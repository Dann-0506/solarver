import { API_BASE_URL } from '../core/api.js';

export async function cargarRespaldos() {
    const tbody = document.getElementById('tablaRespaldosBody');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos`);
        const data = await res.json();

        if (data.success) {
            if (data.respaldos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--muted); padding: 32px;">No hay respaldos generados aún.</td></tr>';
                return;
            }

            tbody.innerHTML = data.respaldos.map(r => `
                <tr>
                    <td>
                        <div style="font-weight:600; color:var(--text);">${r.nombre}</div>
                    </td>
                    
                    <td>
                        <span style="font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: 600; 
                            ${r.tipo === 'Automático' ? 'background: #E8F0FE; color: var(--blue);' : 'background: #F3F4F6; color: var(--muted);'}">
                            ${r.tipo}
                        </span>
                    </td>
                    
                    <td style="color: var(--muted); font-size: 0.85rem;">
                        ${r.fecha}
                    </td>
                    
                    <td style="font-weight: 500;">
                        ${r.tamano}
                    </td>
                    
                    <td>
                        <div class="action-btns" style="justify-content: flex-start;">
                            <button class="act-btn" title="Descargar" onclick="window.descargarRespaldo('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            <button class="act-btn danger" title="Restaurar" onclick="window.confirmarRestauracion('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

export async function crearRespaldo() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'manual' })
        });
        const data = await res.json();
        if (data.success) {
            alert('Respaldo manual creado con éxito.');
            cargarRespaldos();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { alert('Error al crear respaldo'); }
}

export async function ejecutarRestauracion(nombre) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/restaurar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) {
            alert('Base de datos restaurada correctamente. El sistema se reiniciará.');
            window.location.reload();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { alert('Error de conexión'); }
}

export async function confirmarRestauracion(nombre) {
    if (!confirm(`¿Seguro que quieres restaurar el respaldo ${nombre}? Se perderán los datos actuales.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/restaurar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.success) {
            alert('Base de datos restaurada correctamente. El sistema se reiniciará.');
            window.location.reload();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { alert('Error de conexión'); }
}

export function descargarRespaldo(nombre) {
    window.location.href = `${API_BASE_URL}/api/respaldos/descargar/${nombre}`;
}