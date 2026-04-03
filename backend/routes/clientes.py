# ─────────────────────────────────────────
#  SolarVer – Rutas de Clientes
#  Archivo: backend/routes/clientes.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras
from utils.validators import validar_correo, validar_telefono

clientes_bp = Blueprint('clientes', __name__)

# ── GET /api/clientes ──────────────────────────────────────
@clientes_bp.route('/clientes', methods=['GET'])
def get_clientes():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT c."Id_Cliente", c."Nombre_Completo", c."Identificacion",
                   c."Correo", c."Telefono", c."Direccion",
                   c."Fecha_Pago", c."Estado",
                   d."Id_Deuda", d."Monto_Total", d."Saldo_Pendiente", d."Estatus", d."Plazo_Meses", d."Interes_Acumulado"
            FROM   "CLIENTE" c
            LEFT JOIN "DEUDA" d ON d."Id_Cliente" = c."Id_Cliente"
            ORDER  BY c."Id_Cliente" DESC
        """)
        clientes = cursor.fetchall()
        return jsonify({ 'success': True, 'clientes': [dict(c) for c in clientes] }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── POST /api/clientes ─────────────────────────────────────
@clientes_bp.route('/clientes', methods=['POST'])
def crear_cliente():
    data           = request.get_json()
    nombre         = data.get('nombre', '').strip()
    identificacion = data.get('identificacion', '').strip().upper()
    correo         = data.get('correo', '').strip()
    telefono       = data.get('telefono', '').strip()
    direccion      = data.get('direccion', '').strip()
    fecha_pago     = data.get('fecha_pago')
    deuda_inicial  = data.get('deuda_inicial', 0)
    plazo_meses    = data.get('plazo_meses', 12)
    id_usuario     = data.get('id_usuario')
    
    if not all([nombre, identificacion, fecha_pago]):
        return jsonify({ 'success': False, 'message': 'Nombre, identificación y fecha de pago son obligatorios.' }), 400
    
    if int(fecha_pago) not in (5, 17):
        return jsonify({ 'success': False, 'message': 'La fecha de pago debe ser 5 o 17.' }), 400
    
    if correo:
        valido, msj = validar_correo(correo)
        if not valido:
            return jsonify({ 'success': False, 'message': f'Error en correo: {msj}' }), 400
        correo = msj

    if telefono:
        valido, msj = validar_telefono(telefono)
        if not valido:
            return jsonify({ 'success': False, 'message': f'Error en teléfono: {msj}' }), 400
        telefono = msj

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT 1 FROM "CLIENTE" WHERE "Identificacion" = %s', (identificacion,))
        if cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'Ya existe un cliente con esa identificación.' }), 409
        cursor.execute("""
            INSERT INTO "CLIENTE" ("Nombre_Completo","Identificacion","Correo","Telefono","Direccion","Fecha_Pago","Estado")
            VALUES (%s,%s,%s,%s,%s,%s,'Activo')
            RETURNING "Id_Cliente"
        """, (nombre, identificacion, correo or None, telefono or None, direccion or None, int(fecha_pago)))
        nuevo_id = cursor.fetchone()['Id_Cliente']
        monto = float(deuda_inicial) if deuda_inicial else 0.0
        cursor.execute("""
            INSERT INTO "DEUDA" ("Id_Cliente","Monto_Total","Saldo_Pendiente","Estatus","Fecha_Ultimo_Corte","Plazo_Meses")
            VALUES (%s,%s,%s,'pendiente',CURRENT_DATE,%s)
        """, (nuevo_id, monto, monto, plazo_meses))
        if id_usuario:
            cursor.execute("""
                INSERT INTO "HISTORIALCAMBIOS" ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                VALUES (%s,%s,'CREAR_CLIENTE',%s,NOW())
            """, (nuevo_id, id_usuario, f'Cliente {nombre} registrado con identificación {identificacion}'))
        conn.commit()
        return jsonify({ 'success': True, 'message': 'Cliente registrado correctamente.', 'id': nuevo_id }), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── PUT /api/clientes/<id> ─────────────────────────────────
@clientes_bp.route('/clientes/<int:id_cliente>', methods=['PUT'])
def editar_cliente(id_cliente):
    data       = request.get_json()
    nombre     = data.get('nombre', '').strip()
    correo     = data.get('correo', '').strip()
    telefono   = data.get('telefono', '').strip()
    direccion  = data.get('direccion', '').strip()
    fecha_pago = data.get('fecha_pago')
    id_usuario = data.get('id_usuario')
    # identificacion NO se acepta en edición (REQDOM-02)

    if not all([nombre, fecha_pago]):
        return jsonify({ 'success': False, 'message': 'Nombre y fecha de pago son obligatorios.' }), 400

    if correo:
        valido, msj = validar_correo(correo)
        if not valido:
            return jsonify({ 'success': False, 'message': f'Error en correo: {msj}' }), 400
        correo = msj

    if telefono:
        valido, msj = validar_telefono(telefono)
        if not valido:
            return jsonify({ 'success': False, 'message': f'Error en teléfono: {msj}' }), 400
        telefono = msj
        
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            UPDATE "CLIENTE"
            SET "Nombre_Completo"=%s,"Correo"=%s,"Telefono"=%s,"Direccion"=%s,"Fecha_Pago"=%s
            WHERE "Id_Cliente"=%s
        """, (nombre, correo or None, telefono or None, direccion or None, int(fecha_pago), id_cliente))
        if id_usuario:
            cursor.execute("""
                INSERT INTO "HISTORIALCAMBIOS" ("Id_Cliente","Id_Usuario","Accion","Descripcion","Fecha")
                VALUES (%s,%s,'EDITAR_CLIENTE',%s,NOW())
            """, (id_cliente, id_usuario, f'Cliente actualizado: {nombre}'))
        conn.commit()
        return jsonify({ 'success': True, 'message': 'Cliente actualizado correctamente.' }), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── DELETE /api/clientes/<id> ──────────────────────────────
