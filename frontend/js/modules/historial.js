/**
 * Archivo: frontend/js/modules/historial.js
 * Propósito: Tabla paginada del historial de cambios del sistema.
 */

import { API_BASE_URL } from '../core/api.js';
import { renderPagBtns } from '../core/utils.js';

const PER_PAGE = 10;
let _historialData = [];
let _historialPage = 1;

const accionColor = {
    'CREAR_CLIENTE':       { bg: 'rgba(46,213,115,0.1)',  color: '#27ae60', label: 'Creación'        },
    'EDITAR_CLIENTE':      { bg: 'rgba(30,133,200,0.1)',  color: '#1E85C8', label: 'Edición'         },
    'REGISTRAR_PAGO':      { bg: 'rgba(46,213,115,0.1)',  color: '#27ae60', label: 'Pago'            },
    'ACTUALIZAR_ESTATUS':  { bg: 'rgba(52,152,219,0.1)',  color: '#2980b9', label: 'Estatus auto'    },
    'RECORDATORIO_CORREO': { bg: 'rgba(241,196,15,0.1)',  color: '#f39c12', label: 'Recordatorio'    },
    'CREAR_USUARIO':       { bg: 'rgba(255,122,31,0.1)',  color: '#FF7A1F', label: 'Nuevo usuario'   },
    'EDITAR_USUARIO':      { bg: 'rgba(155,89,182,0.1)',  color: '#8e44ad', label: 'Edición usuario' },
};

// ── Cargar historial desde API ─────────────────────────────
export async function cargarHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/historial`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">Error al cargar historial.</td></tr>';
            return;
        }
        _historialData = data.historial;
        _historialPage = 1;
        const countEl = document.getElementById('historialCount');
        if (countEl) countEl.textContent = `(${_historialData.length})`;
        renderHistorialPage();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</td></tr>';
    }
}

function renderHistorialPage() {
    const tbody = document.getElementById('historialTableBody');
    if (!tbody) return;
    const total = _historialData.length;
    const pages = Math.ceil(total / PER_PAGE) || 1;
    const start = (_historialPage - 1) * PER_PAGE;
    const end   = Math.min(start + PER_PAGE, total);
    const data  = _historialData.slice(start, end);

    if (!total) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">Sin registros aún.</td></tr>';
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
    renderPagBtns('historialPagBtns', pages, _historialPage, 'window._cambiarHistorialPage');
}

export function cambiarHistorialPage(p) {
    const pages = Math.ceil(_historialData.length / PER_PAGE) || 1;
    if (p < 1 || p > pages) return;
    _historialPage = p;
    renderHistorialPage();
}

// ── Exponer al scope global ────────────────────────────────
window._cambiarHistorialPage = cambiarHistorialPage;