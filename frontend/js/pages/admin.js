/**
 * Archivo: frontend/js/pages/admin.js
 * Propósito: Controlador del dashboard Administrador.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';
import { cargarStatsDashboard, cargarListasDashboard } from '../core/dashboard_utils.js';

import { cargarRoles, cargarUsuarios, crearUsuario, ejecutarEliminar,
         cerrarDeleteModal, guardarEdicion, abrirModalUsuario,
         cerrarModalUsuario, cerrarEditarModal } from '../modules/usuarios.js';
import { cargarClientes, cargarStats, filterTable, toggleFilter,
         clearFilters, abrirModalCliente, guardarCliente,
         cerrarModalCliente, ejecutarEliminarCliente,
         cerrarDeleteClienteModal, cerrarPerfilModal } from '../modules/clientes.js';
import { cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
         filtrarClientesPago, verificarMonto, guardarPago } from '../modules/pagos.js';
import { cargarConciliaciones } from '../modules/conciliaciones.js';
import { cargarClientesRec, seleccionarTodosRec,
         enviarRecordatorios, cargarHistorialRec } from '../modules/recordatorios.js';
import { mostrarSubreporte, descargarReporte, actualizarVistaReporte } from '../modules/reportes.js';
import { cargarHistorial } from '../modules/historial.js';
import { inicializarPerfil } from '../modules/perfil.js';
import { cargarRespaldos, crearRespaldo, confirmarRestauracion, descargarRespaldo, abrirConfigRespaldos, cerrarConfigRespaldos, guardarConfigRespaldos, confirmarEliminarRespaldo } from '../modules/respaldos.js';

const TABS = ['dashboard','clientes','pagos','conciliaciones','notificaciones','usuarios','historial','reportes','respaldos','perfil'];

document.addEventListener('DOMContentLoaded', async () => {

    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    // 1. Cargar tabs compartidos desde partials/
    await loadSharedTabs();

    // 2. Rellenar sidebar
    document.getElementById('sidebarNombre').textContent   = usuario.nombre;
    document.getElementById('sidebarInitials').textContent = getIniciales(usuario.nombre);

    actualizarAvatar();

    // 3. Logout
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // 4. Navegación — los nav-item usan data-tab, sin onclick en el HTML
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showTab(item.getAttribute('data-tab'));
        });
    });

    await new Promise(resolve => requestAnimationFrame(resolve));

    // 5. Datos iniciales
    cargarRoles();
    cargarListasDashboard();
    cargarStatsDashboard();
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
    window.descargarReporte           = descargarReporte;
    window.actualizarVistaReporte     = actualizarVistaReporte;
    window.cargarHistorial            = cargarHistorial;
    window.cerrarSesion               = cerrarSesion;
    window.actualizarAvatarSidebar    = actualizarAvatar;
    window.crearRespaldo              = crearRespaldo;
    window.confirmarRestauracion      = confirmarRestauracion;
    window.descargarRespaldo          = descargarRespaldo;
    window.abrirConfigRespaldos       = abrirConfigRespaldos;
    window.cerrarConfigRespaldos      = cerrarConfigRespaldos;
    window.guardarConfigRespaldos     = guardarConfigRespaldos;
    window.confirmarEliminarRespaldo  = confirmarEliminarRespaldo;
});

function showTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );
    if (name === 'dashboard')       {cargarListasDashboard(); cargarStatsDashboard();}
    if (name === 'clientes')       {cargarClientes(); cargarStats();}
    if (name === 'pagos')          cargarPagos('pagosTableBody', 'pagosInfo', 'pagosBtns');
    if (name === 'conciliaciones') cargarConciliaciones();
    if (name === 'notificaciones') {cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'usuarios')       cargarUsuarios();
    if (name === 'historial')      cargarHistorial();
    if (name === 'reportes')       {mostrarSubreporte('faltan'); actualizarVistaReporte();}
    if (name === 'respaldos')       cargarRespaldos();
    if (name === 'perfil')         inicializarPerfil();
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
        if (!data.valid) { 
            sessionStorage.removeItem('usuario'); 
            window.location.href = '../pages/login.html'; 
        }
    } catch(e) {}
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