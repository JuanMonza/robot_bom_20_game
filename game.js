// --- LÓGICA DEL JUEGO BOMBERMAN ---

// Canvas y contexto
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Sistema de sonidos
const sounds = {
    explosion: null,
    victory: null,
    background: null
};

/**
 * Inicializa los sonidos del juego usando Web Audio API
 */
function initSounds() {
    try {
        // Música de fondo (tono constante suave)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sounds.audioContext = audioContext;
        
        // Crear osciladores para efectos
        sounds.playExplosion = function() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        };
        
        sounds.playVictory = function() {
            const notes = [262, 330, 392, 523]; // C, E, G, C (acorde mayor)
            notes.forEach((freq, i) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.value = freq;
                
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.15);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
                
                oscillator.start(audioContext.currentTime + i * 0.15);
                oscillator.stop(audioContext.currentTime + i * 0.15 + 0.3);
            });
        };
        
        sounds.playBackgroundMusic = function() {
            if (sounds.bgOscillator) return; // Ya está sonando
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 220; // La
            gainNode.gain.value = 0.05; // Muy bajo volumen
            
            oscillator.start();
            sounds.bgOscillator = oscillator;
            sounds.bgGain = gainNode;
        };
        
        sounds.stopBackgroundMusic = function() {
            if (sounds.bgOscillator) {
                sounds.bgOscillator.stop();
                sounds.bgOscillator = null;
            }
        };
        
    } catch (error) {
        console.warn('No se pudieron inicializar los sonidos:', error);
        // Crear funciones vacías si fallan los sonidos
        sounds.playExplosion = () => {};
        sounds.playVictory = () => {};
        sounds.playBackgroundMusic = () => {};
        sounds.stopBackgroundMusic = () => {};
    }
}

// Configuración del juego
const TILE_SIZE = 40;
const COLS = 16; 
const ROWS = 11;
canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

// Tipos de tiles
const EMPTY = 0;
const WALL = 1;
const BRICK = 2;

// Estado del juego
let currentLevel = 1;
let map = [];
let player = {};
let enemies = [];
let allies = []; // Aliados que ayudan desde nivel 3
let bombs = [];
let explosions = [];
let planes = []; // Aviones para recoger

let gameActive = false;
let timeLeft = 60;
let timerInterval = null;
let playerLives = 3; // Sistema de vidas
let maxLives = 3;
let frameCount = 0; // Contador de frames para debug

// Control de entrada
const keys = {};

// Tipo de personaje seleccionado
let characterType = 'stewardess'; // 'stewardess', 'steward', 'pilot'

/**
 * Inicializa los event listeners para el teclado
 */
function setupKeyboardListeners() {
    window.addEventListener('keydown', e => {
        if (!gameActive) return;
        keys[e.code] = true;
        if (e.code === 'Space') {
            e.preventDefault(); // Evitar scroll
            placeBomb();
        }
    });
    
    window.addEventListener('keyup', e => {
        keys[e.code] = false;
    });
}

/**
 * Inicializa los controles táctiles para móvil
 */
function setupMobileControls() {
    // Botones direccionales
    const dpadButtons = document.querySelectorAll('.dpad .control-btn');
    dpadButtons.forEach(btn => {
        const key = btn.getAttribute('data-key');
        
        // Touch start - presionar
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameActive) keys[key] = true;
        });
        
        // Touch end - soltar
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
        });
        
        // Touch cancel - cancelar
        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys[key] = false;
        });
    });
    
    // Botón de bomba
    const bombBtn = document.querySelector('.btn-bomb');
    bombBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameActive) placeBomb();
    });
    
    // También agregar soporte para clicks (para testing en PC)
    dpadButtons.forEach(btn => {
        const key = btn.getAttribute('data-key');
        btn.addEventListener('mousedown', () => {
            if (gameActive) keys[key] = true;
        });
        btn.addEventListener('mouseup', () => {
            keys[key] = false;
        });
        btn.addEventListener('mouseleave', () => {
            keys[key] = false;
        });
    });
    
    bombBtn.addEventListener('click', () => {
        if (gameActive) placeBomb();
    });
}

/**
 * Inicializa el juego
 */
function initGame() {
    try {
        // Capturar personaje seleccionado desde el formulario
        if (window.selectedCharacter) {
            characterType = window.selectedCharacter;
        }
        
        initSounds();
        setupKeyboardListeners();
        setupMobileControls();
        startLevel(1);
        // Iniciar el loop solo después de que todo esté configurado
        requestAnimationFrame(loop);
        // Música de fondo
        setTimeout(() => sounds.playBackgroundMusic(), 500);
    } catch (error) {
        console.error('Error al inicializar el juego:', error);
        alert('Error al iniciar el juego. Por favor recarga la página.');
    }
}

/**
 * Inicia un nivel específico
 * @param {number} level - Número de nivel a iniciar
 */
function startLevel(level) {
    try {
        currentLevel = level;
        gameActive = true;
        document.getElementById('overlay').classList.add('hidden');
        
        // Reiniciar timer
        clearInterval(timerInterval);
        timeLeft = 60;
        updateUI();
        
        timerInterval = setInterval(() => {
            if (!gameActive) return;
            timeLeft--;
            updateUI();
            if (timeLeft <= 0) {
                gameOver("¡Se acabó el tiempo!");
            }
        }, 1000);

        // Inicializar mapa y entidades
        initializeMap(level);
        initializePlayer();
        initializeEnemies(level);
        initializeAllies(level); // Inicializar aliados desde nivel 3
        spawnPlanes();
        updateUI();
    } catch (error) {
        console.error('Error al iniciar nivel:', error);
        alert('Error al cargar el nivel. Por favor recarga la página.');
    }
}

/**
 * Inicializa el mapa del nivel
 * @param {number} level - Nivel actual
 */
function initializeMap(level) {
    map = [];
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) {
            // Paredes en los bordes y en posiciones pares
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) {
                row.push(WALL);
            } else {
                // Zona segura para el jugador (esquina superior izquierda)
                if (r < 3 && c < 3) {
                    row.push(EMPTY);
                } else {
                    // Probabilidad de ladrillos aumenta con el nivel
                    row.push(Math.random() < 0.3 + (level * 0.05) ? BRICK : EMPTY);
                }
            }
        }
        map.push(row);
    }
}

