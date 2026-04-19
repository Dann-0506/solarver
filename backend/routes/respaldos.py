import os
import subprocess
from datetime import datetime
from flask import Blueprint, jsonify, send_file, request
from dotenv import load_dotenv

load_dotenv()

respaldos_bp = Blueprint('respaldos', __name__)
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')

if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)

def _get_pg_env():
    """Crea un entorno para subprocess inyectando la contraseña de BD de forma segura."""
    env = os.environ.copy()
    db_password = os.getenv("DB_PASSWORD")
    if db_password:
        env['PGPASSWORD'] = db_password
    return env

@respaldos_bp.route('/respaldos', methods=['GET'])
def listar_respaldos():
    try:
        archivos = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith('.sql'):
                path = os.path.join(BACKUP_DIR, f)
                stat = os.stat(path)
                archivos.append({
                    'nombre': f,
                    'fecha': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'tamano': f"{round(stat.st_size / 1024, 2)} KB"
                })
        archivos.sort(key=lambda x: x['fecha'], reverse=True)
        return jsonify({'success': True, 'respaldos': archivos}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos', methods=['POST'])
def crear_respaldo():
    try:
        nombre = f"solarver_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        path = os.path.join(BACKUP_DIR, nombre)
        
        # Leemos el host, usuario y base de datos de tu .env para que sea 100% dinámico
        host = os.getenv("DB_HOST", "localhost")
        user = os.getenv("DB_USER", "postgres")
        db   = os.getenv("DB_NAME", "SolarVer")
        
        comando = ['pg_dump', '-h', host, '-U', user, '-d', db, '--clean', '-f', path]
        
        # Pasamos el entorno seguro con la contraseña
        resultado = subprocess.run(comando, capture_output=True, text=True, env=_get_pg_env())
        
        if resultado.returncode != 0:
            return jsonify({'success': False, 'message': resultado.stderr}), 500
            
        return jsonify({'success': True, 'message': 'Respaldo generado', 'archivo': nombre}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos/restaurar', methods=['POST'])
def restaurar_respaldo():
    nombre = request.json.get('nombre')
    path = os.path.join(BACKUP_DIR, nombre)
    
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    try:
        host = os.getenv("DB_HOST", "localhost")
        user = os.getenv("DB_USER", "postgres")
        db   = os.getenv("DB_NAME", "SolarVer")
        
        comando = ['psql', '-h', host, '-U', user, '-d', db, '-f', path]
        
        # Pasamos el entorno seguro con la contraseña
        resultado = subprocess.run(comando, capture_output=True, text=True, env=_get_pg_env())
        
        if resultado.returncode != 0:
            return jsonify({'success': False, 'message': resultado.stderr}), 500
            
        return jsonify({'success': True, 'message': 'Base de datos restaurada'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos/descargar/<nombre>', methods=['GET'])
def descargar_respaldo(nombre):
    path = os.path.join(BACKUP_DIR, nombre)
    return send_file(path, as_attachment=True)