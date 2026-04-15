import { config, gameState, move, undo, redo, handlePracticeModeChange, startAIMode, stopAIMode, saveSettings, initGrid, clearHistory, updateStatistics } from './main.js';
import { mergeAnimations, getGoalValue } from './grid.js';
import { getHighScoreKey, getHighestTileKey, getGameStateKey, getPrimeFactorization, formatScore } from './utils.js';
import { openColorPicker } from './color.js';

// Map of tile value -> display name supplied by the current theme/editor
const tileDisplayNameMap = new Map();

// Local storage key for a user-edited/custom tile theme
const CUSTOM_THEME_KEY = 'customTileTheme';

// The currently loaded theme tiles (full list). Filtering shows subsets of this array.
let currentThemeTiles = [];

// Helper: determine numeric value (or null)
function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

function isIntegerNumber(val) {
    const n = toNumber(val);
    return n !== null && Number.isInteger(n);
}

function isPowerOf(n, base) {
    if (!Number.isFinite(n) || n <= 1 || !Number.isInteger(n)) return false;
    while (n % base === 0) n = n / base;
    return n === 1;
}

function isPowerOfTwo(n) { return isPowerOf(n, 2); }
function isPowerOfThree(n) { return isPowerOf(n, 3); }

function isPerfectSquare(x) {
    if (!Number.isFinite(x) || x < 0) return false;
    const s = Math.floor(Math.sqrt(x));
    return s * s === x;
}

function isFibonacci(n) {
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return false;
    return isPerfectSquare(5 * n * n + 4) || isPerfectSquare(5 * n * n - 4);
}

function isOperatorValue(val) {
    const s = String(val);
    return ['plus', 'minus', 'multiply', 'divide', '+', '-', '*', '/'].includes(s);
}

function filterTiles(tiles, filter) {
    if (!Array.isArray(tiles)) return [];
    switch ((filter || 'all').toString()) {
        case 'classic':
            return tiles.filter(t => {
                const n = toNumber(t.tileValue);
                return n !== null && isPowerOfTwo(n) && n > 1;
            });
        case 'fibonacci':
            return tiles.filter(t => {
                const n = toNumber(t.tileValue);
                return n !== null && isFibonacci(n);
            });
        case 'negative':
            return tiles.filter(t => {
                const n = toNumber(t.tileValue);
                if (n !== null) {
                    if (n < 0) return true; // all negative numeric tiles
                    return isPowerOfTwo(n) && n > 1; // powers of two > 1
                }
                return false;
            });
        case 'power-of-three':
            return tiles.filter(t => {
                const n = toNumber(t.tileValue);
                return n !== null && isPowerOfThree(n);
            });
        case 'operators':
            return tiles.filter(t => isOperatorValue(t.tileValue));
        case 'all':
        default:
            return tiles.slice();
    }
}

function saveCustomThemeToLocalStorage(tiles) {
    try {
        // store as an object for future extensibility
        localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify({ tiles }));
    } catch (e) {
        console.error('Failed to save custom theme to localStorage', e);
    }
}

function getCustomThemeFromLocalStorage() {
    try {
        const raw = localStorage.getItem(CUSTOM_THEME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.tiles)) return parsed.tiles;
    } catch (e) {
        console.error('Failed to read custom theme from localStorage', e);
    }
    return null;
}


// --- Supermerging Style Helpers ---

const largePrimeGradients = {
    7: 'linear-gradient(135deg, #0005, transparent, #fff5, transparent, #0005)',
    11: 'radial-gradient(#fff5, transparent, #0005, transparent, #fff5, transparent, #0005)',
    13: 'linear-gradient(180deg, #0005, transparent, #fff5, transparent, #0005, transparent, #fff5, transparent, #0005)',
    17: 'repeating-linear-gradient(195deg, transparent 0%, transparent 19%, #0906 20%, #0906 26%, transparent 27%)',
    19: 'repeating-linear-gradient(135deg, #90f6 0%, #90f6 3%, transparent 4%, transparent 21%, #90f6 22%, #90f6 25%)',
    23: 'repeating-linear-gradient(60deg, #f906 0%, #f906 3%, transparent 4%, transparent 21%, #f906 22%, #f906 25%)',
    29: 'repeating-linear-gradient(170deg, #09f6 0%, #09f6 3%, transparent 4%, transparent 21%, #09f6 22%, #09f6 25%)',
    31: 'repeating-linear-gradient(105deg, transparent 0%, transparent 2%, #f006 3%, #f006 8%, transparent 9%, transparent 22.25%)',
    37: 'repeating-linear-gradient(35deg, transparent 0%, transparent 6%, #9996 7%, #90f6 13%, transparent 14%, transparent 20%)',
    41: 'repeating-linear-gradient(150deg, #0f06 0%, #fff6 2%, transparent 3%, transparent 13.67%, #0006 14.67%, #0f06 16.67%)',
    43: 'repeating-linear-gradient(80deg, transparent 0%, transparent 6.5%, #f996 7.5%, #ff06 12.5%, transparent 13.5%, transparent 20%)',
    47: 'repeating-linear-gradient(10deg, transparent 0%, transparent 6.5%, #f906 7.5%, #f906 12.5%, transparent 13.5%, transparent 20%)',
    53: 'repeating-linear-gradient(120deg, transparent 0%, transparent 4.643%, #0f06 5.143%, #0f06 9.143%, transparent 9.643%, transparent 14.286%)',
    59: 'repeating-linear-gradient(50deg, transparent 0%, transparent 4.643%, #99f6 5.143%, #99f6 9.143%, transparent 9.643%, transparent 14.286%)',
}

