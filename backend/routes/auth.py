"""Rutas de autenticación de usuarios y manejo de sesiones.

Expone los endpoints REST para inicio de sesión y verificación de estado
de sesiones activas. Implementa bloqueo temporal por intentos fallidos y
verificación de contraseñas con bcrypt.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify, Response
from db import get_connection
from datetime import datetime, timedelta
import psycopg2.extras
import bcrypt

auth_bp = Blueprint('auth', __name__)

# NOTE: usuarios_eliminados vive solo en memoria; se vacía al reiniciar el servidor
usuarios_eliminados: set[str] = set()
MAX_INTENTOS: int         = 3
TIEMPO_BLOQUEO: timedelta = timedelta(minutes=5)

@auth_bp.route('/login', methods=['POST'])
def login() -> tuple[Response, int]:
    """Autentica a un usuario con sus credenciales.

    Lee username y contraseña del cuerpo JSON, verifica el estado de la
    cuenta y aplica la lógica de bloqueo por intentos fallidos. En caso
    de éxito retorna los datos del usuario y la ruta de redirección según
    su rol.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito con datos
        del usuario y ruta de redirección; 400 si faltan credenciales; 401
        si son incorrectas; 403 si la cuenta está inactiva o bloqueada;
        500 ante error inesperado del servidor.
    """
    data     = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({ 'success': False, 'message': 'Usuario y contraseña son obligatorios.' }), 400

    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT u."Id_Usuario", u."Nombre", u."Username", u."Contrasena",
                   u."Estado", u."Intentos_Fallidos", u."Fecha_Bloqueo", u."Foto_Perfil", r."Nombre_Rol"
            FROM   "USUARIO" u
            JOIN   "ROL"     r ON u."Id_Rol" = r."Id_Rol"
            WHERE  u."Username" = %s
        """, (username,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({ 'success': False, 'message': 'Usuario o contraseña incorrectos.' }), 401

        if not usuario['Estado']:
            return jsonify({ 'success': False, 'message': 'Tu cuenta está inactiva. Contacta al administrador.' }), 403

        if usuario['Fecha_Bloqueo']:
            tiempo_restante = usuario['Fecha_Bloqueo'] - datetime.now()
            if tiempo_restante.total_seconds() > 0:
                minutos = int(tiempo_restante.total_seconds() // 60) + 1
                return jsonify({ 'success': False, 'message': f'Cuenta bloqueada. Intenta en {minutos} minuto(s).' }), 403
            else:
                cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=0, "Fecha_Bloqueo"=NULL WHERE "Username"=%s', (username,))
                conn.commit()

        contrasena_bd = usuario['Contrasena']
        es_valida     = False

        if contrasena_bd.startswith('$2b$') or contrasena_bd.startswith('$2a$'):
            es_valida = bcrypt.checkpw(password.encode('utf-8'), contrasena_bd.encode('utf-8'))
        else:
            # FIXME: comparación en texto plano expone contraseñas sin hash; migrar todas las cuentas a bcrypt
            es_valida = (password == contrasena_bd)

        if not es_valida:
            nuevos_intentos = usuario['Intentos_Fallidos'] + 1
            if nuevos_intentos >= MAX_INTENTOS:
                fecha_bloqueo = datetime.now() + TIEMPO_BLOQUEO
                cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=%s, "Fecha_Bloqueo"=%s WHERE "Username"=%s', (nuevos_intentos, fecha_bloqueo, username))
                conn.commit()
                return jsonify({ 'success': False, 'message': 'Demasiados intentos fallidos. Cuenta bloqueada por 5 minutos.' }), 403
            else:
                cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=%s WHERE "Username"=%s', (nuevos_intentos, username))
                conn.commit()
                restantes = MAX_INTENTOS - nuevos_intentos
                return jsonify({ 'success': False, 'message': f'Contraseña incorrecta. Te quedan {restantes} intento(s).' }), 401

        nombre_rol = usuario['Nombre_Rol'].lower()
        cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=0, "Fecha_Bloqueo"=NULL WHERE "Username"=%s', (username,))
        conn.commit()

        redirect = '/pages/admin.html' if 'admin' in nombre_rol else '/pages/empleado.html'
        print(f"Login: {username} → {redirect}")

        return jsonify({
            'success' : True,
            'message' : f'Bienvenido, {usuario["Nombre"]}.',
            'usuario' : {
                'id'      : usuario['Id_Usuario'],
                'nombre'  : usuario['Nombre'],
                'username': usuario['Username'],
                'rol'     : usuario['Nombre_Rol'],
                'foto'    : usuario['Foto_Perfil']
            },
            'redirect': redirect
        }), 200

    except Exception as e:
        print(f"Error login: {e}")
        return jsonify({ 'success': False, 'message': f'Error del servidor: {str(e)}' }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

@auth_bp.route('/session/check', methods=['POST'])
def check_session() -> tuple[Response, int]:
    """Verifica si la sesión de un usuario sigue siendo válida.

    Comprueba si el username recibido está en el conjunto en memoria de
    usuarios eliminados. Si lo está, lo descarta del conjunto y señala la
    sesión como inválida; en caso contrario la confirma como válida.
    Siempre retorna HTTP 200 independientemente del resultado.

    Returns:
        Tupla (respuesta JSON, 200) con el campo ``valid`` (bool) y,
        cuando la cuenta fue eliminada, un mensaje de error.
    """
    data     = request.get_json()
    username = data.get('username', '').strip()
    if username in usuarios_eliminados:
        usuarios_eliminados.discard(username)
        return jsonify({ 'valid': False, 'message': 'Tu cuenta ha sido eliminada.' }), 200
    return jsonify({ 'valid': True }), 200