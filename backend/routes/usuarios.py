"""Rutas para gestión de usuarios y roles.

Expone los endpoints REST para consultar, crear, editar y eliminar
usuarios del sistema, así como para actualizar el perfil y cambiar
la contraseña del usuario autenticado.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify, current_app, Response
from db import get_connection
import psycopg2.extras
import bcrypt
import os
from services.validators_service import validar_correo
from werkzeug.utils import secure_filename

usuarios_bp = Blueprint('usuarios', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}


@usuarios_bp.route('/usuarios', methods=['GET'])
def get_usuarios() -> tuple[Response, int]:
    """Retorna la lista de usuarios del sistema con su rol asignado.

    Returns:
        Tupla (respuesta JSON, 200) con lista de usuarios. Retorna 500
        ante error de base de datos.
    """
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT u."Id_Usuario", u."Nombre", u."Username", u."Correo", 
                   u."Estado", u."Foto_Perfil", r."Nombre_Rol", r."Id_Rol"
            FROM "USUARIO" u
            JOIN "ROL" r ON u."Id_Rol" = r."Id_Rol"
            ORDER BY u."Id_Usuario"
        """)
        usuarios = cursor.fetchall()
        return jsonify({'success': True, 'usuarios': usuarios}), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


@usuarios_bp.route('/roles', methods=['GET'])
def get_roles() -> tuple[Response, int]:
    """Retorna la lista de roles disponibles en el sistema.

    Returns:
        Tupla (respuesta JSON, 200) con lista de roles. Retorna 500 ante
        error de base de datos.
    """
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


@usuarios_bp.route('/usuarios', methods=['POST'])
def crear_usuario() -> tuple[Response, int]:
    """Crea un nuevo usuario con contraseña hasheada en bcrypt.

    Valida formato de correo, verifica unicidad de username y correo, y
    almacena la contraseña hasheada. Nunca guarda contraseñas en texto
    plano.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 201 con el ID del
        usuario creado; 400 si faltan campos o el correo es inválido; 409
        si el username o correo ya existen; 500 ante error de base de datos.
    """
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


@usuarios_bp.route('/usuarios/<int:id_usuario>', methods=['PUT', 'DELETE'])
def gestionar_usuario(id_usuario: int) -> tuple[Response, int]:
    """Edita o elimina un usuario según el método HTTP de la petición.

    DELETE: elimina el usuario si existe.
    PUT: actualiza los datos del usuario; si se envía ``password`` la
    rehashea con bcrypt antes de guardarla.

    Args:
        id_usuario: ID del usuario a gestionar.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 400 si
        faltan campos obligatorios (PUT); 404 si el usuario no existe; 409
        si el nuevo username o correo ya están en uso (PUT); 500 ante error
        de base de datos.
    """
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


def archivo_permitido(filename: str) -> bool:
    """Verifica si la extensión del archivo está en la lista de extensiones permitidas.

    Args:
        filename: Nombre del archivo incluyendo su extensión.

    Returns:
        True si la extensión (en minúsculas) está en ALLOWED_EXTENSIONS;
        False en caso contrario o si el nombre no contiene punto.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@usuarios_bp.route('/usuarios/perfil/<int:id_usuario>', methods=['PUT'])
def actualizar_perfil(id_usuario: int) -> tuple[Response, int]:
    """Actualiza el nombre, username y opcionalmente la foto de perfil.

    Recibe un ``multipart/form-data`` con los campos ``nombre``,
    ``username`` y, de forma opcional, ``foto`` (PNG, JPG o JPEG). La
    imagen se guarda en ``static/uploads/profiles/`` con el nombre
    ``perfil_<id>.ext``.

    Args:
        id_usuario: ID del usuario cuyo perfil se actualiza.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito con los
        datos actualizados; 400 si faltan campos obligatorios; 500 ante
        error de base de datos o de sistema de archivos.
    """
    nombre  = request.form.get('nombre', '').strip()
    username = request.form.get('username', '').strip()
    foto_url = None

    if not nombre or not username:
        return jsonify({ 'success': False, 'message': 'Nombre y username son obligatorios.' }), 400
    
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if 'foto' in request.files:
            file = request.files['foto']
            if file and archivo_permitido(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = secure_filename(f'perfil_{id_usuario}.{ext}')

                upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'profiles')
                if not os.path.exists(upload_folder):
                    os.makedirs(upload_folder)

                path_completo = os.path.join(upload_folder, filename)
                file.save(path_completo)
                foto_url = f'/static/uploads/profiles/{filename}'

        query = 'UPDATE "USUARIO" SET "Nombre"=%s, "Username"=%s'
        params = [nombre, username]

        if foto_url:
            query += ', "Foto_Perfil"=%s'
            params.append(foto_url)

        query += ' WHERE "Id_Usuario"=%s'
        params.append(id_usuario)

        cursor.execute(query, tuple(params))
        conn.commit()
        return jsonify({
            'success': True,
            'message': 'Perfil actualizado correctamente.',
            'usuario': {
                'nombre': nombre,
                'username': username,
                'foto': foto_url
            }
        }), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


@usuarios_bp.route('/usuarios/perfil/<int:id_usuario>/password', methods=['PUT'])
def actualizar_password_perfil(id_usuario: int) -> tuple[Response, int]:
    """Cambia la contraseña del usuario tras verificar la contraseña actual.

    Verifica la contraseña actual con bcrypt. Si la verificación falla por
    ValueError (contraseña sin hash), intenta la comparación en texto plano
    como fallback. La nueva contraseña se almacena siempre hasheada.

    Args:
        id_usuario: ID del usuario que cambia su contraseña.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 400 si
        faltan datos; 401 si la contraseña actual es incorrecta; 404 si el
        usuario no existe; 500 ante error de base de datos.
    """
    # FIXME: el fallback a texto plano en caso de ValueError permite autenticar contraseñas sin hash; migrar a bcrypt puro
    data = request.get_json(silent=True) or {}
    pass_actual = data.get('password_actual')
    pass_nueva = data.get('password_nueva')

    if not pass_actual or not pass_nueva:
        return jsonify({'success': False, 'message': 'Faltan datos requeridos.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute('SELECT "Contrasena" FROM "USUARIO" WHERE "Id_Usuario" = %s', (id_usuario,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado.'}), 404

        contrasena_bd = usuario.get('Contrasena', '')
        es_correcta = False

        try:
            es_correcta = bcrypt.checkpw(pass_actual.encode('utf-8'), contrasena_bd.encode('utf-8'))
        except ValueError:
            if pass_actual == contrasena_bd:
                es_correcta = True

        if not es_correcta:
            return jsonify({'success': False, 'message': 'La contraseña actual es incorrecta.'}), 401

        salt = bcrypt.gensalt()
        hash_nuevo = bcrypt.hashpw(pass_nueva.encode('utf-8'), salt).decode('utf-8')

        cursor.execute(
            'UPDATE "USUARIO" SET "Contrasena" = %s WHERE "Id_Usuario" = %s', 
            (hash_nuevo, id_usuario)
        )
        conn.commit()

        return jsonify({'success': True, 'message': '¡Contraseña actualizada y encriptada con éxito!'}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()