export function getFontSizeByChars(charCount) {
    let percentage;
    if (charCount >= 3) percentage = 130 / charCount + 1;
    return percentage ? `calc(${percentage}% / var(--grid-size))` : '';
}

export function applySupermergingStyle(tileEl, value) {
    if (value === 0) {
        tileEl.className = 'tile tile-0';
        tileEl.style.backgroundImage = 'none';
        return;
    }

    const factors = getPrimeFactorization(value);
    const primes = Object.keys(factors).map(Number);
    
    tileEl.style.backgroundImage = 'none'; // Reset style

    let baseValue = value;
    const backgroundImages = [];
    const sortedPrimes = primes.sort((a, b) => a - b);

    for (const prime of sortedPrimes) {
        if (prime > 5) {
            const power = factors[prime];
            baseValue /= Math.pow(prime, power);
            if (largePrimeGradients[prime]) {
                for (let i = 0; i < power; i++) {
                    backgroundImages.push(largePrimeGradients[prime]);
                }
            }
        }
    }
    
    tileEl.className = `tile tile-base-${baseValue}`;
    
    if (backgroundImages.length > 0) {
        tileEl.style.backgroundImage = backgroundImages.join(', ');
    }
    const charCount = String(value).length;
    tileEl.style.fontSize = getFontSizeByChars(charCount);
}

export function generateGridCells() {
    const gridContainerInner = document.getElementById('grid-container-inner');
    if (!gridContainerInner) return;
    gridContainerInner.innerHTML = '';
    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gridContainerInner.appendChild(cell);
        }
    }
}

export function updateUI() {
    const tileContainer = document.getElementById('tile-container');
    const existingTileIds = new Set(gameState.tiles.map(t => 'tile-' + t.id));
    Array.from(tileContainer.children).forEach(child => {
        if (child.classList.contains('tile') && !existingTileIds.has(child.id) && !child.classList.contains('merging')) {
            tileContainer.removeChild(child);
        }
    });

    gameState.tiles.forEach(t => {
        let tileEl = document.getElementById('tile-' + t.id);
        if (!tileEl) {
            tileEl = document.createElement('div');
            tileEl.id = 'tile-' + t.id;
            tileContainer.appendChild(tileEl);
        }
        if (config.GAME_MODE === 'supermerging' || config.GAME_MODE === 'dive') {
            applySupermergingStyle(tileEl, t.value);
        } else if (config.GAME_MODE === 'math' && isNaN(t.value)) {
            let opClass = '';
            switch (t.value) {
                case '+': opClass = 'plus'; break;
                case '-': opClass = 'minus'; break;
                case '*': opClass = 'multiply'; break;
                case '/': opClass = 'divide'; break;
            }
            tileEl.className = `tile tile-operator tile-${opClass}`;
            tileEl.style.backgroundImage = 'none';
            tileEl.style.fontSize = '';
        } else {
            tileEl.className = `tile tile-${t.value}`;
            tileEl.style.backgroundImage = 'none'; // Ensure style is cleared when switching modes
            const charCount = String(t.value).length;
            tileEl.style.fontSize = getFontSizeByChars(charCount);
        }
        if (t.id === gameState.lastNewTileId) tileEl.classList.add('new');
        if (t.merged) tileEl.classList.add('merged');
        // Use theme/editor-provided display name when available, otherwise fall back to the tile's value
        const displayName = tileDisplayNameMap.get(String(t.value)) || t.value;
        tileEl.textContent = displayName;
        tileEl.style.top = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * t.row + 10 / config.GRID_SIZE)}%`;
        tileEl.style.left = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * t.col + 10 / config.GRID_SIZE)}%`;
    });

    animateMerges();
    if (config.GAME_MODE === 'dive') {
        updateDiveSeedsUI();
    }

    document.getElementById('score').textContent = formatScore(gameState.score);
    updateHighScore();
}

