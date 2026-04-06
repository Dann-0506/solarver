# Archivo: demos/demo_tiempo.py
import sys
import os
from datetime import datetime
import pytz

# Agregar la carpeta backend al path para poder importar los servicios
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from services.scheduler_service import actualizar_estatus_deudas, procesar_cobros_automaticos

def simular_envio_correos_referenciados():
    print("\n--- SIMULANDO: 5 días antes del corte (Día 12 del mes) ---")
    print("Objetivo: El sistema debe detectar a los clientes que pagan el día 17 y enviarles el correo con la referencia.")
    
    # Viajamos en el tiempo al día 12 del mes actual
    tz = pytz.timezone('America/Mexico_City')
    fecha_falsa = datetime(2024, 10, 12, 9, 0, 0, tzinfo=tz) # Ajusta el año y mes según necesites
    
    enviados = procesar_cobros_automaticos(fecha_simulada=fecha_falsa)
    print(f"Se enviaron {enviados} correos con referencias bancarias.")

def simular_penalizaciones_atraso():
    print("\n--- SIMULANDO: Día de revisión de penalizaciones ---")
    print("Objetivo: El sistema revisará si alguien no pagó a tiempo y aplicará el 5% de interés moratorio.")
    
    tz = pytz.timezone('America/Mexico_City')
    # Viajamos al día 18 (un día después del corte del 17)
    fecha_falsa = datetime(2024, 10, 18, 9, 0, 0, tzinfo=tz) 
    
    # Nota: Tu función de actualizar_estatus requiere que la BD tenga clientes en estado 'pendiente' que ya se pasaron de la fecha.
    actualizar_estatus_deudas(fecha_simulada=fecha_falsa)
    print("Revisión de estatus y penalizaciones completada.")

if __name__ == "__main__":
    while True:
        print("\n--- PANEL DE PRUEBAS SCHEDULERS ---")
        print("1. Simular Día 12 (Envío de correos referenciados 5 días antes del corte)")
        print("2. Simular Día 18 (Revisión de atrasos y aplicación de penalizaciones)")
        print("3. Salir")
        
        opcion = input("Elige qué evento temporal quieres demostrar (1-3): ")
        
        if opcion == '1':
            simular_envio_correos_referenciados()
        elif opcion == '2':
            simular_penalizaciones_atraso()
        elif opcion == '3':
            print("Saliendo del simulador...")
            break
        else:
            print("Opción no válida, intenta de nuevo.")