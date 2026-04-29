/**
 * Módulo de utilidades compartidas.
 *
 * Provee funciones de formato, manipulación del DOM y controles de UI
 * reutilizables en todos los módulos de la aplicación.
 */

// ── Formato de moneda ──────────────────────────────────────

/**
 * Formatea un valor numérico como cadena de moneda compacta en pesos mexicanos.
 *
 * @param {number|string} value - Valor a formatear. Se convierte con parseFloat.
 * @returns {string} Cadena formateada (ej. '$1.5M', '$300k', '$1,234.56').
 */
export function formatMoney(value) {
    const n = parseFloat(value) || 0;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return '$' + (n / 1000).toFixed(0) + 'k';
    return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
}

// ── Iniciales desde nombre completo ───────────────────────

/**
 * Extrae hasta dos iniciales en mayúsculas del nombre completo dado.
 *
 * @param {string} nombre - Nombre completo del usuario.
 * @returns {string} Cadena de una o dos letras en mayúsculas.
 */
export function getIniciales(nombre) {
    return (nombre || '')
        .split(' ')
        .map(p => p[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

// ── Renderizar botones de paginación ──────────────────────

/**
 * Renderiza los botones de paginación dentro de un contenedor del DOM.
 *
 * Los botones de cada página ejecutan un onclick usando el nombre de función
 * recibido como cadena, por lo que dicha función debe existir en el ámbito global.
 *
 * @param {string} containerId - ID del elemento contenedor de los botones.
 * @param {number} pages - Número total de páginas.
 * @param {number} active - Número de la página actualmente activa.
 * @param {string} onChangeFn - Nombre (como cadena) de la función a invocar al cambiar de página.
 * @returns {void}
 */
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

/**
 * Muestra un mensaje de alerta estilizado en un elemento del DOM.
 *
 * Para alertas de tipo 'success', el elemento se oculta automáticamente
 * después de 4 segundos.
 *
 * @param {string} elementId - ID del elemento donde se mostrará la alerta.
 * @param {string} msg - Texto del mensaje a mostrar.
 * @param {string} [tipo='error'] - Tipo de alerta: 'error', 'success' o 'warning'.
 * @returns {void}
 */
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

/**
 * Oculta un elemento de alerta en el DOM.
 *
 * @param {string} elementId - ID del elemento a ocultar.
 * @returns {void}
 */
export function ocultarAlerta(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

// ── Calcular próximo día de corte (5 o 17) ────────────────

/**
 * Calcula la fecha del próximo día de corte de pago (5 o 17 del mes).
 *
 * @returns {{dia: number, fecha: Date, label: string}} Objeto con el día numérico,
 *   el objeto Date correspondiente y una etiqueta en formato DD/MM/AAAA.
 */
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

/**
 * Muestra una notificación tipo toast en la esquina de la pantalla.
 *
 * Crea el contenedor si no existe y lo elimina del DOM al finalizar
 * la animación (aprox. 3.8 s).
 *
 * @param {string} mensaje - Texto a mostrar en el toast.
 * @param {string} [tipo='success'] - Tipo de toast: 'success', 'error' o 'warning'.
 * @returns {void}
 */
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

/**
 * Muestra un modal de confirmación global y retorna la decisión del usuario.
 *
 * @param {string} titulo - Título del modal.
 * @param {string} mensaje - Cuerpo descriptivo de la acción a confirmar.
 * @returns {Promise<boolean>} Resuelve con true si el usuario acepta, false si cancela.
 */
export function confirmarAccionGlobal(titulo, mensaje) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        // Asegurar que esté por encima de todo
        overlay.style.zIndex = '3000';

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
