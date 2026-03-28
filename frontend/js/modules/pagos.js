/**
 * Archivo: frontend/js/modules/pagos.js
 * Propósito: Registro y visualización de pagos. Usado por admin y empleado.
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { renderPagBtns, mostrarAlerta, ocultarAlerta } from '../core/utils.js';

const PER_PAGE  = 8;
let _pagosData  = [];
let _pagosPage  = 1;
let _pagoFolio  = null;
let _pagoSaldo  = 0;
let _clientesPago = [];

// ── Cargar lista de pagos ──────────────────────────────────
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

function renderPagosPage(tbodyId, infoId, btnsId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const total = _pagosData.length;
    const pages = Math.ceil(total / PER_PAGE) || 1;
    const start = (_pagosPage - 1) * PER_PAGE;
    const end   = Math.min(start + PER_PAGE, total);
    const data  = _pagosData.slice(start, end);

    tbody.innerHTML = data.map(p => {
        const saldo = parseFloat(p.Saldo_Pendiente) || 0;
        return `<tr>
          <td style="padding:12px 16px;font-family:'Sora',sans-serif;font-size:.82rem;font-weight:600;color:var(--blue-d)">${p.Folio}</td>
          <td style="padding:12px 16px;font-weight:600">${p.Nombre_Completo}</td>
          <td style="padding:12px 16px;font-weight:700;color:var(--success)">$${parseFloat(p.Monto).toLocaleString()}</td>
          <td style="padding:12px 16px">${p.Metodo_Pago || '—'}</td>
          <td style="padding:12px 16px;color:var(--muted);font-size:.82rem">${p.Fecha_Pago}</td>
          <td style="padding:12px 16px;font-weight:600;color:${saldo > 0 ? 'var(--error)' : 'var(--success)'}">
            ${saldo > 0 ? '$' + saldo.toLocaleString() : 'Saldado'}
          </td>
          <td style="padding:12px 16px"><span style="background:#E8F8EF;color:#27ae60;padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600">${p.Estado || 'Completado'}</span></td>
        </tr>`;
    }).join('');

    const infoEl = document.getElementById(infoId);
    if (infoEl) infoEl.textContent = `Mostrando ${start + 1}-${end} de ${total} pagos`;
    renderPagBtns(btnsId, pages, _pagosPage, 'window._cambiarPaginaPagos');
}

export function cambiarPaginaPagos(p) {
    const pages = Math.ceil(_pagosData.length / PER_PAGE) || 1;
    if (p < 1 || p > pages) return;
    _pagosPage = p;
    renderPagosPage('pagosTableBody', 'pagosInfo', 'pagosBtns');
}

// ── Modal de registro de pago ──────────────────────────────
export async function abrirModalPago(modalId = 'pagoModal') {
    ocultarAlerta('pagoAlert');
    const fields = ['pagoMonto', 'pagoMetodo'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fecha = document.getElementById('pagoFecha');
    if (fecha) fecha.value = new Date().toISOString().split('T')[0];
    const saldoDisp = document.getElementById('pagoSaldoDisp');
    if (saldoDisp) saldoDisp.textContent = '—';
    const folioDisp = document.getElementById('pagoFolioDisp');
    if (folioDisp) folioDisp.textContent = 'Generando...';
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

    _pagoSaldo = 0;
    _pagoFolio = null;
    _clientesPago = [];

    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes`);
        const data = await res.json();
        if (data.success) {
            _clientesPago = data.clientes.filter(c => parseFloat(c.Saldo_Pendiente) > 0);
        }
    } catch (e) {}

    try {
        const res  = await fetch(`${API_BASE_URL}/api/pagos/siguiente-folio`);
        const data = await res.json();
        if (data.success) {
            _pagoFolio = data.folio;
            if (folioDisp) folioDisp.textContent = data.folio;
        }
    } catch (e) {}

    document.getElementById(modalId).classList.add('open');
}

export function cerrarModalPago(modalId = 'pagoModal') {
    document.getElementById(modalId).classList.remove('open');
}

export function cerrarComprobante(modalId = 'comprobanteModal') {
    document.getElementById(modalId).classList.remove('open');
}

// ── Búsqueda de clientes en el modal ──────────────────────
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
          <div onclick="window._seleccionarClientePago(${c.Id_Cliente},'${c.Nombre_Completo.replace(/'/g, "\\'")}',${c.Saldo_Pendiente})"
            style="padding:10px 16px;cursor:pointer;font-size:.85rem;border-bottom:1px solid var(--border)"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='white'">
            <div style="font-weight:600">${c.Nombre_Completo}</div>
            <div style="font-size:.78rem;color:var(--muted)">${c.Identificacion} — <span style="color:var(--error);font-weight:600">$${parseFloat(c.Saldo_Pendiente).toLocaleString()} pendiente</span></div>
          </div>`).join('');
    }
    lista.style.display = 'block';
}

export function seleccionarClientePago(id, nombre, saldo) {
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
    if (saldoDisp) saldoDisp.textContent = '$' + _pagoSaldo.toLocaleString();
    verificarMonto();
}

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

// ── Guardar pago ───────────────────────────────────────────
export async function guardarPago() {
    const idCliente = document.getElementById('pagoCliente')?.value;
    const monto     = parseFloat(document.getElementById('pagoMonto')?.value);
    const metodo    = document.getElementById('pagoMetodo')?.value;
    const fecha     = document.getElementById('pagoFecha')?.value;
    const usuario   = getUsuario();

    ocultarAlerta('pagoAlert');
    if (!idCliente) { mostrarAlerta('pagoAlert', 'Selecciona un cliente.', 'error'); return; }
    if (!monto || monto <= 0) { mostrarAlerta('pagoAlert', 'El monto debe ser mayor a $0.', 'error'); return; }
    if (!metodo)  { mostrarAlerta('pagoAlert', 'Selecciona un método de pago.', 'error'); return; }
    if (!fecha)   { mostrarAlerta('pagoAlert', 'Selecciona una fecha.', 'error'); return; }

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
            mostrarAlerta('pagoAlert', data.message, 'error');
        }
    } catch (e) {
        mostrarAlerta('pagoAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btn) { btn.textContent = 'Confirmar pago'; btn.disabled = false; }
    }
}

// ── Cerrar lista al hacer click fuera ─────────────────────
document.addEventListener('click', (e) => {
    const lista = document.getElementById('pagoClienteLista');
    if (lista && !lista.contains(e.target) && e.target.id !== 'pagoClienteBuscar') {
        lista.style.display = 'none';
    }
});

// ── Exponer al scope global ────────────────────────────────
window._seleccionarClientePago = seleccionarClientePago;
window._cambiarPaginaPagos     = cambiarPaginaPagos;