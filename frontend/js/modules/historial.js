/**
 * Módulo de historial de cambios del sistema.
 *
 * Carga y pagina el registro de acciones realizadas por los usuarios
 * (creación de clientes, pagos, recordatorios, etc.), con etiquetas
 * de color por tipo de acción.
 */

import { API_BASE_URL } from '../core/api.js';
import { renderPagBtns, mostrarToast } from '../core/utils.js';

const PER_PAGE = 10;
let _historialData = [];
let _historialPage = 1;

/**
 * Mapa de códigos de acción a su etiqueta y colores de presentación.
 * Permite renderizar badges sin condiciones en el template.
 */
const accionColor = {
    'CREAR_CLIENTE':       { bg: 'rgba(46,213,115,0.1)',  color: '#27ae60', label: 'Creación'        },
    'EDITAR_CLIENTE':      { bg: 'rgba(30,133,200,0.1)',  color: '#1E85C8', label: 'Edición'         },
    'REGISTRAR_PAGO':      { bg: 'rgba(46,213,115,0.1)',  color: '#27ae60', label: 'Pago'            },
    'ACTUALIZAR_ESTATUS':  { bg: 'rgba(52,152,219,0.1)',  color: '#2980b9', label: 'Estatus auto'    },
    'RECORDATORIO_CORREO': { bg: 'rgba(241,196,15,0.1)',  color: '#f39c12', label: 'Recordatorio'    },
    'CREAR_USUARIO':       { bg: 'rgba(255,122,31,0.1)',  color: '#ff7a1f', label: 'Nuevo Usuario'   },
    'ELIMINAR_USUARIO':    { bg: 'rgba(231,76,60,0.1)',   color: '#e74c3c', label: 'Borrar Usuario'  },
    'ELIMINAR_CLIENTE':    { bg: 'rgba(231,76,60,0.1)',   color: '#e74c3c', label: 'Borrar Cliente'  }
};

/**
 * Carga el historial completo desde la API y renderiza la primera página.
 *
 * @returns {Promise<void>}
 */
export async function cargarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Cargando historial...</td></tr>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/historial`);
        const data = await res.json();

        if (data.success) {
            _historialData = data.historial || [];
            _historialPage = 1;
            renderHistorial();
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">${data.message}</td></tr>`;
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">Error al conectar con el servidor.</td></tr>';
        mostrarToast('Error al conectar con el servidor para cargar el historial.', 'error');
    }
}

/**
 * Renderiza la página actual de `_historialData` en la tabla y actualiza la paginación.
 */
function renderHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;

    const total = _historialData.length;
    const pages = Math.ceil(total / PER_PAGE) || 1;
    const start = (_historialPage - 1) * PER_PAGE;
    const end   = Math.min(start + PER_PAGE, total);
    const data  = _historialData.slice(start, end);

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No hay registros recientes en el sistema.</td></tr>';
        const infoEl = document.getElementById('historialPagInfo');
        if (infoEl) infoEl.textContent = '';
        renderPagBtns('historialBtns', 1, 1, 'window._cambiarPaginaHistorial');
        return;
    }

    tbody.innerHTML = data.map(r => {
        const ac = accionColor[r.Accion] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--muted)', label: r.Accion };
        return `<tr style="border-top:1px solid var(--border)">
          <td style="padding:12px 16px;font-size:.82rem;color:var(--muted);white-space:nowrap">${r.Fecha || '—'}</td>
          <td style="padding:12px 16px;font-size:.85rem;font-weight:600">${r.Cliente || '—'}</td>
          <td style="padding:12px 16px">
            <span style="background:${ac.bg};color:${ac.color};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600;font-family:'Sora',sans-serif">${ac.label}</span>
          </td>
          <td style="padding:12px 16px;font-size:.82rem;color:var(--muted)">${r.Descripcion || '—'}</td>
          <td style="padding:12px 16px;font-size:.82rem;font-weight:500">${r.Usuario || '—'}</td>
        </tr>`;
    }).join('');

    const infoEl = document.getElementById('historialPagInfo');
    if (infoEl) infoEl.textContent = `Mostrando ${start + 1}-${end} de ${total} registros`;
    renderPagBtns('historialBtns', pages, _historialPage, 'window._cambiarPaginaHistorial');
}

/**
 * Cambia la página visible del historial.
 *
 * @param {number} p - Número de página destino (base 1).
 */
export function cambiarPaginaHistorial(p) {
    const pages = Math.ceil(_historialData.length / PER_PAGE) || 1;
    if (p < 1 || p > pages) return;
    _historialPage = p;
    renderHistorial();
}

window._cambiarPaginaHistorial = cambiarPaginaHistorial;
