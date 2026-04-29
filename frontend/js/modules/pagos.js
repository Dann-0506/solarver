/**
 * Módulo de registro y visualización de pagos.
 *
 * Gestiona la tabla paginada de pagos, el modal de registro de un nuevo
 * pago y la búsqueda de clientes dentro del modal. Disponible para
 * administrador y empleado.
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { renderPagBtns, mostrarToast } from '../core/utils.js';

const PER_PAGE  = 8;
let _pagosData  = [];
let _pagosPage  = 1;
let _pagoSaldo  = 0;
let _clientesPago = [];

/**
 * Carga la lista de pagos desde la API y la renderiza en la tabla indicada.
 *
 * @param {string} [tbodyId='pagosTableBody'] - ID del elemento `<tbody>` destino.
 * @param {string} [infoId='pagosInfo'] - ID del elemento que muestra el texto de paginación.
 * @param {string} [btnsId='pagosBtns'] - ID del contenedor de botones de paginación.
 * @returns {Promise<void>}
 */
export async function cargarPagos(tbodyId = 'pagosTableBody', infoId = 'pagosInfo', btnsId = 'pagosBtns') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/pagos`);
        const data = await res.json();
        if (!data.success || !data.pagos.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">Sin pagos registrados.</td></tr>';
            const infoEl = document.getElementById(infoId);
            if (infoEl) infoEl.textContent = 'Sin registros';
            return;
        }
        _pagosData = data.pagos;
        _pagosPage = 1;
        renderPagosPage(tbodyId, infoId, btnsId);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</td></tr>';
    }
}

/**
 * Renderiza la página actual de `_pagosData` en la tabla y actualiza la paginación.
 *
 * @param {string} tbodyId - ID del `<tbody>`.
 * @param {string} infoId - ID del elemento de texto informativo.
 * @param {string} btnsId - ID del contenedor de botones de paginación.
 */
function renderPagosPage(tbodyId, infoId, btnsId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const total = _pagosData.length;
    const pages = Math.ceil(total / PER_PAGE) || 1;
    const start = (_pagosPage - 1) * PER_PAGE;
    const end   = Math.min(start + PER_PAGE, total);
    const data  = _pagosData.slice(start, end);

    tbody.innerHTML = data.map(p => {
        const esHuerfano = p.Folio.includes('HUERF');
        const saldo = parseFloat(p.Saldo_Pendiente) || 0;

        const colorNombre = esHuerfano ? 'color:var(--error); font-weight:800;' : 'font-weight:600;';
        const colorFondoFila = esHuerfano ? 'background: #FEF9EC;' : '';
        const textoSaldo = esHuerfano ? 'Requiere revisión' : (saldo > 0 ? '$' + saldo.toLocaleString() : 'Saldado');
        const colorSaldo = esHuerfano ? 'color:var(--warning)' : (saldo > 0 ? 'color:var(--error)' : 'color:var(--success)');

        return `<tr style="${colorFondoFila}">
          <td style="padding:12px 16px;font-family:'Sora',sans-serif;font-size:.82rem;font-weight:600;color:var(--blue-d)">${p.Folio}</td>
          <td style="padding:12px 16px; ${colorNombre}">${p.Nombre_Completo}</td>
          <td style="padding:12px 16px;font-weight:700;color:var(--success)">$${parseFloat(p.Monto).toLocaleString()}</td>
          <td style="padding:12px 16px">${p.Metodo_Pago || '—'}</td>
          <td style="padding:12px 16px;color:var(--muted);font-size:.82rem">${p.Fecha_Pago}</td>
          <td style="padding:12px 16px;font-weight:600;${colorSaldo}">${textoSaldo}</td>
          <td style="padding:12px 16px"><span style="background:${esHuerfano ? '#FEF9EC' : '#E8F8EF'};color:${esHuerfano ? '#F39C12' : '#27ae60'};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600">${p.Estado || 'Completado'}</span></td>
        </tr>`;
    }).join('');

    const infoEl = document.getElementById(infoId);
    if (infoEl) infoEl.textContent = `Mostrando ${start + 1}-${end} de ${total} pagos`;
    renderPagBtns(btnsId, pages, _pagosPage, 'window._cambiarPaginaPagos');
}

/**
 * Cambia la página visible de la tabla de pagos.
 *
 * @param {number} p - Número de página destino (base 1).
 */
export function cambiarPaginaPagos(p) {
    const pages = Math.ceil(_pagosData.length / PER_PAGE) || 1;
    if (p < 1 || p > pages) return;
    _pagosPage = p;
    renderPagosPage('pagosTableBody', 'pagosInfo', 'pagosBtns');
}

/**
 * Abre el modal de registro de pago, inicializa sus campos y precarga
 * la lista de clientes con saldo pendiente y el siguiente folio disponible.
 *
 * @param {string} [modalId='pagoModal'] - ID del modal a abrir.
 * @returns {Promise<void>}
 */
export async function abrirModalPago(modalId = 'pagoModal') {
    const fields = ['pagoMonto', 'pagoMetodo'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fecha = document.getElementById('pagoFecha');
    if (fecha) fecha.value = new Date().toISOString().split('T')[0];
    const saldoDisp = document.getElementById('pagoSaldoDisp');
    if (saldoDisp) saldoDisp.textContent = '—';
    const folioDisp = document.getElementById('pagoFolioDisp');
    if (folioDisp) folioDisp.textContent = '—';
    const clienteInput = document.getElementById('pagoClienteBuscar');
    if (clienteInput) clienteInput.value = '';
    const clienteHidden = document.getElementById('pagoCliente');
    if (clienteHidden) clienteHidden.value = '';
    const listaEl = document.getElementById('pagoClienteLista');
    if (listaEl) listaEl.style.display = 'none';
    const selEl = document.getElementById('pagoClienteSeleccionado');
    if (selEl) selEl.style.display = 'none';
    const advEl = document.getElementById('pagoAdvertencia');
    if (advEl) advEl.style.display = 'none';
    const btnGuardar = document.getElementById('btnGuardarPago');
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.style.opacity = '1'; }
    const mensDisp = document.getElementById('pagoMensualidadDisp');
    if (mensDisp) mensDisp.textContent = '—';

    _pagoSaldo = 0;
    _clientesPago = [];

    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes`);
        const data = await res.json();
        if (data.success) {
            _clientesPago = data.clientes.filter(c => parseFloat(c.Saldo_Pendiente) > 0);
        }
    } catch (e) {}

    document.getElementById(modalId).classList.add('open');
}

