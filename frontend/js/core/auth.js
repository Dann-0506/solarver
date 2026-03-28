/**
 * Archivo: frontend/js/core/auth.js
 * Proposito: Manejar la autenticación de usuarios, incluyendo el almacenamiento seguro de tokens y la gestión de sesiones.
 * Fecha de creación: 2024-06-01
 * Última modificación: 2024-06-10
 */

import { API_BASE_URL } from './api.js'; // Importar la URL base de la API desde el módulo de configuración

export function getUsuario() {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null; // Devuelve el usuario almacenado en sesión o null si no existe
}

export function guardarUsuario(datosUsuario) {
    sessionStorage.setItem('usuario', JSON.stringify(datosUsuario)); // Almacena el usuario en sesión como una cadena JSON
}

export function cerrarSesion() {
    sessionStorage.removeItem('usuario');
    window.location.href = 'login.html'; // Redirige al usuario a la página de login después de cerrar sesión
}

export function esAdmin() {
    const u = getUsuario();
    return u && u.rol && u.rol.toLowerCase().includes('admin'); // Verifica si el usuario tiene el rol de admin
}