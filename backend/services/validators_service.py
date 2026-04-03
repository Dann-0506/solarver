# Archivo: backend/utils/validators.py
# Servicio específico para validación de correos y teléfonos utilizando Abstract API

import phonenumbers
import requests
import os
import re

def validar_correo(correo):
    """
    Verifica la validez del correo usando una API externa profesional.
    Evita problemas de bloqueo del puerto 25 y filtros anti-spam.
    """
    if not correo:
        return True, None
    
    # 1. Validación rápida de formato con Expresiones Regulares (Regex)
    # Esto evita gastar peticiones a la API si el correo ni siquiera tiene un '@'
    patron = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    if not re.match(patron, correo):
        return False, "El formato del correo electrónico es inválido."
        
    try:
        api_key = os.getenv("ABSTRACT_EMAIL_API_KEY")
        
        # Si hay llave configurada, usamos la API profesional
        # Si hay llave configurada, usamos la API profesional de Reputación
        if api_key:
            url = "https://emailreputation.abstractapi.com/v1/"
            
            # 1. Recuperamos el uso de 'params' para seguridad en la red
            parametros = {
                "api_key": api_key,
                "email": correo
            }
            
            respuesta = requests.get(url, params=parametros, timeout=5)
            
            if respuesta.status_code == 200:
                datos = respuesta.json()
                
                # 2. Extraemos el bloque anidado que manda la API de reputación
                info_entrega = datos.get("email_deliverability", {})
                
                # 3. Consultamos usando las llaves correctas de esta API específica
                if info_entrega.get("is_format_valid") is False:
                    return False, "El formato del correo es incorrecto."
                    
                # Esta API utiliza "status" con minúsculas
                if info_entrega.get("status") == "undeliverable":
                    return False, "La bandeja de entrada no es accesible."
                    
        return True, correo.lower()
        
    except Exception as e:
        print(f"Advertencia: Error conectando a la API de correos: {e}")
        # Failsafe: Permitimos guardar si el servicio externo falla
        return True, correo.lower()

def validar_telefono(telefono, region_default="MX"):
    """
    Verifica la estructura del teléfono y opcionalmente comprueba su existencia
    mediante una API de validación externa.
    """
    if not telefono:
        return True, None
    
    try:
        # 1. Validar el formato lógico con la librería instalada
        num_parseado = phonenumbers.parse(telefono, region_default)
        if not phonenumbers.is_valid_number(num_parseado):
            return False, "El número de teléfono no es válido para esta región."
        
        # WhatsApp requiere formato E.164 sin el '+' (Ej. 522291234567)
        tel_e164 = phonenumbers.format_number(num_parseado, phonenumbers.PhoneNumberFormat.E164)
        tel_wa = tel_e164.replace('+', '')
        
        # 2. Verificar existencia de la línea con Abstract API
        api_key = os.getenv("ABSTRACT_PHONE_API_KEY")
        
        if api_key:
            url = f"https://phoneintelligence.abstractapi.com/v1/?api_key={api_key}&phone={tel_e164}"
            respuesta = requests.get(url, timeout=5)
            
            if respuesta.status_code == 200:
                datos = respuesta.json()
                # La API devolverá valid = false si el número está inactivo
                if datos.get("valid") is False:
                    return False, "La línea telefónica no existe o se encuentra inactiva."
                    
        return True, tel_wa
        
    except phonenumbers.NumberParseException:
        return False, "Formato de teléfono irreconocible. Revisa los números."
    except Exception as e:
        print(f"Advertencia: Error conectando a la API de teléfonos: {e}")
        return True, tel_wa