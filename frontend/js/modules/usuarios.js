/**
 * Archivo: frontend/js/modules/usuarios.js
 * Propósito: CRUD completo de usuarios del sistema (solo Administrador).
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { getIniciales, mostrarAlerta, ocultarAlerta } from '../core/utils.js';

// ── Cargar roles en los selects ────────────────────────────
export async function cargarRoles() {
    try {
        const res  = await fetch(`${API_BASE_URL}/api/roles`);
        const data = await res.json();
        const selectC = document.getElementById('uRol');
        if (!selectC) return;
        selectC.innerHTML = '<option value="">Seleccionar...</option>';
        if (data.success) {
            data.roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value       = r.Id_Rol;
                opt.textContent = r.Nombre_Rol;
                selectC.appendChild(opt);
            });
        }
    } catch (e) { console.error('Error cargando roles:', e); }
}

// ── Cargar y renderizar tabla de usuarios ─────────────────
export async function cargarUsuarios() {
    const tbody = document.getElementById('usuariosTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>';
    try {
        const res  = await fetch(`${API_BASE_URL}/api/usuarios`);
        const data = await res.json();
        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">Error al cargar usuarios.</td></tr>';
            return;
        }
        const countEl = document.getElementById('userCount');
        if (countEl) countEl.textContent = `(${data.usuarios.length})`;

        const usuarioActual = getUsuario();
        tbody.innerHTML = data.usuarios.map(u => {
            const ini   = getIniciales(u.Nombre);
            const esAdm = u.Nombre_Rol.toLowerCase().includes('admin');
            const esYo  = u.Username === usuarioActual?.username;
            const colorBg = esAdm ? 'background:linear-gradient(135deg,var(--orange),var(--orange-d))' : '';

            const avatarHtml = u.Foto_Perfil 
                ? `<img src="${u.Foto_Perfil}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                : ini;
            const avatarStyle = u.Foto_Perfil ? 'background:transparent; padding:0;' : colorBg;

            return `<tr>
              <td><div style="display:flex;align-items:center;gap:10px">
                <div class="pay-av" style="${avatarStyle}">${avatarHtml}</div>
                <div>
                  <div style="font-weight:600">${u.Nombre}${esYo ? ' <span style="font-size:.7rem;background:rgba(30,133,200,0.1);color:var(--blue);padding:1px 6px;border-radius:4px">Tú</span>' : ''}</div>
                  <div style="font-size:.74rem;color:var(--muted)">@${u.Username}</div>
                </div>
              </div></td>
              <td>${u.Correo}</td>
              <td><span class="badge-role ${esAdm ? 'role-admin' : 'role-emp'}">${u.Nombre_Rol}</span></td>
              <td><span class="badge-status ${u.Estado ? 'status-activo' : 'status-inactivo'}">${u.Estado ? 'Activo' : 'Inactivo'}</span></td>
              <td><div class="action-btns">
                ${!esYo ? `
                <button class="act-btn" title="Editar" onclick="window._abrirEditarUsuario(${u.Id_Usuario},'${u.Nombre}','${u.Username}','${u.Correo}',${u.Id_Rol})">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="act-btn danger" title="Eliminar" onclick="window._confirmarEliminarUsuario(${u.Id_Usuario},'${u.Nombre}')">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>` : '<span style="font-size:.75rem;color:var(--muted)">—</span>'}
              </div></td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error)">No se pudo conectar con el servidor.</td></tr>';
    }
}

// ── Crear usuario ──────────────────────────────────────────
export async function crearUsuario() {
    const nombre   = document.getElementById('uNombre').value.trim();
    const username = document.getElementById('uUsername').value.trim();
    const correo   = document.getElementById('uCorreo').value.trim();
    const password = document.getElementById('uPassword').value.trim();
    const id_rol   = document.getElementById('uRol').value;

    if (!nombre || !username || !correo || !password || !id_rol) {
        mostrarAlerta('modalAlert', 'Completa todos los campos obligatorios.', 'error');
        return;
    }

    const btn = document.getElementById('btnCrearUsuario');
    btn.textContent = 'Creando...';
    btn.disabled    = true;

    try {
        const res  = await fetch(`${API_BASE_URL}/api/usuarios`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ nombre, username, correo, password, id_rol: parseInt(id_rol) })
        });
        const data = await res.json();
        if (data.success) {
            cerrarModalUsuario();
            mostrarAlerta('userAlert', '✅ Usuario creado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarAlerta('modalAlert', data.message, 'error');
        }
    } catch (e) {
        mostrarAlerta('modalAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Crear usuario';
        btn.disabled    = false;
    }
}

// ── Eliminar usuario ───────────────────────────────────────
let _deleteId = null;

export function confirmarEliminarUsuario(id, nombre) {
    _deleteId = id;
    const el = document.getElementById('deleteNombre');
    if (el) el.textContent = nombre;
    document.getElementById('deleteModal').classList.add('open');
}

export function cerrarDeleteModal() {
    _deleteId = null;
    document.getElementById('deleteModal').classList.remove('open');
}

export async function ejecutarEliminar() {
    if (!_deleteId) return;
    const btn = document.getElementById('btnConfirmarEliminar');
    btn.textContent = 'Eliminando...';
    btn.disabled    = true;
    try {
        const res  = await fetch(`${API_BASE_URL}/api/usuarios/${_deleteId}`, { method: 'DELETE' });
        const data = await res.json();
        cerrarDeleteModal();
        if (data.success) {
            mostrarAlerta('userAlert', '✅ Usuario eliminado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarAlerta('userAlert', data.message, 'error');
        }
    } catch (e) {
        cerrarDeleteModal();
        mostrarAlerta('userAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Sí, eliminar';
        btn.disabled    = false;
    }
}

// ── Editar usuario ─────────────────────────────────────────
export function abrirEditarUsuario(id, nombre, username, correo, idRol) {
    document.getElementById('eId').value       = id;
    document.getElementById('eNombre').value   = nombre;
    document.getElementById('eUsername').value = username;
    document.getElementById('eCorreo').value   = correo;
    document.getElementById('ePassword').value = '';
    ocultarAlerta('editModalAlert');
    // Reusar roles ya cargados en el select de creación
    const selectE = document.getElementById('eRol');
    const selectC = document.getElementById('uRol');
    if (selectE && selectC) {
        selectE.innerHTML = selectC.innerHTML;
        selectE.value = idRol;
    }
    document.getElementById('editUserModal').classList.add('open');
}

export function cerrarEditarModal() {
    document.getElementById('editUserModal').classList.remove('open');
}

export async function guardarEdicion() {
    const id       = document.getElementById('eId').value;
    const nombre   = document.getElementById('eNombre').value.trim();
    const username = document.getElementById('eUsername').value.trim();
    const correo   = document.getElementById('eCorreo').value.trim();
    const id_rol   = document.getElementById('eRol').value;
    const password = document.getElementById('ePassword').value.trim();

    if (!nombre || !username || !correo || !id_rol) {
        mostrarAlerta('editModalAlert', 'Completa todos los campos obligatorios.', 'error');
        return;
    }

    const btn = document.getElementById('btnGuardarEdicion');
    btn.textContent = 'Guardando...';
    btn.disabled    = true;

    const body = { nombre, username, correo, id_rol: parseInt(id_rol) };
    if (password) body.password = password;

    try {
        const res  = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
            method : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            cerrarEditarModal();
            mostrarAlerta('userAlert', '✅ Usuario actualizado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarAlerta('editModalAlert', data.message, 'error');
        }
    } catch (e) {
        mostrarAlerta('editModalAlert', 'No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Guardar cambios';
        btn.disabled    = false;
    }
}

// ── Modales ────────────────────────────────────────────────
export function abrirModalUsuario() {
    ocultarAlerta('modalAlert');
    ['uNombre', 'uUsername', 'uCorreo', 'uPassword'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const rol = document.getElementById('uRol');
    if (rol) rol.value = '';
    document.getElementById('userModal').classList.add('open');
}

export function cerrarModalUsuario() {
    document.getElementById('userModal').classList.remove('open');
}

// ── Exponer al scope global para los onclick del HTML ──────
window._confirmarEliminarUsuario = confirmarEliminarUsuario;
window._abrirEditarUsuario       = abrirEditarUsuario;