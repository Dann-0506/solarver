"""Módulo de notificaciones transaccionales para Solarver.

Centraliza el envío de correos electrónicos y SMS a través de los proveedores
Brevo e Infobip. Expone funciones genéricas de envío y flujos de alto nivel
para estados de cuenta e instrucciones de pago.
"""
from __future__ import annotations
import requests
import os
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter
from concurrent.futures import ThreadPoolExecutor
from .documentos_service import generar_pdf_base64, generar_pdf_instrucciones_pago

# Máximo de 3 hilos para no saturar la cuota de Brevo en envíos masivos simultáneos
executor = ThreadPoolExecutor(max_workers=3)

# ── FUNCIONES DE ENVÍO DE NOTIFICACIONES ──
def enviar_email(
    to_email: str,
    to_name: str,
    template_id: int,
    params: dict,
    adjunto: dict | None = None,
) -> tuple[bool, str]:
    """Envía un correo transaccional a través de la API de Brevo.

    Args:
        to_email: Dirección de correo del destinatario.
        to_name: Nombre completo del destinatario.
        template_id: ID de la plantilla de Brevo a utilizar.
        params: Diccionario de variables que se inyectan en la plantilla.
        adjunto: Diccionario opcional con el archivo adjunto. Debe incluir
            las claves ``content`` (Base64) y ``name`` (nombre del archivo).

    Returns:
        Tupla ``(éxito, mensaje)`` donde ``éxito`` es ``True`` si el correo
        se envió correctamente y ``mensaje`` describe el resultado o el error.
    """
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("CORREO_REMITENTE", "proyecto.software.s0l4rver@gmail.com")
    sender_name = os.getenv("NOMBRE_REMITENTE", "SolarVer")
    
    if not api_key or not to_email:
        return False, "API Key o correo destino faltante"

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": to_name}],
        "templateId": template_id,
        "params": params
    }

    if adjunto:
        payload["attachment"] = [adjunto]

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (201, 202):
            return True, "Email enviado con éxito"
        else:
            logging.error(f"Error Brevo Email ({to_email}): {response.text}")
            return False, f"Error API: {response.status_code}"
    except Exception as e:
        logging.error(f"Error de red Email a {to_email}: {e}")
        return False, str(e)

def enviar_sms(telefono: str, mensaje: str) -> tuple[bool, str]:
    """Envía un SMS transaccional a través de la API de Infobip.

    Args:
        telefono: Número de teléfono del destinatario. Acepta formato local
            (10 dígitos) o internacional; se normaliza internamente.
        mensaje: Texto del SMS a enviar.

    Returns:
        Tupla ``(éxito, mensaje)`` donde ``éxito`` es ``True`` si el SMS
        se envió correctamente y ``mensaje`` describe el resultado o el error.
    """
    api_key = os.getenv("INFOBIP_API_KEY")
    base_url = os.getenv("INFOBIP_BASE_URL")
    sender_name = os.getenv("SMS_SENDER_NAME", "SolarVer")
    
    if not api_key or not base_url or not telefono:
        return False, "API Key, Base URL o teléfono faltante"

    # Infobip prefiere el número en formato internacional, sin signos de '+'
    telefono_limpio = str(telefono).replace("+", "").replace(" ", "").replace("-", "")

    if len(telefono_limpio) == 10:
        # Agregar prefijo de país México si el número es local de 10 dígitos
        telefono_limpio = f"52{telefono_limpio}"

    # Endpoint avanzado de Infobip para SMS
    url = f"{base_url}/sms/2/text/advanced"
    
    headers = {
        "Authorization": f"App {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    payload = {
        "messages": [
            {
                "destinations": [{"to": telefono_limpio}],
                "from": sender_name,
                "text": mensaje
            }
        ]
    }

    try:
        # Timeout alto porque Infobip puede tardar más que Brevo en redes congestionadas
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        
        # Infobip responde con 200 OK cuando tiene éxito
        if response.status_code == 200:
            return True, "SMS enviado con éxito (Infobip)"
        else:
            logging.error(f"Error Infobip SMS ({telefono}): {response.text}")
            return False, f"Error API: {response.status_code}"
            
    except Exception as e:
        logging.error(f"Error de red SMS a {telefono}: {e}")
        return False, str(e)

