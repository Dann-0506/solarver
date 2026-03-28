/**
 * Archivo: frontend/js/pages/admin.js
 * Propósito: Controlador del dashboard Administrador.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';

import { cargarRoles, cargarUsuarios, crearUsuario, ejecutarEliminar,
         cerrarDeleteModal, guardarEdicion, abrirModalUsuario,
         cerrarModalUsuario, cerrarEditarModal } from '../modules/usuarios.js';
import { cargarClientes, cargarStats, filterTable, toggleFilter,
         clearFilters, abrirModalCliente, guardarCliente,
         cerrarModalCliente, ejecutarEliminarCliente,
         cerrarDeleteClienteModal, cerrarPerfilModal } from '../modules/clientes.js';
import { cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
         filtrarClientesPago, verificarMonto, guardarPago } from '../modules/pagos.js';
import { cargarClientesRec, seleccionarTodosRec,
         enviarRecordatorios, cargarHistorialRec } from '../modules/recordatorios.js';
import { mostrarSubreporte, generarReporte } from '../modules/reportes.js';
import { cargarHistorial } from '../modules/historial.js';

const TABS = ['dashboard','clientes','pagos','notificaciones','usuarios','historial','reportes','respaldos'];

document.addEventListener('DOMContentLoaded', async () => {

    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    // 1. Cargar tabs compartidos desde partials/
    await loadSharedTabs();

    // 2. Rellenar sidebar
    document.getElementById('sidebarNombre').textContent   = usuario.nombre;
    document.getElementById('sidebarInitials').textContent = getIniciales(usuario.nombre);

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // 4. Navegación — los nav-item usan data-tab, sin onclick en el HTML
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showTab(item.getAttribute('data-tab'));
        });
    });

    // 5. Datos iniciales
    cargarRoles();
    cargarStatsAdmin();
    setInterval(verificarSesion, 10000);

    // 6. Exponer funciones al HTML (modales usan onclick)
    window.showTab                    = showTab;
    window.abrirModalUsuario          = abrirModalUsuario;
    window.cerrarModalUsuario         = cerrarModalUsuario;
    window.crearUsuario               = crearUsuario;
    window.cerrarDeleteModal          = cerrarDeleteModal;
    window.ejecutarEliminar           = ejecutarEliminar;
    window.cerrarEditarModal          = cerrarEditarModal;
    window.guardarEdicion             = guardarEdicion;
    window.abrirModalCliente          = abrirModalCliente;
    window.filterTable                = filterTable;
    window.toggleFilter               = toggleFilter;
    window.clearFilters               = clearFilters;
    window.guardarCliente             = guardarCliente;
    window.cerrarModalCliente         = cerrarModalCliente;
    window.cerrarDeleteClienteModal   = cerrarDeleteClienteModal;
    window.ejecutarEliminarCliente    = ejecutarEliminarCliente;
    window.cerrarPerfilModal          = cerrarPerfilModal;
    window.abrirModalPago             = () => abrirModalPago('pagoModal');
    window.cerrarModalPago            = () => cerrarModalPago('pagoModal');
    window.cerrarComprobante          = () => cerrarComprobante('comprobanteModal');
    window.filtrarClientesPago        = filtrarClientesPago;
    window.verificarMonto             = verificarMonto;
    window.guardarPago                = guardarPago;
    window.seleccionarTodosRec        = seleccionarTodosRec;
    window.enviarRecordatorios        = enviarRecordatorios;
    window.cargarHistorialRec         = cargarHistorialRec;
    window.mostrarSubreporte          = mostrarSubreporte;
    window.generarReporte             = generarReporte;
    window.cargarHistorial            = cargarHistorial;
    window.cerrarSesion               = cerrarSesion;
});

function showTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );
    if (name === 'clientes')       { cargarClientes(); cargarStats(); }
    if (name === 'pagos')          cargarPagos('pagosTableBody', 'pagosInfo', 'pagosBtns');
    if (name === 'notificaciones') { cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'usuarios')       cargarUsuarios();
    if (name === 'historial')      cargarHistorial();
    if (name === 'reportes')       mostrarSubreporte('pendientes');
}

async function cargarStatsAdmin() {
    try {
        const [resC, resP] = await Promise.all([
            fetch(`${API_BASE_URL}/api/clientes`),
            fetch(`${API_BASE_URL}/api/pagos`)
        ]);
        const dc = await resC.json();
        const dp = await resP.json();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        if (dc.success) {
            set('statClientes',  dc.clientes.length);
            set('statAtrasadas', dc.clientes.filter(c => (c.Estatus||'').toLowerCase() === 'atrasado').length);
        }
        if (dp.success) {
            const ingresos = dp.pagos.reduce((s, p) => s + (parseFloat(p.Monto) || 0), 0);
            const fmt = ingresos >= 1000000 ? '$'+(ingresos/1000000).toFixed(1)+'M'
                      : ingresos >= 1000    ? '$'+(ingresos/1000).toFixed(0)+'k'
                      : '$'+ingresos.toLocaleString();
            set('statPagos',    dp.pagos.length);
            set('statIngresos', fmt);
        }
    } catch(e) { console.error('Stats error:', e); }
}

async function verificarSesion() {
    const usuario = getUsuario();
    if (!usuario) return;
    try {
        const res  = await fetch(`${API_BASE_URL}/api/session/check`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usuario.username })
        });
        const data = await res.json();
        if (!data.valid) { sessionStorage.removeItem('usuario'); window.location.href = '../pages/login.html'; }
    } catch(e) {}
}