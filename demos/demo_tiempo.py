# Archivo: demos/demo_tiempo.py
import sys
import os
from datetime import datetime
import pytz

# Agregar la carpeta backend al path para poder importar los servicios
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from services.scheduler_service import actualizar_estatus_deudas, procesar_cobros_automaticos

def obtener_siguiente_mes(hoy):
    """Calcula el próximo mes y año basado en la fecha actual"""
    if hoy.month == 12:
        return hoy.year + 1, 1
    return hoy.year, hoy.month + 1

def simular_envio_correos_referenciados():
    print("\n--- SIMULANDO: 5 días antes del corte (Día 12 del mes actual) ---")
    print("Objetivo: El sistema detecta clientes que pagan el día 17 y les envía su referencia bancaria.")
    
    tz = pytz.timezone('America/Mexico_City')
    hoy = datetime.now(tz)
    fecha_falsa = hoy.replace(day=12, hour=9, minute=0, second=0)
    
    enviados = procesar_cobros_automaticos(fecha_simulada=fecha_falsa)
    print(f"Se enviaron {enviados} correos con referencias bancarias.")

def simular_penalizaciones_atraso():
    print("\n--- SIMULANDO: Día de revisión de penalizaciones (Día 18 del mes actual) ---")
    print("Objetivo: El sistema revisará si alguien no pagó a tiempo el día 17 y aplicará el 5% de interés moratorio.")
    
    tz = pytz.timezone('America/Mexico_City')
    hoy = datetime.now(tz)
    fecha_falsa = hoy.replace(day=18, hour=9, minute=0, second=0)
    
    actualizados = actualizar_estatus_deudas(fecha_simulada=fecha_falsa)
    print(f"Revisión de estatus y penalizaciones completada. Se evaluaron/actualizaron {actualizados} cuentas.")

def simular_inicio_nuevo_mes():
    print("\n--- SIMULANDO: Avance de 1 mes (Inicio de nuevas mensualidades) ---")
    print("Objetivo: Simular los días de corte del próximo mes. Los pagos anteriores ya no cubren este periodo y el estatus regresa a 'pendiente'.")
    
    tz = pytz.timezone('America/Mexico_City')
    hoy = datetime.now(tz)
    nuevo_anio, nuevo_mes = obtener_siguiente_mes(hoy)
    
    # 1. Viajamos al día 5 del próximo mes (Clientes del grupo 1)
    fecha_dia_5 = hoy.replace(year=nuevo_anio, month=nuevo_mes, day=5, hour=9, minute=0, second=0)
    print(f"\n[!] Viajando virtualmente al {fecha_dia_5.strftime('%d/%m/%Y')}...")
    actualizados_5 = actualizar_estatus_deudas(fecha_simulada=fecha_dia_5)
    print(f" -> Los clientes que pagan los días 5 ahora están como 'pendiente'. Cuentas procesadas: {actualizados_5}")

    # 2. Viajamos al día 17 del próximo mes (Clientes del grupo 2)
    fecha_dia_17 = hoy.replace(year=nuevo_anio, month=nuevo_mes, day=17, hour=9, minute=0, second=0)
    print(f"\n[!] Viajando virtualmente al {fecha_dia_17.strftime('%d/%m/%Y')}...")
    actualizados_17 = actualizar_estatus_deudas(fecha_simulada=fecha_dia_17)
    print(f" -> Los clientes que pagan los días 17 ahora están como 'pendiente'. Cuentas procesadas: {actualizados_17}")

if __name__ == "__main__":
    while True:
        print("\n--- PANEL DE PRUEBAS DEL MOTOR AUTOMÁTICO (SCHEDULER) ---")
        print("1. Simular Día 12 (Envío de correos con referencias bancarias)")
        print("2. Simular Día 18 (Revisión de atrasos y penalizaciones del 5%)")
        print("3. Simular Avance de 1 Mes (Generar nuevas mensualidades a cobrar)")
        print("4. Salir")
        
        opcion = input("Elige qué evento temporal quieres demostrar (1-4): ")
        
        if opcion == '1':
            simular_envio_correos_referenciados()
        elif opcion == '2':
            simular_penalizaciones_atraso()
        elif opcion == '3':
            simular_inicio_nuevo_mes()
        elif opcion == '4':
            print("Saliendo del simulador...")
            break
        else:
            print("Opción no válida, intenta de nuevo.")