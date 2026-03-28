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