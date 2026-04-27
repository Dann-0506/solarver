"""Rutas para conciliación manual de pagos.

Expone los endpoints REST para consultar referencias pendientes de
conciliación y procesarlas de forma individual o masiva.
"""

from flask import Blueprint, request, jsonify, Response
from db import get_connection
import psycopg2.extras

conciliaciones_bp = Blueprint('conciliaciones', __name__)


@conciliaciones_bp.route('/conciliaciones/pendientes', methods=['GET'])
def get_pendientes() -> tuple[Response, int]:
    """Retorna las referencias de pago con estatus 'Pendiente'.

    Returns:
        Tupla (respuesta JSON, 200) con lista de referencias pendientes
        enriquecidas con datos del cliente y saldo de deuda. La fecha de
        generación se formatea como DD/MM/YYYY HH:MM. Retorna 500 ante
        error de base de datos.
    """
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
def conciliar_manual(id_referencia: int) -> tuple[Response, int]:
    """Concilia manualmente una referencia de pago pendiente.

    Valida que la referencia exista y esté pendiente, registra el pago
    con folio ``FOL-MAN-N``, marca la referencia como ``Conciliado_Manual``
    y actualiza el saldo de la deuda.

    Args:
        id_referencia: ID de la referencia a conciliar.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 en éxito; 404 si
        la referencia no existe o ya fue procesada; 500 ante error de
        base de datos.
    """
    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('SELECT * FROM "REFERENCIAPAGO" WHERE "Id_Referencia" = %s AND "Estado" = %s', (id_referencia, 'Pendiente'))
        ref = cursor.fetchone()
        if not ref:
            return jsonify({'success': False, 'message': 'Referencia no encontrada o ya procesada.'}), 404
            
        monto = float(ref['Monto_Esperado'])
        id_deuda = ref['Id_Deuda']

        cursor.execute("SELECT nextval('folio_seq') AS num")
        folio = f"FOL-MAN-{cursor.fetchone()['num']}"

        cursor.execute("""
            INSERT INTO "PAGO" ("Id_Deuda","Monto","Fecha_Pago","Metodo_Pago","Folio","Estado","Referencia_Externa")
            VALUES (%s, %s, NOW(), 'Conciliación', %s, 'completado', %s)
        """, (id_deuda, monto, folio, ref['Clave_Ref']))

        cursor.execute('UPDATE "REFERENCIAPAGO" SET "Estado" = %s WHERE "Id_Referencia" = %s', ('Conciliado_Manual', id_referencia))

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


@conciliaciones_bp.route('/conciliaciones/manual/masivo', methods=['POST'])
def conciliar_masivo() -> tuple[Response, int]:
    """Concilia masivamente una lista de referencias de pago pendientes.

    Procesa cada referencia de la lista recibida; omite silenciosamente
    las que no existan o ya estén procesadas. Aplica la misma lógica que
    ``conciliar_manual`` por cada referencia válida.

    Returns:
        Tupla (respuesta JSON, código HTTP). Código 200 con el conteo de
        referencias conciliadas; 400 si no se enviaron referencias; 500
        ante error de base de datos.
    """
    data = request.get_json()
    referencias = data.get('referencias', [])
    
    if not referencias:
        return jsonify({'success': False, 'message': 'No se enviaron referencias para procesar.'}), 400

    conn = cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        procesados = 0
        
        for id_ref in referencias:
            cursor.execute('SELECT * FROM "REFERENCIAPAGO" WHERE "Id_Referencia" = %s AND "Estado" = %s', (id_ref, 'Pendiente'))
            ref = cursor.fetchone()
            if not ref:
                continue
                
            monto = float(ref['Monto_Esperado'])
            id_deuda = ref['Id_Deuda']

            cursor.execute("SELECT nextval('folio_seq') AS num")
            folio = f"FOL-MAN-{cursor.fetchone()['num']}"

            cursor.execute("""
                INSERT INTO "PAGO" ("Id_Deuda","Monto","Fecha_Pago","Metodo_Pago","Folio","Estado","Referencia_Externa")
                VALUES (%s, %s, NOW(), 'Conciliación', %s, 'completado', %s)
            """, (id_deuda, monto, folio, ref['Clave_Ref']))

            cursor.execute('UPDATE "REFERENCIAPAGO" SET "Estado" = %s WHERE "Id_Referencia" = %s', ('Conciliado_Manual', id_ref))

            cursor.execute('SELECT "Saldo_Pendiente" FROM "DEUDA" WHERE "Id_Deuda"=%s', (id_deuda,))
            deuda = cursor.fetchone()
            nuevo_saldo = max(float(deuda['Saldo_Pendiente']) - monto, 0)
            nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
            
            cursor.execute('UPDATE "DEUDA" SET "Saldo_Pendiente"=%s, "Estatus"=%s WHERE "Id_Deuda"=%s', (nuevo_saldo, nuevo_estatus, id_deuda))
            
            procesados += 1

        conn.commit()
        return jsonify({'success': True, 'message': f'{procesados} pagos conciliados exitosamente de manera masiva.'}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()