import os
import json
import subprocess
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from dotenv import load_dotenv
from db import get_connection
import psycopg2.extras

# Asegurarnos de cargar el .env
load_dotenv()

respaldos_bp = Blueprint('respaldos', __name__)
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')

if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)


# ─── FUNCIONES AUXILIARES DE SEGURIDAD Y EJECUCIÓN ───

def _get_pg_env():
    """Crea un entorno para subprocess inyectando la contraseña de BD de forma segura."""
    env = os.environ.copy()
    db_password = os.getenv("DB_PASSWORD")
    if db_password:
        env['PGPASSWORD'] = db_password
    return env

def es_admin(username):
    """Verifica en la BD si el usuario existe, está activo y es administrador."""
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

def generar_archivo_respaldo(tipo="manual"):
    """Esta función concentra la lógica de pg_dump. Puede ser llamada por la API o por el Scheduler."""
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


# ─── RUTAS DE LA API (PROTEGIDAS) ───

@respaldos_bp.route('/respaldos', methods=['GET'])
def listar_respaldos():
    username = request.headers.get('X-Username')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado.'}), 403

    try:
        archivos = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith('.sql'):
                path = os.path.join(BACKUP_DIR, f)
                stat = os.stat(path)
                
                # Detectar el tipo de respaldo leyendo el nombre del archivo
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
def crear_respaldo():
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
def restaurar_respaldo():
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
def eliminar_respaldo(nombre):
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
def descargar_respaldo(nombre):
    # En peticiones GET de descarga a través del navegador, leemos desde los parámetros URL (?u=...)
    username = request.args.get('u')
    if not es_admin(username):
        return jsonify({'success': False, 'message': 'Acceso denegado. Se requiere rol de Administrador.'}), 403

    path = os.path.join(BACKUP_DIR, nombre)
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    return send_file(path, as_attachment=True)


@respaldos_bp.route('/respaldos/config', methods=['GET', 'POST'])
def config_respaldos():
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