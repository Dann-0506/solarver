/**
 * Entry point de la vista de dashboard para el rol Empleado.
 *
 * Inicializa la sesión, carga los tabs compartidos y despacha
 * la lógica de cada sección a sus módulos correspondientes.
 *
 * Módulos importados:
 *   - core/auth.js: verificación de sesión y cierre de sesión.
 *   - core/api.js: URL base de la API REST.
 *   - core/utils.js: utilidades generales (iniciales de nombre).
 *   - core/partials.js: carga de tabs HTML compartidos.
 *   - core/dashboard_utils.js: carga de estadísticas y listas del dashboard.
 *   - modules/clientes.js: gestión de clientes.
 *   - modules/pagos.js: gestión de pagos.
 *   - modules/recordatorios.js: gestión de recordatorios a clientes.
 *   - modules/perfil.js: gestión del perfil del usuario.
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
    if (name === 'pagos')          cargarPagos('pagosTableBody', 'pagosInfo', 'pagosBtns');
    if (name === 'notificaciones') { cargarClientesRec(); cargarHistorialRec(); }
    if (name === 'perfil')         inicializarPerfil();
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