function animateMerges() {
    const tileContainer = document.getElementById('tile-container');
    if (!tileContainer) return;

    mergeAnimations.forEach(anim => {
        const finalTop = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * anim.to.row + 10 / config.GRID_SIZE)}%`;
        const finalLeft = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * anim.to.col + 10 / config.GRID_SIZE)}%`;

        const sources = anim.sources || ['from', 'from2', 'from3'].map(key => anim[key]).filter(Boolean);

        sources.forEach(source => {
            const alias = document.createElement('div');
            
            if (config.GAME_MODE === 'supermerging' || config.GAME_MODE === 'dive') {
                applySupermergingStyle(alias, source.value);
                alias.classList.add('merging');
            } else if (config.GAME_MODE === 'math' && isNaN(source.value)) {
                let opClass = '';
                switch (source.value) {
                    case '+': opClass = 'plus'; break;
                    case '-': opClass = 'minus'; break;
                    case '*': opClass = 'multiply'; break;
                    case '/': opClass = 'divide'; break;
                }
                alias.className = `tile tile-operator tile-${opClass} merging`;
                alias.style.fontSize = '';
            } else {
                alias.className = `tile tile-${source.value} merging`;
                const charCount = String(source.value).length;
                alias.style.fontSize = getFontSizeByChars(charCount);
            }

            alias.textContent = source.value;
            alias.style.top = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * source.row + 10 / config.GRID_SIZE)}%`;
            alias.style.left = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * source.col + 10 / config.GRID_SIZE)}%`;
            tileContainer.appendChild(alias);

            // Force reflow to apply initial state before transition
            void alias.offsetWidth;

            // Animate to the merged position
            alias.style.top = finalTop;
            alias.style.left = finalLeft;

            // Remove alias tiles after animation
            setTimeout(() => alias.remove(), 200); // NOTE: Adjust time to match your CSS transition duration
        });
    });
}

function updateHighScore() {
    const highScoreKey = getHighScoreKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
    let highScore = parseFloat(localStorage.getItem(highScoreKey) || '0');
    if (gameState.score > highScore) {
        highScore = gameState.score;
        localStorage.setItem(highScoreKey, highScore);
    }
    document.getElementById('high-score').textContent = formatScore(highScore);

    const highestTileKey = getHighestTileKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
    const currentHighestTile = gameState.tiles.reduce((max, t) => Math.max(max, t.value), 0);
    const storedHighestTile = parseFloat(localStorage.getItem(highestTileKey) || '0');
        if (currentHighestTile > storedHighestTile) {
        localStorage.setItem(highestTileKey, currentHighestTile);
    }
}

export function updateDiveSeedsUI() {
    const container = document.getElementById('dive-seed-group');
    if (!container) return;
    container.innerHTML = ''; // Clear old seeds
    if (gameState.diveSeeds) {
        gameState.diveSeeds.sort((a, b) => a - b).forEach(seed => {
            const seedEl = document.createElement('div');
            seedEl.id = `tile-seed-${seed}`;
            applySupermergingStyle(seedEl, seed);
            seedEl.textContent = seed;
            container.appendChild(seedEl);
        });
    }
}

export function updateGoalDisplay() {
    const goal = getGoalValue();
    const goalDescription = document.getElementById('goal-description');
    const goalNumbers = document.querySelectorAll('.goal-number');

    if (config.GAME_MODE === 'negative') {
        if (goalDescription) {
            goalDescription.textContent = `Join the numbers and get to both the ${goal} and -${goal} tiles!`;
        }
        goalNumbers.forEach(el => {
            el.textContent = `${goal} and -${goal}`;
        });
    } else {
        if (goalDescription) {
            goalDescription.textContent = `Join the numbers and get to the ${goal} tile!`;
        }
        goalNumbers.forEach(el => {
            el.textContent = goal;
        });
    }
}

export function showGameOver() {
    document.getElementById('game-over-container')?.classList.remove('hidden');
    // When the game ends, the AI is stopped. We need to sync the UI
    // so that updateAnimationState() can correctly remove .no-animations.
    const icon = document.getElementById('ai-toggle-button-icon');
    if (icon) icon.className = 'fas fa-play';
    updateAnimationState();
}
export function hideGameOver() {
    document.getElementById('game-over-container')?.classList.add('hidden');
}
export function showGameWon() {
    document.getElementById('game-won-container')?.classList.remove('hidden');
    // When the game ends, the AI is stopped. We need to sync the UI
    // so that updateAnimationState() can correctly remove .no-animations.
    const icon = document.getElementById('ai-toggle-button-icon');
    if (icon) icon.className = 'fas fa-play';
    updateAnimationState();
}
export function hideGameWon() {
    document.getElementById('game-won-container')?.classList.add('hidden');
}

export function updateUndoRedoUI(undoCount, redoCount) {
    const undoCounter = document.getElementById('undo-counter');
    const redoCounter = document.getElementById('redo-counter');
    if (undoCounter) undoCounter.textContent = Math.max(0, undoCount - 1);
    if (redoCounter) redoCounter.textContent = redoCount;
    document.getElementById('undo-button').disabled = undoCount <= 1;
    document.getElementById('redo-button').disabled = redoCount === 0;
}