/**
 * Inicializa el jugador
 */
function initializePlayer() {
    player = { 
        x: TILE_SIZE * 1.5, 
        y: TILE_SIZE * 1.5, 
        radius: 12, 
        speed: 3, 
        alive: true,
        animFrame: 0,  // Frame de animación
        facing: 'right' // Dirección que mira
    };
}

/**
 * Genera aviones aleatorios en el mapa
 */
function spawnPlanes() {
    planes = [];
    // Generar 1-2 aviones por nivel
    const planeCount = Math.random() > 0.5 ? 2 : 1;
    
    for (let i = 0; i < planeCount; i++) {
        let hx, hy;
        let attempts = 0;
        
        do {
            hx = Math.floor(Math.random() * COLS);
            hy = Math.floor(Math.random() * ROWS);
            attempts++;
            if (attempts > 50) break;
        } while (map[hy][hx] !== EMPTY || (hx < 4 && hy < 4));
        
        if (attempts <= 50) {
            planes.push({
                x: hx * TILE_SIZE + TILE_SIZE / 2,
                y: hy * TILE_SIZE + TILE_SIZE / 2,
                collected: false,
                pulse: 0,
                rotation: 0
            });
        }
    }
}

/**
 * Inicializa los aliados del nivel (desde nivel 3)
 * @param {number} level - Nivel actual
 */
function initializeAllies(level) {
    allies = [];
    
    // Solo aparecen aliados desde el nivel 3
    if (level < 3) return;
    
    const allyCount = 1; // Un aliado por nivel
    const allySpeed = 1.3; // Un poco más rápido que enemigos
    
    for (let i = 0; i < allyCount; i++) {
        let ax, ay;
        let attempts = 0;
        
        do {
            ax = Math.floor(Math.random() * COLS);
            ay = Math.floor(Math.random() * ROWS);
            attempts++;
            if (attempts > 100) break;
        } while (map[ay][ax] !== EMPTY || (ax < 5 && ay < 5));
        
        if (attempts <= 100) {
            allies.push({
                x: ax * TILE_SIZE + TILE_SIZE / 2,
                y: ay * TILE_SIZE + TILE_SIZE / 2,
                radius: 12,
                dir: Math.floor(Math.random() * 4),
                speed: allySpeed,
                alive: true
            });
        }
    }
}

/**
 * Inicializa los enemigos del nivel
 * @param {number} level - Nivel actual
 */
function initializeEnemies(level) {
    enemies = [];
    const enemyCount = 2 + (level * 2); // Nivel 1=4, Nivel 2=6, Nivel 3=8
    const enemySpeed = 1.0 + (level * 0.2); // Velocidad moderada estilo Pac-Man

    for (let i = 0; i < enemyCount; i++) {
        let ex, ey;
        let attempts = 0;
        
        // Buscar posición válida para el enemigo
        do {
            ex = Math.floor(Math.random() * COLS);
            ey = Math.floor(Math.random() * ROWS);
            attempts++;
            if (attempts > 100) {
                console.warn('No se pudo colocar enemigo después de 100 intentos');
                break;
            }
        } while (map[ey][ex] !== EMPTY || (ex < 5 && ey < 5));

        if (attempts <= 100) {
            const enemy = {
                x: ex * TILE_SIZE + TILE_SIZE / 2,
                y: ey * TILE_SIZE + TILE_SIZE / 2,
                radius: 12, // Radio para detección de colisiones
                dir: Math.floor(Math.random() * 4),
                speed: enemySpeed,
                alive: true,
                moveTimer: 0
            };
            enemies.push(enemy);
        }
    }
}

/**
 * El jugador pierde una vida
 * @param {string} reason - Razón de la muerte
 */
function loseLife(reason) {
    playerLives--;
    updateUI();
    
    if (playerLives <= 0) {
        gameActive = false;
        clearInterval(timerInterval);
        showOverlay("GAME OVER", reason, "Reintentar Nivel", () => {
            playerLives = 3;
            startLevel(currentLevel);
        });
    } else {
        // Reaparecer en posición inicial
        player.x = TILE_SIZE * 1.5;
        player.y = TILE_SIZE * 1.5;
        player.alive = true;
        
        // Breve invulnerabilidad visual
        setTimeout(() => {
            if (gameActive) {
                // Continuar jugando
            }
        }, 1000);
    }
}

/**
 * Completa el nivel actual
 */
function levelComplete() {
    gameActive = false;
    clearInterval(timerInterval);
    sounds.playVictory();
    
    if (currentLevel >= 3) {
        showOverlay("¡VICTORIA TOTAL!", "Has completado los 3 niveles.", "Jugar de Nuevo", () => startLevel(1));
    } else {
        showOverlay("¡Nivel Completado!", "Prepárate para el siguiente nivel.", "Siguiente Nivel", () => startLevel(currentLevel + 1));
    }
}

/**
 * Muestra el overlay con mensaje
 * @param {string} title - Título del overlay
 * @param {string} msg - Mensaje a mostrar
 * @param {string} btnText - Texto del botón
 * @param {Function} action - Acción al hacer clic
 */
function showOverlay(title, msg, btnText, action) {
    document.getElementById('overlay-title').innerText = title;
    document.getElementById('overlay-msg').innerText = msg;
    const btn = document.getElementById('overlay-btn');
    btn.innerText = btnText;
    btn.onclick = action;
    document.getElementById('overlay').classList.remove('hidden');
}

/**
 * Actualiza la interfaz de usuario
 */
function updateUI() {
    document.getElementById('level-txt').innerText = currentLevel;
    document.getElementById('enemies-txt').innerText = enemies.filter(e => e.alive).length;
    document.getElementById('lives-txt').innerText = '❤️'.repeat(playerLives);
    
    const tDisplay = document.getElementById('timer-txt');
    tDisplay.innerText = timeLeft;
    tDisplay.style.color = timeLeft <= 10 ? 'red' : '#FFD700';
}

