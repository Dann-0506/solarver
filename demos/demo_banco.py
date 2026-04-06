# Archivo: demos/demo_banco.py
import requests
import json

WEBHOOK_URL = "http://localhost:5000/api/webhooks/banco"

def simular_pago_banco():
    print("\nSIMULADOR DE TRANSFERENCIAS BANCARIAS")
    print("Asegúrate de que tu servidor Flask esté corriendo en otro terminal.\n")
    
    referencia = input("Ingresa la CLAVE DE REFERENCIA (Ej. SOL-X-XXXX) o inventa una para ver qué pasa: ")
    try:
        monto = float(input("Ingresa el MONTO depositado (Ej. 1500.00): "))
    except ValueError:
        print("Error: El monto debe ser un número.")
        return

    # Armamos el JSON tal cual lo mandaría el banco
    payload = {
        "referencia": referencia,
        "monto": monto
    }

    print(f"\nEnviando JSON al Webhook: {json.dumps(payload)}")
    
    try:
        response = requests.post(WEBHOOK_URL, json=payload, headers={'Content-Type': 'application/json'})
        
        print(f"\nRespuesta del Servidor SolarVer (Status: {response.status_code}):")
        datos = response.json()
        
        if datos.get('success'):
            print(f"ÉXITO: {datos.get('message')}")
        else:
            print(f"RECHAZADO: {datos.get('message')}")
            
    except requests.exceptions.ConnectionError:
        print("Error: No se pudo conectar al servidor. ¿Está Flask corriendo en el puerto 5000?")

if __name__ == "__main__":
    simular_pago_banco()