function updateAnimationState() {
    const gridContainer = document.getElementById('grid-container');
    const aiIsActive = document.getElementById('ai-toggle-button-icon')?.classList.contains('fa-stop');
    if (aiIsActive && config.aiMoveDelay < 50) {
        gridContainer.classList.add('no-animations');
    } else {
        gridContainer.classList.remove('no-animations');
    }
}

function setupEventListeners() {
    // Keyboard
    document.addEventListener('keydown', e => {
        if (document.querySelector('.overlay:not(.hidden)') ||
            !document.getElementById('settings-menu')?.classList.contains('hidden') ||
            !document.getElementById('overlay-backdrop')?.classList.contains('hidden')) {
            return;
        }
        switch (e.key) {
            case 'ArrowUp': case 'w': move(3); break;
            case 'ArrowDown': case 's': move(1); break;
            case 'ArrowLeft': case 'a': move(0); break;
            case 'ArrowRight': case 'd': move(2); break;
        }
        if ((e.ctrlKey || e.metaKey)  && config.practiceMode) {
            if (e.key === 'z') undo();
            if (e.key === 'y') redo();
        }
    });

    // Touch
    let touchStartX = 0, touchStartY = 0;
    const gameContainer = document.getElementById('game-container');
    gameContainer.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    gameContainer.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - touchStartX, dy = touchEndY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) {
            if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 2 : 0);
            else move(dy > 0 ? 1 : 3);
        }
    });

    const restartGame = () => {
        stopAIMode();
        // Clear the saved game state for the current mode to ensure a fresh start.
        const gameStateKey = getGameStateKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
        localStorage.removeItem(gameStateKey);
        initGrid();
    };

    // Buttons
    document.getElementById('restart-button').addEventListener('click', restartGame);
    document.getElementById('game-over-restart').addEventListener('click', restartGame);
    document.getElementById('game-won-restart').addEventListener('click', restartGame);
    document.getElementById('game-won-keep-going').addEventListener('click', hideGameWon);
    document.getElementById('undo-button').addEventListener('click', undo);
    document.getElementById('redo-button').addEventListener('click', redo);

    // Settings & Menus
    document.getElementById('settings-button').addEventListener('click', () => document.getElementById('settings-menu').classList.remove('hidden'));
    document.getElementById('close-settings-menu').addEventListener('click', () => document.getElementById('settings-menu').classList.add('hidden'));

    document.querySelectorAll('.setting-menu-item').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelector('.setting-menu-item.active')?.classList.remove('active');
            document.querySelector('.settings-menu-content-inner.active')?.classList.remove('active');

            button.classList.add('active');
            const contentId = button.id.replace('-button', '');
            document.getElementById(contentId)?.classList.add('active');

            document.getElementById('settings-menu-list')?.classList.remove('active');
            document.getElementById('settings-menu-content')?.classList.add('active');
        });
    });

    document.getElementById('settings-back-button')?.addEventListener('click', () => {
        document.getElementById('settings-menu-list')?.classList.add('active');
        document.getElementById('settings-menu-content')?.classList.remove('active');
    });

    document.getElementById('mode-button')?.addEventListener('click', () => {
        document.getElementById('modes-menu')?.classList.remove('hidden');
        document.getElementById('overlay-backdrop')?.classList.remove('hidden');
        document.getElementById('game-container').classList.add("covered");
    });

    document.getElementById('ai-option-button')?.addEventListener('click', () => {
        document.getElementById('ai-options-menu')?.classList.remove('hidden');
        document.getElementById('overlay-backdrop')?.classList.remove('hidden');
        document.getElementById('game-container').classList.add("covered");
    });
    
    document.getElementById('close-modes-menu')?.addEventListener('click', () => {
        document.getElementById('modes-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop')?.classList.add('hidden');
        document.getElementById('game-container').classList.remove("covered");
    });

    document.getElementById('close-ai-options-menu')?.addEventListener('click', () => {
        document.getElementById('ai-options-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop')?.classList.add('hidden');
        document.getElementById('game-container').classList.remove("covered");
    });

    // Statistics Menu
    document.getElementById('statistics-button')?.addEventListener('click', () => {
        updateStatistics();
        document.getElementById('statistics-menu')?.classList.remove('hidden');
        document.getElementById('overlay-backdrop')?.classList.remove('hidden');
        document.getElementById('game-container').classList.add("covered");
    });
    document.getElementById('close-statistics-menu')?.addEventListener('click', () => {
        document.getElementById('statistics-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop')?.classList.add('hidden');
        document.getElementById('game-container').classList.remove("covered");

    });

    document.getElementById('overlay-backdrop')?.addEventListener('click', () => {
        document.getElementById('modes-menu')?.classList.add('hidden');
        document.getElementById('ai-options-menu')?.classList.add('hidden');
        document.getElementById('statistics-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop')?.classList.add('hidden');
        document.getElementById('game-container').classList.remove("covered");
    });

    // Customize Theme Menu
    document.getElementById('customize-themes')?.addEventListener('click', () => {
        document.getElementById('customize-theme-menu')?.classList.remove('hidden');
        document.getElementById('overlay-backdrop2')?.classList.remove('hidden');
        document.getElementById('game-container')?.classList.add('covered');
    });

    document.getElementById('close-customize-theme-menu')?.addEventListener('click', () => {
        document.getElementById('customize-theme-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop2')?.classList.add('hidden');
        document.getElementById('game-container')?.classList.remove('covered');
    });

    document.getElementById('overlay-backdrop2')?.addEventListener('click', () => {
        document.getElementById('customize-theme-menu')?.classList.add('hidden');
        document.getElementById('overlay-backdrop2')?.classList.add('hidden');
        document.getElementById('game-container')?.classList.remove('covered');
    });

    // Filter selector for theme editor
    const filterSelect = document.getElementById('filter-tiles-select');
    filterSelect?.addEventListener('change', e => {
        const val = e.target.value;
        const toShow = filterTiles(currentThemeTiles, val);
        populateTileThemeEditor(toShow);
    });

    // Reset theme to defaults (clears saved custom theme and reloads defaults)
    document.getElementById('theme-reset')?.addEventListener('click', () => {
        try { localStorage.removeItem(CUSTOM_THEME_KEY); } catch (e) { /* ignore */ }
        const styleEl = document.getElementById('custom-tile-theme-styles');
        if (styleEl) styleEl.remove();
        // Reload themes.json and repopulate editor with defaults
        loadThemesAndPopulateEditor();
    });

    document.getElementById('grid-size-select').addEventListener('change', e => {
        config.GRID_SIZE = parseInt(e.target.value, 10);
        document.documentElement.style.setProperty('--grid-size', config.GRID_SIZE);
        initGrid();
        updateGoalDisplay();
        saveSettings();
    });

    document.getElementById('game-mode-select').addEventListener('change', e => {
        config.GAME_MODE = e.target.value;
        document.getElementById('dive-seed-container').classList.toggle('hidden', config.GAME_MODE !== 'dive');
        initGrid();
        updateGoalDisplay();
        saveSettings();
    });

    document.getElementById('practice-mode-toggle').addEventListener('change', e => {
        const enabled = e.target.checked;
        handlePracticeModeChange(enabled);
        document.getElementById('undo-button').classList.toggle('hidden', !enabled);
        document.getElementById('redo-button').classList.toggle('hidden', !enabled);
    });

    document.getElementById('maximum-undo-memory')?.addEventListener('change', e => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 2) {
            config.maxUndoMemory = value;
            saveSettings();
        }
    });

    document.getElementById('tile-moving-animation-speed-select')?.addEventListener('change', e => {
        const speed = e.target.value;
        config.animationSpeed = speed;
        let speedValue = '1';
        switch (speed) {
            case 'slow':
                speedValue = '1.8';
                break;
            case 'medium':
                speedValue = '1';
                break;
            case 'fast':
                speedValue = '0.4';
                break;
            case 'instantaneous':
                speedValue = '0';
                break;
        }
        document.documentElement.style.setProperty('--tile-moving-animation-speed', speedValue);
        saveSettings();
    });

    // AI Controls
    document.getElementById('ai-toggle-button').addEventListener('click', () => {
        const icon = document.getElementById('ai-toggle-button-icon');
        if (icon.classList.contains('fa-play')) {
            startAIMode();
            icon.className = 'fas fa-stop';
            document.getElementById('ai-status').textContent = 'AI Mode: On';
        } else {
            stopAIMode();
            icon.className = 'fas fa-play';
            document.getElementById('ai-status').textContent = 'AI Mode: Off';
        }
        updateAnimationState();
    });

    document.getElementById('ai-strategy-select').addEventListener('change', e => {
        config.aiStrategy = e.target.value;
        saveSettings();
    });

    document.getElementById('ai-move-duration-input').addEventListener('change', e => {
        config.aiMoveDelay = parseInt(e.target.value, 10);
        saveSettings();
        updateAnimationState();
        if (document.getElementById('ai-toggle-button-icon').classList.contains('fa-stop')) {
            stopAIMode();
            startAIMode();
        }
    });

    document.getElementById('sync-tiles-dark-mode-toggle').addEventListener('change', e => {
        config.syncTilesDarkMode = e.target.checked;
        document.documentElement.classList.toggle('sync-tiles-dark-mode', e.target.checked);
        saveSettings();
    });

    document.getElementById('invert-colors-toggle').addEventListener('change', e => {
        config.invertColors = e.target.checked;
        document.getElementById('invert-colors').classList.toggle('hidden', !e.target.checked);
        saveSettings();
    });

    document.getElementById('grayscale-colors-toggle').addEventListener('change', e => {
        config.grayscaleColors = e.target.checked;
        document.getElementById('grayscale-colors').classList.toggle('hidden', !e.target.checked);
        saveSettings();
    });

    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', e => {
            const theme = e.target.value;
            config.theme = theme;
            const html = document.documentElement;
            html.classList.remove('dark-mode', 'auto-mode');
            if (theme === 'dark') {
                html.classList.add('dark-mode');
            } else if (theme === 'auto') {
                html.classList.add('auto-mode');
            }
            saveSettings();
        });
    });
}

