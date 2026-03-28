# ─────────────────────────────────────────
#  SolarVer – Rutas de Pagos
#  Archivo: backend/routes/pagos.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras

pagos_bp = Blueprint('pagos', __name__)

# ── GET /api/pagos ─────────────────────────────────────────
@pagos_bp.route('/pagos', methods=['GET'])
def get_pagos():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT p."Id_Pago", p."Monto", p."Fecha_Pago",
                   p."Metodo_Pago", p."Folio", p."Estado",
                   d."Id_Deuda", d."Saldo_Pendiente", d."Monto_Total",
                   c."Id_Cliente", c."Nombre_Completo", c."Fecha_Pago" AS "Dia_Pago"
            FROM   "PAGO"    p
            JOIN   "DEUDA"   d ON d."Id_Deuda"   = p."Id_Deuda"
            JOIN   "CLIENTE" c ON c."Id_Cliente" = d."Id_Cliente"
            ORDER  BY p."Id_Pago" DESC
            LIMIT  200
        """)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            if row.get('Fecha_Pago'):
                row['Fecha_Pago'] = row['Fecha_Pago'].strftime('%d/%m/%Y %H:%M')
            result.append(row)
        return jsonify({ 'success': True, 'pagos': result }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── GET /api/pagos/siguiente-folio ────────────────────────
@pagos_bp.route('/pagos/siguiente-folio', methods=['GET'])
def siguiente_folio():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Usar la secuencia atómica de PostgreSQL
        cursor.execute("SELECT nextval('folio_seq') AS num")
        num   = cursor.fetchone()['num']
        folio = f'FOL-{num}'
        conn.commit()
        return jsonify({ 'success': True, 'folio': folio }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── POST /api/pagos ────────────────────────────────────────
@pagos_bp.route('/pagos', methods=['POST'])
def registrar_pago():
    data        = request.get_json()
    id_cliente  = data.get('id_cliente')
    monto       = float(data.get('monto', 0))
    fecha_pago  = data.get('fecha_pago')
    metodo_pago = data.get('metodo_pago', '').strip()
    id_usuario  = data.get('id_usuario')

    if not all([id_cliente, monto, fecha_pago, metodo_pago]):
        return jsonify({ 'success': False, 'message': 'Todos los campos son obligatorios.' }), 400
    if monto <= 0:
        return jsonify({ 'success': False, 'message': 'El monto debe ser mayor a $0.' }), 400

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT d."Id_Deuda", d."Saldo_Pendiente", c."Nombre_Completo"
            FROM "DEUDA" d
            JOIN "CLIENTE" c ON c."Id_Cliente" = d."Id_Cliente"
            WHERE d."Id_Cliente" = %s
        """, (id_cliente,))
        deuda = cursor.fetchone()
        if not deuda:
            return jsonify({ 'success': False, 'message': 'No se encontró deuda para este cliente.' }), 404

        saldo_actual = float(deuda['Saldo_Pendiente'])
        advertencia = None
        if monto > saldo_actual:
            advertencia = f'El monto ingresado (${monto:,.2f}) supera el saldo pendiente (${saldo_actual:,.2f}).'

        # Folio atómico
        cursor.execute("SELECT nextval('folio_seq') AS num")
        num   = cursor.fetchone()['num']
        folio = f'FOL-{num}'

        cursor.execute("""
            INSERT INTO "PAGO" ("Id_Deuda","Monto","Fecha_Pago","Metodo_Pago","Folio","Estado")
            VALUES (%s,%s,%s,%s,%s,'completado')
            RETURNING "Id_Pago"
        """, (deuda['Id_Deuda'], monto, fecha_pago, metodo_pago, folio))
        id_pago = cursor.fetchone()['Id_Pago']

        nuevo_saldo   = max(saldo_actual - monto, 0)
        nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
        cursor.execute("""
            UPDATE "DEUDA"
            SET "Saldo_Pendiente"=%s,"Estatus"=%s,"Fecha_Ultimo_Corte"=CURRENT_DATE
            WHERE "Id_Deuda"=%s
        """, (nuevo_saldo, nuevo_estatus, deuda['Id_Deuda']))

        if id_usuario:
            cursor.execute("""
                INSERT INTO "HISTORIALCAMBIOS" ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                VALUES (%s,%s,'REGISTRAR_PAGO',%s,NOW())
            """, (id_cliente, id_usuario, f'Pago de ${monto:,.2f} registrado. Folio: {folio}. Saldo pendiente: ${nuevo_saldo:,.2f}'))

        conn.commit()
        return jsonify({
            'success'       : True,
            'message'       : 'Pago registrado correctamente.',
            'folio'         : folio,
            'id_pago'       : id_pago,
            'nuevo_saldo'   : nuevo_saldo,
            'nuevo_estatus' : nuevo_estatus,
            'advertencia'   : advertencia
        }), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()