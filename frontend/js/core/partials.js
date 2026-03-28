/**
 * Archivo: frontend/js/core/partials.js
 * Propósito: Cargar fragmentos HTML compartidos en los dashboards.
 * Evita duplicar tabs idénticos entre admin.html y empleado.html.
 */

/**
 * Carga un partial HTML en un contenedor del DOM.
 * @param {string} containerId - ID del div contenedor
 * @param {string} partialPath - Ruta relativa al archivo HTML parcial
 */
export async function loadPartial(containerId, partialPath) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const res  = await fetch(partialPath);
        if (!res.ok) throw new Error(`No se pudo cargar ${partialPath}`);
        container.innerHTML = await res.text();
    } catch (e) {
        console.error('Error cargando partial:', e);
        container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--error)">Error al cargar esta sección.</div>`;
    }
}

/**
 * Carga todos los partials compartidos de ambos dashboards.
 * Llama a esto antes de inicializar los módulos.
 */
export async function loadSharedTabs() {
    await Promise.all([
        loadPartial('tab-dashboard',      '../partials/tab-dashboard.html'),
        loadPartial('tab-clientes',       '../partials/tab-clientes.html'),
        loadPartial('tab-pagos',          '../partials/tab-pagos.html'),
        loadPartial('tab-notificaciones', '../partials/tab-notificaciones.html'),
    ]);
}