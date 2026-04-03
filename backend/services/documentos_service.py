# Archivo: backend/services/documentos_service.py
# Servicio específico para generación de documentos (PDF, Excel) en memoria.

import io
import base64
import pandas as pd
from datetime import datetime
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

def generar_pdf_base64(cliente):
    """Genera el PDF del Estado de Cuenta en memoria y lo codifica en Base64."""
    output = io.BytesIO()
    p = canvas.Canvas(output, pagesize=letter)
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
    pdf_bytes = output.getvalue()
    output.close()
    return base64.b64encode(pdf_bytes).decode('utf-8')

def generar_excel_reporte(datos):
    """Genera un archivo Excel usando Pandas y devuelve un objeto BytesIO."""
    df = pd.DataFrame(datos)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Reporte')
    output.seek(0)
    return output

def generar_pdf_reporte(datos, tipo):
    """Genera un reporte en PDF con tablas y estilos, devuelve un objeto BytesIO."""
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(letter))
    elements = []
    styles = getSampleStyleSheet()
    
    titulo = "SolarVer - Reporte de Pagos Realizados" if tipo == 'realizados' else f"SolarVer - Reporte de Cobranza ({tipo.upper()})"
    elements.append(Paragraph(titulo, styles['Title']))
    
    # Subtítulo dinámico indicando el periodo
    if tipo == 'realizados':
        elements.append(Paragraph(f"Periodo: Últimos 30 días (Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')})", styles['Normal']))
    else:
        elements.append(Paragraph(f"Periodo: Estado al corte actual (Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')})", styles['Normal']))
    
    # Armar la tabla dependiendo del tipo de reporte
    if tipo == 'realizados':
        tabla_data = [["Folio", "Cliente", "Contacto (Tel / Correo)", "Monto", "Método", "Fecha"]]
        for d in datos:
            contacto = f"{d['Telefono'] or '-'} / {d['Correo'] or '-'}"
            tabla_data.append([
                d['Folio'], 
                str(d['Cliente'])[:25], 
                contacto[:35], 
                f"${d['Monto']:,.2f}", 
                d['Metodo_Pago'], 
                str(d['Fecha_Pago'])
            ])
    else:
        tabla_data = [["Cliente", "Contacto (Tel / Correo)", "Día Pago", "Saldo", "Interés", "Estatus"]]
        for d in datos:
            contacto = f"{d['Telefono'] or '-'} / {d['Correo'] or '-'}"
            tabla_data.append([
                str(d['Cliente'])[:25], 
                contacto[:35], 
                str(d['Dia_Pago']), 
                f"${d['Saldo_Pendiente']:,.2f}", 
                f"${d['Interes_Acumulado']:,.2f}", 
                str(d['Estatus']).capitalize()
            ])
    
    t = Table(tabla_data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(t)
    doc.build(elements)
    
    output.seek(0)
    return output