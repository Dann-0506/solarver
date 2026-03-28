/**
 * Archivo: frontend/js/modules/reportes.js
 * Propósito: Generación de reportes de pagos pendientes y atrasados (US-12).
 */

import { API_BASE_URL } from '../core/api.js';
import { calcularProximoDiaCorte } from '../core/utils.js';

let _reporteActual = 'pendientes';
let _reporteData   = [];

// ── Mostrar sub-reporte ────────────────────────────────────
export async function mostrarSubreporte(tipo) {
    _reporteActual = tipo;
    const tbody = document.getElementById('reporteTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';

    // Actualizar estilos de botones
    const estiloActivo   = 'padding:9px 20px;border-radius:10px;border:none;font-size:.84rem;font-weight:600;cursor:pointer;font-family:\'Sora\',sans-serif;background:var(--orange);color:white;box-shadow:0 4px 12px rgba(255,122,31,0.3)';
    const estiloInactivo = 'padding:9px 20px;border-radius:10px;border:1.5px solid var(--border);font-size:.84rem;font-weight:600;cursor:pointer;font-family:\'Sora\',sans-serif;background:white;color:var(--text)';
    const btnPend = document.getElementById('btnSubPendientes');
    const btnAtr  = document.getElementById('btnSubAtrasados');
    if (btnPend) btnPend.style.cssText = tipo === 'pendientes' ? estiloActivo : estiloInactivo;
    if (btnAtr)  btnAtr.style.cssText  = tipo === 'atrasados'  ? estiloActivo : estiloInactivo;

    try {
        const res  = await fetch(`${API_BASE_URL}/api/clientes`);
        const data = await res.json();
        if (!data.success) return;

        let clientes       = [];
        let tituloReporte  = '';
        let subtituloFecha = '';

        if (tipo === 'pendientes') {
            const proximo = calcularProximoDiaCorte();
            clientes = data.clientes.filter(c =>
                parseInt(c.Fecha_Pago) === proximo.dia && parseFloat(c.Saldo_Pendiente) > 0
            );
            tituloReporte  = `Próximos a pagar — Día ${proximo.dia}`;
            subtituloFecha = `Fecha de corte: ${proximo.label}`;
        } else {
            clientes = data.clientes.filter(c => (c.Estatus || '').toLowerCase() === 'atrasado');
            tituloReporte = 'Clientes con pago atrasado';
        }

        _reporteData = clientes;

        const totalDeuda = clientes.reduce((s, c) => s + (parseFloat(c.Saldo_Pendiente) || 0), 0);
        const tituloEl   = document.getElementById('reporteTitulo');
        const conteoEl   = document.getElementById('reporteConteo');
        if (tituloEl) tituloEl.textContent = tituloReporte;
        if (conteoEl) conteoEl.textContent = `(${clientes.length} clientes)${subtituloFecha ? ' · ' + subtituloFecha : ''}`;

        const resumenEl = document.getElementById('reporteResumen');
        if (resumenEl) {
            const proximo = calcularProximoDiaCorte();
            const diaMasComun = clientes.filter(c => c.Fecha_Pago == 5).length >= clientes.filter(c => c.Fecha_Pago == 17).length ? '5' : '17';
            resumenEl.innerHTML = `
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Total clientes</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif">${clientes.length}</div>
              </div>
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Saldo total</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif;color:var(--error)">$${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">${tipo === 'pendientes' ? 'Próxima fecha de corte' : 'Día más común'}</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif;color:var(--blue-d)">Día ${tipo === 'pendientes' ? proximo.dia : diaMasComun}</div>
              </div>`;
        }

        if (!clientes.length) {
            const msg = tipo === 'pendientes'
                ? `No hay clientes próximos a pagar el día ${calcularProximoDiaCorte().dia}.`
                : 'No hay clientes con pagos atrasados.';
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">${msg}</td></tr>`;
            return;
        }

        const colorSt = tipo === 'pendientes' ? '#F39C12'      : 'var(--error)';
        const bgSt    = tipo === 'pendientes' ? '#FEF9EC'      : '#FDECEA';
        const labelSt = tipo === 'pendientes' ? 'Próximo'      : 'Atrasado';

        tbody.innerHTML = clientes.map(c => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:12px 16px">
              <div style="font-weight:600;font-size:.88rem">${c.Nombre_Completo}</div>
              <div style="font-size:.75rem;color:var(--muted)">${c.Identificacion}</div>
            </td>
            <td style="padding:12px 16px;font-size:.84rem">
              <div>${c.Telefono || '—'}</div>
              <div style="color:var(--muted);font-size:.76rem">${c.Correo || '—'}</div>
            </td>
            <td style="padding:12px 16px">
              <span style="background:rgba(30,133,200,0.1);color:var(--blue-d);padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:600;font-family:'Sora',sans-serif">Día ${c.Fecha_Pago}</span>
            </td>
            <td style="padding:12px 16px;font-weight:600;font-size:.88rem">$${parseFloat(c.Monto_Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 16px;font-weight:700;color:var(--error);font-family:'Sora',sans-serif">$${parseFloat(c.Saldo_Pendiente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 16px">
              <span style="background:${bgSt};color:${colorSt};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600">${labelSt}</span>
            </td>
          </tr>`).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</td></tr>';
    }
}

// ── Exportar CSV ───────────────────────────────────────────
export function generarReporte() {
    if (!_reporteData.length) return;
    const tipo  = _reporteActual === 'pendientes' ? 'Pendientes' : 'Atrasados';
    const fecha = new Date().toLocaleDateString('es-MX');
    let csv = `Reporte de Pagos ${tipo} — SolarVer — ${fecha}\n`;
    csv += 'Cliente,Identificacion,Telefono,Correo,Dia Pago,Deuda Total,Saldo Pendiente,Estatus\n';
    _reporteData.forEach(c => {
        csv += `"${c.Nombre_Completo}","${c.Identificacion}","${c.Telefono || ''}","${c.Correo || ''}",Dia ${c.Fecha_Pago},$${parseFloat(c.Monto_Total || 0).toFixed(2)},$${parseFloat(c.Saldo_Pendiente || 0).toFixed(2)},"${c.Estatus}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `SolarVer_Reporte_${tipo}_${fecha.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}