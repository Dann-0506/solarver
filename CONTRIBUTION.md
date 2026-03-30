# Guía de Contribución para SolarVer

¡Gracias por tu interés en contribuir a **SolarVer**! Para mantener nuestro código limpio, organizado y libre de errores en la rama principal, por favor sigue estas reglas de trabajo.

## Flujo de Trabajo (Ramas y PRs)

Nuestra rama `main` está protegida. **NUNCA** se deben subir cambios directamente a `main`. Todo código nuevo debe pasar por una rama individual y un Pull Request.

### 1. Nomenclatura de Ramas
Antes de empezar a trabajar, crea una rama nueva desde `main`. Usa los siguientes prefijos para indicar qué estás haciendo:
* `fix/` - Para reparar un error (ej. `fix/dashboard-empleado-carga`).
* `feat/` - Para una característica nueva (ej. `feat/exportar-pdf-reportes`).
* `docs/` - Para cambios en documentación (ej. `docs/actualizar-readme`).

**Comando:** `git checkout -b fix/nombre-del-problema`

### 2. Guardando cambios (Commits)
* Sube tu rama al servidor remoto pronto para tener un respaldo.
* Escribe mensajes de commit claros y descriptivos en tiempo presente (ej. "Agrega botón de cancelar", en lugar de "Agregué un botón").

### 3. Pull Requests (PR)
Cuando termines tu tarea:
1. Asegúrate de que tu código funciona localmente.
2. Abre un Pull Request apuntando hacia `main`.
3. Añade un título descriptivo y explica brevemente en la descripción qué problema resuelve tu código.
4. Una vez que el PR sea aprobado y fusionado (merged), **elimina tu rama** para mantener el repositorio limpio.

## Reporte de Errores (Issues)
Si encuentras un bug pero no tienes tiempo de arreglarlo, por favor abre un "Issue" en GitHub detallando:
* Qué esperabas que pasara.
* Qué pasó en realidad.
* Pasos para reproducir el error.