# Convenciones de Código — Solarver

Este documento define las convenciones de comentarios y documentación para el proyecto **Solarver**. Todo código nuevo o refactorizado debe seguir estas reglas para mantener consistencia y facilitar el onboarding de nuevos desarrolladores.

---

## 1. Reglas generales

- **Idioma:** Todos los comentarios y docstrings se escriben en **español**, excepto las palabras reservadas técnicas (`Args`, `Returns`, `@param`, etc.) que se mantienen en inglés por ser parte del estándar.
- **Tono:** Imperativo y directo. Evita comentarios redundantes que repiten lo que el código ya dice.
- **El "por qué" sobre el "qué":** Los comentarios inline deben explicar la razón de una decisión, no describir lo evidente.
- **Mantenimiento:** Si modificas el comportamiento de una función, actualiza también su docstring. Documentación desactualizada es peor que ninguna.
- **No inventar:** Documenta únicamente lo que el código realmente hace. Si algo no queda claro, marca con `TODO:` o `FIXME:` en lugar de suponer.

---

## 2. Backend (Python)

### 2.1 Estilo de docstrings

Se usa el estilo **Google** para todos los docstrings. Aplica a módulos, clases, funciones y métodos públicos.

#### Encabezado de módulo

Cada archivo `.py` debe iniciar con un docstring de módulo:

```python
"""Módulo de rutas para gestión de pagos.

Expone los endpoints REST relacionados con el registro, consulta,
edición y cancelación de pagos de clientes.
"""
```

#### Funciones y métodos

```python
def registrar_pago(cliente_id: int, monto: float, fecha: str) -> dict:
    """Registra un nuevo pago para un cliente.

    Args:
        cliente_id: ID del cliente que realiza el pago.
        monto: Monto del pago en pesos mexicanos. Debe ser positivo.
        fecha: Fecha del pago en formato YYYY-MM-DD.

    Returns:
        Diccionario con los datos del pago creado, incluyendo su ID
        autogenerado y la marca de tiempo de creación.

    Raises:
        ValueError: Si el monto es negativo o la fecha tiene formato inválido.
        ClienteNoEncontradoError: Si no existe un cliente con el ID dado.
    """
```

#### Reglas para docstrings de Python

- La primera línea es un resumen breve en imperativo, terminada en punto.
- Si la función es trivial (un getter de una línea, por ejemplo), basta con la línea de resumen.
- Las secciones permitidas son: `Args`, `Returns`, `Raises`, `Yields` (para generadores) y `Example` (opcional).
- Omite la sección `Args` si la función no recibe parámetros.
- Omite `Returns` si la función no retorna nada explícitamente.
- No documentes `self` en métodos de clase.

### 2.2 Comentarios inline

```python
# Correcto: explica el "por qué"
# Usamos un timeout corto porque la API del banco suele tardar < 2s
response = requests.get(url, timeout=3)

# Incorrecto: redundante
# Hacemos una petición GET
response = requests.get(url, timeout=3)
```

- Usa `#` con un espacio después.
- Los comentarios de bloque preceden al código que describen, no van al final de la línea (excepto comentarios cortos tipo `# noqa` o aclaraciones de una palabra).

### 2.3 Marcadores estándar

Usa estos prefijos para marcar puntos pendientes o problemáticos:

- `# TODO: descripción` — Funcionalidad pendiente de implementar.
- `# FIXME: descripción` — Código que funciona pero necesita arreglo.
- `# HACK: descripción` — Solución temporal que debería revisarse.
- `# NOTE: descripción` — Aclaración importante para futuros lectores.

### 2.4 Type hints

Toda función nueva o refactorizada debe incluir type hints en parámetros y retorno. Esto reduce la necesidad de describir tipos en el docstring.

```python
def obtener_cliente(cliente_id: int) -> Cliente | None:
    """Recupera un cliente por su ID."""
```

---

## 3. Frontend (JavaScript)

### 3.1 Estilo de comentarios

Se usa el estándar **JSDoc** para funciones y módulos. Comentarios inline siguen las mismas reglas que en Python.

#### Encabezado de archivo

Cada archivo `.js` inicia con un bloque descriptivo:

```javascript
/**
 * Módulo de gestión de clientes.
 *
 * Maneja la carga, filtrado, creación y edición de clientes en la
 * interfaz del dashboard de administrador.
 */
```

#### Funciones

```javascript
/**
 * Carga la lista de clientes desde la API y la renderiza en la tabla.
 *
 * @param {number} [page=1] - Número de página a cargar.
 * @param {string} [filtro=''] - Texto de búsqueda opcional.
 * @returns {Promise<void>}
 * @throws {Error} Si la respuesta de la API no es válida.
 */
async function cargarClientes(page = 1, filtro = '') {
    // ...
}
```

#### Reglas para JSDoc

- La primera línea es un resumen breve en imperativo, terminada en punto.
- Usa `@param {tipo} nombre - descripción` para cada parámetro.
- Marca parámetros opcionales con corchetes: `[nombre=valorPorDefecto]`.
- Usa `@returns {tipo}` (no `@return`).
- Usa `@throws` para documentar errores que la función puede lanzar.
- Para funciones triviales, basta con un comentario de una línea: `// Devuelve true si el usuario es admin.`

### 3.2 Comentarios inline

Mismas reglas que Python: explicar el "por qué", no el "qué". Usa `//` con un espacio después.

```javascript
// Correcto
// Esperamos 300ms para evitar disparar la búsqueda en cada tecla
const debounced = debounce(buscar, 300);

// Incorrecto
// Llamamos a debounce
const debounced = debounce(buscar, 300);
```

### 3.3 Marcadores estándar

Idénticos a Python: `// TODO:`, `// FIXME:`, `// HACK:`, `// NOTE:`.

---

## 4. SQL

Para archivos `.sql` y consultas embebidas:

```sql
-- Recupera los pagos pendientes de conciliación del último mes.
-- Excluye pagos cancelados o reembolsados.
SELECT p.id, p.monto, p.fecha
FROM pagos p
WHERE p.estado = 'pendiente'
  AND p.fecha >= NOW() - INTERVAL 30 DAY;
```

- Usa `--` con un espacio después.
- Comenta consultas no triviales explicando qué retornan y por qué se filtran ciertos casos.

---

## 5. HTML

Comentarios para marcar secciones grandes o decisiones de estructura:

```html
<!-- Sección: Tabla de clientes con paginación -->
<div id="tabla-clientes">
    <!-- ... -->
</div>
```

- Evita comentar cada elemento; usa solo para marcar bloques grandes o aclarar intención.

---

## 6. CSS

```css
/* Estilos del dashboard principal.
   Sigue el sistema de spacing de 8px definido en base.css */

/* Botón primario: usado en acciones críticas como guardar y confirmar */
.btn-primary {
    /* ... */
}
```

---

## 7. Commits relacionados a documentación

Cuando los cambios sean exclusivamente de comentarios o docstrings, usa el prefijo `docs:` en el mensaje de commit:

```
docs: estandariza docstrings en backend/routes/pagos.py
docs: agrega JSDoc a frontend/js/modules/clientes.js
```

---

## 8. Lo que NO se debe hacer

- No dejar bloques de código comentados "por si acaso". Si no se usa, se borra (Git lo recuerda por ti).
- No escribir docstrings genéricos del tipo "Esta función hace algo".
- No copiar y pegar el mismo docstring entre funciones similares sin adaptarlo.
- No documentar parámetros que no existen o han sido renombrados.
- No mezclar idiomas dentro de un mismo comentario (excepto términos técnicos universales).