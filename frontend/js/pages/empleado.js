/**
 * Archivo: frontend/js/pages/empleado.js
 * Propósito: Controlador del dashboard Empleado.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';
import { cargarStatsDashboard, cargarListasDashboard } from '../core/dashboard_utils.js';

import { cargarClientes, cargarStats, filterTable, toggleFilter,
         clearFilters, abrirModalCliente, guardarCliente,
         cerrarModalCliente, ejecutarEliminarCliente,
         cerrarDeleteClienteModal, cerrarPerfilModal } from '../modules/clientes.js';
import { cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
         filtrarClientesPago, verificarMonto, guardarPago } from '../modules/pagos.js';
import { cargarClientesRec, seleccionarTodosRec,
         enviarRecordatorios, cargarHistorialRec } from '../modules/recordatorios.js';
import { inicializarPerfil } from '../modules/perfil.js';
import { act } from 'react';

const TABS = ['dashboard', 'clientes', 'pagos', 'notificaciones', 'perfil'];

document.addEventListener('DOMContentLoaded', async () => {

    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    // 1. Cargar tabs compartidos
    await loadSharedTabs();

    // 2. Sidebar
    document.getElementById('sidebarNombre').textContent   = usuario.nombre;
    document.getElementById('sidebarInitials').textContent = getIniciales(usuario.nombre);

    actualizarAvatar();

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // 4. Navegación
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showTab(item.getAttribute('data-tab'));
        });
    });

    await new Promise(resolve => requestAnimationFrame(resolve));

    // 5. Datos iniciales
    cargarClientes();
    cargarStats();
    cargarStatsDashboard();
    cargarListasDashboard();

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
    window.actualizarAvatarSidebar   = actualizarAvatar;
});

function showTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );
    if (name === 'dashboard')      { cargarStatsDashboard(); cargarListasDashboard(); }
    if (name === 'clientes')       { cargarClientes(); cargarStats(); }
    if (name === 'pagos')          cargarPagos('pagosTableBody', 'pagosInfo', 'pagosBtns');
    if (name === 'notificaciones') { cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'perfil')         inicializarPerfil();
}

function actualizarAvatar() {
    const usuario = getUsuario();
    const initalsEl = document.getElementById('sidebarInitials');

    if (usuario && usuario.foto) {
        const rutaLimpia = usuario.foto.startsWith('/') ? usuario.foto.substring(1) : usuario.foto;
        const urlFoto = usuario.foto.startsWith('http') ? usuario.foto : `${API_BASE_URL}/${rutaLimpia}`;

        initalsEl.innerHTML = `<img src="${urlFoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='${getIniciales(usuario.nombre)}';this.parentElement.style.padding='';">`;
        initalsEl.style.backgroundColor = 'transparent';
        initalsEl.style.padding = '0';
    } else if (usuario) {
        initalsEl.textContent = getIniciales(usuario.nombre);
        initalsEl.style.background = '';
        initalsEl.style.padding = '';
    }
}