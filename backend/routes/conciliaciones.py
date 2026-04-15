# Archivo: backend/routes/conciliaciones.py
# Rutas específicas para conciliaciones manuales de pagos, con validación de referencias y actualización de estatus en la base de datos.

from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras

conciliaciones_bp = Blueprint('conciliaciones', __name__)

@conciliaciones_bp.route('/conciliaciones/pendientes', methods=['GET'])
def get_pendientes():
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT r."Id_Referencia", r."Clave_Ref", r."Monto_Esperado", r."Fecha_Generacion", r."Estado",
                   c."Nombre_Completo", c."Identificacion", d."Saldo_Pendiente"
            FROM "REFERENCIAPAGO" r
            JOIN "DEUDA" d ON r."Id_Deuda" = d."Id_Deuda"
            JOIN "CLIENTE" c ON d."Id_Cliente" = c."Id_Cliente"
            WHERE r."Estado" = 'Pendiente'
            ORDER BY r."Fecha_Generacion" DESC
        """)
        pendientes = cursor.fetchall()
        
        for p in pendientes:
            if p.get('Fecha_Generacion'):
                p['Fecha_Generacion'] = p['Fecha_Generacion'].strftime('%d/%m/%Y %H:%M')
                
        return jsonify({'success': True, 'pendientes': pendientes}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@conciliaciones_bp.route('/conciliaciones/manual/<int:id_referencia>', methods=['POST'])
def conciliar_manual(id_referencia):
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. Validar referencia
        cursor.execute('SELECT * FROM "REFERENCIAPAGO" WHERE "Id_Referencia" = %s AND "Estado" = %s', (id_referencia, 'Pendiente'))
        ref = cursor.fetchone()
        if not ref:
            return jsonify({'success': False, 'message': 'Referencia no encontrada o ya procesada.'}), 404
            
        monto = float(ref['Monto_Esperado'])
        id_deuda = ref['Id_Deuda']

        # 2. Registrar el pago y cambiar estatus
        cursor.execute("SELECT nextval('folio_seq') AS num")
        folio = f"FOL-MAN-{cursor.fetchone()['num']}"

        cursor.execute("""
            INSERT INTO "PAGO" ("Id_Deuda","Monto","Fecha_Pago","Metodo_Pago","Folio","Estado","Referencia_Externa")
            VALUES (%s, %s, NOW(), 'Conciliación', %s, 'completado', %s)
        """, (id_deuda, monto, folio, ref['Clave_Ref']))

        cursor.execute('UPDATE "REFERENCIAPAGO" SET "Estado" = %s WHERE "Id_Referencia" = %s', ('Conciliado_Manual', id_referencia))

        # 3. Actualizar saldo
        cursor.execute('SELECT "Saldo_Pendiente" FROM "DEUDA" WHERE "Id_Deuda"=%s', (id_deuda,))
        deuda = cursor.fetchone()
        nuevo_saldo = max(float(deuda['Saldo_Pendiente']) - monto, 0)
        nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
        
        cursor.execute('UPDATE "DEUDA" SET "Saldo_Pendiente"=%s, "Estatus"=%s WHERE "Id_Deuda"=%s', (nuevo_saldo, nuevo_estatus, id_deuda))

        conn.commit()
        return jsonify({'success': True, 'message': 'Pago conciliado manualmente con éxito.'}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()