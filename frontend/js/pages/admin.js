/**
 * Archivo: frontend/js/pages/admin.js
 * Propósito: Controlador del dashboard Administrador con exposición global.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';
import { cargarStatsDashboard, cargarListasDashboard } from '../core/dashboard_utils.js';

// Importaciones de módulos
import { 
    cargarRoles, cargarUsuarios, crearUsuario, 
    abrirModalUsuario, cerrarModalUsuario, 
    abrirEditarUsuario, cerrarEditarModal, guardarEdicion 
} from '../modules/usuarios.js';

import { 
    cargarClientes, cargarStats, filterTable, toggleFilter,
    clearFilters, abrirModalCliente, guardarCliente,
    cerrarModalCliente, cerrarPerfilModal 
} from '../modules/clientes.js';

import { 
    cargarPagos, abrirModalPago, cerrarModalPago, cerrarComprobante,
    filtrarClientesPago, verificarMonto, guardarPago 
} from '../modules/pagos.js';

import { cargarConciliaciones, conciliarMasivo } from '../modules/conciliaciones.js';

import { 
    cargarClientesRec, cargarHistorialRec, abrirModalRecordatorio, 
    enviarRecordatorio, cerrarModalRecordatorio 
} from '../modules/recordatorios.js';

import { mostrarSubreporte, descargarReporte, actualizarVistaReporte, enviarEstadosDeCuenta } from '../modules/reportes.js';
import { cargarHistorial } from '../modules/historial.js';
import { inicializarPerfil } from '../modules/perfil.js';
import { 
    cargarRespaldos, crearRespaldo, abrirConfigRespaldos, 
    cerrarConfigRespaldos, guardarConfigRespaldos,
    confirmarRestauracion, confirmarEliminarRespaldo, descargarRespaldo
} from '../modules/respaldos.js';

// --- EXPOSICIÓN GLOBAL PARA HTML ONCLICK ---
// Usuarios
window.abrirModalUsuario = abrirModalUsuario;
window.cerrarModalUsuario = cerrarModalUsuario;
window.crearUsuario = crearUsuario;
window.abrirEditarUsuario = abrirEditarUsuario;
window.cerrarEditarModal = cerrarEditarModal;
window.guardarEdicion = guardarEdicion;

// Clientes
window.abrirModalCliente = abrirModalCliente;
window.cerrarModalCliente = cerrarModalCliente;
window.guardarCliente = guardarCliente;
window.cerrarPerfilModal = cerrarPerfilModal;
window.filterTable = filterTable;
window.toggleFilter = toggleFilter;
window.clearFilters = clearFilters;

// Pagos
window.abrirModalPago = abrirModalPago;
window.cerrarModalPago = cerrarModalPago;
window.guardarPago = guardarPago;
window.cerrarComprobante = cerrarComprobante;
window.filtrarClientesPago = filtrarClientesPago;
window.verificarMonto = verificarMonto;

// Reportes e Historial
window.actualizarVistaReporte = actualizarVistaReporte;
window.enviarEstadosDeCuenta = enviarEstadosDeCuenta;
window.descargarReporte = descargarReporte;
window.cargarHistorial = cargarHistorial;

// Respaldos
window.crearRespaldo = crearRespaldo;
window.abrirConfigRespaldos = abrirConfigRespaldos;
window.cerrarConfigRespaldos = cerrarConfigRespaldos;
window.guardarConfigRespaldos = guardarConfigRespaldos;

window.crearRespaldo = crearRespaldo;
window.confirmarRestauracion = confirmarRestauracion;     // 👈 Necesaria para la tabla
window.confirmarEliminarRespaldo = confirmarEliminarRespaldo; // 👈 Necesaria para la tabla
window.descargarRespaldo = descargarRespaldo;             // 👈 Necesaria para la tabla
window.abrirConfigRespaldos = abrirConfigRespaldos;
window.cerrarConfigRespaldos = cerrarConfigRespaldos;
window.guardarConfigRespaldos = guardarConfigRespaldos;

// ... (El resto del código de DOMContentLoaded y changeTab se mantiene igual)

const TABS = ['dashboard', 'clientes', 'pagos', 'conciliaciones', 'usuarios', 'notificaciones', 'historial', 'reportes', 'respaldos', 'perfil'];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    // 1. Cargamos el HTML de los tabs
    await loadSharedTabs(); 

    // 2. 👈 PEQUEÑA PAUSA TÉCNICA: Permite al navegador procesar el nuevo HTML
    await new Promise(resolve => setTimeout(resolve, 100));
    
    document.getElementById('sidebarNombre').textContent = usuario.nombre;
    actualizarAvatar();

    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            changeTab(link.getAttribute('data-tab'));
        });
    });

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    
    // 3. Iniciamos el dashboard de forma asíncrona
    await changeTab('dashboard'); 
    
    cargarRoles();
    setInterval(verificarSesion, 60000);
});

async function changeTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );

    // 👈 CAMBIO: Await en las funciones de carga de datos
    if (name === 'dashboard') { 
        await cargarStatsDashboard(); 
        await cargarListasDashboard(); 
    }
    if (name === 'clientes')       { cargarClientes(); cargarStats(); }
    if (name === 'pagos')          cargarPagos();
    if (name === 'conciliaciones') cargarConciliaciones();
    if (name === 'usuarios')       cargarUsuarios();
    if (name === 'notificaciones') { cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'reportes')       actualizarVistaReporte();
    if (name === 'historial')      cargarHistorial();
    if (name === 'respaldos')      cargarRespaldos();
    if (name === 'perfil')         inicializarPerfil();
}

async function verificarSesion() {
    const usuario = getUsuario();
    if (!usuario) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/session/check`, {
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
        initalsEl.innerHTML = `<img src="${urlFoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='${getIniciales(usuario.nombre)}';">`;
        initalsEl.style.padding = '0';
    } else if (usuario) {
        initalsEl.textContent = getIniciales(usuario.nombre);
    }
}

window.actualizarAvatarSidebar = actualizarAvatar;