/**
 * Archivo: frontend/js/core/dashboard_utils.js
 * Propósito: Centralizar la carga de estadísticas y listas del panel de inicio.
 */

import { API_BASE_URL } from './api.js';

export async function cargarStatsDashboard() {
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

export async function cargarListasDashboard() {
    // 1. Actividad Reciente - Aumentado a 9 registros
    const contenedorHistorial = document.getElementById('dashHistorial');
    if (contenedorHistorial) {
        try {
            const resH = await fetch(`${API_BASE_URL}/api/historial`);
            const dataH = await resH.json();
            if (dataH.success && dataH.historial) {
                const ultimos = dataH.historial.slice(0, 9); // 👈 Aumentado a 9
                if (ultimos.length > 0) {
                    contenedorHistorial.innerHTML = ultimos.map(r => {
                        const colorAccion = r.Accion.includes('ELIMINAR') ? 'var(--error)' : 
                                            r.Accion.includes('PAGO') || r.Accion.includes('CREAR') ? 'var(--success)' : 'var(--blue-d)';
                        return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 10px; border-bottom:1px solid var(--border)">
                                <div style="max-width: 75%;">
                                    <div style="font-weight:600; font-size:.84rem; color:var(--text); line-height:1.2">${r.Descripcion}</div>
                                    <div style="font-size:.72rem; color:var(--muted); margin-top:3px;">
                                        <span style="color:${colorAccion}; font-weight:700; text-transform:uppercase; font-size:.65rem">${r.Accion.replace(/_/g, ' ')}</span> 
                                        • ${r.Usuario}
                                    </div>
                                </div>
                                <div style="text-align:right; font-size:.72rem; color:var(--muted); white-space:nowrap; min-width:75px;">
                                    ${r.Fecha.split(' ')[0]}<br>${r.Fecha.split(' ')[1] || ''}
                                </div>
                            </div>`;
                    }).join('');
                    if (contenedorHistorial.lastElementChild) contenedorHistorial.lastElementChild.style.borderBottom = 'none';
                } else {
                    contenedorHistorial.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Sin actividad.</div>';
                }
            }
        } catch (e) { contenedorHistorial.innerHTML = '<div style="text-align:center;padding:40px;color:var(--error)">Error de carga.</div>'; }
    }

    // 2. Deudas Próximas - Limitado a 2 registros
    const divDeuda = document.getElementById('dashClientesDeuda');
    if (divDeuda) {
        try {
            const resC = await fetch(`${API_BASE_URL}/api/clientes`);
            const dataC = await resC.json();
            if (dataC.success && dataC.clientes) {
                const pendientes = dataC.clientes
                    .filter(c => (c.Estatus || '').toLowerCase() !== 'pagado' && parseFloat(c.Saldo_Pendiente) > 0)
                    .slice(0, 2); // 👈 Limitado a 2

                if (pendientes.length > 0) {
                    divDeuda.innerHTML = pendientes.map(c => `
                        <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
                            <div>
                                <div style="font-weight:600; font-size:.85rem;">${c.Nombre_Completo}</div>
                                <div style="font-size:.75rem; color:var(--muted);">Día: ${c.Fecha_Pago}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="color:var(--error); font-weight:700;">$${parseFloat(c.Saldo_Pendiente).toLocaleString()}</div>
                            </div>
                        </div>`).join('');
                    if (divDeuda.lastElementChild) divDeuda.lastElementChild.style.borderBottom = 'none';
                } else { divDeuda.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Sin deudas.</div>'; }
            }
        } catch (e) { divDeuda.innerHTML = '<div style="text-align:center;padding:20px;color:var(--error)">Error.</div>'; }
    }

    // 3. Recordatorios - Limitado a 2 registros
    const divRec = document.getElementById('dashRecordatorios');
    if (divRec) {
        try {
            const resR = await fetch(`${API_BASE_URL}/api/recordatorios/historial`); 
            const dataR = await resR.json();
            const recordatorios = (dataR.recordatorios || []).slice(0, 2); // 👈 Limitado a 2
            
            if (recordatorios.length > 0) {
                divRec.innerHTML = recordatorios.map(r => `
                    <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
                        <div>
                            <div style="font-weight:600; font-size:.85rem;">${r.Cliente}</div>
                            <div style="font-size:.75rem; color:var(--muted);">${r.Canal}</div>
                        </div>
                        <div style="text-align:right; font-size:.75rem; color:var(--muted);">${r.Fecha_Envio.split(' ')[0]}</div>
                    </div>`).join('');
                if (divRec.lastElementChild) divRec.lastElementChild.style.borderBottom = 'none';
            } else { divRec.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Sin recordatorios.</div>'; }
        } catch (e) { divRec.innerHTML = '<div style="text-align:center;padding:20px;color:var(--error)">Error.</div>'; }
    }
}