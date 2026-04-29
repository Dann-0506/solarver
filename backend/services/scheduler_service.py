"""Módulo de tareas programadas para Solarver.

Expone las tareas que el scheduler ejecuta periódicamente: actualización
de estatus e intereses moratorios de deudas, generación de referencias de
cobro automático y respaldos programados de la base de datos.
"""
from __future__ import annotations
from db import get_connection
from datetime import datetime, timedelta
from dotenv import load_dotenv
from .notificaciones_service import enviar_instrucciones_pago
from routes.respaldos import generar_archivo_respaldo
import random
import string
import psycopg2.extras
import pytz
import os
import json

load_dotenv()

def actualizar_estatus_deudas(fecha_simulada: datetime | None = None) -> int:
    """Evalúa y actualiza el estatus de todas las deudas activas.

    Tarea automática diaria. Determina si cada deuda está pagada, pendiente
    o atrasada comparando los pagos del periodo con la mensualidad requerida.
    Si el estatus resulta ``'atrasado'`` y aún no se cobró penalización este
    mes, aplica un interés moratorio del 5% sobre la cuota y lo registra en
    el historial de cambios para auditoría.

    Args:
        fecha_simulada: Fecha a usar en lugar de ``datetime.now()``.
            Útil para pruebas o simulaciones de corte. Si es ``None``,
            usa la fecha y hora actuales en zona horaria de México.

    Returns:
        Número de cuentas actualizadas en esta ejecución.
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

            pago_requerido = mensualidad + float(d['Interes_Acumulado'] or 0)

            # 4. Evaluar el nuevo estatus
            if round(pagado_mes, 2) >= round(min(pago_requerido, float(d['Saldo_Pendiente'])), 2):
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
                
                # Si se penalizó actualizamos la fecha; si no, mantenemos la anterior
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


def procesar_cobros_automaticos(fecha_simulada: datetime | None = None) -> int:
    """Genera referencias de cobro y notifica a clientes que vencen en 5 días.

    Solo actúa cuando el día objetivo (hoy + 5) coincide con uno de los días
    de corte válidos del sistema: 5 o 17. Para cada cliente afectado crea
    una referencia única en la tabla ``REFERENCIAPAGO`` y delega el envío del
    PDF de instrucciones al servicio de notificaciones.

    Args:
        fecha_simulada: Fecha a usar en lugar de ``datetime.now()``.
            Útil para pruebas o simulaciones de corte. Si es ``None``,
            usa la fecha y hora actuales en zona horaria de México.

    Returns:
        Número de referencias enviadas exitosamente en esta ejecución.
    """
    tz = pytz.timezone('America/Mexico_City')
    hoy = fecha_simulada if fecha_simulada else datetime.now(tz)
    
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
            else:
                print(f"Error al enviar referencia: {clave_ref} para {c['Nombre_Completo']}")
                conn.rollback()
        
        return enviados
        
    except Exception as e:
        if conn: conn.rollback()
        print(f"Error en cobro automático referenciado: {e}")
        return 0
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


def procesar_respaldos_automaticos() -> None:
    """Genera un respaldo de la base de datos según la configuración de ``config.json``.

    Lee la frecuencia y hora programadas en ``backups/config.json``. Solo
    ejecuta si la hora actual coincide exactamente con la configurada y si no
    existe ya un archivo de respaldo del mismo día. Soporta frecuencias
    ``'diario'``, ``'semanal'`` (domingos) y ``'mensual'`` (día 1 de cada mes).
    """
    base_dir = os.path.dirname(os.path.dirname(__file__))
    backup_dir = os.path.join(base_dir, 'backups')
    config_path = os.path.join(backup_dir, 'config.json')

    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    # Valores por defecto si no existe o falla la lectura del archivo de configuración
    config = {'frecuencia': 'diario', 'hora': '02:00'}
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as file:
                config = json.load(file)
        except:
            pass

    frecuencia = config.get('frecuencia', 'diario')
    hora_config = config.get('hora', '02:00')
    ahora = datetime.now()

    if ahora.strftime('%H:%M') != hora_config:
        return

    if frecuencia == 'semanal' and ahora.weekday() != 6:
        return
    if frecuencia == 'mensual' and ahora.day != 1:
        return

    # Verificar si ya se generó un respaldo hoy para evitar duplicados en el mismo día
    prefijo_hoy = f"solarver_backup_auto_{ahora.strftime('%Y%m%d')}"
    for archivo in os.listdir(backup_dir):
        if archivo.startswith(prefijo_hoy):
            return

    print(f"[{ahora.strftime('%Y-%m-%d %H:%M:%S')}] Notificando al sistema para generar respaldo ({frecuencia})...")
    
    exito, mensaje, archivo = generar_archivo_respaldo('auto')
    
    if exito:
        print(f"El sistema confirmó la creación del respaldo: {archivo}")
    else:
        print(f"El sistema falló al crear el respaldo: {mensaje}")