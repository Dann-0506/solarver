# Hallazgos técnicos — backend/routes/

Registrados durante la tarea de documentación de `backend/routes/`.  
Ningún ítem fue corregido; todos están pendientes de decisión y acción.

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

## 2. Código duplicado — Lógica de conciliación

**Archivos:** `conciliaciones.py`  
**Funciones:** `conciliar_manual()`, `conciliar_masivo()`

Ambas funciones ejecutan exactamente los mismos pasos en el mismo orden:
1. `SELECT nextval('folio_seq')` → generar folio `FOL-MAN-N`
2. `INSERT INTO "PAGO"` con método `'Conciliación'`
3. `UPDATE "REFERENCIAPAGO"` → estado `'Conciliado_Manual'`
4. `SELECT "Saldo_Pendiente"` → calcular nuevo saldo
5. `UPDATE "DEUDA"` → actualizar saldo y estatus

La única diferencia es que `conciliar_masivo` itera sobre una lista y omite referencias no encontradas (`continue`). Un bug corregido en una función deberá replicarse manualmente en la otra.

**Acción sugerida:** extraer un helper privado `_procesar_referencia(cursor, id_ref)` y llamarlo desde ambas rutas.

---

## 3. Código duplicado — Generación de folio

**Archivos:** `pagos.py`, `conciliaciones.py`, `webhooks.py`  
**Patrón repetido:** `SELECT nextval('folio_seq') AS num`

La misma consulta para consumir la secuencia de folios aparece en 5 puntos:

| Archivo | Función | Prefijo de folio |
|---|---|---|
| `pagos.py` | `siguiente_folio()` | `FOL-N` |
| `pagos.py` | `registrar_pago()` | `FOL-N` |
| `conciliaciones.py` | `conciliar_manual()` | `FOL-MAN-N` |
| `conciliaciones.py` | `conciliar_masivo()` | `FOL-MAN-N` |
| `webhooks.py` | `recibir_pago_automatico()` | `FOL-AUTO-N` / `FOL-HUERF-N` |

**Acción sugerida:** centralizar en un helper `generar_folio(cursor, prefijo="FOL")` en `db.py` o en un servicio compartido.

---

## 4. Ruta de historial fuera de su módulo

**Archivo:** `recordatorios.py`  
**Función:** `get_historial()`  
**Ruta expuesta:** `GET /api/historial`

Esta función retorna el historial de cambios del sistema (`HISTORIALCAMBIOS`) y está registrada en `recordatorios_bp`, aunque conceptualmente no tiene relación con los recordatorios. La ruta tampoco sigue el patrón `/recordatorios/...` del resto del blueprint.

**Acción sugerida:** mover `get_historial()` a `clientes.py` o crear un blueprint `historial_bp` dedicado, y actualizar la ruta en el frontend.

---

## 5. Función con dos métodos HTTP en una sola firma

**Archivos:** `usuarios.py`, `respaldos.py`  
**Funciones:** `gestionar_usuario()` (PUT + DELETE), `config_respaldos()` (GET + POST)

Las dos funciones manejan verbos HTTP distintos con lógica completamente separada dentro del mismo cuerpo. Esto dificulta escribir pruebas unitarias por verbo y aumenta la complejidad ciclomática.

**Acción sugerida:** separar en funciones independientes (`editar_usuario`, `eliminar_usuario`, `get_config_respaldos`, `set_config_respaldos`), o al menos extraer el cuerpo de cada verbo a funciones privadas.

---

## 6. Finales de línea mixtos (CRLF / LF)

**Archivos:** `clientes.py`, `recordatorios.py`

Git reporta que estos dos archivos tienen finales de línea CRLF, distintos al resto del proyecto que usa LF. Probablemente fueron editados con un editor de Windows.

**Acción sugerida:** normalizar con `git add --renormalize` o configurar `.gitattributes` con `* text=auto` para forzar LF en todo el repositorio.

---

