"""Rutas para generación y envío de reportes.

Expone los endpoints REST para consultar el estado mensual de clientes,
exportar reportes en PDF o Excel y disparar el envío masivo de estados
de cuenta por correo electrónico.
"""

from flask import Blueprint, jsonify, request, send_file, Response, Request
from db import get_connection
import psycopg2.extras
from services.notificaciones_service import iniciar_envio_masivo
from services.documentos_service import generar_excel_reporte, generar_pdf_reporte
from datetime import datetime, timedelta

reportes_bp = Blueprint('reportes', __name__)


def procesar_rango_fechas(request: Request) -> tuple[datetime, datetime]:
    """Extrae y normaliza el rango de fechas de los parámetros de la petición.

    Si no se proporcionan los parámetros ``inicio`` y ``fin``, el rango
    por defecto es los últimos 30 días hasta ahora. La fecha de fin se
    ajusta al último segundo del día para incluir todos los registros.

    Args:
        request: Objeto Request de Flask con los parámetros de la URL.

    Returns:
        Tupla (inicio_dt, fin_dt) como objetos datetime.
    """
    inicio_str = request.args.get('inicio')
    fin_str = request.args.get('fin')

    if not inicio_str or not fin_str:
        fin_dt = datetime.now()
        inicio_dt = fin_dt - timedelta(days=30)
    else:
        inicio_dt = datetime.strptime(inicio_str, '%Y-%m-%d')
        fin_dt = datetime.strptime(fin_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
    
    return inicio_dt, fin_dt


@reportes_bp.route('/reportes/estado-mensual', methods=['GET'])
def get_estado_mensual() -> tuple[Response, int]:
    """Retorna el estado de pago mensual de clientes con saldo pendiente.

    Separa los clientes en dos grupos: los que ya pagaron en el periodo
    actual ('pagado') y los que aún no ('faltan').

    Returns:
        Tupla (respuesta JSON, 200) con las claves ``pagaron`` y ``faltan``.
        Retorna 500 ante error de base de datos.
    """
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT c."Nombre_Completo", c."Identificacion", c."Fecha_Pago", 
                   c."Telefono", c."Correo",
                   d."Monto_Total", d."Saldo_Pendiente", d."Estatus", d."Plazo_Meses", d."Interes_Acumulado"
            FROM "CLIENTE" c
            JOIN "DEUDA" d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE d."Saldo_Pendiente" > 0
        """)
        clientes = cursor.fetchall()
        return jsonify({
            'success': True,
            'pagaron': [c for c in clientes if c['Estatus'] == 'pagado'],
            'faltan': [c for c in clientes if c['Estatus'] != 'pagado']
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@reportes_bp.route('/reportes/ingresos-mensuales', methods=['GET'])
def get_ingresos_mensuales() -> tuple[Response, int]:
    """Retorna los pagos completados dentro del rango de fechas indicado.

    Acepta los parámetros de URL ``inicio`` y ``fin`` (formato YYYY-MM-DD).
    Si se omiten, usa los últimos 30 días.

    Returns:
        Tupla (respuesta JSON, 200) con lista de pagos y fecha formateada
        como DD/MM/YYYY HH:MM. Retorna 500 ante error de base de datos.
    """
    inicio, fin = procesar_rango_fechas(request)

    conn = cursor = None
    
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT p."Folio", c."Nombre_Completo", c."Telefono", c."Correo",
                   p."Monto", p."Metodo_Pago", p."Fecha_Pago"
            FROM "PAGO" p
            JOIN "DEUDA" d ON p."Id_Deuda" = d."Id_Deuda"
            JOIN "CLIENTE" c ON d."Id_Cliente" = c."Id_Cliente"
            WHERE p."Estado" = 'completado' 
              AND p."Fecha_Pago" BETWEEN %s AND %s
            ORDER BY p."Fecha_Pago" DESC
        """, (inicio, fin))
        pagos = cursor.fetchall()
        for p in pagos:
            if p.get('Fecha_Pago'):
                p['Fecha_Pago'] = p['Fecha_Pago'].strftime('%d/%m/%Y %H:%M')
        return jsonify({'success': True, 'pagos': pagos}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@reportes_bp.route('/reportes/exportar', methods=['GET'])
def exportar_reporte() -> Response | tuple[Response, int]:
    """Genera y descarga un reporte en PDF o Excel.

    Acepta los parámetros de URL ``tipo`` (``integral``, ``realizados``,
    ``pendiente``, ``atrasado``) y ``formato`` (``pdf`` o ``excel``).
    La generación del documento se delega al servicio de documentos.

    Returns:
        Respuesta con el archivo adjunto para descarga en caso de éxito.
        Retorna tupla (respuesta JSON, 500) ante error de base de datos.
    """
    tipo = request.args.get('tipo', 'integral')
    formato = request.args.get('formato', 'pdf')

    inicio, fin = procesar_rango_fechas(request)
    
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if tipo == 'realizados':
            cursor.execute("""
                SELECT p."Folio", c."Nombre_Completo" AS "Cliente", 
                       c."Telefono", c."Correo",
                       p."Monto", p."Metodo_Pago", p."Fecha_Pago"
                FROM "PAGO" p
                JOIN "DEUDA" d ON p."Id_Deuda" = d."Id_Deuda"
                JOIN "CLIENTE" c ON d."Id_Cliente" = c."Id_Cliente"
                WHERE p."Estado" = 'completado'
                  AND p."Fecha_Pago" BETWEEN %s AND %s
                ORDER BY p."Fecha_Pago" DESC
            """, (inicio, fin))
            datos = cursor.fetchall()
            for d in datos:
                if d.get('Fecha_Pago'):
                    d['Fecha_Pago'] = d['Fecha_Pago'].strftime('%d/%m/%Y %H:%M')
        else:
            query = """
                SELECT c."Nombre_Completo" as "Cliente", c."Identificacion" as "ID", 
                       c."Telefono", c."Correo",
                       c."Fecha_Pago" as "Dia_Pago", d."Saldo_Pendiente", 
                       d."Interes_Acumulado", d."Estatus"
                FROM "CLIENTE" c
                JOIN "DEUDA" d ON d."Id_Cliente" = c."Id_Cliente"
                WHERE d."Saldo_Pendiente" > 0
            """
            if tipo == 'pendiente': query += " AND d.\"Estatus\" = 'pendiente'"
            elif tipo == 'atrasado': query += " AND d.\"Estatus\" = 'atrasado'"
            
            cursor.execute(query)
            datos = cursor.fetchall()

        if formato == 'excel':
            output = generar_excel_reporte(datos)
            return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             as_attachment=True, download_name=f"Reporte_{tipo}.xlsx")
        else:
            output = generar_pdf_reporte(datos, tipo)
            return send_file(output, mimetype='application/pdf', as_attachment=True, download_name=f"Reporte_{tipo}.pdf")

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@reportes_bp.route('/reportes/enviar-masivo', methods=['POST'])
def enviar_estados_cuenta() -> tuple[Response, int]:
    """Dispara el envío masivo de estados de cuenta por correo electrónico.

    Solo aplica a clientes con deuda activa y correo registrado. El tipo
    'realizados' no es válido para este endpoint. El envío se delega al
    servicio de notificaciones de forma asíncrona; la respuesta es
    inmediata (HTTP 202).

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 202 en éxito con el
        conteo de correos a enviar; 400 si el tipo es 'realizados'; 404 si
        ningún cliente del segmento tiene correo; 500 ante error de base de
        datos.
    """
    data = request.get_json()
    tipo = data.get('tipo', 'integral') 
    
    if tipo == 'realizados':
        return jsonify({'success': False, 'message': 'Solo se pueden enviar estados de cuenta a clientes con deuda activa.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        query = """
            SELECT c."Nombre_Completo" as "Cliente", c."Correo",
                   c."Fecha_Pago" as "Dia_Pago", d."Saldo_Pendiente", d."Estatus"
            FROM "CLIENTE" c
            JOIN "DEUDA" d ON d."Id_Cliente" = c."Id_Cliente"
            WHERE d."Saldo_Pendiente" > 0 AND c."Correo" IS NOT NULL
        """
        
        if tipo == 'pendiente': query += " AND d.\"Estatus\" = 'pendiente'"
        elif tipo == 'atrasado': query += " AND d.\"Estatus\" = 'atrasado'"
        
        cursor.execute(query)
        clientes = cursor.fetchall()

        if not clientes:
            return jsonify({'success': False, 'message': 'Ningún cliente en esta categoría tiene correo registrado.'}), 404

        iniciar_envio_masivo(clientes)

        return jsonify({
            'success': True, 
            'message': f'Generando y enviando estados de cuenta adjuntos a {len(clientes)} clientes. Puedes seguir trabajando.'
        }), 202

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()