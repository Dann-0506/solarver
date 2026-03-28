# ─────────────────────────────────────────
#  SolarVer – Rutas de Recordatorios e Historial
#  Archivo: backend/routes/recordatorios.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras
import os
import urllib.request
import json as json_lib

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
                   d."Saldo_Pendiente", d."Estatus"
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

    if not ids_clientes:
        return jsonify({ 'success': False, 'message': 'Selecciona al menos un cliente.' }), 400

    resend_api_key = os.getenv('RESEND_API_KEY', '')
    resend_from    = os.getenv('RESEND_FROM', '')

    if not resend_api_key:
        return jsonify({ 'success': False, 'message': 'Configura RESEND_API_KEY en el archivo .env' }), 500

    conn = cursor = None
    enviados = 0
    errores  = []

    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        format_ids = ','.join(['%s'] * len(ids_clientes))
        cursor.execute(f"""
            SELECT c."Id_Cliente", c."Nombre_Completo", c."Correo",
                   c."Fecha_Pago", d."Saldo_Pendiente", d."Estatus"
            FROM   "CLIENTE" c
            JOIN   "DEUDA"   d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE  c."Id_Cliente" IN ({format_ids})
        """, ids_clientes)
        clientes = cursor.fetchall()

        for c in clientes:
            if not c['Correo']:
                errores.append(f"{c['Nombre_Completo']} (sin correo registrado)")
                continue
            try:
                saldo    = float(c['Saldo_Pendiente'])
                dia_pago = c['Fecha_Pago']
                cuerpo_html = f"""
                <html><body style="font-family:Arial,sans-serif;color:#333;max-width:500px;margin:0 auto">
                  <div style="background:#1E85C8;padding:20px;border-radius:8px 8px 0 0;text-align:center">
                    <h2 style="color:white;margin:0">SolarVer</h2>
                    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0">Paneles Solares Veracruz</p>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #eee">
                    <p>Hola <strong>{c['Nombre_Completo']}</strong>,</p>
                    <p>Te recordamos que tienes un saldo pendiente de pago:</p>
                    <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;text-align:center;border:1px solid #eee">
                      <div style="font-size:2rem;font-weight:700;color:#E74C3C">${saldo:,.2f}</div>
                      <div style="color:#666;font-size:.9rem">Fecha limite: Dia {dia_pago} de cada mes</div>
                    </div>
                    <p>Para cualquier aclaracion, contactanos.</p>
                    <p style="color:#999;font-size:.8rem;margin-top:24px">— Equipo SolarVer Veracruz</p>
                  </div>
                </body></html>"""

                payload = json_lib.dumps({
                    "from"   : resend_from,
                    "to"     : [c['Correo']],
                    "subject": "Recordatorio de pago — SolarVer Veracruz",
                    "html"   : cuerpo_html
                }).encode('utf-8')

                req = urllib.request.Request(
                    'https://api.resend.com/emails',
                    data=payload,
                    headers={ 'Authorization': f'Bearer {resend_api_key}', 'Content-Type': 'application/json' },
                    method='POST'
                )
                with urllib.request.urlopen(req) as resp:
                    resp_data = json_lib.loads(resp.read().decode())

                cursor.execute("""
                    INSERT INTO "RECORDATORIO"
                        ("Id_Cliente","Id_Usuario","Fecha_Envio","Canal","Mensaje","Estado_Envio")
                    VALUES (%s,%s,NOW(),'Correo',%s,'enviado')
                """, (c['Id_Cliente'], id_usuario, f"Recordatorio enviado a {c['Correo']}. Saldo: ${saldo:,.2f}. Dia de pago: {dia_pago}."))

                cursor.execute("""
                    INSERT INTO "HISTORIALCAMBIOS"
                        ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                    VALUES (%s,%s,'RECORDATORIO_CORREO',%s,NOW())
                """, (c['Id_Cliente'], id_usuario, f"Recordatorio por correo enviado a {c['Correo']}. Saldo pendiente: ${saldo:,.2f}"))

                enviados += 1

            except urllib.error.HTTPError as ex:
                errores.append(f"{c['Nombre_Completo']}: {ex.read().decode()}")
            except Exception as ex:
                errores.append(f"{c['Nombre_Completo']}: {str(ex)}")

        conn.commit()
        msg_resp = f"{enviados} correo(s) enviado(s) correctamente."
        if errores:
            msg_resp += f" Errores: {', '.join(errores)}"
        return jsonify({ 'success': True, 'message': msg_resp, 'enviados': enviados, 'errores': errores }), 200

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