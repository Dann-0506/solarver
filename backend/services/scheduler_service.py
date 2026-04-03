#  Archivo: backend/services/scheduler_service.py
#  Servicio específico para tareas programadas (scheduler) como actualización de estatus e intereses.

from db import get_connection
from datetime import datetime, timedelta
from .notificaciones_service import enviar_instrucciones_pago
import random
import string
import psycopg2.extras
import pytz


def actualizar_estatus_deudas(fecha_simulada=None):
    """
    Tarea automática diaria:
    Evalúa el estatus de cada deuda, y aplica un interés moratorio del 5%
    si el cliente se atrasa (máximo una vez por mes).
    """
    tz       = pytz.timezone('America/Mexico_City')
    hoy      = fecha_simulada if fecha_simulada else datetime.now(tz)
    dia_hoy  = hoy.day
    mes_hoy  = hoy.month
    anio_hoy = hoy.year

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. Traemos los datos, incluyendo las nuevas columnas de interés
        cursor.execute("""
            SELECT d."Id_Deuda", d."Saldo_Pendiente", d."Estatus", d."Monto_Total", d."Plazo_Meses",
                   d."Interes_Acumulado", d."Fecha_Ultima_Penalizacion",
                   c."Id_Cliente", c."Fecha_Pago" AS "Dia_Corte"
            FROM   "DEUDA"   d
            JOIN   "CLIENTE" c ON c."Id_Cliente" = d."Id_Cliente"
            WHERE  d."Saldo_Pendiente" > 0
        """)
        deudas = cursor.fetchall()

        actualizados = 0
        for d in deudas:
            dia_corte = int(d['Dia_Corte'])

            # 2. Calcular inicio del periodo
            if dia_corte == 5:
                if dia_hoy >= 5: inicio_periodo = datetime(anio_hoy, mes_hoy, 5, tzinfo=tz)
                else: inicio_periodo = datetime(anio_hoy if mes_hoy > 1 else anio_hoy - 1, mes_hoy - 1 if mes_hoy > 1 else 12, 5, tzinfo=tz)
            else:
                if dia_hoy >= 17: inicio_periodo = datetime(anio_hoy, mes_hoy, 17, tzinfo=tz)
                else: inicio_periodo = datetime(anio_hoy if mes_hoy > 1 else anio_hoy - 1, mes_hoy - 1 if mes_hoy > 1 else 12, 17, tzinfo=tz)

            # 3. Sumar pagos del mes
            cursor.execute("""
                SELECT COALESCE(SUM("Monto"), 0) AS total_pagado
                FROM   "PAGO"
                WHERE  "Id_Deuda" = %s AND "Fecha_Pago" >= %s AND "Estado" = 'completado'
            """, (d['Id_Deuda'], inicio_periodo))
            pagado_mes = float(cursor.fetchone()['total_pagado'])
            mensualidad = float(d['Monto_Total']) / int(d['Plazo_Meses'] or 12)

            # 4. Evaluar el nuevo estatus
            if pagado_mes >= min(mensualidad, float(d['Saldo_Pendiente'])):
                nuevo_estatus = 'pagado'
            elif dia_hoy > dia_corte:
                nuevo_estatus = 'atrasado'
            else:
                nuevo_estatus = 'pendiente'

            # 5. LÓGICA DE INTERÉS MORATORIO
            nuevo_saldo   = float(d['Saldo_Pendiente'])
            nuevo_interes = float(d['Interes_Acumulado'] or 0)
            fecha_penal   = d['Fecha_Ultima_Penalizacion']
            se_penalizo   = False

            if nuevo_estatus == 'atrasado':
                # Validar que no se le haya cobrado ya en este mes y año
                ya_cobrado_este_mes = (fecha_penal and fecha_penal.month == mes_hoy and fecha_penal.year == anio_hoy)
                
                if not ya_cobrado_este_mes:
                    multa = mensualidad * 0.05  # 5% de recargo sobre su cuota
                    nuevo_saldo   += multa
                    nuevo_interes += multa
                    se_penalizo    = True

            # 6. Actualizar si hubo cambio de estatus o si se aplicó multa
            if nuevo_estatus != d['Estatus'] or se_penalizo:
                
                # Si se penalizó, actualizamos la fecha, si no, mantenemos la que tenía
                query_update = """
                    UPDATE "DEUDA"
                    SET "Estatus"=%s, "Saldo_Pendiente"=%s, "Interes_Acumulado"=%s, "Fecha_Ultimo_Corte"=CURRENT_DATE
                """
                params = [nuevo_estatus, nuevo_saldo, nuevo_interes]

                if se_penalizo:
                    query_update += ', "Fecha_Ultima_Penalizacion"=CURRENT_DATE '
                
                query_update += ' WHERE "Id_Deuda"=%s'
                params.append(d['Id_Deuda'])

                cursor.execute(query_update, tuple(params))

                # Registrar en el historial para auditoría
                razon = f'Estatus auto: {d["Estatus"]} → {nuevo_estatus}.'
                if se_penalizo:
                    razon += f' Se aplicó interés moratorio de ${multa:,.2f}.'
                
                cursor.execute("""
                    INSERT INTO "HISTORIALCAMBIOS"
                        ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                    VALUES (%s, NULL, 'ACTUALIZAR_ESTATUS', %s, NOW())
                """, (d['Id_Cliente'], razon))
                actualizados += 1

        conn.commit()
        print(f"Estatus e intereses actualizados: {actualizados} cuentas — {hoy.strftime('%d/%m/%Y %H:%M')}")
        return actualizados

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error actualizando estatus: {e}")
        return 0
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


