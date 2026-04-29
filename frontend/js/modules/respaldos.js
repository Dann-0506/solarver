/**
 * Módulo de gestión de respaldos de base de datos.
 *
 * Permite crear, descargar, restaurar y eliminar respaldos, así como
 * configurar la frecuencia de los respaldos automáticos. Restringido
 * a usuarios con rol de administrador.
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { mostrarToast, confirmarAccionGlobal } from '../core/utils.js';

/**
 * Construye los headers de autenticación para las peticiones al endpoint de respaldos.
 *
 * @param {boolean} [isJson=true] - Si es `true`, agrega `Content-Type: application/json`.
 * @returns {Object} Objeto de headers listo para usar en `fetch`.
 */
function getAuthHeaders(isJson = true) {
    const usuario = getUsuario();
    const headers = {
        'X-Username': usuario ? usuario.username : ''
    };
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

/**
 * Consulta la configuración actual del respaldo automático y actualiza
 * los elementos de título y subtítulo en la vista.
 *
 * @returns {Promise<void>}
 */
export async function actualizarVistaConfig() {
    const titleEl = document.getElementById('configVistaTitulo');
    const subEl = document.getElementById('configVistaSub');
    if (!titleEl || !subEl) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`, {
            method: 'GET',
            headers: getAuthHeaders(false)
        });
        const data = await res.json();

        if (data.success && data.config) {
            const { frecuencia, hora } = data.config;

            let textoTitulo = "";
            let textoSub = "";

            if (frecuencia === 'diario') {
                textoTitulo = "Respaldo automático diario";
                textoSub = `Programado · Todos los días a las ${hora}`;
            } else if (frecuencia === 'semanal') {
                textoTitulo = "Respaldo automático semanal";
                textoSub = `Programado · Domingos a las ${hora}`;
            } else if (frecuencia === 'mensual') {
                textoTitulo = "Respaldo automático mensual";
                textoSub = `Programado · Día 1 del mes a las ${hora}`;
            }

            titleEl.innerText = textoTitulo;
            subEl.innerText = textoSub;
        }
    } catch (e) {
        titleEl.innerText = "Error de conexión";
        subEl.innerText = "No se pudo leer la configuración";
    }
}

/**
 * Carga la lista de respaldos disponibles y los muestra en la tabla.
 * También actualiza el bloque de configuración del respaldo automático.
 *
 * @returns {Promise<void>}
 */
export async function cargarRespaldos() {
    actualizarVistaConfig();

    const tbody = document.getElementById('tablaRespaldosBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 32px; color: var(--muted);">Cargando respaldos...</td></tr>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos`, {
            method: 'GET',
            headers: getAuthHeaders(false)
        });
        const data = await res.json();

        if (data.success) {
            if (data.respaldos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--muted); padding: 32px;">No hay respaldos generados aún.</td></tr>';
                return;
            }

            tbody.innerHTML = data.respaldos.map(r => `
                <tr>
                    <td>
                        <div style="font-weight:600; color:var(--text);">${r.nombre}</div>
                    </td>
                    <td>
                        <span style="font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: 600;
                            ${r.tipo === 'Automático' ? 'background: #E8F0FE; color: var(--blue);' : 'background: #F3F4F6; color: var(--muted);'}">
                            ${r.tipo}
                        </span>
                    </td>
                    <td style="color: var(--muted); font-size: 0.85rem;">
                        ${r.fecha}
                    </td>
                    <td style="font-weight: 500;">
                        ${r.tamano}
                    </td>
                    <td>
                        <div class="action-btns" style="justify-content: flex-start;">
                            <button class="act-btn" title="Descargar" onclick="window.descargarRespaldo('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            <button class="act-btn warning" title="Restaurar" onclick="window.confirmarRestauracion('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                            </button>
                            <button class="act-btn danger" title="Eliminar" onclick="window.confirmarEliminarRespaldo('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--error); padding: 32px;">${data.message}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--error); padding: 32px;">Error al cargar los respaldos.</td></tr>';
    }
}

/**
 * Crea un respaldo manual de la base de datos y recarga la tabla al terminar.
 *
 * @returns {Promise<void>}
 */
export async function crearRespaldo() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tipo: 'manual' })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Respaldo manual creado con éxito.', 'success');
            cargarRespaldos();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error al crear respaldo', 'error');
    }
}

/**
 * Solicita confirmación y restaura la base de datos al estado del respaldo indicado.
 * Recarga la página automáticamente tras una restauración exitosa.
 *
 * @param {string} nombre - Nombre del archivo de respaldo a restaurar.
 * @returns {Promise<void>}
 */
export async function confirmarRestauracion(nombre) {
    const confirmado = await confirmarAccionGlobal(
        'Restaurar Sistema',
        `¿Restaurar la base de datos al estado de ${nombre}? Los cambios actuales se perderán.`
    );
    if (!confirmado) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/restaurar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Base de datos restaurada correctamente. Reiniciando...', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

/**
 * Solicita confirmación y elimina permanentemente el archivo de respaldo indicado.
 *
 * @param {string} nombre - Nombre del archivo de respaldo a eliminar.
 * @returns {Promise<void>}
 */
export async function confirmarEliminarRespaldo(nombre) {
    const confirmado = await confirmarAccionGlobal(
        'Eliminar Respaldo',
        `¿Estás seguro de que deseas eliminar permanentemente el respaldo:\n${nombre}?\n\nEsta acción NO se puede deshacer.`
    );

    if (!confirmado) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/${nombre}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Respaldo eliminado con éxito.', 'success');
            cargarRespaldos();
        } else {
            mostrarToast('Error al eliminar: ' + data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión con el servidor.', 'error');
    }
}

/**
 * Inicia la descarga del archivo de respaldo indicado redirigiendo al endpoint de descarga.
 *
 * @param {string} nombre - Nombre del archivo de respaldo a descargar.
 */
export function descargarRespaldo(nombre) {
    const usuario = getUsuario();
    if (!usuario) return;
    window.location.href = `${API_BASE_URL}/api/respaldos/descargar/${nombre}?u=${usuario.username}`;
}

/**
 * Abre el modal de configuración de respaldos automáticos y precarga los valores actuales.
 *
 * @returns {Promise<void>}
 */
export async function abrirConfigRespaldos() {
    const modal = document.getElementById('configRespaldoModal');
    if(!modal) {
        mostrarToast("Falta el HTML del modal 'configRespaldoModal'", 'error');
        return;
    }

    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`, {
            method: 'GET',
            headers: getAuthHeaders(false)
        });
        const data = await res.json();
        if(data.success && data.config) {
            document.getElementById('rFrecuencia').value = data.config.frecuencia || 'diario';
            document.getElementById('rHora').value = data.config.hora || '02:00';
        }
    } catch(e) {
        mostrarToast('No se pudo cargar la configuración actual. Revisa los valores antes de guardar.', 'error');
    }
}

// Cierra el modal de configuración de respaldos automáticos.
export function cerrarConfigRespaldos() {
    document.getElementById('configRespaldoModal').style.display = 'none';
}

/**
 * Lee los campos del modal de configuración y guarda la nueva frecuencia y hora de respaldo.
 *
 * @returns {Promise<void>}
 */
export async function guardarConfigRespaldos() {
    const frecuencia = document.getElementById('rFrecuencia').value;
    const hora = document.getElementById('rHora').value;
    const btn = document.getElementById('btnGuardarConfig');

    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ frecuencia, hora })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('¡Configuración de respaldos automáticos guardada!', 'success');
            cerrarConfigRespaldos();
            actualizarVistaConfig();
        } else {
            mostrarToast('Error: ' + data.message, 'error');
        }
    } catch(e) {
        mostrarToast('Error al guardar.', 'error');
    } finally {
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
}
