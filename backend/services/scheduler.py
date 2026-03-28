# ─────────────────────────────────────────
#  SolarVer – Servicio de actualización automática de estatus
#  Archivo: backend/services/scheduler.py
# ─────────────────────────────────────────

from db import get_connection
from datetime import datetime
import psycopg2.extras
import pytz


def actualizar_estatus_deudas():
    """
    Tarea automática diaria:
    Evalúa el estatus de cada deuda con saldo > 0 según la fecha de corte (5 o 17).
    """
    tz       = pytz.timezone('America/Mexico_City')
    hoy      = datetime.now(tz)
    dia_hoy  = hoy.day
    mes_hoy  = hoy.month
    anio_hoy = hoy.year

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT d."Id_Deuda", d."Saldo_Pendiente", d."Estatus",
                   c."Id_Cliente", c."Fecha_Pago" AS "Dia_Corte"
            FROM   "DEUDA"   d
            JOIN   "CLIENTE" c ON c."Id_Cliente" = d."Id_Cliente"
            WHERE  d."Saldo_Pendiente" > 0
        """)
        deudas = cursor.fetchall()

        actualizados = 0
        for d in deudas:
            dia_corte = int(d['Dia_Corte'])

            # Calcular inicio del periodo actual
            if dia_corte == 5:
                if dia_hoy >= 5:
                    inicio_periodo = datetime(anio_hoy, mes_hoy, 5, tzinfo=tz)
                else:
                    mes_ant  = mes_hoy - 1 if mes_hoy > 1 else 12
                    anio_ant = anio_hoy if mes_hoy > 1 else anio_hoy - 1
                    inicio_periodo = datetime(anio_ant, mes_ant, 5, tzinfo=tz)
            else:
                if dia_hoy >= 17:
                    inicio_periodo = datetime(anio_hoy, mes_hoy, 17, tzinfo=tz)
                else:
                    mes_ant  = mes_hoy - 1 if mes_hoy > 1 else 12
                    anio_ant = anio_hoy if mes_hoy > 1 else anio_hoy - 1
                    inicio_periodo = datetime(anio_ant, mes_ant, 17, tzinfo=tz)

            cursor.execute("""
                SELECT COUNT(*) AS "cnt"
                FROM   "PAGO"
                WHERE  "Id_Deuda" = %s
                AND    "Fecha_Pago" >= %s
                AND    "Estado" = 'completado'
            """, (d['Id_Deuda'], inicio_periodo))
            pagos_periodo = cursor.fetchone()['cnt']

            if pagos_periodo > 0:
                nuevo_estatus = 'pagado'
            elif dia_hoy > dia_corte:
                nuevo_estatus = 'atrasado'
            else:
                nuevo_estatus = 'pendiente'

            if nuevo_estatus != d['Estatus']:
                cursor.execute("""
                    UPDATE "DEUDA"
                    SET    "Estatus"=%s, "Fecha_Ultimo_Corte"=CURRENT_DATE
                    WHERE  "Id_Deuda"=%s
                """, (nuevo_estatus, d['Id_Deuda']))
                cursor.execute("""
                    INSERT INTO "HISTORIALCAMBIOS"
                        ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                    VALUES (%s, NULL, 'ACTUALIZAR_ESTATUS', %s, NOW())
                """, (d['Id_Cliente'], f'Estatus actualizado automáticamente: {d["Estatus"]} → {nuevo_estatus}'))
                actualizados += 1

        conn.commit()
        print(f"✅ Estatus actualizados: {actualizados} deudas — {hoy.strftime('%d/%m/%Y %H:%M')}")
        return actualizados

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ Error actualizando estatus: {e}")
        return 0
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()