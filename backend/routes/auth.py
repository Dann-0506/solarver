# ─────────────────────────────────────────
#  SolarVer – Rutas de Autenticación
#  Archivo: backend/routes/auth.py
# ─────────────────────────────────────────

from flask import Blueprint, request, jsonify
from db import get_connection
from datetime import datetime, timedelta
import psycopg2.extras
import bcrypt

# Crear el Blueprint para autenticación
auth_bp = Blueprint('auth', __name__)

# Variables globales del módulo
usuarios_eliminados = set()
MAX_INTENTOS   = 3
TIEMPO_BLOQUEO = timedelta(minutes=5)

@auth_bp.route('/login', methods=['POST'])
def login():
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
                   u."Estado", u."Intentos_Fallidos", u."Fecha_Bloqueo", r."Nombre_Rol"
            FROM   "USUARIO" u
            JOIN   "ROL"     r ON u."Id_Rol" = r."Id_Rol"
            WHERE  u."Username" = %s
        """, (username,))
        usuario = cursor.fetchone()

        if not usuario:
            return jsonify({ 'success': False, 'message': 'Usuario o contraseña incorrectos.' }), 401

        if not usuario['Estado']:
            return jsonify({ 'success': False, 'message': 'Tu cuenta está inactiva. Contacta al administrador.' }), 403

        # ── Verificar bloqueo ──
        if usuario['Fecha_Bloqueo']:
            tiempo_restante = usuario['Fecha_Bloqueo'] - datetime.now()
            if tiempo_restante.total_seconds() > 0:
                minutos = int(tiempo_restante.total_seconds() // 60) + 1
                return jsonify({ 'success': False, 'message': f'Cuenta bloqueada. Intenta en {minutos} minuto(s).' }), 403
            else:
                cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=0, "Fecha_Bloqueo"=NULL WHERE "Username"=%s', (username,))
                conn.commit()

        # ── Verificar contraseña ──
        contrasena_bd = usuario['Contrasena']
        es_valida     = False

        if contrasena_bd.startswith('$2b$') or contrasena_bd.startswith('$2a$'):
            es_valida = bcrypt.checkpw(password.encode('utf-8'), contrasena_bd.encode('utf-8'))
        else:
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

        # ── Login exitoso ──
        nombre_rol = usuario['Nombre_Rol'].lower()
        cursor.execute('UPDATE "USUARIO" SET "Intentos_Fallidos"=0, "Fecha_Bloqueo"=NULL WHERE "Username"=%s', (username,))
        conn.commit()

        redirect = 'admin.html' if 'admin' in nombre_rol else 'empleado.html'
        print(f"Login: {username} → {redirect}")

        return jsonify({
            'success' : True,
            'message' : f'Bienvenido, {usuario["Nombre"]}.',
            'usuario' : {
                'id'      : usuario['Id_Usuario'],
                'nombre'  : usuario['Nombre'],
                'username': usuario['Username'],
                'rol'     : usuario['Nombre_Rol'],
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
def check_session():
    data     = request.get_json()
    username = data.get('username', '').strip()
    if username in usuarios_eliminados:
        usuarios_eliminados.discard(username)
        return jsonify({ 'valid': False, 'message': 'Tu cuenta ha sido eliminada.' }), 200
    return jsonify({ 'valid': True }), 200