/**
 * Coloca una bomba en la posición del jugador
 */
function placeBomb() {
    if (bombs.length >= 1) return; // Solo una bomba a la vez
    
    const c = Math.floor(player.x / TILE_SIZE);
    const r = Math.floor(player.y / TILE_SIZE);
    
    // Verificar si ya hay una bomba en esta posición
    if (bombs.find(b => b.c === c && b.r === r)) return;

    bombs.push({ 
        c, 
        r, 
        timer: 120, // ~2 segundos a 60 FPS
        range: 1 + currentLevel 
    });
}

/**
 * Actualiza el estado del juego
 */
function update() {
    if (!gameActive || !map || map.length === 0) return;
    
    frameCount++;

    // Movimiento del jugador
    let dx = 0, dy = 0;
    if (keys['ArrowUp']) dy = -player.speed;
    if (keys['ArrowDown']) dy = player.speed;
    if (keys['ArrowLeft']) { dx = -player.speed; player.facing = 'left'; }
    if (keys['ArrowRight']) { dx = player.speed; player.facing = 'right'; }
    
    if (dx !== 0 || dy !== 0) {
        if (moveEntity(player, dx, dy)) {
            player.animFrame++; // Animar solo cuando se mueve
        }
    }

    // Actualizar bombas
    for (let i = bombs.length - 1; i >= 0; i--) {
        bombs[i].timer--;
        if (bombs[i].timer <= 0) {
            createExplosion(bombs[i]);
            sounds.playExplosion();
            bombs.splice(i, 1);
        }
    }

    // Actualizar explosiones
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].timer--;
        
        // Verificar impacto con jugador
        if (player.alive && checkExplosionHit(explosions[i], player)) {
            player.alive = false;
            loseLife("¡Te quemaste con la explosión!");
        }
        
        // Verificar impacto con enemigos
        enemies.forEach(e => {
            if (e.alive && checkExplosionHit(explosions[i], e)) {
                e.alive = false;
            }
        });
        
        if (explosions[i].timer <= 0) {
            explosions.splice(i, 1);
        }
    }

    // Recolectar aviones
    planes.forEach(plane => {
        if (!plane.collected) {
            const dist = Math.hypot(player.x - plane.x, player.y - plane.y);
            if (dist < TILE_SIZE * 0.5) {
                plane.collected = true;
                if (playerLives < maxLives) {
                    playerLives++;
                    updateUI();
                    // Sonido al recoger avión
                    try {
                        sounds.playVictory();
                    } catch(e) {}
                }
            }
            plane.pulse++;
            plane.rotation += 0.05;
        }
    });
    
    // Actualizar enemigos
    enemies = enemies.filter(e => e.alive);
    updateUI();;
    
    // Verificar victoria
    if (enemies.length === 0) {
        levelComplete();
        return;
    }

    // Movimiento de enemigos - IA estilo Pac-Man (movimiento continuo)
    enemies.forEach((e, index) => {
        if (!e.alive) return;
        
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const distance = Math.hypot(dx, dy);
        
        // Inicializar dirección si no existe
        if (e.dir === undefined) e.dir = Math.floor(Math.random() * 4);
        
        let moved = false;
        const dirs = [
            {x:0, y:-e.speed},  // 0: arriba
            {x:e.speed, y:0},   // 1: derecha
            {x:0, y:e.speed},   // 2: abajo
            {x:-e.speed, y:0}   // 3: izquierda
        ];
        
        // Si está cerca del jugador (dentro de 10 tiles), perseguirlo inteligentemente
        if (distance < TILE_SIZE * 10) {
            // Calcular mejor dirección hacia el jugador
            let bestDir = e.dir;
            let maxScore = -Infinity;
            
            // Evaluar las 4 direcciones posibles
            for (let i = 0; i < 4; i++) {
                const testX = e.x + dirs[i].x * 3;
                const testY = e.y + dirs[i].y * 3;
                
                // No dar marcha atrás (dirección opuesta)
                if (i === (e.dir + 2) % 4 && Math.random() > 0.3) continue;
                
                // Probar si puede moverse en esa dirección
                const tempEnt = {x: e.x + dirs[i].x, y: e.y + dirs[i].y};
                if (!checkCollision(tempEnt)) {
                    // Calcular qué tan cerca nos acerca al jugador
                    const newDist = Math.hypot(player.x - testX, player.y - testY);
                    const score = -newDist + (i === e.dir ? 10 : 0); // Bonus por mantener dirección
                    
                    if (score > maxScore) {
                        maxScore = score;
                        bestDir = i;
                    }
                }
            }
            
            e.dir = bestDir;
        }
        
        // Intentar moverse en la dirección actual
        moved = moveEntity(e, dirs[e.dir].x, dirs[e.dir].y);
        
        // Si choca, elegir nueva dirección inteligente
        if (!moved) {
            // Probar otras direcciones (evitar retroceder)
            const tryDirs = [e.dir, (e.dir + 1) % 4, (e.dir + 3) % 4, (e.dir + 2) % 4];
            for (let i = 0; i < tryDirs.length; i++) {
                if (moveEntity(e, dirs[tryDirs[i]].x, dirs[tryDirs[i]].y)) {
                    e.dir = tryDirs[i];
                    moved = true;
                    break;
                }
            }
        }
        
        // Verificar colisión con jugador
        if (player.alive && distance < TILE_SIZE * 0.6) {
            player.alive = false;
            loseLife("¡Un monstruo te atrapó!");
        }
    });
    
    // Movimiento de aliados - Persiguen y eliminan enemigos
    allies.forEach((ally, allyIndex) => {
        if (!ally.alive || enemies.length === 0) return;
        
        // Buscar el enemigo más cercano
        let closestEnemy = null;
        let closestDist = Infinity;
        
        enemies.forEach(e => {
            if (!e.alive) return;
            const dist = Math.hypot(ally.x - e.x, ally.y - e.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestEnemy = e;
            }
        });
        
        if (!closestEnemy) return;
        
        // Inicializar dirección si no existe
        if (ally.dir === undefined) ally.dir = Math.floor(Math.random() * 4);
        
        let moved = false;
        const dirs = [
            {x:0, y:-ally.speed},  // 0: arriba
            {x:ally.speed, y:0},   // 1: derecha
            {x:0, y:ally.speed},   // 2: abajo
            {x:-ally.speed, y:0}   // 3: izquierda
        ];
        
        const dx = closestEnemy.x - ally.x;
        const dy = closestEnemy.y - ally.y;
        
        // Calcular mejor dirección hacia el enemigo más cercano
        let bestDir = ally.dir;
        let maxScore = -Infinity;
        
        for (let i = 0; i < 4; i++) {
            const testX = ally.x + dirs[i].x * 3;
            const testY = ally.y + dirs[i].y * 3;
            
            // No dar marcha atrás
            if (i === (ally.dir + 2) % 4 && Math.random() > 0.3) continue;
            
            const tempEnt = {x: ally.x + dirs[i].x, y: ally.y + dirs[i].y, radius: ally.radius};
            if (!checkCollision(tempEnt)) {
                const newDist = Math.hypot(closestEnemy.x - testX, closestEnemy.y - testY);
                const score = -newDist + (i === ally.dir ? 10 : 0);
                
                if (score > maxScore) {
                    maxScore = score;
                    bestDir = i;
                }
            }
        }
        
        ally.dir = bestDir;
        moved = moveEntity(ally, dirs[ally.dir].x, dirs[ally.dir].y);
        
        // Si choca, elegir nueva dirección
        if (!moved) {
            const tryDirs = [ally.dir, (ally.dir + 1) % 4, (ally.dir + 3) % 4, (ally.dir + 2) % 4];
            for (let i = 0; i < tryDirs.length; i++) {
                if (moveEntity(ally, dirs[tryDirs[i]].x, dirs[tryDirs[i]].y)) {
                    ally.dir = tryDirs[i];
                    break;
                }
            }
        }
        
        // Verificar colisión con enemigos - eliminar enemigo al tocarlo
        enemies.forEach((e, eIndex) => {
            if (!e.alive) return;
            const dist = Math.hypot(ally.x - e.x, ally.y - e.y);
            if (dist < TILE_SIZE * 0.6) {
                e.alive = false;
                // Sonido opcional
                try {
                    sounds.playExplosion();
                } catch(err) {}
            }
        });
    });
}

