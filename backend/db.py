"""Módulo de conexión a la base de datos PostgreSQL.

Provee la función helper para obtener conexiones activas configuradas
con las credenciales del entorno y la zona horaria local de México.
"""

import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()


def get_connection() -> psycopg2.extensions.connection:
    """Retorna una conexión activa a la base de datos PostgreSQL.

    Lee las credenciales desde las variables de entorno definidas en
    el archivo .env y fija la zona horaria de la sesión a
    America/Mexico_City para que todas las operaciones de fecha/hora
    sean consistentes con el horario local.

    Returns:
        Conexión psycopg2 lista para usarse, con la zona horaria
        de sesión ya configurada y el cambio confirmado.

    Raises:
        psycopg2.OperationalError: Si no se puede establecer la conexión
            con los parámetros leídos del entorno.
    """
    connection = psycopg2.connect(
        host     = os.getenv("DB_HOST"),
        port     = os.getenv("DB_PORT"),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD")
    )
    # Garantiza que fecha/hora usen la zona horaria local, no UTC del servidor
    with connection.cursor() as cur:
        cur.execute("SET TIME ZONE 'America/Mexico_City'")
    connection.commit()
    return connection
