"""Rutas para gestión de clientes.

Expone los endpoints REST para creación, edición, eliminación y
consulta de clientes junto con sus pagos asociados.
"""

from flask import Blueprint, request, jsonify, Response
from db import get_connection
import psycopg2.extras
from services.validators_service import validar_correo, validar_telefono

clientes_bp = Blueprint('clientes', __name__)

@clientes_bp.route('/clientes', methods=['GET'])
def get_clientes() -> tuple[Response, int]:
    """Retorna la lista completa de clientes con su deuda asociada.

    Returns:
        Tupla (respuesta JSON, 200) con la lista de clientes y datos de
        deuda. Retorna 500 ante error de base de datos.
    """
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


@clientes_bp.route('/clientes', methods=['POST'])
def crear_cliente() -> tuple[Response, int]:
    """Registra un nuevo cliente junto con su deuda inicial.

    Lee los datos del cuerpo JSON, valida formato de correo y teléfono,
    verifica unicidad de identificación y crea el cliente con su registro
    de deuda en la misma transacción. Registra el evento en el historial
    si se provee id_usuario.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 201 con el ID del
        cliente creado; 400 si faltan campos obligatorios o los datos son
        inválidos; 409 si ya existe un cliente con esa identificación;
        500 ante error de base de datos.
    """
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


@clientes_bp.route('/clientes/<int:id_cliente>', methods=['PUT'])
def editar_cliente(id_cliente: int) -> tuple[Response, int]:
    """Actualiza los datos editables de un cliente existente.

    La identificación no se puede modificar por regla de negocio (REQDOM-02).
    Registra el evento en el historial si se provee id_usuario.

    Args:
        id_cliente: ID del cliente a actualizar.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 400 si
        faltan campos obligatorios o los datos son inválidos; 500 ante
        error de base de datos.
    """
    data       = request.get_json()
    nombre     = data.get('nombre', '').strip()
    correo     = data.get('correo', '').strip()
    telefono   = data.get('telefono', '').strip()
    direccion  = data.get('direccion', '').strip()
    fecha_pago = data.get('fecha_pago')
    id_usuario = data.get('id_usuario')

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


@clientes_bp.route('/clientes/<int:id_cliente>', methods=['DELETE'])
def eliminar_cliente(id_cliente: int) -> tuple[Response, int]:
    """Elimina un cliente y todos sus datos relacionados.

    Bloquea la eliminación si el cliente tiene saldo pendiente. Realiza
    la cascada de borrado manualmente: historial, recordatorios, pagos,
    deuda y finalmente el cliente.

    Args:
        id_cliente: ID del cliente a eliminar.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 404 si
        el cliente no existe; 409 si tiene saldo pendiente; 500 ante error
        de base de datos.
    """
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT "Nombre_Completo" FROM "CLIENTE" WHERE "Id_Cliente"=%s', (id_cliente,))
        cliente = cursor.fetchone()
        if not cliente:
            return jsonify({ 'success': False, 'message': 'Cliente no encontrado.' }), 404
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


@clientes_bp.route('/clientes/<int:id_cliente>/pagos', methods=['GET'])
def get_pagos_cliente(id_cliente: int) -> tuple[Response, int]:
    """Retorna los últimos 5 pagos de un cliente.

    Args:
        id_cliente: ID del cliente cuyo historial se consulta.

    Returns:
        Tupla (respuesta JSON, 200) con lista de hasta 5 pagos recientes
        con fecha formateada como DD/MM/YYYY. Retorna 500 ante error de
        base de datos.
    """
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