# Archivo: backend/utils/brevo_service.py
import requests
import os
import io
import base64
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from concurrent.futures import ThreadPoolExecutor

# Usamos 3 hilos para no saturar la memoria RAM del servidor al generar los PDFs
executor = ThreadPoolExecutor(max_workers=3)

def generar_pdf_base64(cliente):
    """Genera el PDF del Estado de Cuenta en memoria y lo codifica en Base64."""
    output = io.BytesIO()
    p = canvas.Canvas(output, pagesize=letter)
    
    # Diseño básico del Estado de Cuenta
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 730, "SolarVer - Estado de Cuenta Oficial")
    
    p.setFont("Helvetica", 11)
    p.drawString(100, 690, f"Cliente: {cliente['Cliente']}")
    p.drawString(100, 670, f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    
    p.drawString(100, 630, "Detalle de su financiamiento:")
    p.drawString(120, 610, f"- Día de Corte: {cliente['Dia_Pago']} de cada mes")
    p.drawString(120, 590, f"- Saldo Pendiente: ${float(cliente['Saldo_Pendiente']):,.2f}")
    p.drawString(120, 570, f"- Estatus actual: {cliente['Estatus'].upper()}")
    
    p.setFont("Helvetica-Oblique", 10)
    p.drawString(100, 520, "Si ya realizó su pago, haga caso omiso a este documento.")
    
    p.showPage()
    p.save()
    
    # Convertir a Base64
    pdf_bytes = output.getvalue()
    output.close()
    return base64.b64encode(pdf_bytes).decode('utf-8')

def enviar_estado_cuenta_brevo(cliente):
    """Envía el correo usando una plantilla de Brevo y adjuntando el PDF dinámico."""
    if not cliente.get('Correo'):
        return False
        
    url = os.getenv("https://api.brevo.com/v3/smtp/email")
    api_key = os.getenv("BREVO_API_KEY")
    template_id = int(os.getenv("BREVO_ESTADO_CUENTA_TEMPLATE_ID", 1)) # ID de plantilla para el Estado de Cuenta
    
    # 1. Generamos el PDF adjunto
    pdf_b64 = generar_pdf_base64(cliente)
    
    # 2. Armamos el paquete JSON
    payload = {
        "to": [
            {"email": cliente['Correo'], "name": cliente['Cliente']}
        ],
        "templateId": template_id,  
        "params": {                 
            "nombre": cliente['Cliente'],
            "mes": datetime.now().strftime('%B')
        },
        "attachment": [             
            {
                "content": pdf_b64,
                "name": f"Estado_De_Cuenta_{cliente['Cliente'].replace(' ', '_')}.pdf"
            }
        ]
    }
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (201, 202):
            return True
        else:
            logging.error(f"Error Brevo ({cliente['Correo']}): {response.text}")
            return False
    except Exception as e:
        logging.error(f"Error de red enviando a {cliente['Correo']}: {e}")
        return False

def procesar_lote_reportes(lista_clientes):
    """Itera la lista en segundo plano."""
    for cliente in lista_clientes:
        enviar_estado_cuenta_brevo(cliente)

def iniciar_envio_masivo(lista_clientes):
    """Delega el trabajo al hilo para no bloquear el Frontend."""
    executor.submit(procesar_lote_reportes, lista_clientes)