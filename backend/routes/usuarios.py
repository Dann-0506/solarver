# ─────────────────────────────────────────
#  SolarVer – Rutas de Usuarios
#  Archivo: backend/routes/usuarios.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras
import bcrypt
from services.validators_service import validar_correo

usuarios_bp = Blueprint('usuarios', __name__)

# ── GET /api/usuarios ──────────────────────────────────────
@usuarios_bp.route('/usuarios', methods=['GET'])
def get_usuarios():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT u."Id_Usuario", u."Nombre", u."Username", u."Correo",
                   u."Estado", r."Nombre_Rol", r."Id_Rol"
            FROM   "USUARIO" u
            JOIN   "ROL"     r ON u."Id_Rol" = r."Id_Rol"
            ORDER  BY u."Id_Usuario"
        """)
        usuarios = cursor.fetchall()
        return jsonify({ 'success': True, 'usuarios': [dict(u) for u in usuarios] }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── GET /api/roles ─────────────────────────────────────────
@usuarios_bp.route('/roles', methods=['GET'])
def get_roles():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT "Id_Rol", "Nombre_Rol" FROM "ROL" ORDER BY "Id_Rol"')
        roles = cursor.fetchall()
        return jsonify({ 'success': True, 'roles': [dict(r) for r in roles] }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── POST /api/usuarios ─────────────────────────────────────
@usuarios_bp.route('/usuarios', methods=['POST'])
def crear_usuario():
    data     = request.get_json()
    nombre   = data.get('nombre', '').strip()
    username = data.get('username', '').strip()
    correo   = data.get('correo', '').strip()
    password = data.get('password', '').strip()
    id_rol   = data.get('id_rol')

    if not all([nombre, username, correo, password, id_rol]):
        return jsonify({ 'success': False, 'message': 'Todos los campos son obligatorios.' }), 400

    es_valido, msj_correo = validar_correo(correo)
    if not es_valido:
        return jsonify({ 'success': False, 'message': msj_correo }), 400
    
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT 1 FROM "USUARIO" WHERE "Username" = %s', (username,))
        if cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'El nombre de usuario ya existe.' }), 409
        cursor.execute('SELECT 1 FROM "USUARIO" WHERE "Correo" = %s', (correo,))
        if cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'El correo electrónico ya está registrado.' }), 409
        cursor.execute("""
            INSERT INTO "USUARIO" ("Nombre", "Username", "Correo", "Contrasena", "Id_Rol", "Estado")
            VALUES (%s, %s, %s, %s, %s, TRUE)
            RETURNING "Id_Usuario"
        """, (nombre, username, correo, hashed, id_rol))
        nuevo_id = cursor.fetchone()['Id_Usuario']
        conn.commit()
        return jsonify({ 'success': True, 'message': 'Usuario creado correctamente.', 'id': nuevo_id }), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ── PUT /api/usuarios/<id>  y  DELETE /api/usuarios/<id> ──
@usuarios_bp.route('/usuarios/<int:id_usuario>', methods=['PUT', 'DELETE'])
def gestionar_usuario(id_usuario):
    if request.method == 'DELETE':
        conn = cursor = None
        try:
            conn   = get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute('SELECT "Nombre", "Username" FROM "USUARIO" WHERE "Id_Usuario" = %s', (id_usuario,))
            usuario = cursor.fetchone()
            if not usuario:
                return jsonify({ 'success': False, 'message': 'Usuario no encontrado.' }), 404
            cursor.execute('DELETE FROM "USUARIO" WHERE "Id_Usuario" = %s', (id_usuario,))
            conn.commit()
            return jsonify({ 'success': True, 'message': 'Usuario eliminado correctamente.' }), 200
        except Exception as e:
            if conn: conn.rollback()
            return jsonify({ 'success': False, 'message': str(e) }), 500
        finally:
            if cursor: cursor.close()
            if conn:   conn.close()

    # PUT
    data     = request.get_json()
    nombre   = data.get('nombre', '').strip()
    username = data.get('username', '').strip()
    correo   = data.get('correo', '').strip()
    id_rol   = data.get('id_rol')
    password = data.get('password', '').strip()

    if not all([nombre, username, correo, id_rol]):
        return jsonify({ 'success': False, 'message': 'Todos los campos son obligatorios.' }), 400
    
    es_valido, msj_correo = validar_correo(correo)
    if not es_valido:
        return jsonify({ 'success': False, 'message': msj_correo }), 400

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT 1 FROM "USUARIO" WHERE "Id_Usuario" = %s', (id_usuario,))
        if not cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'Usuario no encontrado.' }), 404
        cursor.execute('SELECT 1 FROM "USUARIO" WHERE "Username" = %s AND "Id_Usuario" != %s', (username, id_usuario))
        if cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'El nombre de usuario ya está en uso.' }), 409
        cursor.execute('SELECT 1 FROM "USUARIO" WHERE "Correo" = %s AND "Id_Usuario" != %s', (correo, id_usuario))
        if cursor.fetchone():
            return jsonify({ 'success': False, 'message': 'El correo ya está registrado.' }), 409
        if password:
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("""
                UPDATE "USUARIO" SET "Nombre"=%s,"Username"=%s,"Correo"=%s,"Id_Rol"=%s,"Contrasena"=%s
                WHERE "Id_Usuario"=%s
            """, (nombre, username, correo, id_rol, hashed, id_usuario))
        else:
            cursor.execute("""
                UPDATE "USUARIO" SET "Nombre"=%s,"Username"=%s,"Correo"=%s,"Id_Rol"=%s
                WHERE "Id_Usuario"=%s
            """, (nombre, username, correo, id_rol, id_usuario))
        conn.commit()
        return jsonify({ 'success': True, 'message': 'Usuario actualizado correctamente.' }), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()