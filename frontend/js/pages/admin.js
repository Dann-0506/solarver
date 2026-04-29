/**
 * Entry point de la vista de dashboard para el rol Administrador.
 *
 * Inicializa la sesión, carga los tabs compartidos y despacha
 * la lógica de cada sección a sus módulos correspondientes.
 * Expone funciones de módulos al ámbito global para su uso desde
 * atributos onclick en el HTML.
 *
 * Módulos importados:
 *   - core/auth.js: verificación de sesión y cierre de sesión.
 *   - core/api.js: URL base de la API REST.
 *   - core/utils.js: utilidades generales (iniciales de nombre).
 *   - core/partials.js: carga de tabs HTML compartidos.
 *   - core/dashboard_utils.js: carga de estadísticas y listas del dashboard.
 *   - modules/usuarios.js: gestión de usuarios del sistema.
 *   - modules/clientes.js: gestión de clientes.
 *   - modules/pagos.js: gestión de pagos.
 *   - modules/conciliaciones.js: conciliación masiva de pagos.
 *   - modules/recordatorios.js: envío de recordatorios a clientes.
 *   - modules/reportes.js: generación y descarga de reportes.
 *   - modules/historial.js: consulta de historial de operaciones.
 *   - modules/perfil.js: gestión del perfil del usuario.
 *   - modules/respaldos.js: gestión de respaldos de la base de datos.
 */

import { getUsuario, cerrarSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { getIniciales } from '../core/utils.js';
import { loadSharedTabs } from '../core/partials.js';
import { cargarStatsDashboard, cargarListasDashboard } from '../core/dashboard_utils.js';

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
window.confirmarRestauracion = confirmarRestauracion;
window.confirmarEliminarRespaldo = confirmarEliminarRespaldo;
window.descargarRespaldo = descargarRespaldo;
window.abrirConfigRespaldos = abrirConfigRespaldos;
window.cerrarConfigRespaldos = cerrarConfigRespaldos;
window.guardarConfigRespaldos = guardarConfigRespaldos;

const TABS = ['dashboard', 'clientes', 'pagos', 'conciliaciones', 'usuarios', 'notificaciones', 'historial', 'reportes', 'respaldos', 'perfil'];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = getUsuario();
    if (!usuario) { window.location.href = '../pages/login.html'; return; }

    await loadSharedTabs(); 

    // NOTE: pausa breve para que el navegador procese el HTML insertado por loadSharedTabs antes de continuar
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
    
    await changeTab('dashboard'); 
    
    cargarRoles();
    setInterval(verificarSesion, 60000);
});

/**
 * Muestra el tab indicado y oculta el resto, luego carga sus datos.
 *
 * @param {string} name - Identificador del tab a activar (p. ej. 'dashboard', 'clientes').
 * @returns {Promise<void>}
 */
async function changeTab(name) {
    TABS.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === name ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-item[data-tab]').forEach(item =>
        item.classList.toggle('active', item.getAttribute('data-tab') === name)
    );

    // NOTE: await garantiza que los datos del dashboard estén listos antes de mostrar la vista
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

/**
 * Verifica que la sesión del usuario siga activa en el servidor.
 *
 * Si el servidor indica que la sesión es inválida, elimina los datos
 * locales y redirige al login. Se ejecuta en intervalos periódicos.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Actualiza el avatar del sidebar con la foto de perfil o las iniciales del usuario.
 *
 * Construye la URL de la foto si está disponible; de lo contrario muestra
 * las iniciales generadas por getIniciales.
 */
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