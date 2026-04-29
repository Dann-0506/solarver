/**
 * Módulo de envío de recordatorios de pago.
 *
 * Carga la lista de clientes con deuda pendiente, permite enviar avisos
 * individuales vía SMS o correo y consulta el historial de envíos
 * registrados en el sistema.
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { getIniciales, mostrarToast, confirmarAccionGlobal } from '../core/utils.js';

let _recClientes = [];

/**
 * Carga desde la API la lista de clientes con deuda pendiente y la renderiza.
 *
 * @returns {Promise<void>}
 */
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
        lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</div>';
        mostrarToast('Error de red al cargar la lista de deudores.', 'error');
    }
}

/**
 * Renderiza la lista de clientes con deuda en el contenedor `recClientesLista`.
 */
function renderClientesRec() {
    const lista = document.getElementById('recClientesLista');
    if (!lista) return;

    lista.innerHTML = _recClientes.map(c => {
        const deuda = parseFloat(c.Saldo_Pendiente) || 0;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)">
            <div>
                <div style="font-weight:600">${c.Nombre_Completo}</div>
                <div style="font-size:0.8rem;color:var(--muted)">${c.Telefono || 'Sin teléfono'} | ${c.Correo || 'Sin correo'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <div style="font-weight:bold;color:var(--error)">$${deuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <button class="btn-primary" style="padding:6px 12px;font-size:0.8rem" onclick="window._abrirModalRecordatorio(${c.Id_Cliente}, '${c.Nombre_Completo.replace(/'/g, "\\'")}')">Enviar Aviso</button>
            </div>
        </div>`;
    }).join('');
}

/**
 * Abre el modal de envío de recordatorio para un cliente específico.
 *
 * @param {number} idCliente - ID del cliente al que se enviará el recordatorio.
 * @param {string} nombreCliente - Nombre del cliente, mostrado en el encabezado del modal.
 */
export function abrirModalRecordatorio(idCliente, nombreCliente) {
    const hiddenId = document.getElementById('recClienteId');
    const labelNombre = document.getElementById('recClienteNombre');

    if (hiddenId) hiddenId.value = idCliente;
    if (labelNombre) labelNombre.textContent = nombreCliente;

    const modal = document.getElementById('recordatorioModal');
    if (modal) modal.classList.add('open');
}

// Cierra el modal de envío de recordatorio.
export function cerrarModalRecordatorio() {
    const modal = document.getElementById('recordatorioModal');
    if (modal) modal.classList.remove('open');
}

/**
 * Valida el canal seleccionado, solicita confirmación y envía el recordatorio
 * al cliente activo en el modal.
 *
 * @returns {Promise<void>}
 */
export async function enviarRecordatorio() {
    const idCliente = document.getElementById('recClienteId')?.value;
    const canal = document.getElementById('recCanal')?.value;
    const usuario = getUsuario();

    if (!canal || (canal !== 'sms' && canal !== 'correo')) {
        mostrarToast('Selecciona un canal válido (SMS o Correo).', 'warning');
        return;
    }

    const confirmado = await confirmarAccionGlobal(
        'Enviar Recordatorio',
        `¿Deseas procesar y enviar el recordatorio vía ${canal.toUpperCase()}?`
    );
    if (!confirmado) return;

    const btn = document.getElementById('btnEnviarRecordatorio');
    if (btn) {
        btn.textContent = 'Enviando...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/recordatorios/enviar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // El servidor espera un arreglo de IDs, no un escalar.
            body: JSON.stringify({
                ids_clientes: [parseInt(idCliente)],
                canal: canal,
                id_usuario: usuario?.id
            })
        });

        const data = await res.json();

        if (data.success) {
            mostrarToast('Recordatorio enviado con éxito.', 'success');
            cerrarModalRecordatorio();
            cargarHistorialRec();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión al enviar el recordatorio.', 'error');
    } finally {
        if (btn) {
            btn.textContent = 'Confirmar Envío';
            btn.disabled = false;
        }
    }
}

/**
 * Carga y renderiza el historial de recordatorios enviados.
 *
 * @returns {Promise<void>}
 */
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
          </div>
        `).join('');
    } catch(e) {
        lista.innerHTML = '<div style="text-align:center;padding:32px;color:var(--error)">Error al cargar el historial.</div>';
    }
}

window._abrirModalRecordatorio  = abrirModalRecordatorio;
window._enviarRecordatorio      = enviarRecordatorio;
window._cerrarModalRecordatorio = cerrarModalRecordatorio;
