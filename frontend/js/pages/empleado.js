/**
 * Archivo: frontend/js/pages/empleado.js
 * Propósito: Controlador del dashboard Empleado.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';

import { cargarClientes, cargarStats, filterTable, toggleFilter,
         clearFilters, abrirModalCliente, guardarCliente,
         cerrarModalCliente, ejecutarEliminarCliente,
         cerrarDeleteClienteModal, cerrarPerfilModal } from '../modules/clientes.js';
import { cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
         filtrarClientesPago, verificarMonto, guardarPago } from '../modules/pagos.js';
import { cargarClientesRec, seleccionarTodosRec,
         enviarRecordatorios, cargarHistorialRec } from '../modules/recordatorios.js';

const TABS = ['dashboard', 'clientes', 'pagos', 'notificaciones'];

document.addEventListener('DOMContentLoaded', async () => {

    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    // 1. Cargar tabs compartidos
    await loadSharedTabs();

    // 2. Sidebar
    document.getElementById('sidebarNombre').textContent   = usuario.nombre;
    document.getElementById('sidebarInitials').textContent = getIniciales(usuario.nombre);

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // 4. Navegación
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showTab(item.getAttribute('data-tab'));
        });
    });

    // 5. Datos iniciales
    cargarClientes();
    cargarStats();

    // 6. Exponer al HTML
    window.showTab                   = showTab;
    window.abrirModalCliente         = abrirModalCliente;
    window.filterTable               = filterTable;
    window.toggleFilter              = toggleFilter;
    window.clearFilters              = clearFilters;
    window.guardarCliente            = guardarCliente;
    window.cerrarModalCliente        = cerrarModalCliente;
    window.cerrarDeleteClienteModal  = cerrarDeleteClienteModal;
    window.ejecutarEliminarCliente   = ejecutarEliminarCliente;
    window.cerrarPerfilModal         = cerrarPerfilModal;
    window.abrirModalPago            = () => abrirModalPago('pagoModal');
    window.cerrarModalPago           = () => cerrarModalPago('pagoModal');
    window.cerrarComprobante         = () => cerrarComprobante('comprobanteModal');
    window.filtrarClientesPago       = filtrarClientesPago;
    window.verificarMonto            = verificarMonto;
    window.guardarPago               = guardarPago;
    window.seleccionarTodosRec       = seleccionarTodosRec;
    window.enviarRecordatorios       = enviarRecordatorios;
    window.cargarHistorialRec        = cargarHistorialRec;
    window.cerrarSesion              = cerrarSesion;
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
}