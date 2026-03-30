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

    await new Promise(resolve => requestAnimationFrame(resolve));

    // 5. Datos iniciales
    cargarRoles();
    cargarStatsAdmin();
    cargarListasDashboard();
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
    if (name === 'dashboard')       {cargarStatsAdmin(); cargarListasDashboard();}
    if (name === 'clientes')       { cargarClientes(); cargarStats();}
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

async function cargarListasDashboard() {

    console.log('dashClientesDeuda:', document.getElementById('dashClientesDeuda'));
    console.log('dashRecordatorios:', document.getElementById('dashRecordatorios'));
    // resto de la función...

    // 1. Cargar "Clientes con deuda próxima"
    try {
        const resC = await fetch(`${API_BASE_URL}/api/clientes`);
        const dataC = await resC.json();
        const divDeuda = document.getElementById('dashClientesDeuda');
        
        if (dataC.success && dataC.clientes) {
            // Filtrar clientes con estatus atrasado o pendiente y saldo mayor a 0, tomar los primeros 5
            const pendientes = dataC.clientes
                .filter(c => (c.Estatus || '').toLowerCase() !== 'pagado' && parseFloat(c.Saldo_Pendiente) > 0)
                .slice(0, 5);

            if (pendientes.length > 0) {
                divDeuda.innerHTML = pendientes.map(c => `
                    <div style="display:flex; justify-content:space-between; padding:14px 0; border-bottom:1px solid var(--border);">
                        <div>
                            <div style="font-weight:600; font-size:.85rem; font-family:'Sora', sans-serif;">${c.Nombre_Completo}</div>
                            <div style="font-size:.75rem; color:var(--muted); margin-top:2px;">Día de pago: <span style="font-weight:600;color:var(--blue-d)">${c.Fecha_Pago}</span></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="color:var(--error); font-weight:700; font-size:.85rem;">$${parseFloat(c.Saldo_Pendiente).toLocaleString()}</div>
                            <div style="font-size:.7rem; color:var(--muted); margin-top:2px;">${(c.Estatus || 'Pendiente').toUpperCase()}</div>
                        </div>
                    </div>
                `).join('');
                // Quitar el último borde para que se vea limpio
                divDeuda.lastElementChild.style.borderBottom = 'none';
            } else {
                divDeuda.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">No hay deudas próximas.</div>';
            }
        }
    } catch (e) {
        document.getElementById('dashClientesDeuda').innerHTML = '<div style="text-align:center;padding:24px;color:var(--error)">Error al cargar clientes.</div>';
    }

    // 2. Cargar "Recordatorios recientes"
    try {
        // Asumiendo que esta es la ruta de tu historial. Ajusta si es diferente.
        const resR = await fetch(`${API_BASE_URL}/api/recordatorios/historial`); 
        const dataR = await resR.json();
        const divRec = document.getElementById('dashRecordatorios');
        
        if (dataR.success && dataR.historial) {
            const recientes = dataR.historial.slice(0, 5);
            
            if (recientes.length > 0) {
                divRec.innerHTML = recientes.map(r => `
                    <div style="display:flex; justify-content:space-between; padding:14px 0; border-bottom:1px solid var(--border);">
                        <div>
                            <div style="font-weight:600; font-size:.85rem; font-family:'Sora', sans-serif;">${r.Nombre_Cliente || 'Cliente'}</div>
                            <div style="font-size:.75rem; color:var(--muted); margin-top:2px;">Por: ${r.Nombre_Usuario || 'Sistema'}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:.75rem; color:var(--muted);">${r.Fecha}</div>
                            <div style="font-size:.7rem; color:var(--success); font-weight:600; margin-top:2px;">Enviado</div>
                        </div>
                    </div>
                `).join('');
                divRec.lastElementChild.style.borderBottom = 'none';
            } else {
                divRec.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">No hay recordatorios recientes.</div>';
            }
        } else {
             divRec.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">No hay recordatorios recientes.</div>';
        }
    } catch (e) {
        document.getElementById('dashRecordatorios').innerHTML = '<div style="text-align:center;padding:24px;color:var(--error)">Error al cargar recordatorios.</div>';
    }
}