"""
SolarVer – Utilidades de configuración inicial
Ejecutar desde la carpeta backend/ con: python setup_dev.py
"""

import bcrypt
import os
import sys

def generar_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def generar_hashes_sql():
    """Genera los INSERT con contraseñas hasheadas correctamente."""
    usuarios = [
        ('Admin SolarVer',    'admin',    'admin@solarver.com',    'Admin2024!',    1),
        ('Empleado SolarVer', 'empleado', 'empleado@solarver.com', 'Empleado2024!', 2),
    ]

    print("\n── SQL con contraseñas hasheadas (pegar en pgAdmin o psql) ──\n")
    print("-- Eliminar usuarios de prueba anteriores si existen")
    print("DELETE FROM \"USUARIO\" WHERE \"Username\" IN ('admin', 'empleado');\n")

    for nombre, username, correo, password, id_rol in usuarios:
        hashed = generar_hash(password)
        print(f"-- Usuario: {username} | Contraseña: {password}")
        print(f"INSERT INTO \"USUARIO\" (\"Nombre\", \"Username\", \"Correo\", \"Contrasena\", \"Estado\", \"Id_Rol\")")
        print(f"VALUES ('{nombre}', '{username}', '{correo}', '{hashed}', TRUE, {id_rol});\n")

def crear_env():
    """Crea el archivo .env si no existe."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')

    if os.path.exists(env_path):
        print(f"⚠️  Ya existe un archivo .env en {env_path}")
        resp = input("¿Deseas sobreescribirlo? (s/n): ").strip().lower()
        if resp != 's':
            print("Sin cambios.")
            return

    contenido = """# ─────────────────────────────────────────
#  SolarVer – Variables de entorno
#  NO subir este archivo a git
# ─────────────────────────────────────────

# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=SolarVer
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

# Correo (Resend) — opcional por ahora
RESEND_API_KEY=
RESEND_FROM=noreply@solarver.com
"""
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(contenido)

    print(f"Archivo .env creado en: {os.path.abspath(env_path)}")
    print("Edita DB_PASSWORD con tu contraseña de PostgreSQL")

def verificar_conexion():
    """Verifica que la conexión a la BD funciona."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        import psycopg2
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        conn.close()
        print("Conexión a PostgreSQL exitosa")
    except Exception as e:
        print(f"Error de conexión: {e}")
        print("Verifica que PostgreSQL esté corriendo y que .env esté configurado")

if __name__ == '__main__':
    print("═══════════════════════════════════")
    print("  SolarVer – Setup de desarrollo   ")
    print("═══════════════════════════════════")

    opciones = {
        '1': ('Generar SQL con contraseñas hasheadas', generar_hashes_sql),
        '2': ('Crear archivo .env',                    crear_env),
        '3': ('Verificar conexión a la BD',            verificar_conexion),
        '4': ('Hacer todo (1 + 2 + 3)',                None),
    }

    print("\n¿Qué deseas hacer?")
    for k, (desc, _) in opciones.items():
        print(f"  {k}. {desc}")

    eleccion = input("\nOpción: ").strip()

    if eleccion == '4':
        crear_env()
        generar_hashes_sql()
        verificar_conexion()
    elif eleccion in opciones:
        opciones[eleccion][1]()
    else:
        print("Opción no válida")
        