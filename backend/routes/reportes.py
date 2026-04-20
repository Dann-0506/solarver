# Archivo: backend/routes/reportes.py
# Rutas para generación de reportes y envío masivo de estados de cuenta.

from flask import Blueprint, jsonify, request, send_file
from db import get_connection
import psycopg2.extras
from services.notificaciones_service import iniciar_envio_masivo
from services.documentos_service import generar_excel_reporte, generar_pdf_reporte
from datetime import datetime, timedelta

reportes_bp = Blueprint('reportes', __name__)

def procesar_rango_fechas(request):
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
def get_estado_mensual():
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
def get_ingresos_mensuales():
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
              AND p."Fecha_Pago" >= CURRENT_DATE - INTERVAL '1 month'
            ORDER BY p."Fecha_Pago" DESC
        """)
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
def exportar_reporte():
    tipo = request.args.get('tipo', 'integral')
    formato = request.args.get('formato', 'pdf')
    
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if tipo == 'realizados':
            # Exportación de pagos restringida al ÚLTIMO MES
            cursor.execute("""
                SELECT p."Folio", c."Nombre_Completo" AS "Cliente", 
                       c."Telefono", c."Correo",
                       p."Monto", p."Metodo_Pago", p."Fecha_Pago"
                FROM "PAGO" p
                JOIN "DEUDA" d ON p."Id_Deuda" = d."Id_Deuda"
                JOIN "CLIENTE" c ON d."Id_Cliente" = c."Id_Cliente"
                WHERE p."Estado" = 'completado'
                  AND p."Fecha_Pago" >= CURRENT_DATE - INTERVAL '1 month'
                ORDER BY p."Fecha_Pago" DESC
            """)
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

        # ── DELEGACIÓN DE LA CREACIÓN DEL DOCUMENTO AL SERVICIO ──
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
def enviar_estados_cuenta():
    data = request.get_json()
    tipo = data.get('tipo', 'integral') 
    
    if tipo == 'realizados':
        return jsonify({'success': False, 'message': 'Solo se pueden enviar estados de cuenta a clientes con deuda activa.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Filtramos solo a los que tienen Correo configurado
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