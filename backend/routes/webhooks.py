# Archivo: backend/routes/webhooks.py
from flask import Blueprint, request, jsonify
from db import get_connection
import psycopg2.extras

webhooks_bp = Blueprint('webhooks', __name__)

@webhooks_bp.route('/webhooks/banco', methods=['POST'])
def recibir_pago_automatico():
    """
    Simula el webhook del banco o procesador de pagos.
    Espera recibir un JSON con la referencia y el monto depositado.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'message': 'No se recibió ningún JSON.'}), 400

    referencia = data.get('referencia')
    monto_recibido = float(data.get('monto', 0))

    # Validamos que los datos básicos vengan en el JSON
    if not referencia or monto_recibido <= 0:
        return jsonify({'success': False, 'message': 'Datos inválidos. Se requiere referencia y un monto válido.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Buscar si la referencia existe y si está 'Pendiente'
        cursor.execute("""
            SELECT "Id_Referencia", "Id_Deuda", "Monto_Esperado", "Estado" 
            FROM "REFERENCIAPAGO" 
            WHERE "Clave_Ref" = %s AND "Estado" = 'Pendiente'
        """, (referencia,))
        ref_db = cursor.fetchone()

        # Escenario B: Referencia huérfana, inválida o ya procesada
        if not ref_db:
            # 1. Generar un folio especial para identificar rápidamente los pagos huérfanos
            cursor.execute("SELECT nextval('folio_seq') AS num")
            folio = f"FOL-HUERF-{cursor.fetchone()['num']}"

            # 2. Registrar el dinero en el sistema SIN asignarlo a una deuda (Id_Deuda = NULL)
            cursor.execute("""
                INSERT INTO "PAGO" ("Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado", "Referencia_Externa")
                VALUES (NULL, %s, NOW(), 'Transferencia', %s, 'pendiente', %s)
            """, (monto_recibido, folio, referencia))
            
            conn.commit()

            # 3. Le respondemos al banco con un 200 OK para que sepan que registramos el movimiento
            return jsonify({
                'success': True, 
                'message': 'Dinero recibido, pero la referencia no coincide. Guardado como pago huérfano para conciliación manual.'
            }), 200

        # Escenario A: ¡Hace match! Empezamos a procesar el pago
        id_deuda = ref_db['Id_Deuda']

        # 2. Generar folio para el pago
        cursor.execute("SELECT nextval('folio_seq') AS num")
        folio = f"FOL-AUTO-{cursor.fetchone()['num']}"

        # 3. Registrar el pago en la tabla principal
        cursor.execute("""
            INSERT INTO "PAGO" ("Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado", "Referencia_Externa")
            VALUES (%s, %s, NOW(), 'Transferencia', %s, 'completado', %s)
        """, (id_deuda, monto_recibido, folio, referencia))

        # 4. Marcar la referencia como pagada
        cursor.execute("""
            UPDATE "REFERENCIAPAGO" 
            SET "Estado" = 'Pagado_Automatico' 
            WHERE "Id_Referencia" = %s
        """, (ref_db['Id_Referencia'],))

        # 5. Actualizar el saldo de la deuda
        cursor.execute('SELECT "Saldo_Pendiente" FROM "DEUDA" WHERE "Id_Deuda"=%s', (id_deuda,))
        deuda = cursor.fetchone()
        nuevo_saldo = max(float(deuda['Saldo_Pendiente']) - monto_recibido, 0)
        nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
        
        cursor.execute("""
            UPDATE "DEUDA" SET "Saldo_Pendiente"=%s, "Estatus"=%s 
            WHERE "Id_Deuda"=%s
        """, (nuevo_saldo, nuevo_estatus, id_deuda))

        # Confirmamos los cambios en la BD
        conn.commit()
        return jsonify({'success': True, 'message': f'Pago automático registrado exitosamente con folio {folio}.'}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'message': f"Error interno: {str(e)}"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()