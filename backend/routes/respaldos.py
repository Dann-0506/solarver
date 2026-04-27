"""Rutas para gestión de respaldos de la base de datos.

Expone los endpoints REST para listar, crear, restaurar, eliminar y
descargar respaldos SQL, así como para gestionar la configuración de
respaldos automáticos. Todos los endpoints están protegidos y solo
accesibles para usuarios con rol de administrador.
"""

from __future__ import annotations

import os
import json
import subprocess
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file, Response
from dotenv import load_dotenv
from db import get_connection
import psycopg2.extras

# Garantiza que las variables de entorno estén disponibles en el módulo
load_dotenv()

respaldos_bp = Blueprint('respaldos', __name__)
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')

if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)


def _get_pg_env() -> dict[str, str]:
    """Crea un entorno para subprocess con la contraseña de BD inyectada.

    Inyecta ``PGPASSWORD`` en una copia del entorno actual para que
    ``pg_dump`` y ``psql`` no soliciten la contraseña de forma interactiva.

    Returns:
        Copia del entorno del proceso con ``PGPASSWORD`` configurado si
        la variable ``DB_PASSWORD`` está definida.
    """
    env = os.environ.copy()
    db_password = os.getenv("DB_PASSWORD")
    if db_password:
        env['PGPASSWORD'] = db_password
    return env


