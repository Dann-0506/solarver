# Archivo: backend/routes/recordatorios.py
# Rutas para gestión de recordatorios y notificaciones a clientes.

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras
import os
from services.notificaciones_service import enviar_email, enviar_sms

recordatorios_bp = Blueprint('recordatorios', __name__)

# ── GET /api/recordatorios/clientes ───────────────────────
@recordatorios_bp.route('/recordatorios/clientes', methods=['GET'])
def get_clientes_recordatorio():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT c."Id_Cliente", c."Nombre_Completo", c."Correo",
                   c."Telefono", c."Fecha_Pago",
                   d."Saldo_Pendiente", d."Estatus",
                   (d."Monto_Total" / d."Plazo_Meses") AS "Mensualidad"
            FROM   "CLIENTE" c
            JOIN   "DEUDA"   d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE  d."Saldo_Pendiente" > 0
            AND    d."Estatus" IN ('pendiente', 'atrasado')
            ORDER  BY d."Estatus" DESC, c."Nombre_Completo"
        """)
        rows = cursor.fetchall()
        return jsonify({ 'success': True, 'clientes': [dict(r) for r in rows] }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── POST /api/recordatorios/enviar ────────────────────────
@recordatorios_bp.route('/recordatorios/enviar', methods=['POST'])
def enviar_recordatorios():
    data         = request.get_json()
    ids_clientes = data.get('ids_clientes', [])
    id_usuario   = data.get('id_usuario')
    canal        = data.get('canal', 'email').lower()

    email_template = int(os.getenv('BREVO_EMAIL_REC_TEMPLATE_ID', 3))
    
    if not ids_clientes:
        return jsonify({ 'success': False, 'message': 'Selecciona clientes' }), 400

    conn = cursor = None
    enviados = 0
    errores  = []

    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        format_ids = ','.join(['%s'] * len(ids_clientes))
        cursor.execute(f"""
            SELECT c."Id_Cliente", c."Nombre_Completo", c."Correo", c."Telefono",
                   c."Fecha_Pago", d."Saldo_Pendiente",
                   (d."Monto_Total" / d."Plazo_Meses") AS "Mensualidad"
            FROM   "CLIENTE" c
            JOIN   "DEUDA"   d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE  c."Id_Cliente" IN ({format_ids})
        """, ids_clientes)
        clientes = cursor.fetchall()

        for c in clientes:
            exito_api = False
            resumen_log = ""

            try:
                # ── LÓGICA SMS / WHATSAPP ──
                if canal == 'sms' or canal == 'whatsapp':
                    if not c['Telefono']:
                        errores.append(f"{c['Nombre_Completo']} (Sin Teléfono)")
                        continue
                    
                    texto_sms = f"SolarVer: Hola {c['Nombre_Completo']}, tu pago de ${float(c['Saldo_Pendiente']):,.2f} vence el dia {c['Fecha_Pago']}."
                    # LLAMADA AL SERVICIO CENTRALIZADO
                    exito_api, msg_error = enviar_sms(c['Telefono'], texto_sms)
                    if exito_api:
                        resumen_log = f"SMS enviado al {c['Telefono']}"
                    else:
                        errores.append(f"{c['Nombre_Completo']} ({msg_error})")

                # ── LÓGICA EMAIL ──
                else:
                    if not c['Correo']:
                        errores.append(f"{c['Nombre_Completo']} (Sin Correo)")
                        continue

                    params = {
                        "nombre": c['Nombre_Completo'],
                        "pago_minimo": f"${float(c['Mensualidad']):,.2f}", 
                        "dia_pago": str(c['Fecha_Pago'])
                    }
                    # LLAMADA AL SERVICIO CENTRALIZADO
                    exito_api, msg_error = enviar_email(c['Correo'], c['Nombre_Completo'], email_template, params)
                    
                    if exito_api:
                        resumen_log = f"Correo enviado a {c['Correo']}"
                    else:
                        errores.append(f"{c['Nombre_Completo']} ({msg_error})")

                # ── REGISTRO EN DB SI FUE EXITOSO ──
                if exito_api:
                    cursor.execute("""
                        INSERT INTO "RECORDATORIO" ("Id_Cliente","Id_Usuario","Fecha_Envio","Canal","Mensaje","Estado_Envio")
                        VALUES (%s, %s, NOW(), %s, %s, 'enviado')
                    """, (c['Id_Cliente'], id_usuario, canal.upper(), resumen_log))
                    enviados += 1

            except Exception as e:
                errores.append(f"{c['Nombre_Completo']} (Excepción local)")

        conn.commit()
        return jsonify({ 'success': True, 'message': f'Se enviaron {enviados} notificaciones.', 'enviados': enviados, 'errores': errores }), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

# ── GET /api/recordatorios/historial ──────────────────────
@recordatorios_bp.route('/recordatorios/historial', methods=['GET'])
def get_historial_recordatorios():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT r."Id_Recordatorio", r."Canal", r."Mensaje",
                   r."Estado_Envio", r."Fecha_Envio",
                   c."Nombre_Completo" AS "Cliente",
                   u."Nombre"          AS "Usuario"
            FROM   "RECORDATORIO" r
            LEFT JOIN "CLIENTE" c ON c."Id_Cliente" = r."Id_Cliente"
            LEFT JOIN "USUARIO" u ON u."Id_Usuario" = r."Id_Usuario"
            ORDER  BY r."Fecha_Envio" DESC
            LIMIT  20
        """)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            if row.get('Fecha_Envio'):
                row['Fecha_Envio'] = row['Fecha_Envio'].strftime('%d/%m/%Y %H:%M')
            result.append(row)
        return jsonify({ 'success': True, 'recordatorios': result }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── GET /api/historial ─────────────────────────────────────
@recordatorios_bp.route('/historial', methods=['GET'])
def get_historial():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT h."Id_Historial", h."Accion", h."Descripcion", h."Fecha",
                   c."Nombre_Completo" AS "Cliente",
                   u."Nombre"          AS "Usuario"
            FROM   "HISTORIALCAMBIOS" h
            LEFT JOIN "CLIENTE" c ON c."Id_Cliente" = h."Id_Cliente"
            LEFT JOIN "USUARIO" u ON u."Id_Usuario" = h."Id_Usuario"
            ORDER  BY h."Fecha" DESC
            LIMIT  100
        """)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            if row.get('Fecha'):
                row['Fecha'] = row['Fecha'].strftime('%d/%m/%Y %H:%M')
            result.append(row)
        return jsonify({ 'success': True, 'historial': result }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()