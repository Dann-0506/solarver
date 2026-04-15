# ─────────────────────────────────────────
#  SolarVer – Backend Principal (Flask)
#  Archivo: backend/app.py
# ─────────────────────────────────────────

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

app = Flask(__name__)

CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# ── Blueprints ─────────────────────────────────────────────
app.register_blueprint(auth_bp,             url_prefix='/api')
app.register_blueprint(usuarios_bp,         url_prefix='/api')
app.register_blueprint(clientes_bp,         url_prefix='/api')
app.register_blueprint(pagos_bp,            url_prefix='/api')
app.register_blueprint(recordatorios_bp,    url_prefix='/api')
app.register_blueprint(reportes_bp,         url_prefix='/api')
app.register_blueprint(conciliaciones_bp,   url_prefix='/api')
app.register_blueprint(webhooks_bp,         url_prefix='/api')

# ── Health check ───────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({ 'status': 'ok', 'message': 'Servidor SolarVer funcionando.' }), 200

# ── Inicio ─────────────────────────────────────────────────
if __name__ == '__main__':
    print("Iniciando servidor SolarVer...")
    print("API en: http://localhost:5000")

    from services.scheduler_service import actualizar_estatus_deudas, procesar_cobros_automaticos
    scheduler = BackgroundScheduler(timezone=pytz.timezone('America/Mexico_City'))
    scheduler.add_job(
        actualizar_estatus_deudas,
        trigger='cron',
        hour=8, minute=0,
        id='actualizar_estatus_diario'
    )

    scheduler.add_job(
        procesar_cobros_automaticos,
        trigger='cron',
        hour=9, minute=0,
        id='enviar_referencias_diario'
    )
    
    scheduler.start()
    print("Scheduler activo — actualización a las 08:00 AM y referencias a las 09:00 AM")

    actualizar_estatus_deudas()

    app.run(debug=True, port=5000, use_reloader=False)