// Cierra el modal de registro de pago.
export function cerrarModalPago(modalId = 'pagoModal') {
    document.getElementById(modalId).classList.remove('open');
}

// Cierra el modal de comprobante de pago.
export function cerrarComprobante(modalId = 'comprobanteModal') {
    document.getElementById(modalId).classList.remove('open');
}

/**
 * Filtra la lista de clientes disponibles en el modal según el texto ingresado.
 */
export function filtrarClientesPago() {
    const q     = document.getElementById('pagoClienteBuscar')?.value.toLowerCase() || '';
    const lista = document.getElementById('pagoClienteLista');
    if (!lista) return;
    const datos = _clientesPago.filter(c =>
        c.Nombre_Completo.toLowerCase().includes(q) || c.Identificacion.toLowerCase().includes(q)
    );
    if (!q) { lista.style.display = 'none'; return; }
    if (!datos.length) {
        lista.innerHTML = '<div style="padding:12px 16px;color:var(--muted);font-size:.84rem">Sin resultados.</div>';
    } else {
        lista.innerHTML = datos.map(c => `
          <div onclick="window._seleccionarClientePago(${c.Id_Cliente},'${c.Nombre_Completo.replace(/'/g, "\\'")}',${c.Saldo_Pendiente}, ${c.Monto_Total}, ${c.Plazo_Meses}, ${c.Interes_Acumulado || 0})"
            style="padding:10px 16px;cursor:pointer;font-size:.85rem;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='white'">
            <div style="font-weight:600">${c.Nombre_Completo}</div>
            <div style="font-size:.78rem;color:var(--muted)">${c.Identificacion} — <span style="color:var(--error);font-weight:600">$${parseFloat(c.Saldo_Pendiente).toLocaleString()} pendiente</span></div>
          </div>`).join('');
    }
    lista.style.display = 'block';
}

/**
 * Selecciona un cliente en el modal de pago y precalcula la mensualidad sugerida
 * incluyendo intereses moratorios acumulados.
 *
 * @param {number} id - ID del cliente seleccionado.
 * @param {string} nombre - Nombre completo del cliente.
 * @param {number} saldo - Saldo pendiente actual del cliente.
 * @param {number} montoTotal - Monto total del contrato.
 * @param {number} plazoMeses - Plazo del contrato en meses.
 * @param {number} [interesAcumulado=0] - Interés moratorio acumulado.
 */
