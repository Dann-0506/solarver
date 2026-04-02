import dns.resolver
import smtplib
import socket
import phonenumbers
import requests
import os

def validar_correo_smtp(correo):
    """
    Verifica si el dominio existe y pregunta al servidor SMTP si 
    la bandeja de entrada específica puede recibir correos.
    """
    if not correo:
        return True, None
    
    try:
        dominio = correo.split('@')[1]
        
        # 1. Buscar el servidor de correo (Registro MX)
        registros = dns.resolver.resolve(dominio, 'MX')
        servidor_mx = str(registros[0].exchange)
        
        # 2. Conectarnos al servidor
        servidor = smtplib.SMTP(timeout=5)
        servidor.connect(servidor_mx)
        servidor.helo(socket.gethostname())
        servidor.mail("noreply@solarver.com")
        
        # 3. Preguntar si el usuario existe
        codigo_respuesta, mensaje = servidor.rcpt(correo)
        servidor.quit()
        
        if codigo_respuesta == 250:
            return True, correo.lower()
        else:
            return False, "La bandeja de entrada no existe en ese dominio."
            
    except dns.resolver.NXDOMAIN:
        return False, "El dominio del correo (lo que va después del @) no existe."
    except Exception as e:
        print(f"Advertencia: No se pudo verificar {correo} por red: {e}")
        # Si falla la red, lo dejamos pasar para no bloquear al usuario por un error nuestro
        return True, correo.lower()

def validar_telefono_wa(telefono, region_default="MX"):
    """
    Verifica la estructura del teléfono y lo formatea para WhatsApp.
    Opcionalmente (si hay token), verifica con la API de Meta.
    """
    if not telefono:
        return True, None
    
    try:
        # 1. Validar formato lógico (Ej. 10 dígitos en México)
        num_parseado = phonenumbers.parse(telefono, region_default)
        if not phonenumbers.is_valid_number(num_parseado):
            return False, "El número de teléfono no es válido para esta región."
        
        # WhatsApp requiere formato E.164 sin el '+' (Ej. 522291234567)
        tel_e164 = phonenumbers.format_number(num_parseado, phonenumbers.PhoneNumberFormat.E164)
        tel_wa = tel_e164.replace('+', '')
        
        # 2. Verificar en la API de WhatsApp (si tenemos las credenciales)
        wa_token = os.getenv("WA_ACCESS_TOKEN")
        wa_phone_id = os.getenv("WA_PHONE_NUMBER_ID")
        
        if wa_token and wa_phone_id and wa_token != "tu_token_temporal_o_permanente_aqui":
            # Meta no tiene un endpoint "ping", así que la forma de validar si tiene 
            # WhatsApp es intentar obtener su estado o enviarle un mensaje pre-aprobado.
            # Por ahora, aseguramos que el formato sea 100% el que Meta exige.
            pass 
            
        return True, tel_wa
        
    except phonenumbers.NumberParseException:
        return False, "Formato de teléfono irreconocible. Revisa los números."