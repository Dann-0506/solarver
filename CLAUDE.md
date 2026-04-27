# Instrucciones para Claude Code — Solarver

Este archivo contiene las instrucciones permanentes que Claude Code debe seguir en cada sesión de trabajo sobre este proyecto. Léelo completo antes de ejecutar cualquier tarea.

---

## 1. Contexto del proyecto

**Solarver** es un sistema de gestión de pagos y conciliaciones bancarias para clientes.

- **Backend:** Python con Flask. Estructura en blueprints bajo `backend/routes/` y lógica de negocio en `backend/services/`.
- **Frontend:** JavaScript vanilla (sin frameworks), organizado en `core/` (utilidades), `modules/` (lógica por dominio) y `pages/` (entry points por vista).
- **Base de datos:** SQL (ver `setup_solarver_db.sql` para el esquema).
- **Documentación de referencia:** `README.md`, `CONTRIBUTING.md` y `CONVENTIONS.md`.

---

## 2. Reglas obligatorias

### 2.1 Estándar de código

- **TODOS los comentarios y docstrings deben seguir `CONVENTIONS.md` al pie de la letra.** Si tienes dudas, vuelve a leerlo antes de actuar.
- **Idioma:** español. Nunca mezclar inglés salvo en palabras reservadas técnicas (`Args`, `Returns`, `@param`, etc.).
- **Type hints en Python:** toda función nueva o refactorizada debe incluirlos.
- **JSDoc en JavaScript:** obligatorio en funciones públicas de los módulos.

### 2.2 Alcance de los cambios

- **No modifiques la lógica del código durante tareas de documentación.** Solo agrega o edita comentarios y docstrings.
- Si detectas un bug mientras documentas, **no lo arregles en el mismo commit**. Repórtalo al final de la sesión y déjalo marcado con `# FIXME: descripción del problema`.
- Si una función es ambigua o no entiendes qué hace, marca con `# TODO: revisar comportamiento` en lugar de inventar la descripción.
- **No elimines comentarios existentes que tengan información valiosa.** Solo refórmatealos al estándar.
- No borres bloques de código comentados sin avisar primero; algunos pueden ser referencia intencional.

### 2.3 Flujo de trabajo

- Trabaja **archivo por archivo** y muestra un resumen al terminar cada lote.
- **No toques múltiples carpetas en una misma tarea** a menos que se te pida explícitamente.
- Antes de hacer cambios masivos, confirma el plan conmigo.
- Si una tarea afecta más de 10 archivos, divídela y pregunta cómo proceder.

---

## 3. Estructura del proyecto

```
solarver/
├── backend/
│   ├── app.py              # Entry point de Flask
│   ├── db.py               # Conexión y helpers de base de datos
│   ├── routes/             # Blueprints REST (auth, clientes, pagos, etc.)
│   ├── services/           # Lógica de negocio (notificaciones, validadores, scheduler)
│   ├── static/uploads/     # Archivos subidos por usuarios (NO modificar)
│   └── backups/            # Respaldos SQL (NO modificar)
├── frontend/
│   ├── js/
│   │   ├── core/           # Utilidades compartidas (api, auth, partials, utils)
│   │   ├── modules/        # Lógica por dominio (clientes, pagos, reportes, etc.)
│   │   └── pages/          # Entry points por vista (admin, empleado, login)
│   ├── pages/              # HTML de cada vista
│   ├── partials/           # Fragmentos HTML reutilizables (tabs)
│   └── styles/             # CSS (base, dashboard, login)
├── demos/                  # Scripts de demostración (NO modificar sin pedir)
├── CONVENTIONS.md          # Estándar de comentarios y docstrings
├── README.md
├── CONTRIBUTING.md
├── requirements.txt
├── setup_solarver_db.sql
└── setup_solarver_dev.py
```

---

## 4. Carpetas que NO se deben tocar

- `backend/__pycache__/` y cualquier `__pycache__/` anidado.
- `backend/static/uploads/` (archivos de usuarios reales).
- `backend/backups/` (respaldos de base de datos).
- Cualquier archivo `.pyc` o binario.

Si encuentras `__pycache__` versionado en Git, avísame para agregarlo al `.gitignore`, pero no lo borres por tu cuenta.

---

## 5. Convenciones de Git

- **Una tarea = un commit** (o pocos commits relacionados).
- **Mensajes en español** y siguiendo prefijos convencionales:
  - `docs:` para cambios de comentarios/documentación.
  - `refactor:` para reorganización sin cambio funcional.
  - `fix:` para correcciones de bugs.
  - `feat:` para nuevas funcionalidades.
  - `style:` para formato (espacios, indentación, etc.).
- **Nunca hagas `git push` automáticamente.** Solo `git add` y `git commit` cuando se te pida.
- Antes de commitear, ejecuta `git diff --stat` y muéstrame qué cambió.

---

## 6. Verificación después de cada cambio

Después de modificar archivos, siempre:

1. Ejecuta `git diff` (o `git diff <archivo>`) para mostrar los cambios.
2. Si modificaste código Python, verifica que el archivo siga siendo sintácticamente válido (`python -m py_compile <archivo>`).
3. Si modificaste JavaScript, verifica que no haya errores obvios de sintaxis.
4. Reporta al final: archivos tocados, líneas agregadas/eliminadas, y cualquier `TODO` o `FIXME` que hayas dejado.

---

## 7. Comunicación

- **Sé conciso en los reportes.** No repitas el contenido de los archivos, solo resume qué cambió.
- **Pregunta antes de asumir.** Si algo del prompt es ambiguo, pide aclaración en lugar de adivinar.
- **Avisa de hallazgos.** Si encuentras código duplicado, funciones sin usar, o inconsistencias mientras documentas, repórtalas al final pero **no las arregles** sin pedir permiso.
- **Usa listas cuando reportes** múltiples archivos o cambios.

---

## 8. Comandos útiles del proyecto

- **Levantar el backend (desarrollo):** `python backend/app.py`
- **Configurar la base de datos:** `python setup_solarver_dev.py`
- **Instalar dependencias:** `pip install -r requirements.txt`

---

## 9. Lo que NO se debe hacer

- No instales dependencias nuevas sin pedir permiso.
- No modifiques `requirements.txt` sin justificación clara.
- No cambies versiones de Python o de librerías.
- No reescribas archivos completos cuando solo se necesita editar partes específicas.
- No generes código en inglés salvo que se pida explícitamente.
- No ejecutes scripts de los `demos/` sin avisar.
- No corras migraciones ni toques la base de datos sin confirmación.