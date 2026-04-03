# ─────────────────────────────────────────
#  SolarVer – Rutas de Recordatorios e Historial
#  Archivo: backend/routes/recordatorios.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras
import os
import requests

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
    # Importante: Si el frontend manda 'whatsapp', lo tratamos como 'sms' para usar la API transaccional
    canal        = data.get('canal', 'email').lower()

    # 1. Carga de variables con valores de respaldo (fallback)
    api_key        = os.getenv('BREVO_API_KEY')
    sender_name    = os.getenv('SMS_SENDER_NAME', 'SolarVer')
    sender_email   = os.getenv('CORREO_REMITENTE', 'proyecto.software.s0l4rver@gmail.com') # <--- ASEGÚRATE QUE ESTE SEA TU CORREO VERIFICADO EN BREVO
    email_template = int(os.getenv('BREVO_EMAIL_REC_TEMPLATE_ID', 3))

    print(f"\n--- INICIO PROCESO DE ENVÍO ({canal.upper()}) ---")
    
    if not api_key:
        return jsonify({ 'success': False, 'message': 'API Key no configurada.' }), 500

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

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key
        }

        for c in clientes:
            print(f"Procesando: {c['Nombre_Completo']}")
            exito_api = False
            resumen_log = ""

            try:
                # ── CANAL SMS / WHATSAPP (API TRANSACCIONAL) ──
                if canal == 'sms' or canal == 'whatsapp':
                    if not c['Telefono']:
                        errores.append(f"{c['Nombre_Completo']} (Sin Teléfono)")
                        continue

                    url = "https://api.brevo.com/v3/transactionalSMS/sms"
                    payload = {
                        "sender": sender_name, # Brevo exige que esto no esté vacío
                        "recipient": str(c['Telefono']),
                        "content": f"SolarVer: Hola {c['Nombre_Completo']}, tu pago de ${float(c['Saldo_Pendiente']):,.2f} vence el dia {c['Fecha_Pago']}.",
                        "type": "transactional"
                    }
                    resp = requests.post(url, json=payload, headers=headers, timeout=10)
                    print(f"DEBUG Brevo SMS: {resp.status_code} - {resp.text}")
                    
                    if resp.status_code in (201, 202):
                        exito_api = True
                        resumen_log = f"SMS enviado al {c['Telefono']}"

                # ── CANAL EMAIL ──
                else:
                    if not c['Correo']:
                        # ...
                        continue

                    url = "https://api.brevo.com/v3/smtp/email"
                    payload = {
                        "sender": {"name": sender_name, "email": sender_email},
                        "to": [{"email": c['Correo'], "name": c['Nombre_Completo']}],
                        "templateId": email_template,
                        "params": {
                            "nombre": c['Nombre_Completo'],
                            "pago_minimo": f"${float(c['Mensualidad']):,.2f}", # ENVIAMOS LA MENSUALIDAD CALCULADA
                            "dia_pago": str(c['Fecha_Pago'])
                        }
                    }
                    resp = requests.post(url, json=payload, headers=headers, timeout=10)
                    print(f"DEBUG Brevo Email: {resp.status_code} - {resp.text}")
                    
                    if resp.status_code in (201, 202):
                        exito_api = True
                        resumen_log = f"Correo enviado a {c['Correo']}"

                if exito_api:
                    cursor.execute("""
                        INSERT INTO "RECORDATORIO" ("Id_Cliente","Id_Usuario","Fecha_Envio","Canal","Mensaje","Estado_Envio")
                        VALUES (%s, %s, NOW(), %s, %s, 'enviado')
                    """, (c['Id_Cliente'], id_usuario, canal.upper(), resumen_log))
                    
                    enviados += 1

            except Exception as e:
                print(f"Error en bucle: {str(e)}")

        conn.commit()
        return jsonify({ 'success': True, 'message': f'Se enviaron {enviados} notificaciones.', 'enviados': enviados }), 200

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