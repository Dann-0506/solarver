/**
 * Módulo de autenticación y gestión de sesión.
 *
 * Maneja el almacenamiento del usuario autenticado en sessionStorage,
 * la verificación de roles y el cierre de sesión.
 */

import { API_BASE_URL } from './api.js';

/**
 * Recupera el usuario autenticado desde sessionStorage.
 *
 * @returns {Object|null} Objeto con los datos del usuario, o null si no hay sesión activa.
 */
export function getUsuario() {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
}

/**
 * Almacena los datos del usuario en sessionStorage.
 *
 * @param {Object} datosUsuario - Objeto con los datos del usuario a guardar.
 * @returns {void}
 */
export function guardarUsuario(datosUsuario) {
    sessionStorage.setItem('usuario', JSON.stringify(datosUsuario));
}

/**
 * Cierra la sesión del usuario y redirige a la página de login.
 *
 * @returns {void}
 */
export function cerrarSesion() {
    sessionStorage.removeItem('usuario');
    window.location.href = 'login.html';
}

/**
 * Verifica si el usuario en sesión tiene rol de administrador.
 *
 * @returns {boolean} True si el usuario es admin, false en caso contrario.
 */
export function esAdmin() {
    const u = getUsuario();
    return u && u.rol && u.rol.toLowerCase().includes('admin');
}

/**
 * Fusiona nuevos datos sobre el usuario en sesión y persiste el resultado.
 *
 * @param {Object} nuevosDatos - Campos a actualizar en el objeto de usuario.
 * @returns {Object|null} Usuario actualizado, o null si no había sesión activa.
 */
export function actualizarDatosSesion(nuevosDatos) {
    const usuario = getUsuario();
    if (usuario) {
        const usuarioActualizado = { ...usuario, ...nuevosDatos };
        guardarUsuario(usuarioActualizado);
        return usuarioActualizado;
    }
    return null;
}
