import os
import subprocess
from datetime import datetime
from flask import Blueprint, jsonify, send_file

respaldos_bp = Blueprint('respaldos', __name__)

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')

if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)

@respaldos_bp.route('/respaldos', methods=['GET'])
def listar_respaldos():
    try:
        archivos = []
        for filename in os.listdir(BACKUP_DIR):
            if filename.endswith('.sql'):
                filepath = os.path.join(BACKUP_DIR, filename)
                stat = os.stat(filepath)
                archivos.append({
                    'nombre': filename,
                    'fecha': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'tamano_kb': round(stat.st_size / 1024, 2)
                })

        archivos.sort(key=lambda x: x['fecha'], reverse=True)
        return jsonify({'success': True, 'respaldos': archivos}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos', methods=['POST'])
def crear_respaldo():
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"respaldo_solarver_{timestamp}.sql"
        filepath = os.path.join(BACKUP_DIR, filename)

        comando = [
            'pg_dump', 
            '-U', 'postgres', 
            '-d', 'SolarVer', 
            '--clean',
            '--if-exists',
            '-f', filepath
        ]

        resultado = subprocess.run(comando, capture_output=True, text=True)
        
        if resultado.returncode != 0:
            raise Exception(f"Error de pg_dump: {resultado.stderr}")
            
        return jsonify({'success': True, 'message': 'Respaldo creado con éxito', 'archivo': filename}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos/restaurar/<filename>', methods=['POST'])
def restaurar_respaldo(filename):
    try:
        filepath = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'message': 'El archivo no existe.'}), 404

        comando = [
            'psql', 
            '-U', 'postgres', 
            '-d', 'SolarVer', 
            '-f', filepath
        ]
        
        resultado = subprocess.run(comando, capture_output=True, text=True)
        
        if resultado.returncode != 0:
             raise Exception(f"Error de psql: {resultado.stderr}")

        return jsonify({'success': True, 'message': 'Base de datos restaurada correctamente.'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@respaldos_bp.route('/respaldos/descargar/<filename>', methods=['GET'])
def descargar_respaldo(filename):
    try:
        filepath = os.path.join(BACKUP_DIR, filename)
        return send_file(filepath, as_attachment=True)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500