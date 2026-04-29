"""Servicio de procesamiento de pagos para Solarver.

Centraliza la generación de folios, el cálculo de estatus de deuda
y la lógica de conciliación manual, eliminando la duplicación entre
los blueprints de pagos, conciliaciones y webhooks.
"""
from __future__ import annotations

from datetime import datetime
import pytz


def generar_folio(cursor, prefijo: str = "FOL") -> str:
    """Consume la siguiente posición de folio_seq y retorna el folio formateado.

    Args:
        cursor: Cursor de base de datos activo.
        prefijo: Prefijo del folio. Por defecto ``'FOL'``.

    Returns:
        Folio en formato ``'<prefijo>-<n>'``.
    """
    cursor.execute("SELECT nextval('folio_seq') AS num")
    return f"{prefijo}-{cursor.fetchone()['num']}"


def calcular_estatus_deuda(
    cursor,
    id_deuda: int,
    nuevo_saldo: float,
    deuda: dict,
    hoy: datetime | None = None,
) -> str:
    """Determina el estatus de una deuda tras aplicar un pago.

    Consulta el total pagado en el periodo vigente (desde el último día de
    corte) para decidir si el cliente cubrió la mensualidad. La función
    asume que el INSERT del pago ya fue ejecutado antes de llamarla, por lo
    que ``total_pagado`` incluye el pago recién registrado.

    Args:
        cursor: Cursor de base de datos activo.
        id_deuda: ID de la deuda a evaluar.
        nuevo_saldo: Saldo resultante después de aplicar el pago.
        deuda: Dict con ``Monto_Total``, ``Plazo_Meses``, ``Interes_Acumulado``
            y ``Fecha_Pago`` (día de corte del cliente).
        hoy: Fecha de referencia. Si es ``None``, usa la hora actual en
            zona horaria de México.

    Returns:
        ``'pagado'``, ``'atrasado'`` o ``'pendiente'``.
    """
    if hoy is None:
        tz  = pytz.timezone('America/Mexico_City')
        hoy = datetime.now(tz)

    dia_corte = int(deuda['Fecha_Pago'])

    if dia_corte == 5:
        if hoy.day >= 5:
            inicio_periodo = datetime(hoy.year, hoy.month, 5, tzinfo=hoy.tzinfo)
        else:
            mes_ant  = hoy.month - 1 if hoy.month > 1 else 12
            anio_ant = hoy.year      if hoy.month > 1 else hoy.year - 1
            inicio_periodo = datetime(anio_ant, mes_ant, 5, tzinfo=hoy.tzinfo)
    else:
        if hoy.day >= 17:
            inicio_periodo = datetime(hoy.year, hoy.month, 17, tzinfo=hoy.tzinfo)
        else:
            mes_ant  = hoy.month - 1 if hoy.month > 1 else 12
            anio_ant = hoy.year      if hoy.month > 1 else hoy.year - 1
            inicio_periodo = datetime(anio_ant, mes_ant, 17, tzinfo=hoy.tzinfo)

    cursor.execute("""
        SELECT COALESCE(SUM("Monto"), 0) AS total_pagado
        FROM   "PAGO"
        WHERE  "Id_Deuda" = %s AND "Fecha_Pago" >= %s AND "Estado" = 'completado'
    """, (id_deuda, inicio_periodo))
    pagado_mes = float(cursor.fetchone()['total_pagado'])

    mensualidad    = float(deuda['Monto_Total']) / int(deuda['Plazo_Meses'] or 12)
    interes        = float(deuda.get('Interes_Acumulado') or 0)
    pago_requerido = mensualidad + interes

    if round(nuevo_saldo, 2) <= 0 or round(pagado_mes, 2) >= round(pago_requerido, 2):
        return 'pagado'
    elif hoy.day > dia_corte:
        return 'atrasado'
    else:
        return 'pendiente'


def procesar_conciliacion(cursor, id_ref: int) -> bool:
    """Ejecuta los cinco pasos de conciliación para una sola referencia pendiente.

    No realiza commit ni rollback; la transacción es responsabilidad del llamador.
    Si alguna operación de BD falla, la excepción se propaga sin capturar para
    que el route handler pueda hacer rollback correctamente.

    Args:
        cursor: Cursor de base de datos activo con la transacción abierta.
        id_ref: ID de la referencia a conciliar.

    Returns:
        ``True`` si la referencia fue procesada exitosamente.
        ``False`` si no existe o ya fue procesada (``Estado != 'Pendiente'``).
    """
    cursor.execute(
        'SELECT * FROM "REFERENCIAPAGO" WHERE "Id_Referencia" = %s AND "Estado" = %s',
        (id_ref, 'Pendiente')
    )
    ref = cursor.fetchone()
    if not ref:
        return False

    monto    = float(ref['Monto_Esperado'])
    id_deuda = ref['Id_Deuda']

    folio = generar_folio(cursor, 'FOL-MAN')

    cursor.execute("""
        INSERT INTO "PAGO" ("Id_Deuda","Monto","Fecha_Pago","Metodo_Pago","Folio","Estado","Referencia_Externa")
        VALUES (%s, %s, NOW(), 'Conciliación', %s, 'completado', %s)
    """, (id_deuda, monto, folio, ref['Clave_Ref']))

    cursor.execute(
        'UPDATE "REFERENCIAPAGO" SET "Estado" = %s WHERE "Id_Referencia" = %s',
        ('Conciliado_Manual', id_ref)
    )

    cursor.execute("""
        SELECT d."Saldo_Pendiente", d."Monto_Total", d."Plazo_Meses", d."Interes_Acumulado",
               c."Fecha_Pago"
        FROM   "DEUDA"   d
        JOIN   "CLIENTE" c ON c."Id_Cliente" = d."Id_Cliente"
        WHERE  d."Id_Deuda" = %s
    """, (id_deuda,))
    deuda = cursor.fetchone()

    nuevo_saldo   = max(float(deuda['Saldo_Pendiente']) - monto, 0)
    nuevo_estatus = calcular_estatus_deuda(cursor, id_deuda, nuevo_saldo, deuda)

    cursor.execute(
        'UPDATE "DEUDA" SET "Saldo_Pendiente"=%s, "Estatus"=%s WHERE "Id_Deuda"=%s',
        (nuevo_saldo, nuevo_estatus, id_deuda)
    )

    return True