@clientes_bp.route('/clientes/<int:id_cliente>', methods=['DELETE'])
def eliminar_cliente(id_cliente):
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT "Nombre_Completo" FROM "CLIENTE" WHERE "Id_Cliente"=%s', (id_cliente,))
        cliente = cursor.fetchone()
        if not cliente:
            return jsonify({ 'success': False, 'message': 'Cliente no encontrado.' }), 404
        # Verificar si tiene saldo pendiente
        cursor.execute('SELECT "Saldo_Pendiente" FROM "DEUDA" WHERE "Id_Cliente"=%s', (id_cliente,))
        deuda = cursor.fetchone()
        if deuda and float(deuda['Saldo_Pendiente']) > 0:
            return jsonify({ 'success': False, 'message': 'No se puede eliminar un cliente con adeudo pendiente.' }), 409
        # Cascada manual
        cursor.execute('DELETE FROM "HISTORIALCAMBIOS" WHERE "Id_Cliente"=%s', (id_cliente,))
        cursor.execute('DELETE FROM "RECORDATORIO"     WHERE "Id_Cliente"=%s', (id_cliente,))
        cursor.execute("""
            DELETE FROM "PAGO" WHERE "Id_Deuda" IN (
                SELECT "Id_Deuda" FROM "DEUDA" WHERE "Id_Cliente"=%s
            )
        """, (id_cliente,))
        cursor.execute('DELETE FROM "DEUDA"   WHERE "Id_Cliente"=%s', (id_cliente,))
        cursor.execute('DELETE FROM "CLIENTE" WHERE "Id_Cliente"=%s', (id_cliente,))
        conn.commit()
        return jsonify({ 'success': True, 'message': 'Cliente eliminado correctamente.' }), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── GET /api/clientes/<id>/pagos ───────────────────────────
@clientes_bp.route('/clientes/<int:id_cliente>/pagos', methods=['GET'])
def get_pagos_cliente(id_cliente):
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT p."Id_Pago", p."Monto", p."Fecha_Pago",
                   p."Metodo_Pago", p."Folio", p."Estado"
            FROM   "PAGO"  p
            JOIN   "DEUDA" d ON p."Id_Deuda" = d."Id_Deuda"
            WHERE  d."Id_Cliente" = %s
            ORDER  BY p."Id_Pago" DESC
            LIMIT  5
        """, (id_cliente,))
        pagos = cursor.fetchall()
        result = []
        for p in pagos:
            row = dict(p)
            if row.get('Fecha_Pago'):
                row['Fecha_Pago'] = row['Fecha_Pago'].strftime('%d/%m/%Y')
            result.append(row)
        return jsonify({ 'success': True, 'pagos': result }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()