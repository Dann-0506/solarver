/**
 * Archivo: frontend/js/pages/empleado.js
 * Propósito: Controlador del dashboard Empleado (Refactorizado).
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';
import { cargarStatsDashboard, cargarListasDashboard } from '../core/dashboard_utils.js';

import { 
    cargarClientes, cargarStats, filterTable, toggleFilter,
    clearFilters, abrirModalCliente, guardarCliente,
    cerrarModalCliente, cerrarPerfilModal 
} from '../modules/clientes.js';

import { 
    cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
    filtrarClientesPago, verificarMonto, guardarPago 
} from '../modules/pagos.js';

import { 
    cargarClientesRec, cargarHistorialRec, abrirModalRecordatorio,
    enviarRecordatorio, cerrarModalRecordatorio 
} from '../modules/recordatorios.js';

import { inicializarPerfil } from '../modules/perfil.js';

const TABS = ['dashboard', 'clientes', 'pagos', 'notificaciones', 'perfil'];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    await loadSharedTabs();

    document.getElementById('sidebarNombre').textContent = usuario.nombre;
    actualizarAvatar();

    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            changeTab(link.getAttribute('data-tab'));
        });
    });

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    changeTab('dashboard');
});

function changeTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );

    if (name === 'dashboard')      { cargarStatsDashboard(); cargarListasDashboard(); }
    if (name === 'clientes')       { cargarClientes(); cargarStats(); }
    if (name === 'pagos')          cargarPagos();
    if (name === 'notificaciones') { cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'perfil')         inicializarPerfil();
}

function actualizarAvatar() {
    const usuario = getUsuario();
    const initalsEl = document.getElementById('sidebarInitials');
    if (usuario && usuario.foto) {
        const rutaLimpia = usuario.foto.startsWith('/') ? usuario.foto.substring(1) : usuario.foto;
        const urlFoto = usuario.foto.startsWith('http') ? usuario.foto : `${API_BASE_URL}/${rutaLimpia}`;
        initalsEl.innerHTML = `<img src="${urlFoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='${getIniciales(usuario.nombre)}';">`;
        initalsEl.style.padding = '0';
    } else if (usuario) {
        initalsEl.textContent = getIniciales(usuario.nombre);
    }
}

window.actualizarAvatarSidebar = actualizarAvatar;
window.abrirModalCliente = abrirModalCliente;
window.cerrarModalCliente = cerrarModalCliente;
window.guardarCliente = guardarCliente;
window.cerrarPerfilModal = cerrarPerfilModal;
window.filterTable = filterTable;
window.toggleFilter = toggleFilter;
window.clearFilters = clearFilters;

window.abrirModalPago = abrirModalPago;
window.cerrarModalPago = cerrarModalPago;
window.guardarPago = guardarPago;
window.cerrarComprobante = cerrarComprobante;
window.filtrarClientesPago = filtrarClientesPago;
window.verificarMonto = verificarMonto;