function syncSettingsUI() {
       // Sync UI elements with loaded config
    document.getElementById('grid-size-select').value = config.GRID_SIZE;
    document.documentElement.style.setProperty('--grid-size', config.GRID_SIZE);
    document.getElementById('game-mode-select').value = config.GAME_MODE;
    document.getElementById('dive-seed-container').classList.toggle('hidden', config.GAME_MODE !== 'dive');
    const practiceToggle = document.getElementById('practice-mode-toggle');
    practiceToggle.checked = config.practiceMode;
    document.getElementById('undo-button').classList.toggle('hidden', !config.practiceMode);
    document.getElementById('redo-button').classList.toggle('hidden', !config.practiceMode);
    document.getElementById('ai-strategy-select').value = config.aiStrategy;
    document.getElementById('ai-move-duration-input').value = config.aiMoveDelay;
    document.getElementById('maximum-undo-memory').value = config.maxUndoMemory;

    const syncTilesDarkModeToggle = document.getElementById('sync-tiles-dark-mode-toggle');
    syncTilesDarkModeToggle.checked = config.syncTilesDarkMode;
    document.documentElement.classList.toggle('sync-tiles-dark-mode', config.syncTilesDarkMode);
    
    const invertColorsToggle = document.getElementById('invert-colors-toggle');
    invertColorsToggle.checked = config.invertColors;
    document.getElementById('invert-colors').classList.toggle('hidden', !config.invertColors);

    const grayscaleColorsToggle = document.getElementById('grayscale-colors-toggle');
    grayscaleColorsToggle.checked = config.grayscaleColors;
    document.getElementById('grayscale-colors').classList.toggle('hidden', !config.grayscaleColors);

    const themeRadio = document.querySelector(`input[name="theme"][value="${config.theme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
        themeRadio.dispatchEvent(new Event('change'));
    }

    const speedSelect = document.getElementById('tile-moving-animation-speed-select');
    if (speedSelect) {
        speedSelect.value = config.animationSpeed;
        // Trigger a change event to apply the style on load
        speedSelect.dispatchEvent(new Event('change'));
    }
}

function applyProportionalSpacing() {
    const denseElements = document.querySelectorAll('.text-dense');

    denseElements.forEach(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        const nodesToProcess = [];
        let node;
        while ((node = walker.nextNode())) {
            nodesToProcess.push(node);
        }

        nodesToProcess.forEach(node => {
            const text = node.nodeValue;
            if (!text.includes('1')) {
                return;
            }

            let resultHTML = '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = (i + 1 < text.length) ? text[i + 1] : null;
                let spacing = null;

                // -0.2em on a '1' that is followed by another '1'
                if (char === '1' && nextChar === '1') {
                    spacing = '-0.2em';
                }
                // -0.1em on any character that is followed by a '1'
                else if (nextChar === '1') {
                    spacing = '-0.1em';
                }
                // -0.1em on a '1' that is not followed by another '1'
                else if (char === '1') {
                    spacing = '-0.1em';
                }

                if (spacing) {
                    // Using HTML entities to be safe
                    const safeChar = char.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
                    resultHTML += `<span style="letter-spacing: ${spacing};">${safeChar}</span>`;
                } else {
                    resultHTML += char;
                }
            }

            if (resultHTML !== text) {
                const fragment = document.createDocumentFragment();
                const temp = document.createElement('span');
                temp.innerHTML = resultHTML;
                while (temp.firstChild) {
                    fragment.appendChild(temp.firstChild);
                }
                if (node.parentNode) {
                    node.parentNode.replaceChild(fragment, node);
                }
            }
        });
    });

    document.getElementById('factory-reset')?.addEventListener('click', () => {
        stopAIMode();
        localStorage.clear();
        location.reload();
    });
}

export function initializeUI() {
    setupEventListeners();
    syncSettingsUI();
    applyProportionalSpacing();
    // Populate the tile theme editor from themes.json
    loadThemesAndPopulateEditor();
}

// Load themes.json and populate the tile theme editor table
async function loadThemesAndPopulateEditor() {
    try {
        // If the user has a saved custom theme in localStorage, load that first
        const custom = getCustomThemeFromLocalStorage();
        if (custom && Array.isArray(custom) && custom.length > 0) {
            currentThemeTiles = custom;
            const filterEl = document.getElementById('filter-tiles-select');
            const filter = filterEl ? filterEl.value : 'all';
            const toShow = filterTiles(currentThemeTiles, filter);
            populateTileThemeEditor(toShow);
            applyTileThemeCSS(currentThemeTiles);
            return;
        }

        const res = await fetch('themes.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch themes.json: ${res.status}`);
        const data = await res.json();
        const themeObj = Array.isArray(data.theme) ? data.theme.find(t => t.name === 'Default') || data.theme[0] : null;
        const tiles = (themeObj && Array.isArray(themeObj.tiles)) ? themeObj.tiles : [];
        currentThemeTiles = tiles;
        const filterEl = document.getElementById('filter-tiles-select');
        const filter = filterEl ? filterEl.value : 'all';
        const toShow = filterTiles(currentThemeTiles, filter);
        populateTileThemeEditor(toShow);
        // Apply loaded theme to game tiles immediately
        applyTileThemeCSS(currentThemeTiles);
    } catch (err) {
        // If fetching fails, leave the editor empty but log error
        console.error('Could not load themes.json for theme editor:', err);
    }
}

