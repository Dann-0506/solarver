# Hallazgos técnicos — backend/routes/

Registrados durante la tarea de documentación de `backend/routes/`.  
Todos están pendientes de decisión y acción.

---

## 1. Seguridad — Contraseñas en texto plano

**Archivos:** `auth.py`, `usuarios.py`  
**Marcador en código:** `# FIXME`

En ambos archivos existe una ruta de comparación de contraseñas sin hash:

- **`auth.py` → `login()`**: si la contraseña almacenada no comienza con `$2b$` o `$2a$`, se compara directamente como texto plano.
- **`usuarios.py` → `actualizar_password_perfil()`**: si `bcrypt.checkpw` lanza `ValueError`, se compara `pass_actual == contrasena_bd` como fallback.

Cualquier cuenta que no tenga su contraseña migrada a bcrypt puede autenticarse sin protección de hash. Esto también significa que el dato en la BD está expuesto en texto plano.

**Acción sugerida:** auditar la tabla `USUARIO` para detectar registros sin hash, forzar el rehash en el próximo login exitoso o migrar todas las contraseñas en un script de mantenimiento.

---

## 2. Ruta de historial fuera de su módulo

**Archivo:** `recordatorios.py`  
**Función:** `get_historial()`  
**Ruta expuesta:** `GET /api/historial`

Esta función retorna el historial de cambios del sistema (`HISTORIALCAMBIOS`) y está registrada en `recordatorios_bp`, aunque conceptualmente no tiene relación con los recordatorios. La ruta tampoco sigue el patrón `/recordatorios/...` del resto del blueprint.

**Acción sugerida:** mover `get_historial()` a `clientes.py` o crear un blueprint `historial_bp` dedicado, y actualizar la ruta en el frontend.

---

## 3. Función con dos métodos HTTP en una sola firma

**Archivos:** `usuarios.py`, `respaldos.py`  
**Funciones:** `gestionar_usuario()` (PUT + DELETE), `config_respaldos()` (GET + POST)

Las dos funciones manejan verbos HTTP distintos con lógica completamente separada dentro del mismo cuerpo. Esto dificulta escribir pruebas unitarias por verbo y aumenta la complejidad ciclomática.

**Acción sugerida:** separar en funciones independientes (`editar_usuario`, `eliminar_usuario`, `get_config_respaldos`, `set_config_respaldos`), o al menos extraer el cuerpo de cada verbo a funciones privadas.

---

## 4. Finales de línea mixtos (CRLF / LF)

**Archivos:** `clientes.py`, `recordatorios.py`

Git reporta que estos dos archivos tienen finales de línea CRLF, distintos al resto del proyecto que usa LF. Probablemente fueron editados con un editor de Windows.

**Acción sugerida:** normalizar con `git add --renormalize` o configurar `.gitattributes` con `* text=auto` para forzar LF en todo el repositorio.

---

# Hallazgos técnicos — backend/services/

Registrados durante la tarea de documentación de `backend/services/`.  
Todos están pendientes de decisión y acción.

---

## 5. Importación sin usar en notificaciones_service

**Archivo:** `notificaciones_service.py`  
**Línea:** `from reportlab.lib.pagesizes import letter`

Este import existe en el archivo pero `letter` no se usa en ningún punto de `notificaciones_service.py`. Solo se utiliza en `documentos_service.py`, que es quien genera los PDFs.

**Acción sugerida:** eliminar la importación.

---

## 6. `except` desnudo en generar_excel_reporte

**Archivo:** `documentos_service.py`  
**Función:** `generar_excel_reporte()`

El bloque `try/except` que ajusta el ancho de columnas usa `except:` sin tipo, lo que captura también `SystemExit`, `KeyboardInterrupt` y `GeneratorExit`. Un error crítico del intérprete quedaría silenciado y el archivo Excel seguiría generándose con datos posiblemente corruptos.

```python
except:
    pass
```

**Acción sugerida:** cambiar a `except Exception: pass`.

---

## 7. Commit por cliente dentro del loop en procesar_cobros_automaticos

**Archivo:** `scheduler_service.py`  
**Función:** `procesar_cobros_automaticos()`

La función hace `conn.commit()` dentro del `for` por cada cliente procesado. Si el cliente N se confirma pero el envío del cliente N+1 falla y provoca `conn.rollback()`, la inserción en `REFERENCIAPAGO` del cliente N ya fue persistida aunque el proceso general no termine bien. Los registros de referencia huérfanos (sin notificación enviada) deberían considerarse en la lógica de reintento.

**Acción sugerida:** evaluar si es intencional el commit individual por cliente, o si conviene acumular todos los cambios y confirmar en un único commit al final del loop.

---

# Hallazgos técnicos — backend/app.py y backend/db.py

Registrados durante la tarea de documentación de `backend/app.py` y `backend/db.py`.  
Todos están pendientes de decisión y acción.

---

## 8. Importación sin usar — psycopg2.extras en db.py

**Archivo:** `db.py`  
**Línea:** `import psycopg2.extras`

El módulo `psycopg2.extras` se importa en `db.py` pero no se usa en ningún punto del archivo. Si algún otro módulo lo importa transitivamente vía `db`, eso constituye un acoplamiento implícito que puede romperse si se reorganizan los imports.

**Acción sugerida:** si `psycopg2.extras` se necesita en otro módulo (por ejemplo para usar `RealDictCursor`), importarlo directamente en ese módulo. Si no se usa en ningún lado, eliminar la línea.

---

