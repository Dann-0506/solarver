/**
 * Archivo: frontend/js/modules/reportes.js
 * Propósito: Generación de reportes de pagos pendientes y atrasados (US-12).
 */

import { API_BASE_URL } from '../core/api.js';

let _reporteActual = 'faltan';
let _reporteData   = [];
let _pagaron       = [];
let _faltan        = [];

export async function cargarDatosReporte() {
    try {
        const res  = await fetch(`${API_BASE_URL}/api/reportes/estado-mensual`);
        const data = await res.json();
        if (data.success) {
            _pagaron = data.pagaron;
            _faltan  = data.faltan;
        }
    } catch (e) {
        console.error('Error al cargar reporte mensual:', e);
    }
}

export async function mostrarSubreporte(tipo) {
    _reporteActual = tipo;
    const tbody = document.getElementById('reporteTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';

    const estiloActivo   = 'padding:9px 20px;border-radius:10px;border:none;font-size:.84rem;font-weight:600;cursor:pointer;font-family:\'Sora\',sans-serif;background:var(--orange);color:white;box-shadow:0 4px 12px rgba(255,122,31,0.3)';
    const estiloInactivo = 'padding:9px 20px;border-radius:10px;border:1.5px solid var(--border);font-size:.84rem;font-weight:600;cursor:pointer;font-family:\'Sora\',sans-serif;background:white;color:var(--text)';
    
    const btnFaltan  = document.getElementById('btnSubFaltan');
    const btnPagaron = document.getElementById('btnSubPagaron');
    if (btnFaltan)  btnFaltan.style.cssText  = tipo === 'faltan'  ? estiloActivo : estiloInactivo;
    if (btnPagaron) btnPagaron.style.cssText = tipo === 'pagaron' ? estiloActivo : estiloInactivo;

    // Cargar datos del servidor si las listas están vacías
    if (_pagaron.length === 0 && _faltan.length === 0) {
        await cargarDatosReporte();
    }

    let clientes = tipo === 'pagaron' ? _pagaron : _faltan;
    _reporteData = clientes;

    const totalDeuda = clientes.reduce((s, c) => s + (parseFloat(c.Saldo_Pendiente) || 0), 0);
    const tituloEl   = document.getElementById('reporteTitulo');
    const conteoEl   = document.getElementById('reporteConteo');
    
    if (tituloEl) tituloEl.textContent = tipo === 'pagaron' ? 'Clientes al corriente (Este mes)' : 'Clientes con abono pendiente (Este mes)';
    if (conteoEl) conteoEl.textContent = `(${clientes.length} clientes)`;

    const resumenEl = document.getElementById('reporteResumen');
    if (resumenEl) {
        resumenEl.innerHTML = `
          <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Total clientes en lista</div>
            <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif">${clientes.length}</div>
          </div>
          <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Saldo total de la lista</div>
            <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif;color:var(--error)">$${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>`;
    }

    if (!clientes.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No hay clientes en esta categoría.</td></tr>`;
        return;
    }

    const colorSt = tipo === 'pagaron' ? 'var(--success)' : 'var(--error)';
    const bgSt    = tipo === 'pagaron' ? '#E8F8EF'        : '#FDECEA';
    const labelSt = tipo === 'pagaron' ? 'Abonado'        : 'Falta Abono';

    tbody.innerHTML = clientes.map(c => `
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:12px 16px">
          <div style="font-weight:600;font-size:.88rem">${c.Nombre_Completo}</div>
          <div style="font-size:.75rem;color:var(--muted)">${c.Identificacion}</div>
        </td>
        <td style="padding:12px 16px">
          <span style="background:rgba(30,133,200,0.1);color:var(--blue-d);padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:600;font-family:'Sora',sans-serif">Día ${c.Fecha_Pago}</span>
        </td>
        <td style="padding:12px 16px;font-size:.84rem">${c.Plazo_Meses ? c.Plazo_Meses + ' meses' : 'N/A'}</td>
        <td style="padding:12px 16px;font-weight:600;font-size:.88rem">$${parseFloat(c.Monto_Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td style="padding:12px 16px;font-weight:700;color:var(--error);font-family:'Sora',sans-serif">$${parseFloat(c.Saldo_Pendiente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td style="padding:12px 16px">
          <span style="background:${bgSt};color:${colorSt};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600">${labelSt}</span>
        </td>
      </tr>`).join('');
}

export function generarReporte() {
    if (!_reporteData.length) return;
    const tipo  = _reporteActual === 'pagaron' ? 'Al_Corriente' : 'Falta_Abono';
    const fecha = new Date().toLocaleDateString('es-MX');
    let csv = `Reporte de Pagos Mensual — SolarVer — ${fecha}\n`;
    csv += 'Cliente,Identificacion,Dia Pago,Plazo(Meses),Deuda Total,Saldo Pendiente,Estatus\n';
    _reporteData.forEach(c => {
        csv += `"${c.Nombre_Completo}","${c.Identificacion}",Dia ${c.Fecha_Pago},${c.Plazo_Meses || 12},$${parseFloat(c.Monto_Total || 0).toFixed(2)},$${parseFloat(c.Saldo_Pendiente || 0).toFixed(2)},"${c.Estatus}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `SolarVer_Reporte_${tipo}_${fecha.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}