/**
 * Mueve una entidad verificando colisiones
 * @param {Object} ent - Entidad a mover
 * @param {number} dx - Movimiento en X
 * @param {number} dy - Movimiento en Y
 * @returns {boolean} True si se pudo mover
 */
function moveEntity(ent, dx, dy) {
    if (!ent || !ent.alive) return false;
    
    const newX = ent.x + dx;
    const newY = ent.y + dy;
    
    // Guardar posición anterior
    const oldX = ent.x;
    const oldY = ent.y;
    
    // Intentar mover
    ent.x = newX;
    ent.y = newY;
    
    if (checkCollision(ent)) {
        // Restaurar posición
        ent.x = oldX;
        ent.y = oldY;
        return false;
    }
    
    return true;
}

/**
 * Verifica si una entidad colisiona con el mapa
 * @param {Object} ent - Entidad a verificar
 * @returns {boolean} True si hay colisión
 */
function checkCollision(ent) {
    // Validar que el mapa existe y la entidad tiene propiedades válidas
    if (!map || map.length === 0 || !ent || typeof ent.x !== 'number' || typeof ent.y !== 'number') {
        return true; // Considerar colisión si hay datos inválidos
    }
    
    const margin = 4;
    const points = [
        {c: Math.floor((ent.x - ent.radius + margin) / TILE_SIZE), r: Math.floor((ent.y - ent.radius + margin) / TILE_SIZE)},
        {c: Math.floor((ent.x + ent.radius - margin) / TILE_SIZE), r: Math.floor((ent.y - ent.radius + margin) / TILE_SIZE)},
        {c: Math.floor((ent.x - ent.radius + margin) / TILE_SIZE), r: Math.floor((ent.y + ent.radius - margin) / TILE_SIZE)},
        {c: Math.floor((ent.x + ent.radius - margin) / TILE_SIZE), r: Math.floor((ent.y + ent.radius - margin) / TILE_SIZE)}
    ];
    
    for (let p of points) {
        // Validar que las coordenadas son números válidos
        if (isNaN(p.r) || isNaN(p.c)) {
            return true;
        }
        
        if (p.r < 0 || p.r >= ROWS || p.c < 0 || p.c >= COLS) {
            return true;
        }
        
        // Verificar que la fila existe antes de acceder
        if (map[p.r] && map[p.r][p.c] !== EMPTY) {
            return true;
        }
    }
    return false;
}

/**
 * Crea una explosión desde una bomba
 * @param {Object} bomb - Bomba que explota
 */
function createExplosion(bomb) {
    const dirs = [
        {x:0, y:0},   // centro
        {x:0, y:-1},  // arriba
        {x:1, y:0},   // derecha
        {x:0, y:1},   // abajo
        {x:-1, y:0}   // izquierda
    ];
    
    // Explosión en el centro
    explosions.push({ c: bomb.c, r: bomb.r, timer: 20 });
    
    // Explosión en las 4 direcciones
    for (let i = 1; i < dirs.length; i++) {
        for (let k = 1; k <= bomb.range; k++) {
            const nc = bomb.c + dirs[i].x * k;
            const nr = bomb.r + dirs[i].y * k;
            
            // Verificar límites y paredes
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || map[nr][nc] === WALL) {
                break;
            }
            
            explosions.push({ c: nc, r: nr, timer: 20 });
            
            // Si hay ladrillo, destruirlo y detener la explosión
            if (map[nr][nc] === BRICK) {
                map[nr][nc] = EMPTY;
                
                // 30% de probabilidad de que aparezca una bomba automática
                if (Math.random() < 0.3) {
                    // Crear bomba automática que explota en 2 segundos
                    const autoBomb = {
                        c: nc,
                        r: nr,
                        timer: 120, // 2 segundos (60 fps * 2)
                        range: 2,
                        auto: true // Marca que es una bomba automática
                    };
                    bombs.push(autoBomb);
                }
                
                break;
            }
        }
    }
}