def procesar_cobros_automaticos():
    """Busca clientes que vencen en 5 días, genera una referencia única y delega el envío de instrucciones."""
    tz = pytz.timezone('America/Mexico_City')
    hoy = datetime.now(tz)
    
    # Calculamos qué día de corte estamos buscando (hoy + 5 días)
    dia_objetivo = (hoy + timedelta(days=5)).day
    if dia_objetivo not in [5, 17]:
        return 0

    conn = cursor = None
    enviados = 0
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Buscamos deudas activas que vencen en el día objetivo
        cursor.execute("""
            SELECT c.*, d."Id_Deuda", d."Saldo_Pendiente", (d."Monto_Total" / d."Plazo_Meses") as "Mensualidad"
            FROM "CLIENTE" c
            JOIN "DEUDA" d ON c."Id_Cliente" = d."Id_Cliente"
            WHERE c."Fecha_Pago" = %s AND d."Saldo_Pendiente" > 0 AND c."Estado" = 'Activo'
        """, (dia_objetivo,))
        
        clientes = cursor.fetchall()
        
        for c in clientes:
            monto_a_cobrar = min(float(c['Mensualidad']), float(c['Saldo_Pendiente']))
            
            # 1. Generar Clave de Referencia Única (Ej: SOL-12-A8F9)
            random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            clave_ref = f"SOL-{c['Id_Deuda']}-{random_str}"
            
            # 2. Guardar la referencia en la base de datos
            cursor.execute("""
                INSERT INTO "REFERENCIAPAGO" ("Id_Deuda", "Clave_Ref", "Monto_Esperado", "Estado")
                VALUES (%s, %s, %s, 'Pendiente')
            """, (c['Id_Deuda'], clave_ref, monto_a_cobrar))
            
            # 3. Empaquetar datos y delegar TODO al servicio de notificaciones
            datos_pago = {
                'Correo': c['Correo'],
                'Nombre_Completo': c['Nombre_Completo'],
                'Monto': monto_a_cobrar,
                'Referencia': clave_ref,
                'Fecha_Limite': (hoy + timedelta(days=5)).strftime('%d/%m/%Y')
            }
            
            enviado = enviar_instrucciones_pago(datos_pago)
            
            if enviado:
                print(f"Referencia enviada con éxito: {clave_ref} para {c['Nombre_Completo']}")
                enviados += 1
            
        conn.commit()
        return enviados
        
    except Exception as e:
        if conn: conn.rollback()
        print(f"Error en cobro automático referenciado: {e}")
        return 0
    finally:
        if cursor: cursor.close()
        if conn: conn.close()