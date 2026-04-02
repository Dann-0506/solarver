/**
 * Archivo: frontend/js/modules/reportes.js
 * Propósito: Generación de reportes de pagos pendientes y atrasados (US-12).
 */

import { API_BASE_URL } from '../core/api.js';

let _reporteActual      = 'faltan';
let _reporteData        = [];
let _pagaron            = [];
let _faltan             = [];
let _pagosRealizados    = [];

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

export async function descargarReporte(formato) {
    const tipo = document.getElementById('selTipoReporte').value;
    const btn = event.target;
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Generando...';

    try {
        const url = `${API_BASE_URL}/api/reportes/exportar?tipo=${tipo}&formato=${formato}`;
        const res = await fetch(url);
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Error al generar el reporte');
        }

        // Manejo de respuesta binaria (Blob)
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = downloadUrl;
        const extension = formato === 'excel' ? 'xlsx' : 'pdf';
        a.download = `SolarVer_Cobranza_${tipo}_${new Date().toISOString().slice(0,10)}.${extension}`;
        
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

export async function actualizarVistaReporte() {
    const tipo = document.getElementById('selTipoReporte').value;
    const thead = document.getElementById('reporteTableHead');
    const tbody = document.getElementById('reporteTableBody');
    const resumenEl = document.getElementById('reporteResumen');
    const tituloEl = document.getElementById('reporteTitulo');

    if (!tbody || !thead) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Cargando datos...</td></tr>';

    if (tipo === 'realizados') {
        // --- LÓGICA PARA REPORTE DE PAGOS REALIZADOS ---
        if (_pagosRealizados.length === 0) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/reportes/ingresos-mensuales`);
                const data = await res.json();
                if (data.success) _pagosRealizados = data.pagos;
            } catch (e) { console.error('Error cargando pagos:', e); }
        }

        if (tituloEl) tituloEl.textContent = "Vista Previa de Ingresos Mensuales";
        
        // Cambiar cabecerasconst res = await fetch(`${API_BASE_URL}/api/reportes/ingresos-mensuales`);
                const data = await res.json();
                if (data.success) _pagosRealizados = data.pagos;
        thead.innerHTML = `
            <tr style="background:var(--bg)">
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Folio</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Cliente</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Contacto</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Fecha</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Método</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Monto</th>
            </tr>
        `;

        const totalIngresos = _pagosRealizados.reduce((s, p) => s + (parseFloat(p.Monto) || 0), 0);
        if (resumenEl) {
            resumenEl.innerHTML = `
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Total de transacciones</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif">${_pagosRealizados.length}</div>
              </div>
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Ingresos Totales</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif;color:var(--success)">$${totalIngresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>`;
        }

        if (!_pagosRealizados.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No hay pagos registrados.</td></tr>`;
            return;
        }

        // Llenar cuerpo de la tabla
        tbody.innerHTML = _pagosRealizados.map(p => `
            <tr style="border-top:1px solid var(--border)">
                <td style="padding:12px 16px; font-weight:600; font-size:.85rem; color:var(--blue-d)">${p.Folio}</td>
                <td style="padding:12px 16px; font-weight:600; font-size:.85rem">${p.Nombre_Completo}</td>
                <td style="padding:12px 16px; font-size:.75rem; color:var(--muted)">
                    <div style="font-weight:600; color:var(--text)">${p.Telefono || 'Sin Tel.'}</div>
                    <div>${p.Correo || 'Sin Correo'}</div>
                </td>
                <td style="padding:12px 16px; color:var(--muted); font-size:.85rem">${p.Fecha_Pago}</td>
                <td style="padding:12px 16px; font-size:.85rem">${p.Metodo_Pago}</td>
                <td style="padding:12px 16px; font-weight:700; color:var(--success)">$${parseFloat(p.Monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');

    } else {
        // --- LÓGICA PARA REPORTE DE CARTERA (Pendientes / Atrasados / Integral) ---
        if (_pagaron.length === 0 && _faltan.length === 0) await cargarDatosReporte();

        if (tituloEl) tituloEl.textContent = "Vista Previa de Cobranza Mensual";

        thead.innerHTML = `
            <tr style="background:var(--bg)">
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Cliente</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Contacto</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Día Pago</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Saldo Pendiente</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Intereses</th>
                <th style="padding:12px 16px; text-align:left; font-size:.75rem; font-weight:600; color:var(--muted); text-transform:uppercase;">Estatus</th>
            </tr>
        `;

        let datosAmostrar = [];
        
        if (tipo === 'integral') {
            // Todos los clientes con deuda (al corriente y los que faltan)
            datosAmostrar = [..._pagaron, ..._faltan];
        } else if (tipo === 'pendiente') {
            // Solo los que faltan y su estatus es estrictamente 'pendiente'
            datosAmostrar = _faltan.filter(c => c.Estatus.toLowerCase() === 'pendiente');
        } else if (tipo === 'atrasado') {
            // Solo los que faltan y su estatus es estrictamente 'atrasado'
            datosAmostrar = _faltan.filter(c => c.Estatus.toLowerCase() === 'atrasado');
        }

        const totalDeuda = datosAmostrar.reduce((s, c) => s + (parseFloat(c.Saldo_Pendiente) || 0), 0);
        if (resumenEl) {
            resumenEl.innerHTML = `
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Total clientes en lista</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif">${datosAmostrar.length}</div>
              </div>
              <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 20px;flex:1">
                <div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">Saldo total de la lista</div>
                <div style="font-size:1.4rem;font-weight:700;font-family:'Sora',sans-serif;color:var(--error)">$${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>`;
        }

        if (!datosAmostrar.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No hay clientes para esta categoría.</td></tr>`;
            return;
        }

        tbody.innerHTML = datosAmostrar.map(c => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:12px 16px">
              <div style="font-weight:600;font-size:.88rem">${c.Nombre_Completo}</div>
              <div style="font-size:.75rem;color:var(--muted)">${c.Identificacion}</div>
            </td>
            <td style="padding:12px 16px; font-size:.75rem; color:var(--muted)">
                <div style="font-weight:600; color:var(--text)">${c.Telefono || 'Sin Tel.'}</div>
                <div>${c.Correo || 'Sin Correo'}</div>
            </td>
            <td style="padding:12px 16px">
              <span style="background:rgba(30,133,200,0.1);color:var(--blue-d);padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:600">Día ${c.Fecha_Pago}</span>
            </td>
            <td style="padding:12px 16px;font-weight:700;color:var(--error)">$${parseFloat(c.Saldo_Pendiente || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 16px;color:var(--muted)">$${parseFloat(c.Interes_Acumulado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td style="padding:12px 16px">
              <span class="badge-status status-${c.Estatus.toLowerCase()}">${c.Estatus.toUpperCase()}</span>
            </td>
          </tr>`).join('');
    }
}

window.actualizarVistaReporte = actualizarVistaReporte;
window.mostrarSubreporte = mostrarSubreporte;
window.descargarReporte = descargarReporte;