#  Archivo: backend/services/notificaciones_service.py
#  Servicio centralizado para generación de documentos y envío de notificaciones (email/SMS)
#  Utiliza la API de Brevo para ambos canales, con funciones genéricas y específicas

import requests
import os
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter
from concurrent.futures import ThreadPoolExecutor
from .documentos_service import generar_pdf_base64, generar_pdf_instrucciones_pago

executor = ThreadPoolExecutor(max_workers=3)

# ── FUNCIONES DE ENVÍO DE NOTIFICACIONES ──
def enviar_email(to_email, to_name, template_id, params, adjunto=None):
    """Función genérica para enviar correos transaccionales a través de Brevo."""
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

def enviar_sms(telefono, mensaje):
    """Función genérica para enviar SMS transaccionales a través de Brevo."""
    api_key = os.getenv("BREVO_API_KEY")
    sender_name = os.getenv("SMS_SENDER_NAME", "SolarVer")
    
    if not api_key or not telefono:
        return False, "API Key o teléfono faltante"

    url = "https://api.brevo.com/v3/transactionalSMS/sms"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    payload = {
        "sender": sender_name,
        "recipient": str(telefono),
        "content": mensaje,
        "type": "transactional"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (201, 202):
            return True, "SMS enviado con éxito"
        else:
            logging.error(f"Error Brevo SMS ({telefono}): {response.text}")
            return False, f"Error API: {response.status_code}"
    except Exception as e:
        logging.error(f"Error de red SMS a {telefono}: {e}")
        return False, str(e)

# ── FUNCIONES DE FLUJOS ESPECÍFICOS (Delegados a los genéricos) ──
def enviar_estado_cuenta(cliente):
    """Arma el PDF y llama al servicio genérico de email."""
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

def procesar_lote_reportes(lista_clientes):
    """Itera la lista de estados de cuenta en segundo plano."""
    for cliente in lista_clientes:
        enviar_estado_cuenta(cliente)

def iniciar_envio_masivo(lista_clientes):
    """Delega el trabajo al hilo para no bloquear el Frontend."""
    executor.submit(procesar_lote_reportes, lista_clientes)


def enviar_instrucciones_pago(datos_pago):
    """Arma el PDF de instrucciones y llama al servicio genérico de email."""
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