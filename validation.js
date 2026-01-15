// --- MANEJO DE ERRORES Y VALIDACIONES ---

/**
 * Muestra un mensaje de error en el formulario
 * @param {string} mensaje - El mensaje de error a mostrar
 */
function mostrarError(mensaje) {
    const errorMsg = document.getElementById('form-error');
    errorMsg.innerText = mensaje;
    errorMsg.style.display = 'block';
}

/**
 * Oculta el mensaje de error del formulario
 */
function ocultarError() {
    const errorMsg = document.getElementById('form-error');
    errorMsg.style.display = 'none';
}

/**
 * Valida si todos los campos del formulario están completos
 * @returns {Object} Objeto con los valores del formulario o null si hay error
 */
function obtenerDatosFormulario() {
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const pais = document.getElementById('pais').value;
    const fechaNac = document.getElementById('fecha-nacimiento').value;
    const genero = document.getElementById('gender-select').value;
    const checkMayor = document.getElementById('check-mayor').checked;

    // Validar campos vacíos
    if (!nombre || !apellido || !telefono || !pais || !fechaNac || !genero) {
        mostrarError("Por favor completa todos los datos.");
        return null;
    }

    // Validar que nombre solo contenga letras, espacios y acentos
    const regexNombre = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!regexNombre.test(nombre)) {
        mostrarError("El nombre solo debe contener letras.");
        return null;
    }

    // Validar que apellido solo contenga letras, espacios y acentos
    if (!regexNombre.test(apellido)) {
        mostrarError("El apellido solo debe contener letras.");
        return null;
    }

    // Validar formato de teléfono (números, espacios, + y -)
    const regexTelefono = /^[\d\s\+\-\(\)]+$/;
    if (!regexTelefono.test(telefono)) {
        mostrarError("El teléfono solo debe contener números y símbolos válidos (+, -, paréntesis).");
        return null;
    }

    // Validar que teléfono tenga al menos 7 dígitos
    const digitosTelefono = telefono.replace(/\D/g, '');
    if (digitosTelefono.length < 7) {
        mostrarError("El teléfono debe tener al menos 7 dígitos.");
        return null;
    }

    // Validar que se haya seleccionado un país
    if (pais === "" || pais === "Selecciona tu país") {
        mostrarError("Por favor selecciona tu país.");
        return null;
    }

    // Validar que se haya seleccionado un género
    if (genero === "" || genero === "Selecciona tu género") {
        mostrarError("Por favor selecciona tu género.");
        return null;
    }

    // Validar fecha de nacimiento
    const fecha = new Date(fechaNac);
    const hoy = new Date();
    if (fecha >= hoy) {
        mostrarError("La fecha de nacimiento debe ser anterior a hoy.");
        return null;
    }

    // Validar que la fecha no sea muy antigua (por ejemplo, máximo 120 años)
    const fechaMinima = new Date();
    fechaMinima.setFullYear(fechaMinima.getFullYear() - 120);
    if (fecha < fechaMinima) {
        mostrarError("Por favor ingresa una fecha de nacimiento válida.");
        return null;
    }

    if (!checkMayor) {
        mostrarError("Debes marcar la casilla declarando que eres mayor de edad.");
        return null;
    }

    return { nombre, apellido, telefono, pais, fechaNac, genero };
}

/**
 * Calcula la edad a partir de una fecha de nacimiento
 * @param {string} fechaNacimiento - Fecha en formato YYYY-MM-DD
 * @returns {number} Edad en años
 */
function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    
    // Ajustar si aún no ha cumplido años este mes/día
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    
    return edad;
}

/**
 * Valida si el usuario es mayor de edad
 * @param {number} edad - Edad del usuario
 * @returns {boolean} True si es mayor de edad
 */
function validarMayoriaEdad(edad) {
    if (edad < 18) {
        mostrarError(`Lo sentimos, tienes ${edad} años. Solo mayores de 18 pueden jugar.`);
        return false;
    }
    return true;
}

/**
 * Función principal de validación del usuario
 */
function validarUsuario() {
    try {
        const datos = obtenerDatosFormulario();
        if (!datos) return;

        const edad = calcularEdad(datos.fechaNac);
        if (!validarMayoriaEdad(edad)) return;

        // ÉXITO: Iniciar juego
        ocultarError();
        
        // Auto-seleccionar personaje según género
        let personajeSeleccionado = 'pilot'; // Por defecto piloto
        if (datos.genero === 'female') {
            personajeSeleccionado = 'stewardess'; // Azafata para mujeres
        } else if (datos.genero === 'male') {
            personajeSeleccionado = 'steward'; // Azafato para hombres
        }
        
        // Guardar personaje seleccionado globalmente
        if (typeof characterType !== 'undefined') {
            characterType = personajeSeleccionado;
        }
        window.selectedCharacter = personajeSeleccionado;
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('game-wrapper').style.display = 'flex';
        document.getElementById('player-name-display').innerText = `${datos.nombre} ${datos.apellido}`;
        
        // Iniciar juego
        if (typeof initGame === 'function') {
            initGame();
        } else {
            throw new Error('La función initGame no está definida');
        }
    } catch (error) {
        console.error('Error al validar usuario:', error);
        mostrarError('Ocurrió un error al validar tus datos. Por favor intenta de nuevo.');
    }
}

/**
 * Muestra el modal de términos y condiciones
 */
function showTerms() {
    document.getElementById('terms-modal').style.display = 'block';
}

/**
 * Cierra el modal de términos y condiciones
 */
function closeTerms() {
    document.getElementById('terms-modal').style.display = 'none';
}

/**
 * Muestra el modal de política de cookies
 */
function showCookies() {
    document.getElementById('cookies-modal').style.display = 'block';
}

/**
 * Cierra el modal de política de cookies
 */
function closeCookies() {
    document.getElementById('cookies-modal').style.display = 'none';
}

/**
 * Muestra el modal de política de tratamiento de datos personales
 */
function showDataPolicy() {
    document.getElementById('data-modal').style.display = 'block';
}

/**
 * Cierra el modal de política de tratamiento de datos personales
 */
function closeDataPolicy() {
    document.getElementById('data-modal').style.display = 'none';
}

/**
 * Acceso directo al juego sin validación (solo para testing)
 */
function accesoDirecto() {
    // Ocultar formulario y mostrar juego
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'flex';
    document.getElementById('player-name-display').innerText = 'Jugador Test';
    
    // Establecer personaje por defecto
    if (typeof characterType !== 'undefined') {
        characterType = 'pilot';
    }
    window.selectedCharacter = 'pilot';
    
    // Iniciar juego
    if (typeof initGame === 'function') {
        initGame();
    }
}
