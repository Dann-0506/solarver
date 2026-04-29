"""Módulo de validación de datos de contacto para Solarver.

Valida correos electrónicos y números de teléfono en dos pasos: primero
una verificación local de formato y después una consulta a APIs externas
(Abstract API) para comprobar la entregabilidad o existencia real del dato.
Si el servicio externo no está disponible, el módulo permite el registro
como failsafe para no bloquear el flujo de la aplicación.
"""
from __future__ import annotations
import phonenumbers
import requests
import os
import re

def validar_correo(correo: str | None) -> tuple[bool, str | None]:
    """Valida el formato y la entregabilidad de un correo electrónico.

    Realiza dos verificaciones en cascada: primero valida el formato con una
    expresión regular y, si hay API key configurada, consulta la API de
    reputación de Abstract para verificar que la bandeja sea accesible.
    Si el servicio externo falla, permite el correo para no bloquear el flujo.

    Args:
        correo: Dirección de correo a validar. Si es ``None`` o vacía,
            se asume válida (campo opcional).

    Returns:
        Tupla ``(válido, resultado)`` donde ``resultado`` es el correo
        normalizado en minúsculas si es válido, el mensaje de error si no
        lo es, o ``None`` si el campo estaba vacío.
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
        
        # Si hay llave configurada, usamos la API profesional de reputación
        if api_key:
            url = f"https://emailreputation.abstractapi.com/v1/?api_key={api_key}&email={correo}"
            
            respuesta = requests.get(url, timeout=5)
            
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


def validar_telefono(telefono: str | None, region_default: str = "MX") -> tuple[bool, str | None]:
    """Valida el formato y la existencia de un número de teléfono.

    Realiza dos verificaciones en cascada: primero valida la estructura con
    la librería ``phonenumbers`` y, si hay API key configurada, consulta la
    API de inteligencia telefónica de Abstract para verificar si la línea está
    activa. El número válido se retorna en formato E.164 sin el signo ``+``,
    listo para usar con WhatsApp o Infobip.

    Args:
        telefono: Número de teléfono a validar. Acepta formatos locales e
            internacionales. Si es ``None`` o vacío, se asume válido.
        region_default: Código de región ISO 3166-1 alfa-2 para interpretar
            números locales. Por defecto ``'MX'`` (México).

    Returns:
        Tupla ``(válido, resultado)`` donde ``resultado`` es el número en
        formato E.164 sin ``+`` si es válido, el mensaje de error si no lo es,
        o ``None`` si el campo estaba vacío.
    """
    if not telefono:
        return True, None
    
    # Fase 1 — Validación local con phonenumbers (obligatoria, sin red)
    try:
        num_parseado = phonenumbers.parse(telefono, region_default)
        if not phonenumbers.is_valid_number(num_parseado):
            return False, "El número de teléfono no es válido para esta región."
        # WhatsApp requiere formato E.164 sin el '+' (Ej. 522291234567)
        tel_e164 = phonenumbers.format_number(num_parseado, phonenumbers.PhoneNumberFormat.E164)
        tel_wa = tel_e164.replace('+', '')
    except phonenumbers.NumberParseException:
        return False, "Formato de teléfono irreconocible. Revisa los números."
    except Exception as e:
        print(f"Advertencia: Error en validación local de teléfono: {e}")
        return False, "Error al procesar el número de teléfono."

    # Fase 2 — Verificación externa con Abstract API (opcional, failsafe)
    api_key = os.getenv("ABSTRACT_PHONE_API_KEY")
    if api_key:
        try:
            url = f"https://phoneintelligence.abstractapi.com/v1/?api_key={api_key}&phone={tel_e164}"
            respuesta = requests.get(url, timeout=5)
            if respuesta.status_code == 200:
                datos = respuesta.json()
                # La API devolverá valid = false si el número está inactivo
                if datos.get("valid") is False:
                    return False, "La línea telefónica no existe o se encuentra inactiva."
        except Exception as e:
            print(f"Advertencia: Error conectando a la API de teléfonos: {e}")
            # Failsafe: el número pasó la validación local, se permite continuar.

    return True, tel_wa