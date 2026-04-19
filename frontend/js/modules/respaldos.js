import { API_BASE_URL } from '../core/api.js';

export async function cargarRespaldos() {
    actualizarVistaConfig();
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
                            
                            <button class="act-btn warning" title="Restaurar" onclick="window.confirmarRestauracion('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                            </button>

                            <button class="act-btn danger" title="Eliminar" onclick="window.confirmarEliminarRespaldo('${r.nombre}')">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
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

export async function abrirConfigRespaldos() {
    const modal = document.getElementById('configRespaldoModal');
    if(!modal) return alert("Falta el HTML del modal 'configRespaldoModal'");
    
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`);
        const data = await res.json();
        if(data.success && data.config) {
            document.getElementById('rFrecuencia').value = data.config.frecuencia || 'diario';
            document.getElementById('rHora').value = data.config.hora || '02:00';
        }
    } catch(e) {}
}

export function cerrarConfigRespaldos() {
    document.getElementById('configRespaldoModal').style.display = 'none';
}

export async function guardarConfigRespaldos() {
    const frecuencia = document.getElementById('rFrecuencia').value;
    const hora = document.getElementById('rHora').value;
    const btn = document.getElementById('btnGuardarConfig');
    
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frecuencia, hora })
        });
        const data = await res.json();
        if (data.success) {
            alert('¡Configuración de respaldos automáticos guardada!');
            cerrarConfigRespaldos();
            actualizarVistaConfig();
        }
    } catch(e) {
        alert('Error al guardar.');
    } finally {
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
}

export async function actualizarVistaConfig() {
    const titleEl = document.getElementById('configVistaTitulo');
    const subEl = document.getElementById('configVistaSub');
    if (!titleEl || !subEl) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/config`);
        const data = await res.json();
        
        if (data.success && data.config) {
            const { frecuencia, hora } = data.config;
            
            let textoTitulo = "";
            let textoSub = "";

            if (frecuencia === 'diario') {
                textoTitulo = "Respaldo automático diario";
                textoSub = `Programado · Todos los días a las ${hora}`;
            } else if (frecuencia === 'semanal') {
                textoTitulo = "Respaldo automático semanal";
                textoSub = `Programado · Domingos a las ${hora}`;
            } else if (frecuencia === 'mensual') {
                textoTitulo = "Respaldo automático mensual";
                textoSub = `Programado · Día 1 del mes a las ${hora}`;
            }

            titleEl.innerText = textoTitulo;
            subEl.innerText = textoSub;
        }
    } catch (e) {
        titleEl.innerText = "Error de conexión";
        subEl.innerText = "No se pudo leer la configuración";
    }
}

export async function confirmarEliminarRespaldo(nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el respaldo:\n${nombre}?\n\nEsta acción NO se puede deshacer.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/respaldos/${nombre}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Respaldo eliminado con éxito.');
            cargarRespaldos();
        } else {
            alert('Error al eliminar: ' + data.message);
        }
    } catch (e) {
        alert('Error de conexión con el servidor.');
    }
}