/**
 * Verifica si una explosión impacta una entidad
 * @param {Object} expl - Explosión
 * @param {Object} ent - Entidad
 * @returns {boolean} True si hay impacto
 */
function checkExplosionHit(expl, ent) {
    const explX = expl.c * TILE_SIZE + TILE_SIZE / 2;
    const explY = expl.r * TILE_SIZE + TILE_SIZE / 2;
    return Math.hypot(ent.x - explX, ent.y - explY) < TILE_SIZE * 0.8;
}

/**
 * Dibuja todos los elementos del juego
 */
function draw() {
    // Validar que el contexto y el mapa existen
    if (!ctx || !map || map.length === 0) return;
    
    // Fondo
    ctx.fillStyle = '#1A237E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mapa
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;
            
            if (map[r][c] === WALL) {
                // Bloques de pared (no destructibles) estilo ladrillo
                // Fondo del ladrillo con gradiente gris
                const wallGradient = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
                wallGradient.addColorStop(0, '#757575');
                wallGradient.addColorStop(0.5, '#616161');
                wallGradient.addColorStop(1, '#424242');
                
                ctx.fillStyle = wallGradient;
                ctx.beginPath();
                ctx.roundRect(x, y, TILE_SIZE, TILE_SIZE, 3);
                ctx.fill();
                
                // Borde superior brillante
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, TILE_SIZE - 4, 3, 2);
                ctx.fill();
                
                // Líneas de ladrillos (horizontales)
                ctx.strokeStyle = '#2C2C2C';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x + 3, y + TILE_SIZE / 2);
                ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE / 2);
                ctx.stroke();
                
                // Líneas verticales alternadas (efecto ladrillo)
                ctx.beginPath();
                ctx.moveTo(x + TILE_SIZE / 2, y + 3);
                ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 1);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
                ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 3);
                ctx.stroke();
                
                // Sombra inferior
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                ctx.roundRect(x + 2, y + TILE_SIZE - 5, TILE_SIZE - 4, 3, 2);
                ctx.fill();
            } else if (map[r][c] === BRICK) {
                // Ladrillos destructibles estilo Bomberman original
                // Fondo del ladrillo con gradiente
                const brickGradient = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
                brickGradient.addColorStop(0, '#E57373');
                brickGradient.addColorStop(0.5, '#D32F2F');
                brickGradient.addColorStop(1, '#B71C1C');
                
                ctx.fillStyle = brickGradient;
                ctx.beginPath();
                ctx.roundRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, 3);
                ctx.fill();
                
                // Borde superior brillante
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, TILE_SIZE - 4, 3, 2);
                ctx.fill();
                
                // Líneas de ladrillos (horizontales)
                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x + 3, y + TILE_SIZE / 2);
                ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE / 2);
                ctx.stroke();
                
                // Líneas verticales alternadas (efecto ladrillo)
                ctx.beginPath();
                ctx.moveTo(x + TILE_SIZE / 2, y + 3);
                ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 1);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
                ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 3);
                ctx.stroke();
                
                // Sombra inferior
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.roundRect(x + 2, y + TILE_SIZE - 5, TILE_SIZE - 4, 3, 2);
                ctx.fill();
            }
        }
    }

    // Aviones
    planes.forEach(plane => {
        if (!plane.collected) {
            const bounce = Math.sin(plane.pulse * 0.1) * 3;
            ctx.save();
            ctx.translate(plane.x, plane.y + bounce);
            ctx.rotate(plane.rotation);
            
            // Dibujar avión con detalles
            // Cuerpo del avión
            ctx.fillStyle = '#42A5F5';
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Alas
            ctx.fillStyle = '#1E88E5';
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(-12, -6);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(-12, 6);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();
            
            // Ventanas
            ctx.fillStyle = '#90CAF9';
            ctx.beginPath();
            ctx.arc(2, 0, 2, 0, Math.PI * 2);
            ctx.arc(-3, 0, 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Cola
            ctx.fillStyle = '#1976D2';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(14, -4);
            ctx.lineTo(12, 0);
            ctx.lineTo(14, 4);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
    });
    
    // Bombas estilo Bomberman clásico
    bombs.forEach(b => {
        const bx = b.c * TILE_SIZE + TILE_SIZE / 2;
        const by = b.r * TILE_SIZE + TILE_SIZE / 2;
        const breathe = Math.sin(Date.now() * 0.005) * 2;
        
        // Sombra de la bomba
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(bx, by + 16, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Cuerpo de la bomba con gradiente
        const bombGradient = ctx.createRadialGradient(bx - 5, by - 5, 2, bx, by, 14 + breathe);
        bombGradient.addColorStop(0, '#2C2C2C');
        bombGradient.addColorStop(0.7, '#000000');
        bombGradient.addColorStop(1, '#1A1A1A');
        
        ctx.fillStyle = bombGradient;
        ctx.beginPath();
        ctx.arc(bx, by, 14 + breathe, 0, Math.PI * 2);
        ctx.fill();
        
        // Brillo en la bomba
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(bx - 4, by - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Mecha con llama animada
        const flameIntensity = (Math.sin(Date.now() * 0.01) + 1) / 2;
        
        // Base de la mecha
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by - 14 - breathe);
        ctx.lineTo(bx - 2, by - 20 - breathe);
        ctx.stroke();
        
        // Llama exterior (naranja)
        const flameGradient = ctx.createRadialGradient(bx - 2, by - 22 - breathe, 0, bx - 2, by - 22 - breathe, 6);
        flameGradient.addColorStop(0, `rgba(255, 255, 100, ${flameIntensity})`);
        flameGradient.addColorStop(0.5, `rgba(255, 150, 0, ${flameIntensity * 0.8})`);
        flameGradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
        
        ctx.fillStyle = flameGradient;
        ctx.beginPath();
        ctx.arc(bx - 2, by - 22 - breathe, 5 + flameIntensity * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Llama interior (amarilla brillante)
        ctx.fillStyle = `rgba(255, 255, 200, ${flameIntensity})`;
        ctx.beginPath();
        ctx.arc(bx - 2, by - 22 - breathe, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Explosiones realistas con partículas
    explosions.forEach(e => {
        const ex = e.c * TILE_SIZE + TILE_SIZE / 2;
        const ey = e.r * TILE_SIZE + TILE_SIZE / 2;
        const progress = 1 - (e.timer / 20);
        const maxRadius = TILE_SIZE * 0.8;
        const currentRadius = maxRadius * progress;
        
        // Onda de choque exterior
        const shockGradient = ctx.createRadialGradient(ex, ey, 0, ex, ey, currentRadius + 15);
        shockGradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 * (1 - progress)})`);
        shockGradient.addColorStop(0.3, `rgba(255, 200, 0, ${0.6 * (1 - progress)})`);
        shockGradient.addColorStop(0.6, `rgba(255, 100, 0, ${0.3 * (1 - progress)})`);
        shockGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = shockGradient;
        ctx.beginPath();
        ctx.arc(ex, ey, currentRadius + 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Núcleo de la explosión
        const coreGradient = ctx.createRadialGradient(ex, ey, 0, ex, ey, currentRadius);
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - progress)})`);
        coreGradient.addColorStop(0.4, `rgba(255, 220, 100, ${0.7 * (1 - progress)})`);
        coreGradient.addColorStop(0.7, `rgba(255, 100, 50, ${0.4 * (1 - progress)})`);
        coreGradient.addColorStop(1, `rgba(200, 0, 0, ${0.1 * (1 - progress)})`);
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(ex, ey, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Partículas aleatorias
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + progress * 0.5;
            const dist = currentRadius * (0.7 + Math.random() * 0.3);
            const px = ex + Math.cos(angle) * dist;
            const py = ey + Math.sin(angle) * dist;
            const particleSize = (3 + Math.random() * 3) * (1 - progress);
            
            const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize);
            particleGradient.addColorStop(0, `rgba(255, 255, 150, ${0.8 * (1 - progress)})`);
            particleGradient.addColorStop(0.5, `rgba(255, 150, 50, ${0.5 * (1 - progress)})`);
            particleGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            ctx.fillStyle = particleGradient;
            ctx.beginPath();
            ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Resplandor adicional en el centro
        if (progress < 0.3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - progress / 0.3)})`;
            ctx.beginPath();
            ctx.arc(ex, ey, 10 * (1 - progress / 0.3), 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Enemigos - Esqueletos animados
    enemies.forEach((e, index) => {
        if (e.alive) {
            drawAnimatedSkeleton(e.x, e.y, gameActive ? Date.now() * 0.01 + index : 0);
        }
    });
    
    // Aliados - Robots azules que ayudan
    allies.forEach((ally, index) => {
        if (ally.alive) {
            drawAnimatedAlly(ally.x, ally.y, gameActive ? Date.now() * 0.01 + index : 0);
        }
    });

    // Jugador - Animado con brazos y piernas
    if (player.alive) {
        if (characterType === 'stewardess') {
            drawAnimatedStewardess(player.x, player.y, player.animFrame, player.facing);
        } else if (characterType === 'steward') {
            drawAnimatedSteward(player.x, player.y, player.animFrame, player.facing);
        } else if (characterType === 'pilot') {
            drawAnimatedPilot(player.x, player.y, player.animFrame, player.facing);
        } else {
            // Por defecto azafata
            drawAnimatedStewardess(player.x, player.y, player.animFrame, player.facing);
        }
    }
}

/**
 * Dibuja una azafata animada
 * @param {number} x - Posición X
 * @param {number} y - Posición Y
 * @param {number} frame - Frame de animación
 * @param {string} facing - Dirección ('left' o 'right')
 */
function drawAnimatedStewardess(x, y, frame, facing) {
    const walkCycle = Math.sin(frame * 0.3) * 5;
    
    ctx.save();
    ctx.translate(x, y);
    if (facing === 'left') ctx.scale(-1, 1);
    
    // Sombra del personaje
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Piernas con volumen
    const legGradient = ctx.createLinearGradient(-5, 5, 5, 15);
    legGradient.addColorStop(0, '#1976D2');
    legGradient.addColorStop(1, '#0D47A1');
    
    ctx.fillStyle = legGradient;
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    // Pierna izquierda
    ctx.beginPath();
    ctx.moveTo(-3, 5);
    ctx.lineTo(-5 + walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-5 + walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pierna derecha
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(5 - walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5 - walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuerpo con uniforme azul
    const bodyGradient = ctx.createRadialGradient(-2, -1, 2, 0, 0, 10);
    bodyGradient.addColorStop(0, '#1976D2');
    bodyGradient.addColorStop(0.7, '#1565C0');
    bodyGradient.addColorStop(1, '#0D47A1');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Borde del uniforme
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Chaúqueta con botones
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(0, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pañuelo
    ctx.fillStyle = '#F44336';
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.lineTo(2, -1);
    ctx.lineTo(-2, -1);
    ctx.closePath();
    ctx.fill();
    
    // Brazos con volumen
    const armGradient = ctx.createLinearGradient(-10, -2, -6, 5);
    armGradient.addColorStop(0, '#FFB74D');
    armGradient.addColorStop(1, '#FF9800');
    
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // Brazo izquierdo
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-10 - walkCycle, 5);
    ctx.stroke();
    // Mano
    ctx.fillStyle = '#FFCC80';
    ctx.beginPath();
    ctx.arc(-10 - walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Brazo derecho
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(10 + walkCycle, 5);
    ctx.stroke();
    // Mano
    ctx.beginPath();
    ctx.arc(10 + walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Cabeza (tono piel)
    const headGradient = ctx.createRadialGradient(-2, -11, 2, 0, -10, 7);
    headGradient.addColorStop(0, '#FFCCBC');
    headGradient.addColorStop(0.7, '#FFAB91');
    headGradient.addColorStop(1, '#FF8A65');
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Contorno de la cabeza
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Ojos con brillo
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-2, -11, 1.5, 0, Math.PI * 2);
    ctx.arc(2, -11, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Brillo en los ojos
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-1.5, -11.5, 0.5, 0, Math.PI * 2);
    ctx.arc(2.5, -11.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Boca
    ctx.strokeStyle = '#C62828';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8, 3, 0, Math.PI);
    ctx.stroke();
    
    // Sombrero/Gorra de azafata
    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.ellipse(0, -16, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cabello
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.arc(-4, -11, 3, 0, Math.PI * 2);
    ctx.arc(4, -11, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Dibuja un esqueleto animado
 * @param {number} x - Posición X
 * @param {number} y - Posición Y
 * @param {number} time - Tiempo para animación
 */
function drawAnimatedSkeleton(x, y, time) {
    const bounce = Math.sin(time * 2) * 1.5;
    
    ctx.save();
    ctx.translate(x, y + bounce);
    
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuerpo del monstruo con gradiente
    const bodyGradient = ctx.createRadialGradient(0, -2, 2, 0, 0, 12);
    bodyGradient.addColorStop(0, '#FFF176');
    bodyGradient.addColorStop(0.6, '#FDD835');
    bodyGradient.addColorStop(1, '#F9A825');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Pelaje/textura del monstruo
    ctx.strokeStyle = '#F9A825';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const startX = Math.cos(angle) * 7;
        const startY = Math.sin(angle) * 7;
        const endX = Math.cos(angle) * 10;
        const endY = Math.sin(angle) * 10;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    
    // Cabeza del monstruo
    const headGradient = ctx.createRadialGradient(-1, -13, 2, 0, -12, 8);
    headGradient.addColorStop(0, '#FFEB3B');
    headGradient.addColorStop(0.7, '#FDD835');
    headGradient.addColorStop(1, '#FBC02D');
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuernos
    ctx.fillStyle = '#F57F17';
    ctx.beginPath();
    ctx.moveTo(-5, -17);
    ctx.lineTo(-3, -20);
    ctx.lineTo(-2, -17);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(5, -17);
    ctx.lineTo(3, -20);
    ctx.lineTo(2, -17);
    ctx.closePath();
    ctx.fill();
    
    // Ojos brillantes rojos
    const eyeGlow = 0.5 + Math.sin(time * 5) * 0.5;
    ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(-3, -13, 2.5, 0, Math.PI * 2);
    ctx.arc(3, -13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupilas
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(-3, -13, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Brillo en ojos
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-2.5, -13.5, 0.8, 0, Math.PI * 2);
    ctx.arc(3.5, -13.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Boca con dientes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -9, 3, 0.3, Math.PI - 0.3);
    ctx.stroke();
    
    // Dientes
    ctx.fillStyle = '#FFF';
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 1.5, -9);
        ctx.lineTo(i * 1.5 - 0.5, -7);
        ctx.lineTo(i * 1.5 + 0.5, -7);
        ctx.closePath();
        ctx.fill();
    }
    
    // Brazos con garras
    const armSwing = Math.sin(time * 3) * 4;
    ctx.strokeStyle = '#FDD835';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    // Brazo izquierdo
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-12 - armSwing, 4);
    ctx.stroke();
    
    // Garra izquierda
    ctx.strokeStyle = '#F57F17';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12 - armSwing, 4);
    ctx.lineTo(-14 - armSwing, 6);
    ctx.moveTo(-12 - armSwing, 4);
    ctx.lineTo(-13 - armSwing, 7);
    ctx.moveTo(-12 - armSwing, 4);
    ctx.lineTo(-10 - armSwing, 6);
    ctx.stroke();
    
    // Brazo derecho
    ctx.strokeStyle = '#FDD835';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(12 + armSwing, 4);
    ctx.stroke();
    
    // Garra derecha
    ctx.strokeStyle = '#F57F17';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12 + armSwing, 4);
    ctx.lineTo(14 + armSwing, 6);
    ctx.moveTo(12 + armSwing, 4);
    ctx.lineTo(13 + armSwing, 7);
    ctx.moveTo(12 + armSwing, 4);
    ctx.lineTo(10 + armSwing, 6);
    ctx.stroke();
    
    // Piernas
    const legMove = Math.sin(time * 3) * 3;
    ctx.strokeStyle = '#FBC02D';
    ctx.lineWidth = 4;
    
    // Pierna izquierda
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(-5, 14 + legMove);
    ctx.stroke();
    
    // Pie izquierdo
    ctx.fillStyle = '#F9A825';
    ctx.beginPath();
    ctx.ellipse(-5, 15 + legMove, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pierna derecha
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(5, 14 - legMove);
    ctx.stroke();
    
    // Pie derecho
    ctx.beginPath();
    ctx.ellipse(5, 15 - legMove, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Dibuja un aliado (robot azul que ayuda)
 */
function drawAnimatedAlly(x, y, time) {
    const bounce = Math.sin(time * 2) * 1.5;
    
    ctx.save();
    ctx.translate(x, y + bounce);
    
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuerpo del robot con gradiente azul
    const bodyGradient = ctx.createRadialGradient(0, -2, 2, 0, 0, 12);
    bodyGradient.addColorStop(0, '#64B5F6');
    bodyGradient.addColorStop(0.6, '#2196F3');
    bodyGradient.addColorStop(1, '#1976D2');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Detalles metálicos
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const startX = Math.cos(angle) * 7;
        const startY = Math.sin(angle) * 7;
        const endX = Math.cos(angle) * 10;
        const endY = Math.sin(angle) * 10;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    
    // Cabeza del robot
    const headGradient = ctx.createRadialGradient(-1, -13, 2, 0, -12, 8);
    headGradient.addColorStop(0, '#90CAF9');
    headGradient.addColorStop(0.7, '#42A5F5');
    headGradient.addColorStop(1, '#1E88E5');
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Antena
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -22);
    ctx.stroke();
    
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.arc(0, -23, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Ojos verdes brillantes (amigable)
    const eyeGlow = 0.5 + Math.sin(time * 3) * 0.5;
    ctx.fillStyle = `rgba(0, 230, 118, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(-3, -13, 2.5, 0, Math.PI * 2);
    ctx.arc(3, -13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupilas
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.arc(-3, -13, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Brillo en ojos
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-2.5, -13.5, 0.8, 0, Math.PI * 2);
    ctx.arc(3.5, -13.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Sonrisa amigable
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -9, 3, 0, Math.PI);
    ctx.stroke();
    
    // Brazos mecánicos
    const armSwing = Math.sin(time * 3) * 4;
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    // Brazo izquierdo
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-12 - armSwing, 4);
    ctx.stroke();
    
    // Mano izquierda
    ctx.fillStyle = '#1976D2';
    ctx.beginPath();
    ctx.arc(-12 - armSwing, 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Brazo derecho
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(12 + armSwing, 4);
    ctx.stroke();
    
    // Mano derecha
    ctx.beginPath();
    ctx.arc(12 + armSwing, 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Piernas
    const legMove = Math.sin(time * 3) * 3;
    ctx.strokeStyle = '#1E88E5';
    ctx.lineWidth = 4;
    
    // Pierna izquierda
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(-5, 14 + legMove);
    ctx.stroke();
    
    // Pie izquierdo
    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.ellipse(-5, 15 + legMove, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pierna derecha
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(5, 14 - legMove);
    ctx.stroke();
    
    // Pie derecho
    ctx.beginPath();
    ctx.ellipse(5, 15 - legMove, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Dibuja un azafato animado
 */
function drawAnimatedSteward(x, y, frame, facing) {
    const walkCycle = Math.sin(frame * 0.3) * 5;
    
    ctx.save();
    ctx.translate(x, y);
    if (facing === 'left') ctx.scale(-1, 1);
    
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Piernas con pantalón azul
    const legGradient = ctx.createLinearGradient(-5, 5, 5, 15);
    legGradient.addColorStop(0, '#1565C0');
    legGradient.addColorStop(1, '#0D47A1');
    
    ctx.fillStyle = legGradient;
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-3, 5);
    ctx.lineTo(-5 + walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-5 + walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(5 - walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5 - walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuerpo con uniforme azul
    const bodyGradient = ctx.createRadialGradient(-2, -1, 2, 0, 0, 10);
    bodyGradient.addColorStop(0, '#1976D2');
    bodyGradient.addColorStop(0.7, '#1565C0');
    bodyGradient.addColorStop(1, '#0D47A1');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Botones dorados
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(0, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Corbata
    ctx.fillStyle = '#000';
    ctx.fillRect(-1.5, -5, 3, 8);
    
    // Brazos
    ctx.strokeStyle = '#1976D2';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-10 - walkCycle, 5);
    ctx.stroke();
    ctx.fillStyle = '#FFCCBC';
    ctx.beginPath();
    ctx.arc(-10 - walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(10 + walkCycle, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10 + walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Cabeza
    const headGradient = ctx.createRadialGradient(-2, -11, 2, 0, -10, 7);
    headGradient.addColorStop(0, '#FFCCBC');
    headGradient.addColorStop(0.7, '#FFAB91');
    headGradient.addColorStop(1, '#FF8A65');
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Cabello corto
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.arc(0, -13, 6, Math.PI, 0);
    ctx.fill();
    
    // Ojos
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-2, -11, 1.5, 0, Math.PI * 2);
    ctx.arc(2, -11, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-1.5, -11.5, 0.5, 0, Math.PI * 2);
    ctx.arc(2.5, -11.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Sonrisa
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8, 3, 0, Math.PI);
    ctx.stroke();
    
    // Gorra
    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.ellipse(0, -16, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Dibuja un piloto animado
 */
function drawAnimatedPilot(x, y, frame, facing) {
    const walkCycle = Math.sin(frame * 0.3) * 5;
    
    ctx.save();
    ctx.translate(x, y);
    if (facing === 'left') ctx.scale(-1, 1);
    
    // Sombra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Piernas
    const legGradient = ctx.createLinearGradient(-5, 5, 5, 15);
    legGradient.addColorStop(0, '#37474F');
    legGradient.addColorStop(1, '#263238');
    
    ctx.fillStyle = legGradient;
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-3, 5);
    ctx.lineTo(-5 + walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-5 + walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(5 - walkCycle, 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5 - walkCycle, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Cuerpo con uniforme blanco
    const bodyGradient = ctx.createRadialGradient(-2, -1, 2, 0, 0, 10);
    bodyGradient.addColorStop(0, '#FFFFFF');
    bodyGradient.addColorStop(0.7, '#F5F5F5');
    bodyGradient.addColorStop(1, '#EEEEEE');
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Insignias doradas
    ctx.fillStyle = '#FFD700';
    for (let i = -3; i <= 3; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i - 1, -4);
        ctx.lineTo(i, -6);
        ctx.lineTo(i + 1, -4);
        ctx.lineTo(i, -3);
        ctx.closePath();
        ctx.fill();
    }
    
    // Corbata negra
    ctx.fillStyle = '#000';
    ctx.fillRect(-1, -5, 2, 7);
    
    // Brazos
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-10 - walkCycle, 5);
    ctx.stroke();
    ctx.fillStyle = '#FFCCBC';
    ctx.beginPath();
    ctx.arc(-10 - walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(10 + walkCycle, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10 + walkCycle, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Cabeza
    const headGradient = ctx.createRadialGradient(-2, -11, 2, 0, -10, 7);
    headGradient.addColorStop(0, '#FFCCBC');
    headGradient.addColorStop(0.7, '#FFAB91');
    headGradient.addColorStop(1, '#FF8A65');
    
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Gorra de piloto con visera
    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.arc(0, -14, 6, Math.PI, 0);
    ctx.fill();
    
    // Visera
    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.ellipse(0, -10, 7, 2, 0, 0, Math.PI);
    ctx.fill();
    
    // Insignia en gorra
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Gafas de aviador
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-2, -10, 2.5, 0, Math.PI * 2);
    ctx.arc(2, -10, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Reflejo en gafas
    ctx.fillStyle = 'rgba(135, 206, 250, 0.5)';
    ctx.beginPath();
    ctx.arc(-2, -10, 2, 0, Math.PI * 2);
    ctx.arc(2, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}



/**
 * Loop principal del juego
 */
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