def es_admin(username: str | None) -> bool:
    """Verifica en la BD si el usuario existe, está activo y tiene rol de administrador.

    Args:
        username: Nombre de usuario a verificar. Retorna False si es None
            o vacío.

    Returns:
        True si el usuario existe, está activo y su rol contiene 'admin';
        False en cualquier otro caso, incluyendo errores de base de datos.
    """
    if not username:
        return False
    
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT r."Nombre_Rol" 
            FROM "USUARIO" u 
            JOIN "ROL" r ON u."Id_Rol" = r."Id_Rol" 
            WHERE u."Username" = %s AND u."Estado" = TRUE
        """, (username,))
        usuario = cursor.fetchone()
        
        if usuario and 'admin' in usuario['Nombre_Rol'].lower():
            return True
        return False
    except Exception:
        return False
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

def generar_archivo_respaldo(tipo: str = "manual") -> tuple[bool, str, str | None]:
    """Ejecuta pg_dump y guarda el resultado en el directorio de respaldos.

    El nombre del archivo incluye el tipo y una marca de tiempo para
    facilitar la identificación. Puede ser invocada tanto por la API como
    por el scheduler de respaldos automáticos.

    Args:
        tipo: Sufijo que identifica el origen del respaldo. Valores
            típicos: ``"manual"`` o ``"auto"``.

    Returns:
        Tupla (éxito, mensaje, nombre_archivo). Si falla, nombre_archivo
        es None y mensaje contiene el stderr de pg_dump o la descripción
        del error.
    """
    try:
        nombre = f"solarver_backup_{tipo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        path = os.path.join(BACKUP_DIR, nombre)
        
        host = os.getenv("DB_HOST", "localhost")
        user = os.getenv("DB_USER", "postgres")
        db   = os.getenv("DB_NAME", "SolarVer")
        
        comando = ['pg_dump', '-h', host, '-U', user, '-d', db, '--clean', '-f', path]
        resultado = subprocess.run(comando, capture_output=True, text=True, env=_get_pg_env())
        
        if resultado.returncode != 0:
            return False, resultado.stderr, None
            
        return True, "Respaldo generado", nombre
    except Exception as e:
        return False, str(e), None


@respaldos_bp.route('/respaldos', methods=['GET'])
def listar_respaldos() -> tuple[Response, int]:
    """Lista los archivos de respaldo disponibles en el directorio de backups.

    El tipo ('Automático' o 'Manual') se infiere del nombre del archivo.
    Solo accesible para administradores (header X-Username).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 con lista de
        respaldos ordenada por fecha descendente; 403 si el usuario no es
        administrador; 500 ante error de sistema de archivos.
    """
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    try:
        archivos = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith('.sql'):
                path = os.path.join(BACKUP_DIR, f)
                stat = os.stat(path)
                
                tipo = "Automático" if "_auto_" in f else "Manual"
                
                archivos.append({
                    'nombre': f,
                    'tipo': tipo,
                    'fecha': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'tamano': f"{round(stat.st_size / 1024, 2)} KB"
                })
        archivos.sort(key=lambda x: x['fecha'], reverse=True)
        return jsonify({'success': True, 'respaldos': archivos}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@respaldos_bp.route('/respaldos', methods=['POST'])
def crear_respaldo() -> tuple[Response, int]:
    """Genera un nuevo respaldo de la base de datos.

    Acepta el campo JSON ``tipo`` (``'auto'`` o cualquier otro valor para
    manual). Solo accesible para administradores (header X-Username).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 201 con el nombre del
        archivo generado; 403 si el usuario no es administrador; 500 si
        pg_dump falla.
    """
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    data = request.json or {}
    tipo_str = "auto" if data.get('tipo') == 'auto' else "manual"
    
    exito, mensaje, archivo = generar_archivo_respaldo(tipo_str)
    
    if exito:
        return jsonify({'success': True, 'message': mensaje, 'archivo': archivo}), 201
    else:
        return jsonify({'success': False, 'message': mensaje}), 500


@respaldos_bp.route('/respaldos/restaurar', methods=['POST'])
def restaurar_respaldo() -> tuple[Response, int]:
    """Restaura la base de datos desde un archivo de respaldo existente.

    Ejecuta psql con el archivo indicado en el campo JSON ``nombre``.
    Solo accesible para administradores (header X-Username).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 403 si
        el usuario no es administrador; 404 si el archivo no existe; 500
        si psql falla.
    """
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    nombre = request.json.get('nombre')
    path = os.path.join(BACKUP_DIR, nombre)
    
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    try:
        host = os.getenv("DB_HOST", "localhost")
        user = os.getenv("DB_USER", "postgres")
        db   = os.getenv("DB_NAME", "SolarVer")
        
        comando = ['psql', '-h', host, '-U', user, '-d', db, '-f', path]
        resultado = subprocess.run(comando, capture_output=True, text=True, env=_get_pg_env())
        
        if resultado.returncode != 0:
            return jsonify({'success': False, 'message': resultado.stderr}), 500
            
        return jsonify({'success': True, 'message': 'Base de datos restaurada'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@respaldos_bp.route('/respaldos/<nombre>', methods=['DELETE'])
def eliminar_respaldo(nombre: str) -> tuple[Response, int]:
    """Elimina un archivo de respaldo del sistema de archivos.

    Args:
        nombre: Nombre del archivo a eliminar (sin ruta).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 403 si
        el usuario no es administrador; 404 si el archivo no existe; 500
        ante error de sistema de archivos.
    """
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    path = os.path.join(BACKUP_DIR, nombre)
    
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    try:
        os.remove(path)
        return jsonify({'success': True, 'message': 'Respaldo eliminado correctamente.'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@respaldos_bp.route('/respaldos/descargar/<nombre>', methods=['GET'])
def descargar_respaldo(nombre: str) -> Response | tuple[Response, int]:
    """Descarga un archivo de respaldo como adjunto.

    La autenticación se lee del parámetro URL ``?u=`` en lugar del header
    porque las descargas GET desde el navegador no permiten headers personalizados.

    Args:
        nombre: Nombre del archivo a descargar (sin ruta).

    Returns:
        Respuesta con el archivo adjunto en caso de éxito. Retorna tupla
        (respuesta JSON, 403) si no es administrador; (respuesta JSON, 404)
        si el archivo no existe.
    """
    # Autenticación vía parámetro URL porque las descargas GET del navegador no envían headers
    username = request.args.get('u')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado. Se requiere rol de Administrador.'}), 403

    path = os.path.join(BACKUP_DIR, nombre)
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    return send_file(path, as_attachment=True)


@respaldos_bp.route('/respaldos/config', methods=['GET', 'POST'])
def config_respaldos() -> tuple[Response, int]:
    """Lee o guarda la configuración de respaldos automáticos.

    GET retorna la configuración actual desde ``config.json`` en el
    directorio de backups, o los valores por defecto si el archivo no
    existe. POST sobreescribe el archivo con el JSON recibido.
    Solo accesible para administradores (header X-Username).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 403 si
        el usuario no es administrador.
    """
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    config_path = os.path.join(BACKUP_DIR, 'config.json')
    
    if request.method == 'GET':
        if os.path.exists(config_path):
            with open(config_path, 'r') as file:
                return jsonify({'success': True, 'config': json.load(file)}), 200
        return jsonify({'success': True, 'config': {'frecuencia': 'diario', 'hora': '02:00'}}), 200
        
    if request.method == 'POST':
        data = request.json
        with open(config_path, 'w') as file:
            json.dump(data, file)
        return jsonify({'success': True, 'message': 'Configuración guardada.'}), 200