# ── FUNCIONES DE FLUJOS ESPECÍFICOS (Delegados a los genéricos) ──
def enviar_estado_cuenta(cliente: dict) -> bool:
    """Genera el PDF de estado de cuenta y lo envía por correo al cliente.

    Args:
        cliente: Diccionario con los datos del cliente. Debe incluir al
            menos las claves ``Correo`` y ``Cliente``.

    Returns:
        ``True`` si el correo se envió correctamente, ``False`` en caso contrario.
    """
    if not cliente.get('Correo'):
        return False
        
    template_id = int(os.getenv("BREVO_ESTADO_CUENTA_TEMPLATE_ID", 1))
    pdf_b64 = generar_pdf_base64(cliente)
    adjunto = {
        "content": pdf_b64,
        "name": f"Estado_De_Cuenta_{cliente['Cliente'].replace(' ', '_')}.pdf"
    }
    params = {
        "nombre": cliente['Cliente'],
        "mes": datetime.now().strftime('%B')
    }
    
    # Delegamos a la función genérica
    exito, mensaje = enviar_email(cliente['Correo'], cliente['Cliente'], template_id, params, adjunto)

    if not exito:
        logging.error(f"Error al enviar estado de cuenta a {cliente['Correo']}: {mensaje}")

    return exito

def procesar_lote_reportes(lista_clientes: list[dict]) -> None:
    """Itera la lista de clientes y envía el estado de cuenta a cada uno.

    Ejecutada en segundo plano por ``iniciar_envio_masivo``. Los errores
    individuales se registran en el log sin interrumpir el procesamiento del lote.

    Args:
        lista_clientes: Lista de diccionarios con datos de cada cliente.
    """
    for cliente in lista_clientes:
        enviar_estado_cuenta(cliente)

def iniciar_envio_masivo(lista_clientes: list[dict]) -> None:
    """Delega el envío masivo de estados de cuenta a un hilo del pool.

    No bloquea la respuesta HTTP al cliente; el trabajo se ejecuta en segundo
    plano mediante el ``ThreadPoolExecutor`` compartido del módulo.

    Args:
        lista_clientes: Lista de diccionarios con datos de cada cliente.
    """
    executor.submit(procesar_lote_reportes, lista_clientes)


def enviar_instrucciones_pago(datos_pago: dict) -> bool:
    """Genera el PDF de instrucciones de pago y lo envía por correo al cliente.

    Args:
        datos_pago: Diccionario con los datos del pago. Claves esperadas:
            ``Correo``, ``Nombre_Completo``, ``Monto``, ``Referencia``,
            ``Fecha_Limite``.

    Returns:
        ``True`` si el correo se envió correctamente, ``False`` en caso contrario.
    """
    if not datos_pago.get('Correo'):
        return False
        
    template_id = int(os.getenv("BREVO_INSTRUCCIONES_PAGO_TEMPLATE_ID", 4))
    
    # Generamos el PDF con los datos del diccionario
    pdf_b64 = generar_pdf_instrucciones_pago(
        cliente_nombre=datos_pago['Nombre_Completo'],
        monto=datos_pago['Monto'],
        clave_referencia=datos_pago['Referencia'],
        fecha_limite=datos_pago['Fecha_Limite']
    )
    
    adjunto = {
        "content": pdf_b64,
        "name": f"Instrucciones_Pago_{datos_pago['Referencia']}.pdf"
    }
    
    params = {
        "nombre": datos_pago['Nombre_Completo'],
        "monto": f"${datos_pago['Monto']:,.2f}",
        "referencia": datos_pago['Referencia']
    }
    
    # Delegamos a la función genérica
    exito, mensaje = enviar_email(datos_pago['Correo'], datos_pago['Nombre_Completo'], template_id, params, adjunto)

    if not exito:
        logging.error(f"Error al enviar instrucciones a {datos_pago['Correo']}: {mensaje}")

    return exito