export function seleccionarClientePago(id, nombre, saldo, montoTotal, plazoMeses, interesAcumulado = 0) {
    const clienteHidden = document.getElementById('pagoCliente');
    if (clienteHidden) clienteHidden.value = id;
    const clienteInput  = document.getElementById('pagoClienteBuscar');
    if (clienteInput) clienteInput.value = nombre;
    const listaEl = document.getElementById('pagoClienteLista');
    if (listaEl) listaEl.style.display = 'none';
    const selEl = document.getElementById('pagoClienteSeleccionado');
    if (selEl) { selEl.style.display = 'block'; selEl.textContent = `✓ ${nombre}`; }

    _pagoSaldo = parseFloat(saldo);
    const saldoDisp = document.getElementById('pagoSaldoDisp');
    if (saldoDisp) saldoDisp.textContent = '$' + _pagoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 });

    const plazo = parseInt(plazoMeses) || 12;
    const mensualidadBase = (parseFloat(montoTotal) || 0) / plazo;
    const interes = parseFloat(interesAcumulado) || 0;
    const mensualidadConMora = mensualidadBase + interes;

    const mensDisp = document.getElementById('pagoMensualidadDisp');
    if (mensDisp) mensDisp.textContent = '$' + mensualidadConMora.toLocaleString('es-MX', { minimumFractionDigits: 2 });

    const inputMonto = document.getElementById('pagoMonto');
    if (inputMonto) {
        inputMonto.value = Math.min(mensualidadConMora, _pagoSaldo).toFixed(2);
    }

    verificarMonto();
}

/**
 * Valida que el monto ingresado no supere el saldo pendiente del cliente seleccionado.
 * Muestra una advertencia y bloquea el botón de guardar si el monto es excesivo.
 */
export function verificarMonto() {
    const monto  = parseFloat(document.getElementById('pagoMonto')?.value) || 0;
    const advEl  = document.getElementById('pagoAdvertencia');
    const btnEl  = document.getElementById('btnGuardarPago');
    if (_pagoSaldo > 0 && monto > _pagoSaldo) {
        if (advEl) {
            advEl.textContent = `⚠️ El monto ($${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) supera el saldo pendiente ($${_pagoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}).`;
            advEl.style.display = 'block';
        }
        if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.5'; }
    } else {
        if (advEl) advEl.style.display = 'none';
        if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
    }
}

/**
 * Valida los campos del modal y envía la petición de registro de pago a la API.
 * Si el registro es exitoso, muestra el comprobante y recarga la tabla de pagos.
 *
 * @returns {Promise<void>}
 */
export async function guardarPago() {
    const idCliente = document.getElementById('pagoCliente')?.value;
    const monto     = parseFloat(document.getElementById('pagoMonto')?.value);
    const metodo    = document.getElementById('pagoMetodo')?.value;
    const fecha     = document.getElementById('pagoFecha')?.value;
    const usuario   = getUsuario();

    if (!idCliente) { mostrarToast('Selecciona un cliente.', 'error'); return; }
    if (!monto || monto <= 0) { mostrarToast('El monto debe ser mayor a $0.', 'error'); return; }
    if (!metodo)  { mostrarToast('Selecciona un método de pago.', 'error'); return; }
    if (!fecha)   { mostrarToast('Selecciona una fecha.', 'error'); return; }

    const btn = document.getElementById('btnGuardarPago');
    if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }

    try {
        const res  = await fetch(`${API_BASE_URL}/api/pagos`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ id_cliente: parseInt(idCliente), monto, fecha_pago: fecha, metodo_pago: metodo, id_usuario: usuario?.id })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast('Pago registrado correctamente', 'success');
            const nombre = document.getElementById('pagoClienteBuscar')?.value || '';
            cerrarModalPago();
            // Rellenar comprobante
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            set('cmpCliente', nombre);
            set('cmpFolio',   data.folio);
            set('cmpMonto',   '$' + monto.toLocaleString());
            set('cmpMetodo',  metodo);
            set('cmpFecha',   new Date(fecha).toLocaleDateString('es-MX'));
            const saldo = parseFloat(data.nuevo_saldo) || 0;
            const saldoEl = document.getElementById('cmpSaldo');
            if (saldoEl) {
                saldoEl.textContent = saldo > 0 ? '$' + saldo.toLocaleString() : 'Saldado ✅';
                saldoEl.style.color = saldo > 0 ? 'var(--error)' : 'var(--success)';
            }
            document.getElementById('comprobanteModal').classList.add('open');
            cargarPagos();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btn) { btn.textContent = 'Confirmar pago'; btn.disabled = false; }
    }
}

// Cierra la lista de sugerencias al hacer clic fuera del campo de búsqueda.
document.addEventListener('click', (e) => {
    const lista = document.getElementById('pagoClienteLista');
    if (lista && !lista.contains(e.target) && e.target.id !== 'pagoClienteBuscar') {
        lista.style.display = 'none';
    }
});

// ── Exponer al scope global ────────────────────────────────
window._seleccionarClientePago = seleccionarClientePago;
window._cambiarPaginaPagos     = cambiarPaginaPagos;
