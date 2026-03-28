/**
 * Archivo: frontend/js/modules/clientes.js
 * Propósito: Gestión de clientes — tabla, búsqueda, perfil, CRUD.
 * Usado por admin y empleado (con permisos distintos).
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { getIniciales, renderPagBtns, mostrarAlerta, ocultarAlerta } from '../core/utils.js';

const PER_PAGE = 7;
let allClients   = [];
let filteredData = [];
let currentPage  = 1;
let activeFilter = null;
let editingId    = null;
let deletingId   = null;

// ── Cargar clientes desde API ──────────────────────────────
export async function cargarClientes() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--error)">Error al cargar clientes.</td></tr>';
            return;
        }
        allClients   = data.clientes;
        filteredData = [...allClients];
        currentPage  = 1;
        renderPage();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</td></tr>';
    }
}

// ── Renderizar página actual ───────────────────────────────
function renderPage() {
    const tbody  = document.getElementById('tableBody');
    const admin  = esAdmin();
    const total  = filteredData.length;
    const pages  = Math.ceil(total / PER_PAGE) || 1;
    const start  = (currentPage - 1) * PER_PAGE;
    const end    = Math.min(start + PER_PAGE, total);
    const data   = filteredData.slice(start, end);

    if (!total) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No se encontraron clientes.</td></tr>';
        const pagBtns = document.getElementById('pagBtns');
        if (pagBtns) pagBtns.innerHTML = '';
        const pagInfo = document.getElementById('pagInfo');
        if (pagInfo) pagInfo.textContent = '';
        return;
    }

    const statusMap = { pendiente: 'pendiente', pagado: 'pagado', atrasado: 'atrasado' };

    tbody.innerHTML = data.map(c => {
        const ini    = getIniciales(c.Nombre_Completo);
        const deuda  = parseFloat(c.Saldo_Pendiente) || 0;
        const status = (c.Estatus || 'pendiente').toLowerCase();
        const st     = statusMap[status] || 'pendiente';
        return `<tr>
          <td><div class="client-cell">
            <div class="client-avatar">${ini}</div>
            <div>
              <div class="client-name">${c.Nombre_Completo}</div>
              <div class="client-id">${c.Identificacion}</div>
            </div>
          </div></td>
          <td>${c.Telefono || '—'}</td>
          <td>${c.Correo || '—'}</td>
          <td><span style="background:rgba(30,133,200,0.1);color:var(--blue-d);padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:600">Día ${c.Fecha_Pago}</span></td>
          <td><span class="badge-status status-${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</span></td>
          <td><div class="action-btns">
            <button class="act-btn" title="Ver perfil" onclick="window._abrirPerfilCliente(${c.Id_Cliente})">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${admin ? `
            <button class="act-btn" title="Editar" onclick="window._abrirEditarCliente(${c.Id_Cliente})">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="act-btn danger" title="Eliminar" onclick="window._confirmarEliminarCliente(${c.Id_Cliente}, '${c.Nombre_Completo.replace(/'/g, "\\'")}')">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>` : ''}
          </div></td>
        </tr>`;
    }).join('');

    const pagInfo = document.getElementById('pagInfo');
    if (pagInfo) pagInfo.textContent = `Mostrando ${start + 1}-${end} de ${total} clientes`;
    renderPagBtns('pagBtns', pages, currentPage, 'window._cambiarPaginaClientes');
}

// ── Búsqueda y filtros ─────────────────────────────────────
export function filterTable() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    filteredData = allClients.filter(c =>
        c.Nombre_Completo.toLowerCase().includes(q) ||
        c.Identificacion.toLowerCase().includes(q)
    );
    if (activeFilter) {
        filteredData = filteredData.filter(c => parseInt(c.Fecha_Pago) === activeFilter);
    }
    currentPage = 1;
    renderPage();
}

export function toggleFilter(day) {
    activeFilter = activeFilter === day ? null : day;
    const btn5  = document.getElementById('filter5');
    const btn17 = document.getElementById('filter17');
    if (btn5)  btn5.classList.toggle('active-filter',  activeFilter === 5);
    if (btn17) btn17.classList.toggle('active-filter', activeFilter === 17);
    filterTable();
}

export function clearFilters() {
    activeFilter = null;
    const search = document.getElementById('searchInput');
    if (search) search.value = '';
    const btn5  = document.getElementById('filter5');
    const btn17 = document.getElementById('filter17');
    if (btn5)  btn5.classList.remove('active-filter');
    if (btn17) btn17.classList.remove('active-filter');
    filteredData = [...allClients];
    currentPage  = 1;
    renderPage();
}

export function cambiarPagina(p) {
    const pages = Math.ceil(filteredData.length / PER_PAGE) || 1;
    if (p < 1 || p > pages) return;
    currentPage = p;
    renderPage();
}

// ── Stats ──────────────────────────────────────────────────
export async function cargarStats() {
    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes`);
        const data = await res.json();
        if (!data.success) return;
        const clientes  = data.clientes;
        const activos   = clientes.filter(c => c.Estado === 'Activo').length;
        const pendientes= clientes.filter(c => (c.Estatus || '').toLowerCase() === 'pendiente' && parseFloat(c.Saldo_Pendiente) > 0).length;
        const atrasados = clientes.filter(c => (c.Estatus || '').toLowerCase() === 'atrasado').length;
        const cobros    = clientes.reduce((sum, c) => sum + (parseFloat(c.Monto_Total) - parseFloat(c.Saldo_Pendiente || 0)), 0);
        const fmt = cobros >= 1000 ? '$' + (cobros / 1000).toFixed(0) + 'k' : '$' + cobros.toLocaleString();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('statActivos',    activos);
        set('statPendientes', pendientes);
        set('statAtrasados',  atrasados);
        set('statCobros',     fmt);
    } catch (e) { console.error('Error stats:', e); }
}

// ── Perfil del cliente ─────────────────────────────────────
export async function abrirPerfilCliente(id) {
    const c = allClients.find(x => x.Id_Cliente === id);
    if (!c) return;
    const ini   = getIniciales(c.Nombre_Completo);
    const deuda = parseFloat(c.Saldo_Pendiente) || 0;
    const st    = (c.Estatus || 'pendiente').toLowerCase();
    const set   = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
    set('#profileModal .p-nombre',      c.Nombre_Completo);
    set('#profileModal .p-id',          c.Identificacion);
    set('#profileModal .p-correo',      c.Correo || '—');
    set('#profileModal .p-telefono',    c.Telefono || '—');
    set('#profileModal .p-direccion',   c.Direccion || '—');
    set('#profileModal .p-fecha-pago',  `Día ${c.Fecha_Pago}`);
    const initEl = document.getElementById('pInitials');
    if (initEl) initEl.textContent = ini;
    const debtEl = document.getElementById('pDebt');
    if (debtEl) {
        debtEl.textContent = deuda > 0 ? '$' + deuda.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : 'Saldado';
        debtEl.style.color = deuda > 0 ? 'var(--error)' : 'var(--success)';
    }
    const stEl = document.getElementById('pStatus');
    if (stEl) {
        stEl.textContent = st.charAt(0).toUpperCase() + st.slice(1);
        stEl.className   = `badge-status status-${st}`;
    }
    // Cargar últimos 5 pagos
    const tbodyP = document.querySelector('#profileModal .pagos-tbody');
    if (tbodyP) {
        tbodyP.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--muted)">Cargando...</td></tr>';
        try {
            const res  = await fetch(`${API_BASE_URL}/api/clientes/${id}/pagos`);
            const data = await res.json();
            if (data.success && data.pagos.length) {
                tbodyP.innerHTML = data.pagos.map(p => `
                  <tr>
                    <td style="padding:10px 14px;font-size:.82rem;font-family:'Sora',sans-serif;color:var(--blue-d);font-weight:600">${p.Folio}</td>
                    <td style="padding:10px 14px;font-size:.82rem;font-weight:700;color:var(--success)">$${parseFloat(p.Monto).toLocaleString()}</td>
                    <td style="padding:10px 14px;font-size:.82rem">${p.Metodo_Pago || '—'}</td>
                    <td style="padding:10px 14px;font-size:.82rem;color:var(--muted)">${p.Fecha_Pago}</td>
                  </tr>`).join('');
            } else {
                tbodyP.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--muted);font-style:italic">Sin pagos registrados.</td></tr>';
            }
        } catch (e) {
            tbodyP.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--error)">Error al cargar pagos.</td></tr>';
        }
    }
    document.getElementById('profileModal').classList.add('open');
}

export function cerrarPerfilModal() {
    document.getElementById('profileModal').classList.remove('open');
}

// ── Crear / Editar cliente ─────────────────────────────────
export function abrirModalCliente(modo = 'crear', id = null) {
    editingId = modo === 'editar' ? id : null;
    ocultarAlerta('clienteModalAlert');
    const titulo = document.getElementById('clienteModalTitulo');
    if (titulo) titulo.textContent = modo === 'editar' ? 'Editar cliente' : 'Nuevo cliente';
    if (modo === 'crear') {
        ['cNombre', 'cIdentificacion', 'cCorreo', 'cTelefono', 'cDireccion', 'cDeuda'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const fp = document.getElementById('cFechaPago');
        if (fp) fp.value = '';
        const idField = document.getElementById('cIdentificacion');
        if (idField) idField.disabled = false;
    } else {
        const c = allClients.find(x => x.Id_Cliente === id);
        if (!c) return;
        const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
        set('cNombre',       c.Nombre_Completo);
        set('cIdentificacion', c.Identificacion);
        set('cCorreo',       c.Correo);
        set('cTelefono',     c.Telefono);
        set('cDireccion',    c.Direccion);
        set('cFechaPago',    c.Fecha_Pago);
        const idField = document.getElementById('cIdentificacion');
        if (idField) idField.disabled = true; // inmutable
    }
    document.getElementById('clienteModal').classList.add('open');
}

export function cerrarModalCliente() {
    document.getElementById('clienteModal').classList.remove('open');
    editingId = null;
}

export async function guardarCliente() {
    const nombre       = document.getElementById('cNombre')?.value.trim();
    const identificacion = document.getElementById('cIdentificacion')?.value.trim();
    const correo       = document.getElementById('cCorreo')?.value.trim();
    const telefono     = document.getElementById('cTelefono')?.value.trim();
    const direccion    = document.getElementById('cDireccion')?.value.trim();
    const fecha_pago   = document.getElementById('cFechaPago')?.value;
    const deuda_inicial= document.getElementById('cDeuda')?.value;
    const usuario      = getUsuario();

    if (!nombre || !fecha_pago) {
        mostrarAlerta('clienteModalAlert', 'Nombre y fecha de pago son obligatorios.', 'error');
        return;
    }
    if (!editingId && !identificacion) {
        mostrarAlerta('clienteModalAlert', 'La identificación es obligatoria.', 'error');
        return;
    }

    const btn = document.getElementById('btnGuardarCliente');
    if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

    try {
        const url    = editingId ? `${API_BASE_URL}/api/clientes/${editingId}` : `${API_BASE_URL}/api/clientes`;
        const method = editingId ? 'PUT' : 'POST';
        const body   = { nombre, correo, telefono, direccion, fecha_pago: parseInt(fecha_pago), id_usuario: usuario?.id };
        if (!editingId) { body.identificacion = identificacion; body.deuda_inicial = parseFloat(deuda_inicial) || 0; }

        const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
            cerrarModalCliente();
            mostrarAlerta('tablaAlert', `✅ Cliente ${editingId ? 'actualizado' : 'registrado'} correctamente.`, 'success');
            cargarClientes();
            cargarStats();
        } else {
            mostrarAlerta('clienteModalAlert', data.message, 'error');
        }
    } catch (e) {
        mostrarAlerta('clienteModalAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
    }
}

// ── Eliminar cliente ───────────────────────────────────────
export function confirmarEliminarCliente(id, nombre) {
    deletingId = id;
    const el = document.getElementById('deleteClienteNombre');
    if (el) el.textContent = nombre;
    document.getElementById('deleteClienteModal').classList.add('open');
}

export function cerrarDeleteClienteModal() {
    deletingId = null;
    document.getElementById('deleteClienteModal').classList.remove('open');
}

export async function ejecutarEliminarCliente() {
    if (!deletingId) return;
    const btn = document.getElementById('btnConfirmarEliminarCliente');
    if (btn) { btn.textContent = 'Eliminando...'; btn.disabled = true; }
    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes/${deletingId}`, { method: 'DELETE' });
        const data = await res.json();
        cerrarDeleteClienteModal();
        if (data.success) {
            mostrarAlerta('tablaAlert', '✅ Cliente eliminado correctamente.', 'success');
            cargarClientes();
            cargarStats();
        } else {
            mostrarAlerta('tablaAlert', data.message, 'error');
        }
    } catch (e) {
        cerrarDeleteClienteModal();
        mostrarAlerta('tablaAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btn) { btn.textContent = 'Sí, eliminar'; btn.disabled = false; }
    }
}

// ── Helper rol ─────────────────────────────────────────────
function esAdmin() {
    const u = getUsuario();
    return u && u.rol && u.rol.toLowerCase().includes('admin');
}

// ── Exponer al scope global para onclick del HTML ──────────
window._abrirPerfilCliente      = abrirPerfilCliente;
window._abrirEditarCliente      = (id) => abrirModalCliente('editar', id);
window._confirmarEliminarCliente= confirmarEliminarCliente;
window._cambiarPaginaClientes   = cambiarPagina;