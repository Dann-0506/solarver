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
    // 1. Cargar "Clientes con deuda próxima"
    try {
        const resC = await fetch(`${API_BASE_URL}/api/clientes`);
        const dataC = await resC.json();
        const divDeuda = document.getElementById('dashClientesDeuda');
        
        if (dataC.success && dataC.clientes) {
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
                divDeuda.lastElementChild.style.borderBottom = 'none';
            } else {
                divDeuda.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">No hay deudas próximas.</div>';
            }
        }
    } catch (e) {
        if (document.getElementById('dashClientesDeuda')) {
            document.getElementById('dashClientesDeuda').innerHTML = '<div style="text-align:center;padding:24px;color:var(--error)">Error al cargar clientes.</div>';
        }
    }

    // 2. Cargar "Recordatorios recientes"
    try {
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
             if(divRec) divRec.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">No hay recordatorios recientes.</div>';
        }
    } catch (e) {
        if(document.getElementById('dashRecordatorios')){
            document.getElementById('dashRecordatorios').innerHTML = '<div style="text-align:center;padding:24px;color:var(--error)">Error al cargar recordatorios.</div>';
        }
    }
}