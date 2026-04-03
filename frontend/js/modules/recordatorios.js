/**
 * Archivo: frontend/js/modules/recordatorios.js
 * Propósito: Envío manual de recordatorios de pago (US-09 y US-12).
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { getIniciales, mostrarAlerta } from '../core/utils.js';

let _recClientes = [];

// ── Cargar clientes con deuda ──────────────────────────────
export async function cargarClientesRec() {
    const lista = document.getElementById('recClientesLista');
    if (!lista) return;
    lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)">Cargando...</div>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/recordatorios/clientes`);
        const data = await res.json();
        if (!data.success || !data.clientes.length) {
            lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">Sin clientes con deuda pendiente.</div>';
            return;
        }
        _recClientes = data.clientes;
        renderClientesRec();
    } catch (e) {
        lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar.</div>';
    }
}

function renderClientesRec() {
    const lista = document.getElementById('recClientesLista');
    if (!lista) return;
    
    lista.innerHTML = _recClientes.map(c => {
        // Obtenemos la mensualidad calculada en el backend y el saldo restante
        const pagoMensual = parseFloat(c.Mensualidad || 0); 
        const saldoTotal  = parseFloat(c.Saldo_Pendiente || 0);
        
        const st      = (c.Estatus || '').toLowerCase();
        const stColor = st === 'atrasado' ? 'var(--error)' : '#F39C12';
        const stBg    = st === 'atrasado' ? '#FDECEA'      : '#FEF9EC';
        const ini     = getIniciales(c.Nombre_Completo);
        
        return `
          <label style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='white'">
            <input type="checkbox" class="rec-check" value="${c.Id_Cliente}" onchange="window._actualizarConteoRec()"
              style="width:16px;height:16px;accent-color:var(--orange);cursor:pointer">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--blue-d));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;color:white;flex-shrink:0">${ini}</div>
            
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.Nombre_Completo}</div>
              <div style="font-size:.75rem;color:var(--muted)">Día límite: ${c.Fecha_Pago} de cada mes</div>
            </div>
            
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700;font-family:'Sora',sans-serif;color:var(--error);font-size:.88rem">
                Pago: $${pagoMensual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">
                Deuda restante: $${saldoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <span style="background:${stBg};color:${stColor};padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:600">${st.charAt(0).toUpperCase() + st.slice(1)}</span>
            </div>
          </label>`;
    }).join('');
    
    actualizarConteoRec();
}

export function actualizarConteoRec() {
    const checks = document.querySelectorAll('.rec-check:checked');
    const el     = document.getElementById('recSeleccionados');
    if (el) el.textContent = `${checks.length} seleccionado(s)`;
}

export function seleccionarTodosRec() {
    const checks = document.querySelectorAll('.rec-check');
    const todos  = Array.from(checks).every(c => c.checked);
    checks.forEach(c => c.checked = !todos);
    actualizarConteoRec();
}

// ── Enviar recordatorios ───────────────────────────────────
export async function enviarRecordatorios() {
    const checks  = document.querySelectorAll('.rec-check:checked');
    const ids     = Array.from(checks).map(c => parseInt(c.value));
    const usuario = getUsuario();
    const canal   = document.getElementById('recCanal').value; // LEEMOS EL CANAL SELECCIONADO

    if (!ids.length) {
        mostrarAlerta('recAlert', '⚠️ Selecciona al menos un cliente.', 'warning');
        return;
    }

    const btn = document.getElementById('btnEnviarRec');
    if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }
    const alertEl = document.getElementById('recAlert');
    if (alertEl) alertEl.style.display = 'none';

    try {
        const res  = await fetch(`${API_BASE_URL}/api/recordatorios/enviar`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ENVIAMOS EL CANAL EN EL BODY
            body   : JSON.stringify({ ids_clientes: ids, id_usuario: usuario?.id, canal: canal })
        });
        const data = await res.json();
        if (data.success) {
            mostrarAlerta('recAlert', `${data.message}`, 'success');
            document.querySelectorAll('.rec-check').forEach(c => c.checked = false);
            actualizarConteoRec();
            cargarHistorialRec();
        } else {
            mostrarAlerta('recAlert', `${data.message}`, 'error');
        }
    } catch (e) {
        mostrarAlerta('recAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        if (btn) { 
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Notificación`; 
            btn.disabled = false; 
        }
    }
}

// ── Historial de recordatorios ─────────────────────────────
export async function cargarHistorialRec() {
    const lista = document.getElementById('recHistorialLista');
    if (!lista) return;
    lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)">Cargando...</div>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/recordatorios/historial`);
        const data = await res.json();
        if (!data.success || !data.recordatorios.length) {
            lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">Sin envíos registrados.</div>';
            return;
        }
        lista.innerHTML = data.recordatorios.map(r => `
          <div style="padding:12px 20px;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-weight:600;font-size:.86rem">${r.Cliente || '—'}</div>
              <span style="background:#E8F8EF;color:#27ae60;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:600">✓ ${r.Canal}</span>
            </div>
            <div style="font-size:.76rem;color:var(--muted)">${r.Fecha_Envio} · Por: ${r.Usuario || '—'}</div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:2px">${r.Mensaje}</div>
          </div>`).join('');
    } catch (e) {
        lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--error)">No se pudo cargar.</div>';
    }
}

// ── Exponer al scope global ────────────────────────────────
window._actualizarConteoRec = actualizarConteoRec;