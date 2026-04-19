import os
import subprocess
import json
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


@respaldos_bp.route('/respaldos', methods=['GET'])
def listar_respaldos():
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
def crear_respaldo():
    data = request.json or {}
    tipo_str = "auto" if data.get('tipo') == 'auto' else "manual"
    
    exito, mensaje, archivo = generar_archivo_respaldo(tipo_str)
    
    if exito:
        return jsonify({'success': True, 'message': mensaje, 'archivo': archivo}), 201
    else:
        return jsonify({'success': False, 'message': mensaje}), 500


@respaldos_bp.route('/respaldos/descargar/<nombre>', methods=['GET'])
def descargar_respaldo(nombre):
    path = os.path.join(BACKUP_DIR, nombre)
    return send_file(path, as_attachment=True)

@respaldos_bp.route('/respaldos/<nombre>', methods=['DELETE'])
def eliminar_respaldo(nombre):
    path = os.path.join(BACKUP_DIR, nombre)
    
    if not os.path.exists(path):
        return jsonify({'success': False, 'message': 'Archivo no encontrado'}), 404
        
    try:
        os.remove(path)
        return jsonify({'success': True, 'message': 'Respaldo eliminado correctamente.'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos/config', methods=['GET', 'POST'])
def config_respaldos():
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