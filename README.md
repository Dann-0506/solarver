# SolarVer - Proyecto Universitario

¡Bienvenido al repositorio de **SolarVer**!

Este proyecto es desarrollado como parte de la materia **Ingenieria de Software** en el **Instituto Técnológico de Veracruz**.

**Nota:** Este es un sistema de simulación creado con fines estrictamente educativos. **No es un producto comercial**.

## Descripción del Proyecto

SolarVer es un prototipo de plataforma web diseñada para simular la administración de clientes, pagos y recordatorios de un negocio. El objetivo es poner en práctica conocimientos de desarrollo web, base de datos y planeación de proyectos.

Se cuenta con dos roles de simulación:
- **Administrador:** Vista global de ingresos y gestión de usuarios.
- **Empleado:** Herramienta para registrar cobros y visualizar historial de clientes.

## Tecnologías Empleadas

- **Frontend:** HTML5, CSS3, JavaScript.
- **Backend:** Python.
- **Base de Datos:** PostgreSQL.

## Guía de Instalación Local

Para revisar y hacer funcionar este proyecto, sigue estos pasos:

### Requisitos previos
- Python 3.12.8 o superior.
- PostgreSQL.
- Git.

### Pasos para ejecutar

1. **Clonar el repositorio:**
    git clone [https://github.com/Dann-0506/solarver](https://github.com/Dann-0506/solarver)

2. **Configurar el entorno virtual:**
    cd /ruta/del/proyecto
    python -m venv venv

    #En Windows:
    venv\scripts\activate
    #En Linux/Mac:
    source venv/bin/activate

3. **Instalar dependencias:**
    pip install -r requirements.text

4. **Crear la base de datos:**
    psql -U 'usuario' -f setup_solarver_db.sql

5. **Configurar el entorno:**
    python setup_solarver_dev.py 
    (NOTA: Se recomienda seleccionar la opción 3 si es la primera vez que se ejecuta).

6. **Iniciar el servidor local**
    cd backend
    python app.py

7. **Probar la aplicación:**
    Abre el navegador y visita **http://localhost:5000** (o el puerto que indique la terminal).

## Colaboradores

- Daniel Landero Arias
- Eduardo Novoa Siles
