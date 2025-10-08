import { config, gameState, move, undo, redo, handlePracticeModeChange, startAIMode, stopAIMode, saveSettings, initGrid, clearHistory, updateStatistics } from './main.js';
import { mergeAnimations, getGoalValue } from './grid.js';
import { getHighScoreKey, getHighestTileKey, getGameStateKey } from './utils.js';


// --- Supermerging Style Helpers ---

const largePrimeGradients = {
    7: 'linear-gradient(135deg, #0005, transparent, #fff5, transparent, #0005)',
    11: 'radial-gradient(#fff5, transparent, #0005, transparent, #fff5, transparent, #0005)'
}

function getPrimeFactorization(num) {
    const n = Math.abs(num);
    if (n <= 1) return {};
    const factors = {};
    let tempN = n;

    while (tempN % 2 === 0) {
        factors[2] = (factors[2] || 0) + 1;
        tempN /= 2;
    }

    for (let i = 3; i * i <= tempN; i += 2) {
        while (tempN % i === 0) {
            factors[i] = (factors[i] || 0) + 1;
            tempN /= i;
        }
    }

    if (tempN > 2) {
        factors[tempN] = (factors[tempN] || 0) + 1;
    }

    return factors;
}

function applySupermergingStyle(tileEl, value) {
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
        if (config.GAME_MODE === 'supermerging') {
            applySupermergingStyle(tileEl, t.value);
        } else {
            tileEl.className = `tile tile-${t.value}`;
            tileEl.style.backgroundImage = 'none'; // Ensure style is cleared when switching modes
        }
        if (t.id === gameState.lastNewTileId) tileEl.classList.add('new');
        if (t.merged) tileEl.classList.add('merged');
        tileEl.textContent = t.value;
        tileEl.style.top = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * t.row + 10 / config.GRID_SIZE)}%`;
        tileEl.style.left = `${((100 - 10 / config.GRID_SIZE) / config.GRID_SIZE * t.col + 10 / config.GRID_SIZE)}%`;
    });

    animateMerges();

    document.getElementById('score').textContent = gameState.score;
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
            
            if (config.GAME_MODE === 'supermerging') {
                applySupermergingStyle(alias, source.value);
                alias.classList.add('merging');
            } else {
                alias.className = `tile tile-${source.value} merging`;
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
    let highScore = parseInt(localStorage.getItem(highScoreKey) || '0');
    if (gameState.score > highScore) {
        highScore = gameState.score;
        localStorage.setItem(highScoreKey, highScore);
    }
    document.getElementById('high-score').textContent = highScore;

    const highestTileKey = getHighestTileKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
    const currentHighestTile = gameState.tiles.reduce((max, t) => Math.max(max, t.value), 0);
    const storedHighestTile = parseInt(localStorage.getItem(highestTileKey) || '0');
        if (currentHighestTile > storedHighestTile) {
        localStorage.setItem(highestTileKey, currentHighestTile);
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

    document.getElementById('grid-size-select').addEventListener('change', e => {
        config.GRID_SIZE = parseInt(e.target.value, 10);
        document.documentElement.style.setProperty('--grid-size', config.GRID_SIZE);
        initGrid();
        updateGoalDisplay();
        saveSettings();
    });

    document.getElementById('game-mode-select').addEventListener('change', e => {
        config.GAME_MODE = e.target.value;
        document.getElementById('tile-container').classList.toggle('tile-factor', config.GAME_MODE === 'supermerging');
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
    document.getElementById('tile-container').classList.toggle('tile-factor', config.GAME_MODE === 'supermerging');
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
}