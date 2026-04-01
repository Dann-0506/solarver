from flask import Blueprint, jsonify
from db import get_connection
import psycopg2.extras

reportes_bp = Blueprint('reportes', __name__)

@reportes_bp.route('/reportes/estado-mensual', methods=['GET'])
def get_estado_mensual():
    conn = cursor = None
    try:
        conn   = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Traer clientes con saldo pendiente
        cursor.execute("""
            SELECT c."Id_Cliente", c."Nombre_Completo", c."Identificacion",
                   c."Fecha_Pago", d."Monto_Total", d."Saldo_Pendiente", 
                   d."Estatus", d."Plazo_Meses"
            FROM "CLIENTE" c
            JOIN "DEUDA" d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE d."Saldo_Pendiente" > 0
        """)
        clientes = cursor.fetchall()

        pagaron = []
        faltan = []

        for c in clientes:
            # El scheduler asigna 'pagado' si ya se registró pago en su periodo
            if c['Estatus'] == 'pagado':
                pagaron.append(dict(c))
            else:
                faltan.append(dict(c))

        return jsonify({
            'success': True,
            'pagaron': pagaron,
            'faltan': faltan
        }), 200
    except Exception as e:
        return jsonify({ 'success': False, 'message': str(e) }), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()