# Hallazgos técnicos — frontend/js/core/

Registrados durante la tarea de documentación de `frontend/js/core/`.  
El hallazgo 10 implicó corrección del comentario inconsistente, no del código.

---

## 9. Importación sin usar en auth.js

**Archivo:** `auth.js`  
**Línea:** `import { API_BASE_URL } from './api.js';`

`API_BASE_URL` se importa pero no se usa en ninguna de las cinco funciones del archivo. Es probable que sea un import residual de una versión anterior donde `auth.js` realizaba llamadas directas a la API.

**Acción sugerida:** eliminar la importación si no se planea usar `API_BASE_URL` en este módulo. Si se prevé usarla en el futuro, agregar una llamada real o un comentario que justifique el import.

---

## 10. Inconsistencia entre comentario y código en cargarListasDashboard

**Archivo:** `dashboard_utils.js`  
**Función:** `cargarListasDashboard()`  
**Sección:** Recordatorios (bloque 3)

El comentario original decía `// Limitado a 2 registros`, pero el código aplicaba `.slice(0, 1)`. El comentario fue corregido para reflejar lo que el código realmente hace (`Limitado a 1 registro`), pero la intención original es ambigua: podría ser un error de límite o un cambio deliberado sin actualizar el comentario.

**Acción sugerida:** confirmar si el límite correcto es 1 o 2 y ajustar el código o dejarlo documentado intencionalmente.

---

# Hallazgos técnicos — frontend/js/modules/

Registrados durante la tarea de documentación de `frontend/js/modules/`.  
Todos están pendientes de decisión y acción (salvo el catch vacío de `respaldos.js`, corregido por instrucción explícita).

---

## 11. `event.target` del objeto global en reportes.js

**Archivo:** `reportes.js`  
**Funciones:** `descargarReporte()`, `enviarEstadosDeCuenta()`  
**Marcadores en código:** `// TODO: revisar comportamiento` (líneas 138 y 341)

Ambas funciones obtienen la referencia al botón clickeado a través del objeto global `event` en lugar de recibirlo como parámetro. Esta forma de acceder al evento es no estándar, no funciona en entornos con `strict mode` habilitado y complica las pruebas unitarias (habría que simular el objeto global).

```javascript
// Problemático — depende de window.event implícito
const btn = event.target;
```

**Acción sugerida:** hacer que los `onclick` del HTML pasen el botón explícitamente:
```html
onclick="descargarReporte('pdf', this)"
```
y recibir el elemento como segundo parámetro en la función.

---

## 12. Importación sin usar — getIniciales en recordatorios.js

**Archivo:** `recordatorios.js`  
**Línea:** `import { getIniciales, mostrarToast, confirmarAccionGlobal } from '../core/utils.js';`

`getIniciales` se importa pero no se llama en ninguna función del módulo. Es probable que sea un residuo de una versión anterior donde `renderClientesRec` mostraba avatares con iniciales.

**Acción sugerida:** eliminar `getIniciales` de la importación si no se planea usarlo.

---

## 13. Patrón de paginación triplicado en módulos

**Archivos:** `clientes.js` → `cambiarPagina`, `pagos.js` → `cambiarPaginaPagos`, `historial.js` → `cambiarPaginaHistorial`

Las tres funciones tienen lógica idéntica: validar rango `(p < 1 || p > pages)`, actualizar la variable de página y llamar a la función de render correspondiente. Un bug o cambio de criterio en la guardia deberá replicarse en los tres sitios.

**Acción sugerida:** extraer un helper genérico en `core/utils.js`, por ejemplo:

```javascript
function cambiarPagina(p, total, perPage, paginaRef, renderFn) { ... }
```

---

## 14. HTML de estado de carga duplicado en múltiples módulos

**Archivos:** `clientes.js`, `pagos.js`, `conciliaciones.js`, `recordatorios.js`, `reportes.js`, `respaldos.js`, `historial.js`

La cadena HTML del estado "Cargando..." con estilos inline se repite al menos en 7 módulos con variaciones mínimas (distinto `colspan`, distinto texto). Cualquier cambio de estilo o texto tendrá que aplicarse en cada aparición.

**Acción sugerida:** añadir a `core/utils.js` un helper `setTableLoading(tbodyId, colspan, mensaje)` que centralice la generación de esta fila.

---

# Hallazgos técnicos — Seguridad transversal

---

## 15. Autenticación basada en header X-Username sin verificación real

**Archivos:** todos los endpoints que usan `request.headers.get('X-Username')`

El esquema actual de autenticación lee el username del header `X-Username` que envía el cliente, pero no valida que la sesión sea real. Cualquier cliente (incluido un atacante con curl) puede enviar `X-Username: admin` y el backend le creerá. Es una vulnerabilidad de control de acceso roto (OWASP A01:2021).

Detectado al corregir la exposición del username en la URL (`descargar_respaldo`). Esa corrección resolvió la visibilidad en logs y `Referer`, pero no la autenticación en sí, porque se mantuvo consistencia con el resto de la app.

**Acción sugerida:** migrar a sesiones de Flask (`session['user_id']`) o JWT en un sprint dedicado. Implica:
- Modificar el endpoint de login para guardar datos en sesión.
- Modificar todos los endpoints protegidos para leer de sesión.
- Modificar el frontend para no enviar `X-Username` manualmente.
- Manejar logout, expiración y refresco.

**Prioridad:** prerequisito antes de hacer público el proyecto.  
**Estimación:** 1 sprint dedicado (no se debe mezclar con otros fixes).
