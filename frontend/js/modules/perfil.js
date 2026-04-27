import { getUsuario, actualizarDatosSesion } from '../core/auth.js';
import { API_BASE_URL } from '../core/api.js';
import { mostrarToast } from '../core/utils.js'; // 👈 Importamos el nuevo servicio de Toasts

let inicializado = false;

export function inicializarPerfil() {
    const usuario = getUsuario();
    if (!usuario) return;

    const formDatos = document.getElementById('formDatosPerfil');
    const formPassword = document.getElementById('formPasswordPerfil');
    const inputFoto = document.getElementById('fotoPerfilInput');
    const previewContainer = document.getElementById('previewAvatarContainer');

    document.getElementById('nombrePerfil').value = usuario.nombre || '';
    document.getElementById('usernamePerfil').value = usuario.username || '';

    if (usuario.foto) {
        const rutaLimpia = usuario.foto.startsWith('/') ? usuario.foto.substring(1) : usuario.foto;
        const urlFoto = usuario.foto.startsWith('http') ? usuario.foto : `${API_BASE_URL}/${rutaLimpia}`;
        previewContainer.innerHTML = `<img src="${urlFoto}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    inputFoto.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                // 👈 Reemplazamos alert por mostrarToast
                mostrarToast('La imagen es demasiado grande. El máximo permitido es 5MB.', 'error');
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                previewContainer.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    if (inicializado) return;

    formDatos.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btnSubmit = formDatos.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerText;
        btnSubmit.innerText = 'Guardando...';
        btnSubmit.disabled = true;

        try {
            const formData = new FormData();
            formData.append('nombre', document.getElementById('nombrePerfil').value);
            formData.append('username', document.getElementById('usernamePerfil').value);
            
            const file = inputFoto.files[0];
            if (file) {
                formData.append('foto', file);
            }

            const response = await fetch(`${API_BASE_URL}/api/usuarios/perfil/${usuario.id}`, {
                method: 'PUT',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                actualizarDatosSesion({
                    nombre: result.usuario.nombre,
                    username: result.usuario.username,
                    foto: result.usuario.foto
                });

                if (typeof window.actualizarAvatarSidebar === 'function') {
                    window.actualizarAvatarSidebar();
                }

                // 👈 Reemplazamos alert por mostrarToast
                mostrarToast('¡Datos personales actualizados correctamente!', 'success');
            } else {
                mostrarToast(result.message || 'Error al actualizar el perfil.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error de conexión con el servidor.', 'error');
        } finally {
            btnSubmit.innerText = textoOriginal;
            btnSubmit.disabled = false;
        }
    });

    formPassword.addEventListener('submit', async function(e) {
        e.preventDefault();

        const passActual = document.getElementById('passwordActual').value;
        const passNueva = document.getElementById('passwordNueva').value;
        const passConfirmar = document.getElementById('passwordConfirmar').value;

        if (passNueva !== passConfirmar) {
            // 👈 Reemplazamos alert por mostrarToast (tipo warning)
            mostrarToast('Las contraseñas nuevas no coinciden.', 'warning');
            return;
        }

        const btnSubmit = formPassword.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerText;
        btnSubmit.innerText = 'Actualizando...';
        btnSubmit.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/api/usuarios/perfil/${usuario.id}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password_actual: passActual,
                    password_nueva: passNueva
                })
            });

            const result = await response.json();

            if (result.success) {
                mostrarToast('¡Contraseña actualizada con éxito!', 'success');
                formPassword.reset();
            } else {
                mostrarToast(result.message || 'Error al actualizar la contraseña.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarToast('Error de conexión con el servidor.', 'error');
        } finally {
            btnSubmit.innerText = textoOriginal;
            btnSubmit.disabled = false;
        }
    });

    inicializado = true;
}