// Generate and inject runtime CSS rules from a tile theme array so changes apply to game tiles immediately.
function applyTileThemeCSS(tiles) {
    if (!Array.isArray(tiles)) return;
    let css = '';
    try {
        // rebuild name map
        tileDisplayNameMap.clear();
        tiles.forEach(tile => {
            const val = String(tile.tileValue);
            const cls = 'tile-' + val;
            const esc = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(cls) : cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
            const selector = `.tile.${esc}`;
            const lightBg = tile.tileBackgroundLightMode || 'initial';
            const lightColor = tile.tileTextColorLightMode || 'inherit';
            const darkBg = tile.tileBackgroundDarkMode || tile.tileBackgroundLightMode || 'initial';
            const darkColor = tile.tileTextColorDarkMode || tile.tileTextColorLightMode || 'inherit';

            css += `${selector} { background: ${lightBg} !important; color: ${lightColor} !important; }\n`;
            css += `.dark-mode.sync-tiles-dark-mode ${selector} { background: ${darkBg} !important; color: ${darkColor} !important; }\n`;

            // store display name (fallback to value)
            tileDisplayNameMap.set(val, tile.tileName != null ? String(tile.tileName) : String(tile.tileValue));
        });
    } catch (e) {
        console.error('Failed to build tile theme CSS', e);
    }

    let styleEl = document.getElementById('custom-tile-theme-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-tile-theme-styles';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
}

function createPreviewTile(tile) {
    const preview = document.createElement('div');
    preview.className = 'tile';

    const value = String(tile.tileValue);
    // mimic rendering used elsewhere: numeric values use tile-{value}, operators use operator classes
    if (!isNaN(Number(value))) {
        preview.classList.add(`tile-${value}`);
    } else {
        // operators (plus/minus/multiply/divide)
        switch (value) {
            case 'plus':
                preview.classList.add('tile-operator', 'tile-plus');
                break;
            case 'minus':
                preview.classList.add('tile-operator', 'tile-minus');
                break;
            case 'multiply':
                preview.classList.add('tile-operator', 'tile-multiply');
                break;
            case 'divide':
                preview.classList.add('tile-operator', 'tile-divide');
                break;
            default:
                preview.classList.add(`tile-${value}`);
        }
    }

    preview.textContent = tile.tileName || tile.tileValue;
    // apply light mode colors to the preview by default
    if (tile.tileBackgroundLightMode) preview.style.background = tile.tileBackgroundLightMode;
    if (tile.tileTextColorLightMode) preview.style.color = tile.tileTextColorLightMode;

    return preview;
}

function populateTileThemeEditor(tiles) {
    const tbody = document.getElementById('tile-theme-editor-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    tiles.forEach((tile, idx) => {
        const tr = document.createElement('tr');

        // Col 1: preview
        const tdPreview = document.createElement('td');
        const tdPreviewInner = document.createElement('div');
        tdPreviewInner.className = 'tile-individual';
        tdPreview.appendChild(tdPreviewInner);
        const preview = createPreviewTile(tile);
        tdPreviewInner.appendChild(preview);
        tr.appendChild(tdPreview);

        // Col 2: input for tile value
        const tdValue = document.createElement('td');
        const inputValue = document.createElement('input');
        inputValue.type = 'text';
        inputValue.value = tile.tileValue;
        inputValue.className = 'tile-editor-value';
        inputValue.dataset.index = String(idx);
        tdValue.appendChild(inputValue);
        tr.appendChild(tdValue);

        // Col 3: input for tile display name
        const tdName = document.createElement('td');
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.value = tile.tileName || '';
        inputName.className = 'tile-editor-name';
        inputName.dataset.index = String(idx);
        tdName.appendChild(inputName);
        tr.appendChild(tdName);

        // Col 4: background color pickers (light + dark)
        const tdBg = document.createElement('td');
        const bgContainer = document.createElement('div');
        bgContainer.className = 'color-picker-inputs';

        const bgLightSwatch = document.createElement('div');
        bgLightSwatch.className = 'color-swatch';
        bgLightSwatch.style.backgroundColor = tile.tileBackgroundLightMode || '#ffffff';
        bgLightSwatch.addEventListener('click', () => {
            openColorPicker(tile.tileBackgroundLightMode || '#ffffff', `Tile ${tile.tileName || tile.tileValue} BG (Light)`, (newColor) => {
                tile.tileBackgroundLightMode = newColor;
                bgLightSwatch.style.backgroundColor = newColor;
                refreshPreviewFromTile();
            });
        });

        const bgDarkSwatch = document.createElement('div');
        bgDarkSwatch.className = 'color-swatch';
        bgDarkSwatch.style.backgroundColor = tile.tileBackgroundDarkMode || '#000000';
        bgDarkSwatch.addEventListener('click', () => {
        openColorPicker(tile.tileBackgroundDarkMode || '#000000', `Tile ${tile.tileName || tile.tileValue} BG (Dark)`, (newColor) => {
            tile.tileBackgroundDarkMode = newColor;
            bgDarkSwatch.style.backgroundColor = newColor;
            // Update runtime CSS so dark-mode colors take effect when active
            applyTileThemeCSS(currentThemeTiles);
            try { saveCustomThemeToLocalStorage(currentThemeTiles); } catch (e) { /* swallow */ }
        });
        });

        bgContainer.appendChild(bgLightSwatch);
        bgContainer.appendChild(bgDarkSwatch);
        tdBg.appendChild(bgContainer);
        tr.appendChild(tdBg);

        // Col 5: text color pickers (light + dark)
        const tdText = document.createElement('td');
        const textContainer = document.createElement('div');
        textContainer.className = 'color-picker-inputs';

        const txtLightSwatch = document.createElement('div');
        txtLightSwatch.className = 'color-swatch';
        txtLightSwatch.style.backgroundColor = tile.tileTextColorLightMode || '#000000';
        txtLightSwatch.addEventListener('click', () => {
            openColorPicker(tile.tileTextColorLightMode || '#000000', `Tile ${tile.tileName || tile.tileValue} Text (Light)`, (newColor) => {
                tile.tileTextColorLightMode = newColor;
                txtLightSwatch.style.backgroundColor = newColor;
                refreshPreviewFromTile();
            });
        });

        const txtDarkSwatch = document.createElement('div');
        txtDarkSwatch.className = 'color-swatch';
        txtDarkSwatch.style.backgroundColor = tile.tileTextColorDarkMode || '#ffffff';
        txtDarkSwatch.addEventListener('click', () => {
            openColorPicker(tile.tileTextColorDarkMode || '#ffffff', `Tile ${tile.tileName || tile.tileValue} Text (Dark)`, (newColor) => {
                tile.tileTextColorDarkMode = newColor;
                txtDarkSwatch.style.backgroundColor = newColor;
                applyTileThemeCSS(currentThemeTiles);
                try { saveCustomThemeToLocalStorage(currentThemeTiles); } catch (e) { /* swallow */ }
            });
        });

        textContainer.appendChild(txtLightSwatch);
        textContainer.appendChild(txtDarkSwatch);
        tdText.appendChild(textContainer);
        tr.appendChild(tdText);

        // Wire up events to update preview and in-memory tile object
        function refreshPreviewFromTile() {
            // update preview appearance: class, text, colors (light)
            preview.textContent = inputName.value || inputValue.value;
            // update classes
            preview.className = 'tile';
            const newVal = inputValue.value;
            if (!isNaN(Number(newVal))) {
                preview.classList.add(`tile-${newVal}`);
            } else {
                switch (newVal) {
                    case 'plus': preview.classList.add('tile-operator', 'tile-plus'); break;
                    case 'minus': preview.classList.add('tile-operator', 'tile-minus'); break;
                    case 'multiply': preview.classList.add('tile-operator', 'tile-multiply'); break;
                    case 'divide': preview.classList.add('tile-operator', 'tile-divide'); break;
                    default: preview.classList.add(`tile-${newVal}`);
                }
            }
            // Use the tile's stored light-mode colors (falling back to the swatch visuals)
            preview.style.background = tile.tileBackgroundLightMode || bgLightSwatch.style.backgroundColor || '#ffffff';
            preview.style.color = tile.tileTextColorLightMode || txtLightSwatch.style.backgroundColor || '#000000';
            // Rebuild runtime CSS so changes to value/name/colors immediately affect game tiles
            applyTileThemeCSS(currentThemeTiles);
            // Persist the updated theme so changes survive reloads
            try { saveCustomThemeToLocalStorage(currentThemeTiles); } catch (e) { /* swallow */ }
        }

        inputValue.addEventListener('input', () => {
            tiles[idx].tileValue = inputValue.value;
            refreshPreviewFromTile();
        });
        inputName.addEventListener('input', () => {
            tiles[idx].tileName = inputName.value;
            refreshPreviewFromTile();
        });

        tbody.appendChild(tr);
    });
}