## 7. Autenticación por parámetro URL en descarga de respaldos

**Archivo:** `respaldos.py`  
**Función:** `descargar_respaldo()`  
**Ruta:** `GET /api/respaldos/descargar/<nombre>?u=<username>`

El username del administrador viaja en la URL en texto claro (`?u=...`). Esto lo expone en logs del servidor, historial del navegador y encabezados `Referer`.

**Acción sugerida:** evaluar una solución de descarga con token de corta duración (pre-signed URL o token JWT de un solo uso) en lugar del username directamente en la query string.

---

## 8. Estatus de deuda simplificado en conciliación

**Archivos:** `conciliaciones.py`, `webhooks.py`

Al actualizar la deuda tras una conciliación, el estatus calculado es únicamente `'pagado'` o `'pendiente'`:

```python
nuevo_estatus = 'pagado' if nuevo_saldo <= 0 else 'pendiente'
```

En cambio, `registrar_pago()` en `pagos.py` incluye la lógica completa (considera `'atrasado'` según el día del corte y el monto pagado en el periodo). Las conciliaciones nunca producen el estatus `'atrasado'` aunque el pago llegue tarde.

**Acción sugerida:** alinear la lógica de estatus de los tres flujos de pago (manual, conciliación, webhook), o documentar intencionalmente que los pagos conciliados siempre resetean a `'pendiente'` si hay saldo.

---

# Hallazgos técnicos — backend/services/

Registrados durante la tarea de documentación de `backend/services/`.  
Ningún ítem fue corregido; todos están pendientes de decisión y acción.
El hallazgo 12 ya está marcado con `# FIXME` en el código.

---

## 9. Importación sin usar en notificaciones_service

**Archivo:** `notificaciones_service.py`  
**Línea:** `from reportlab.lib.pagesizes import letter`

Este import existe en el archivo pero `letter` no se usa en ningún punto de `notificaciones_service.py`. Solo se utiliza en `documentos_service.py`, que es quien genera los PDFs.

**Acción sugerida:** eliminar la importación.

---

## 10. `except` desnudo en generar_excel_reporte

**Archivo:** `documentos_service.py`  
**Función:** `generar_excel_reporte()`

El bloque `try/except` que ajusta el ancho de columnas usa `except:` sin tipo, lo que captura también `SystemExit`, `KeyboardInterrupt` y `GeneratorExit`. Un error crítico del intérprete quedaría silenciado y el archivo Excel seguiría generándose con datos posiblemente corruptos.

```python
except:
    pass
```

**Acción sugerida:** cambiar a `except Exception: pass`.

---

## 11. Commit por cliente dentro del loop en procesar_cobros_automaticos

**Archivo:** `scheduler_service.py`  
**Función:** `procesar_cobros_automaticos()`

La función hace `conn.commit()` dentro del `for` por cada cliente procesado. Si el cliente N se confirma pero el envío del cliente N+1 falla y provoca `conn.rollback()`, la inserción en `REFERENCIAPAGO` del cliente N ya fue persistida aunque el proceso general no termine bien. Los registros de referencia huérfanos (sin notificación enviada) deberían considerarse en la lógica de reintento.

**Acción sugerida:** evaluar si es intencional el commit individual por cliente, o si conviene acumular todos los cambios y confirmar en un único commit al final del loop.

---

## 12. Posible NameError en validar_telefono

**Archivo:** `validators_service.py`  
**Función:** `validar_telefono()`  
**Marcador en código:** `# FIXME` (línea ~124)

El bloque `except Exception as e:` retorna `True, tel_wa`, pero `tel_wa` se define después de `phonenumbers.format_number()`. Si esta llamada lanzara una excepción no prevista, `tel_wa` no estaría definido y se produciría un `NameError` dentro del propio handler.

**Acción sugerida:** inicializar `tel_wa = None` antes del bloque `try`, o separar el `except` genérico del `except NumberParseException` para que solo cubra el bloque de la llamada a la API.
