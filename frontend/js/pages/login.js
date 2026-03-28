/**
 * Archivo: frontend/js/pages/login.js
 * Propósito: Manejar el formulario de inicio de sesión.
 */

import { API_BASE_URL } from '../core/api.js';       // CORRECCIÓN: extensión .js obligatoria en módulos ES
import { guardarUsuario } from '../core/auth.js';     // CORRECCIÓN: extensión .js obligatoria

document.addEventListener('DOMContentLoaded', () => {

    // CORRECCIÓN: 'loginForm' como string, no como variable sin definir
    const formLogin        = document.getElementById('loginForm');
    const inputUsername    = document.getElementById('username');
    const inputPassword    = document.getElementById('password');
    // CORRECCIÓN: el id en el HTML es 'btnTogglePass', no 'btnTogglePassword'
    const btnTogglePassword = document.getElementById('btnTogglePass');
    const btnSubmit        = document.getElementById('btnLogin');

    formLogin.addEventListener('submit', handleLogin);
    btnTogglePassword.addEventListener('click', togglePassword);
    inputUsername.addEventListener('input', hideAlert);
    inputPassword.addEventListener('input', hideAlert);

    function togglePassword() {
        inputPassword.type = inputPassword.type === 'password' ? 'text' : 'password';
    }

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

    function showAlert(msg, type = 'error') {
        const alertEl  = document.getElementById('alertError');
        const alertMsg = document.getElementById('alertMsg');
        alertMsg.textContent = msg;
        alertEl.className = `alert ${type}`;
        alertEl.style.display = 'flex';
    }

    function hideAlert() {
        document.getElementById('alertError').style.display = 'none';
    }
});