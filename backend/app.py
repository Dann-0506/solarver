"""Entry point del backend Flask de Solarver.

Configura la aplicación, habilita CORS para el frontend, registra todos
los blueprints de la API REST bajo el prefijo /api, y arranca el
scheduler de tareas periódicas cuando el archivo se ejecuta directamente.
"""

from flask import Flask, jsonify
from flask_cors import CORS
import pytz
from apscheduler.schedulers.background import BackgroundScheduler

from routes.auth            import auth_bp
from routes.usuarios        import usuarios_bp
from routes.clientes        import clientes_bp
from routes.pagos           import pagos_bp
from routes.recordatorios   import recordatorios_bp
from routes.reportes        import reportes_bp
from routes.conciliaciones  import conciliaciones_bp
from routes.webhooks        import webhooks_bp
from routes.respaldos       import respaldos_bp

app = Flask(__name__)

# Restringe el tamaño de archivos subidos para evitar consumo excesivo de memoria
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# Permite peticiones del frontend en desarrollo sin restricción de origen;
# X-Username es el header personalizado que identifica al usuario autenticado
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Username"]
}})


app.register_blueprint(auth_bp,             url_prefix='/api')
app.register_blueprint(usuarios_bp,         url_prefix='/api')
app.register_blueprint(clientes_bp,         url_prefix='/api')
app.register_blueprint(pagos_bp,            url_prefix='/api')
app.register_blueprint(recordatorios_bp,    url_prefix='/api')
app.register_blueprint(reportes_bp,         url_prefix='/api')
app.register_blueprint(conciliaciones_bp,   url_prefix='/api')
app.register_blueprint(webhooks_bp,         url_prefix='/api')
app.register_blueprint(respaldos_bp,        url_prefix='/api')


@app.route('/api/health', methods=['GET'])
def health_check() -> tuple:
    """Verifica que el servidor está activo y responde correctamente.

    Returns:
        Tupla con la respuesta JSON de estado y el código HTTP 200.
    """
    return jsonify({ 'status': 'ok', 'message': 'Servidor SolarVer funcionando.' }), 200


if __name__ == '__main__':
    print("Iniciando servidor SolarVer...")
    print("API en: http://localhost:5000")

    from services.scheduler_service import actualizar_estatus_deudas, procesar_cobros_automaticos, procesar_respaldos_automaticos

    # Se usa la zona horaria de México para que los cron coincidan con el horario local
    scheduler = BackgroundScheduler(timezone=pytz.timezone('America/Mexico_City'))

    # 08:00 AM — actualiza estados de deuda antes del horario hábil
    scheduler.add_job(
        actualizar_estatus_deudas,
        trigger='cron',
        hour=8, minute=0,
        id='actualizar_estatus_diario'
    )

    # 09:00 AM — envía referencias de cobro al inicio de la jornada
    scheduler.add_job(
        procesar_cobros_automaticos,
        trigger='cron',
        hour=9, minute=0,
        id='enviar_referencias_diario'
    )

    # Cada minuto — genera respaldos según la configuración interna del servicio
    scheduler.add_job(
        procesar_respaldos_automaticos,
        trigger='cron',
        minute='*',
        id='generar_respaldos_automaticos'
    )

    scheduler.start()
    print("Scheduler activo — actualización a las 08:00 AM y referencias a las 09:00 AM")

    # Ejecuta la actualización de estatus al arrancar para no esperar al día siguiente
    actualizar_estatus_deudas()

    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)