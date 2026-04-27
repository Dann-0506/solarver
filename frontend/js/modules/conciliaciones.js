import { API_BASE_URL } from '../core/api.js';
// 👈 Importamos nuestras nuevas utilidades y quitamos mostrarAlerta
import { mostrarToast, confirmarAccionGlobal } from '../core/utils.js';

export async function cargarConciliaciones() {
    const tbody = document.getElementById('conciliacionesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--muted)">Cargando datos...</td></tr>';
    
    // Resetear el estado de la vista masiva
    const chkAll = document.getElementById('chkAllConcil');
    if (chkAll) chkAll.checked = false;
    verificarSeleccionMasiva();
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/conciliaciones/pendientes`);
        const data = await res.json();
        
        if (!data.success || !data.pendientes.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--muted); font-style:italic">No hay transferencias pendientes de conciliar. 🎉</td></tr>';
            return;
        }

        tbody.innerHTML = data.pendientes.map(r => `
            <tr style="border-bottom:1px solid var(--border); transition:background 0.2s">
                <td style="padding:16px; text-align:center;">
                    <input type="checkbox" class="chk-concil" value="${r.Id_Referencia}" onchange="window._verificarSeleccionMasiva()" style="cursor:pointer; accent-color: var(--blue);">
                </td>
                <td style="padding:16px; font-size:0.85rem; color:var(--muted)">${r.Fecha_Generacion}</td>
                <td style="padding:16px;">
                    <div style="font-weight:600; color:var(--text)">${r.Nombre_Completo}</div>
                    <div style="font-size:0.8rem; color:var(--muted)">${r.Identificacion}</div>
                </td>
                <td style="padding:16px; font-family:monospace; font-size:0.95rem; color:var(--blue-d); font-weight:bold;">${r.Clave_Ref}</td>
                <td style="padding:16px; font-weight:bold; color:var(--error)">$${parseFloat(r.Monto_Esperado).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                <td style="padding:16px; text-align:center;">
                    <button class="btn-primary" style="padding:8px 16px; font-size:0.8rem" onclick="window._conciliarManual(${r.Id_Referencia}, '${r.Clave_Ref}')">
                        Marcar Pagado
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--error)">Error al conectar con el servidor.</td></tr>';
        console.error("Error cargando conciliaciones:", e);
    }
}

// -- Conciliación Uno a Uno --
export async function conciliarManual(id_referencia, clave) {
    // 👈 Reemplazamos el confirm nativo por el modal asíncrono
    const confirmado = await confirmarAccionGlobal(
        'Confirmar Conciliación',
        `¿Estás 100% seguro de registrar manualmente el pago para la referencia ${clave}?`
    );
    if (!confirmado) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/conciliaciones/manual/${id_referencia}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (data.success) {
            // 👈 Reemplazamos mostrarAlerta por mostrarToast
            mostrarToast('Pago registrado exitosamente.', 'success'); 
            cargarConciliaciones(); 
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error de red al intentar conciliar.', 'error');
        console.error("Error conciliando:", e);
    }
}

export function toggleAllConcil(source) {
    const checkboxes = document.querySelectorAll('.chk-concil');
    checkboxes.forEach(chk => chk.checked = source.checked);
    verificarSeleccionMasiva();
}

export function verificarSeleccionMasiva() {
    const checkboxes = document.querySelectorAll('.chk-concil:checked');
    const btnMasivo = document.getElementById('btnConciliarMasivo');
    
    if (btnMasivo) {
        btnMasivo.disabled = checkboxes.length === 0;
        if (checkboxes.length > 0) {
            btnMasivo.style.opacity = '1';
            btnMasivo.innerText = `✓ Conciliar (${checkboxes.length})`;
        } else {
            btnMasivo.style.opacity = '0.5';
            btnMasivo.innerText = `✓ Conciliar Seleccionados`;
        }
    }
}

export async function conciliarMasivo() {
    const checkboxes = document.querySelectorAll('.chk-concil:checked');
    const referencias = Array.from(checkboxes).map(chk => parseInt(chk.value));
    
    if (referencias.length === 0) return;
    
    // 👈 Reemplazamos el confirm nativo por el modal asíncrono
    const confirmado = await confirmarAccionGlobal(
        'Conciliación Masiva',
        `¿Estás seguro de registrar manualmente los ${referencias.length} pagos seleccionados?`
    );
    if (!confirmado) return;
    
    const btnMasivo = document.getElementById('btnConciliarMasivo');
    btnMasivo.innerText = 'Procesando...';
    btnMasivo.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/api/conciliaciones/manual/masivo`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referencias })
        });
        const data = await res.json();
        
        if (data.success) {
            // 👈 Reemplazamos mostrarAlerta por mostrarToast
            mostrarToast(data.message, 'success');
            cargarConciliaciones();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('Error de red al intentar conciliar masivamente.', 'error');
        console.error("Error conciliando masivo:", e);
    } finally {
        verificarSeleccionMasiva();
    }
}

window._cargarConciliaciones = cargarConciliaciones;
window._conciliarManual = conciliarManual;
window._toggleAllConcil = toggleAllConcil;
window._verificarSeleccionMasiva = verificarSeleccionMasiva;
window._conciliarMasivo = conciliarMasivo;