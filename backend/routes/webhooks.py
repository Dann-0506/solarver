"""Rutas para recepción de webhooks de pagos automáticos.

Expone el endpoint de entrada para notificaciones del banco o procesador
de pagos. Maneja tanto referencias válidas (pago automático) como
referencias huérfanas o inválidas (pago sin asignar para conciliación
manual).
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify, Response
from db import get_connection
import psycopg2.extras

webhooks_bp = Blueprint('webhooks', __name__)


@webhooks_bp.route('/webhooks/banco', methods=['POST'])
def recibir_pago_automatico() -> tuple[Response, int]:
    """Procesa una notificación de pago recibida del banco o procesador.

    Espera un JSON con los campos ``referencia`` (clave única generada
    previamente) y ``monto`` (monto depositado). Si la referencia existe
    y está pendiente, registra el pago automáticamente con folio
    ``FOL-AUTO-N`` y actualiza la deuda. Si la referencia es inválida o
    ya fue procesada, guarda el dinero como pago huérfano con folio
    ``FOL-HUERF-N`` para su conciliación manual posterior.

    Returns:
        Tupla (respuesta JSON, 200) en ambos escenarios (válido y
        huérfano) para que el banco confirme la recepción. Retorna 400 si
        faltan datos; 500 ante error de base de datos.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'message': 'No se recibió ningún JSON.'}), 400

    referencia = data.get('referencia')
    monto_recibido = float(data.get('monto', 0))

    if not referencia or monto_recibido <= 0:
        return jsonify({'success': False, 'message': 'Datos inválidos. Se requiere referencia y un monto válido.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT "Id_Referencia", "Id_Deuda", "Monto_Esperado", "Estado"
            FROM "REFERENCIAPAGO"
            WHERE "Clave_Ref" = %s AND "Estado" = 'Pendiente'
        """, (referencia,))
        ref_db = cursor.fetchone()

        if not ref_db:
            cursor.execute("SELECT nextval('folio_seq') AS num")
            folio = f"FOL-HUERF-{cursor.fetchone()['num']}"

            cursor.execute("""
                INSERT INTO "PAGO" ("Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado", "Referencia_Externa")
                VALUES (NULL, %s, NOW(), 'Transferencia', %s, 'pendiente', %s)
            """, (monto_recibido, folio, referencia))
            
            conn.commit()

            return jsonify({
                'success': True, 
                'message': 'Dinero recibido, pero la referencia no coincide. Guardado como pago huérfano para conciliación manual.'
            }), 200

        id_deuda = ref_db['Id_Deuda']

        cursor.execute("SELECT nextval('folio_seq') AS num")
        folio = f"FOL-AUTO-{cursor.fetchone()['num']}"

        cursor.execute("""
            INSERT INTO "PAGO" ("Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado", "Referencia_Externa")
            VALUES (%s, %s, NOW(), 'Transferencia', %s, 'completado', %s)
        """, (id_deuda, monto_recibido, folio, referencia))

        cursor.execute("""
            UPDATE "REFERENCIAPAGO"
            SET "Estado" = 'Pagado_Automatico'
            WHERE "Id_Referencia" = %s
        """, (ref_db['Id_Referencia'],))

        cursor.execute('SELECT "Saldo_Pendiente" FROM "DEUDA" WHERE "Id_Deuda"=%s', (id_deuda,))
        deuda = cursor.fetchone()
        nuevo_saldo = max(float(deuda['Saldo_Pendiente']) - monto_recibido, 0)
        nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
        
        cursor.execute("""
            UPDATE "DEUDA" SET "Saldo_Pendiente"=%s, "Estatus"=%s 
            WHERE "Id_Deuda"=%s
        """, (nuevo_saldo, nuevo_estatus, id_deuda))

        conn.commit()
        return jsonify({'success': True, 'message': f'Pago automático registrado exitosamente con folio {folio}.'}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'message': f"Error interno: {str(e)}"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()