/**
 * Módulo de administración de usuarios del sistema.
 *
 * Gestiona el CRUD completo de usuarios: listado, creación, edición y
 * eliminación. Disponible únicamente para usuarios con rol de administrador.
 */

import { API_BASE_URL } from '../core/api.js';
import { getUsuario } from '../core/auth.js';
import { getIniciales, mostrarToast, confirmarAccionGlobal } from '../core/utils.js';

/**
 * Carga los roles disponibles desde la API y los popula en el select de creación.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Carga la lista de usuarios desde la API y la renderiza en la tabla,
 * resaltando al usuario actualmente autenticado.
 *
 * @returns {Promise<void>}
 */
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
            const ini = getIniciales(u.Nombre);
            const esAdm = u.Nombre_Rol.toLowerCase().includes('admin');
            const esYo = u.Username === usuarioActual?.username;
            const colorBg = esAdm ? 'background:linear-gradient(135deg,var(--orange),var(--orange-d))' : '';

            let avatarHtml = ini;
            let avatarStyle = colorBg;

            if (u.Foto_Perfil) {
                const rutaLimpia = u.Foto_Perfil.startsWith('/') ? u.Foto_Perfil.substring(1) : u.Foto_Perfil;
                const urlCompleta = `${API_BASE_URL}/${rutaLimpia}`;

                avatarHtml = `<img src="${urlCompleta}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='${ini}';this.parentElement.style.background='${colorBg}'">`;
                avatarStyle = 'background:transparent; padding:0;';
            }

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

/**
 * Lee los campos del formulario de creación, valida los campos obligatorios
 * y envía la petición de alta de nuevo usuario a la API.
 *
 * @returns {Promise<void>}
 */
export async function crearUsuario() {
    const nombre   = document.getElementById('uNombre').value.trim();
    const username = document.getElementById('uUsername').value.trim();
    const correo   = document.getElementById('uCorreo').value.trim();
    const password = document.getElementById('uPassword').value.trim();
    const id_rol   = document.getElementById('uRol').value;

    if (!nombre || !username || !correo || !password || !id_rol) {
        mostrarToast('Completa todos los campos obligatorios.', 'error');
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
            mostrarToast('Usuario creado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Crear usuario';
        btn.disabled    = false;
    }
}

/**
 * Solicita confirmación al usuario y, si acepta, elimina el usuario de forma permanente.
 *
 * @param {number} id - ID del usuario a eliminar.
 * @param {string} nombre - Nombre del usuario, usado en el mensaje de confirmación.
 * @returns {Promise<void>}
 */
export async function confirmarEliminarUsuario(id, nombre) {
    const confirmado = await confirmarAccionGlobal(
        'Eliminar Usuario',
        `¿Estás seguro de que deseas eliminar permanentemente al usuario ${nombre}?`
    );

    if (!confirmado) return;

    try {
        const res  = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            mostrarToast('Usuario eliminado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
}

/**
 * Abre el modal de edición y precarga los datos del usuario indicado.
 *
 * @param {number} id - ID del usuario a editar.
 * @param {string} nombre - Nombre completo del usuario.
 * @param {string} username - Nombre de usuario.
 * @param {string} correo - Correo electrónico.
 * @param {number} idRol - ID del rol actualmente asignado.
 */
export function abrirEditarUsuario(id, nombre, username, correo, idRol) {
    document.getElementById('eId').value       = id;
    document.getElementById('eNombre').value   = nombre;
    document.getElementById('eUsername').value = username;
    document.getElementById('eCorreo').value   = correo;
    document.getElementById('ePassword').value = '';

    // Reutiliza las opciones del select de creación para evitar una petición adicional.
    const selectE = document.getElementById('eRol');
    const selectC = document.getElementById('uRol');
    if (selectE && selectC) {
        selectE.innerHTML = selectC.innerHTML;
        selectE.value = idRol;
    }
    document.getElementById('editUserModal').classList.add('open');
}

// Cierra el modal de edición de usuario.
export function cerrarEditarModal() {
    document.getElementById('editUserModal').classList.remove('open');
}

/**
 * Lee los campos del modal de edición, valida los campos obligatorios
 * y envía la petición de actualización a la API.
 * Si se ingresa contraseña, se incluye en el body; si no, se omite.
 *
 * @returns {Promise<void>}
 */
export async function guardarEdicion() {
    const id       = document.getElementById('eId').value;
    const nombre   = document.getElementById('eNombre').value.trim();
    const username = document.getElementById('eUsername').value.trim();
    const correo   = document.getElementById('eCorreo').value.trim();
    const id_rol   = document.getElementById('eRol').value;
    const password = document.getElementById('ePassword').value.trim();

    if (!nombre || !username || !correo || !id_rol) {
        mostrarToast('Completa todos los campos obligatorios.', 'error');
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
            mostrarToast('Usuario actualizado correctamente.', 'success');
            cargarUsuarios();
        } else {
            mostrarToast(data.message, 'error');
        }
    } catch (e) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Guardar cambios';
        btn.disabled    = false;
    }
}

/**
 * Limpia los campos del formulario de creación y abre el modal de nuevo usuario.
 */
export function abrirModalUsuario() {
    ['uNombre', 'uUsername', 'uCorreo', 'uPassword'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const rol = document.getElementById('uRol');
    if (rol) rol.value = '';
    document.getElementById('userModal').classList.add('open');
}

// Cierra el modal de creación de usuario.
export function cerrarModalUsuario() {
    document.getElementById('userModal').classList.remove('open');
}

// ── Exponer al scope global para los onclick del HTML ──────
window._confirmarEliminarUsuario = confirmarEliminarUsuario;
window._abrirEditarUsuario       = abrirEditarUsuario;
