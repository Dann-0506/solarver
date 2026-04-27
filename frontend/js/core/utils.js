/**
 * Archivo: frontend/js/core/utils.js
 * Propósito: Funciones utilitarias compartidas entre todos los módulos.
 */

// ── Formato de moneda ──────────────────────────────────────
export function formatMoney(value) {
    const n = parseFloat(value) || 0;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return '$' + (n / 1000).toFixed(0) + 'k';
    return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

// ── Iniciales desde nombre completo ───────────────────────
export function getIniciales(nombre) {
    return (nombre || '')
        .split(' ')
        .map(p => p[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

// ── Renderizar botones de paginación ──────────────────────
export function renderPagBtns(containerId, pages, active, onChangeFn) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    let html = `<button class="pag-btn" onclick="${onChangeFn}(${active - 1})" ${active <= 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="pag-btn ${i === active ? 'active' : ''}" onclick="${onChangeFn}(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn" onclick="${onChangeFn}(${active + 1})" ${active >= pages ? 'disabled' : ''}>›</button>`;
    cont.innerHTML = html;
}

// ── Mostrar alerta en un elemento por ID ──────────────────
export function mostrarAlerta(elementId, msg, tipo = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent      = msg;
    el.style.display    = 'block';
    el.style.background = tipo === 'error'   ? '#FDECEA'
                        : tipo === 'success' ? '#E8F8EF'
                        : '#FEF9EC';
    el.style.color      = tipo === 'error'   ? 'var(--error)'
                        : tipo === 'success' ? 'var(--success)'
                        : 'var(--warning)';
    el.style.borderColor = el.style.color;
    if (tipo === 'success') {
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
}

export function ocultarAlerta(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

// ── Calcular próximo día de corte (5 o 17) ────────────────
export function calcularProximoDiaCorte() {
    const hoy  = new Date();
    const dia  = hoy.getDate();
    const mes  = hoy.getMonth();
    const anio = hoy.getFullYear();
    let proximoDia, proximoMes, proximoAnio;
    if (dia < 5) {
        proximoDia = 5; proximoMes = mes; proximoAnio = anio;
    } else if (dia < 17) {
        proximoDia = 17; proximoMes = mes; proximoAnio = anio;
    } else {
        proximoDia = 5;
        if (mes === 11) { proximoMes = 0; proximoAnio = anio + 1; }
        else            { proximoMes = mes + 1; proximoAnio = anio; }
    }
    const fecha = new Date(proximoAnio, proximoMes, proximoDia);
    return {
        dia: proximoDia,
        fecha,
        label: `${proximoDia}/${(proximoMes + 1).toString().padStart(2, '0')}/${proximoAnio}`
    };
}

export function mostrarToast(mensaje, tipo = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    // Iconos SVG estandarizados
    const icon = tipo === 'success' 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` 
        : tipo === 'error' 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` 
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    
    toast.innerHTML = `<span style="display:flex; align-items:center;">${icon}</span> <span>${mensaje}</span>`;
    container.appendChild(toast);

    // Auto-eliminar del DOM después de que termine la animación (aprox 3.8s)
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3800);
}

// ── Modal de Confirmación Global Asíncrono ────────────────
export function confirmarAccionGlobal(titulo, mensaje) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        overlay.style.zIndex = '3000'; // Asegurar que esté por encima de todo

        overlay.innerHTML = `
            <div class="modal" style="max-width:420px; text-align:center;">
                <div style="width:56px; height:56px; border-radius:50%; background:#FEF9EC; color:#F39C12; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <h3 style="margin-bottom:8px">${titulo}</h3>
                <p class="sub" style="margin-bottom:24px">${mensaje}</p>
                <div class="modal-footer" style="justify-content:center">
                    <button class="btn-secondary" id="btnCancelarConfirm">Cancelar</button>
                    <button class="btn-primary" id="btnAceptarConfirm">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('btnCancelarConfirm').onclick = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 250);
            resolve(false);
        };

        document.getElementById('btnAceptarConfirm').onclick = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 250);
            resolve(true);
        };
    });
}