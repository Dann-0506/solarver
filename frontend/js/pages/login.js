/**
 * Entry point de la vista de inicio de sesión.
 *
 * Controla el formulario de login, la validación de campos, la
 * comunicación con el endpoint de autenticación y la redirección
 * post-login según el rol del usuario.
 *
 * Módulos importados:
 *   - core/api.js: URL base de la API REST.
 *   - core/auth.js: persistencia de datos del usuario en sesión.
 */

import { API_BASE_URL } from '../core/api.js';       // NOTE: la extensión .js es obligatoria en importaciones de módulos ES nativos
import { guardarUsuario } from '../core/auth.js';     // NOTE: la extensión .js es obligatoria en importaciones de módulos ES nativos

document.addEventListener('DOMContentLoaded', () => {

    // NOTE: se pasa el id como cadena al getElementById, no como variable
    const formLogin        = document.getElementById('loginForm');
    const inputUsername    = document.getElementById('username');
    const inputPassword    = document.getElementById('password');
    // NOTE: el id en el HTML es 'btnTogglePass'; el nombre de variable es más descriptivo para legibilidad
    const btnTogglePassword = document.getElementById('btnTogglePass');
    const btnSubmit        = document.getElementById('btnLogin');

    formLogin.addEventListener('submit', handleLogin);
    btnTogglePassword.addEventListener('click', togglePassword);
    inputUsername.addEventListener('input', hideAlert);
    inputPassword.addEventListener('input', hideAlert);

    /**
     * Alterna la visibilidad del campo de contraseña entre 'password' y 'text'.
     */
    function togglePassword() {
        inputPassword.type = inputPassword.type === 'password' ? 'text' : 'password';
    }

    /**
     * Maneja el envío del formulario de inicio de sesión.
     *
     * Valida que los campos no estén vacíos, realiza la petición al
     * endpoint de autenticación y redirige al usuario según la respuesta.
     *
     * @param {Event} e - Evento submit del formulario.
     * @returns {Promise<void>}
     */
    async function handleLogin(e) {
        e.preventDefault();

        const username = inputUsername.value.trim();
        const password = inputPassword.value.trim();

        if (!username || !password) {
            showAlert('Por favor completa todos los campos.', 'error');
            return;
        }

        btnSubmit.innerHTML = '<span class="loading-spinner"></span> Verificando...';
        btnSubmit.disabled = true;
        hideAlert();

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                guardarUsuario(data.usuario);
                showAlert(data.message, 'success');
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 500);
            } else {
                showAlert(data.message, 'error');
            }

        } catch (error) {
            showAlert('No se pudo conectar con el servidor.', 'error');
            console.error('Error en login:', error);
        } finally {
            btnSubmit.innerHTML = 'Ingresar al sistema';
            btnSubmit.disabled = false;
        }
    }

    /**
     * Muestra el bloque de alerta con el mensaje y tipo indicados.
     *
     * @param {string} msg - Texto a mostrar en la alerta.
     * @param {string} [type='error'] - Tipo de alerta: 'error' o 'success'.
     */
    function showAlert(msg, type = 'error') {
        const alertEl  = document.getElementById('alertError');
        const alertMsg = document.getElementById('alertMsg');
        alertMsg.textContent = msg;
        alertEl.className = `alert ${type}`;
        alertEl.style.display = 'flex';
    }

    // Oculta el bloque de alerta del formulario.
    function hideAlert() {
        document.getElementById('alertError').style.display = 'none';
    }
});