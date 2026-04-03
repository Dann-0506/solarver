import { API_BASE_URL } from '../core/api.js';
import { mostrarAlerta } from '../core/utils.js';

export async function cargarConciliaciones() {
    const tbody = document.getElementById('conciliacionesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--muted)">Cargando datos...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/conciliaciones/pendientes`);
        const data = await res.json();
        
        if (!data.success || !data.pendientes.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--muted); font-style:italic">No hay transferencias pendientes de conciliar. 🎉</td></tr>';
            return;
        }

        tbody.innerHTML = data.pendientes.map(r => `
            <tr style="border-bottom:1px solid var(--border); transition:background 0.2s">
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--error)">Error al conectar con el servidor.</td></tr>';
        console.error("Error cargando conciliaciones:", e);
    }
}

export async function conciliarManual(id_referencia, clave) {
    if (!confirm(`¿Estás 100% seguro de registrar manualmente el pago para la referencia ${clave}?`)) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/conciliaciones/manual/${id_referencia}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (data.success) {
            mostrarAlerta('concilAlert', '✅ Pago registrado exitosamente.', 'success');
            cargarConciliaciones(); // Recargar la tabla
        } else {
            mostrarAlerta('concilAlert', `⚠️ ${data.message}`, 'error');
        }
    } catch (e) {
        mostrarAlerta('concilAlert', 'Error de red al intentar conciliar.', 'error');
        console.error("Error conciliando:", e);
    }
}

// Exponer funciones al objeto global para que los botones HTML (onclick) puedan usarlas
window._cargarConciliaciones = cargarConciliaciones;
window._conciliarManual = conciliarManual;