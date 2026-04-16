import { moveGrid as calculateMove, addRandomTile, isGameOver, isGameWon, getGoalValue, resetMergedState, mergeAnimations } from './grid.js';
import { initializeUI, updateUI, updateGoalDisplay, generateGridCells, showGameOver, showGameWon, hideGameOver, hideGameWon, updateUndoRedoUI, updateDiveSeedsUI, applySupermergingStyle, getFontSizeByChars } from './ui.js';
import { getGameStateKey, getHighScoreKey, getHighestTileKey, getGamesPlayedKey, getPrimeFactorization, formatScore } from './utils.js';
import { initializeColorPicker } from './color.js';

// Shared configuration
export let config = {
    GRID_SIZE: 4,
    GAME_MODE: 'classic',
    practiceMode: false,
    aiMoveDelay: 100,
    aiStrategy: 'random',
    animationSpeed: 'medium',
    invertColors: false,
    grayscaleColors: false,
    theme: 'light',
    syncTilesDarkMode: true,
    maxUndoMemory: 256,
    fontSizeScale: 1
};

// Shared game state
export let gameState = {
    grid: [],
    tiles: [],
    score: 0,
    previousScore: 0,
    tileIdCounter: 1,
    lastNewTileId: null,
    hasShownGameWon: false,
    beforeMovePositions: null,
    diveSeeds: [],
    moves: 0,
    playtimeAccumulated: 0,
    startedAt: null,
    finalized: false
};

// Undo/Redo support
let undoStack = [];
let redoStack = [];

// AI state
let aiModeActive = false;
let aiIntervalId = null;

// --- SETTINGS & STATE PERSISTENCE ---

function saveGameState() {
    const stateToSave = {
        grid: gameState.grid,
        score: gameState.score,
        tiles: gameState.tiles,
        tileIdCounter: gameState.tileIdCounter,
        hasShownGameWon: gameState.hasShownGameWon,
        GRID_SIZE: config.GRID_SIZE,
        GAME_MODE: config.GAME_MODE,
        practiceMode: config.practiceMode,
        diveSeeds: [...gameState.diveSeeds],
        moves: gameState.moves || 0,
        playtime: (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0)
    };
    localStorage.setItem(getGameStateKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE), JSON.stringify(stateToSave));
}

function clearGameState() {
    localStorage.removeItem(getGameStateKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE));
}

function restoreGameState() {
    const savedState = localStorage.getItem(getGameStateKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE));
    if (savedState) {
        const restored = JSON.parse(savedState);
        gameState.grid = restored.grid;
        gameState.score = restored.score;
        gameState.previousScore = restored.score;
        gameState.tiles = restored.tiles;
        gameState.tileIdCounter = restored.tileIdCounter;
        gameState.hasShownGameWon = restored.hasShownGameWon;
        config.GRID_SIZE = restored.GRID_SIZE || 4;
        config.GAME_MODE = restored.GAME_MODE || 'classic';
        config.practiceMode = restored.practiceMode || false;
        gameState.diveSeeds = restored.diveSeeds || (restored.GAME_MODE === 'dive' ? [2] : []);
        gameState.moves = restored.moves || 0;
        gameState.playtimeAccumulated = restored.playtime || 0;
        gameState.startedAt = Date.now();
        gameState.finalized = false;
        return true;
    }
    return false;
}

export function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        config.GRID_SIZE = settings.GRID_SIZE || 4;
        config.GAME_MODE = settings.GAME_MODE || 'classic';
        config.practiceMode = settings.practiceMode || false;
        config.aiMoveDelay = settings.aiMoveDelay || 100;
        config.aiStrategy = settings.aiStrategy || 'random';
        config.animationSpeed = settings.animationSpeed || 'medium';
        config.invertColors = settings.invertColors || false;
        config.grayscaleColors = settings.grayscaleColors || false;
        config.theme = settings.theme || 'light';
        config.syncTilesDarkMode = settings.syncTilesDarkMode ?? true;
        config.maxUndoMemory = settings.maxUndoMemory || 256;
        config.fontSizeScale = settings.fontSizeScale || 1;
    }
}

export function saveSettings() {
    const settings = {
        GRID_SIZE: config.GRID_SIZE,
        GAME_MODE: config.GAME_MODE,
        practiceMode: config.practiceMode,
        aiMoveDelay: config.aiMoveDelay,
        aiStrategy: config.aiStrategy,
        animationSpeed: config.animationSpeed,
        invertColors: config.invertColors,
        grayscaleColors: config.grayscaleColors,
        theme: config.theme,
        syncTilesDarkMode: config.syncTilesDarkMode,
        maxUndoMemory: config.maxUndoMemory,
        fontSizeScale: config.fontSizeScale
    };
    localStorage.setItem('gameSettings', JSON.stringify(settings));
}

// --- GAME INITIALIZATION ---

export function initGrid() {
        clearUndoRedoStacks();

    if (!restoreGameState()) {
        // No saved state, or it failed to load. Start a new game.
        gameState.grid = Array(config.GRID_SIZE).fill().map(() => Array(config.GRID_SIZE).fill(null));
        gameState.tiles = [];
        gameState.tileIdCounter = 1;
        gameState.score = 0;
        gameState.previousScore = 0;
        gameState.hasShownGameWon = false;
        gameState.moves = 0;
        gameState.playtimeAccumulated = 0;
        gameState.startedAt = Date.now();
        gameState.finalized = false;
        if (config.GAME_MODE === 'dive') {
            gameState.diveSeeds = [2];
        } else {
            gameState.diveSeeds = [];
        }
        addRandomTile();
        addRandomTile();
        incrementGamesPlayed(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
        saveState(); // Save initial state for undo
    }

    // At this point, we either have a restored game state or a new one.
    // The config object is also set correctly. Now, build the UI.
    document.documentElement.style.setProperty('--grid-size', config.GRID_SIZE);
    generateGridCells();
    updateUI();

    hideGameOver();
    hideGameWon();

    const highScoreKey = getHighScoreKey(config.GAME_MODE, config.practiceMode, config.GRID_SIZE);
    const savedHighScore = localStorage.getItem(highScoreKey);
    document.getElementById('high-score').textContent = savedHighScore || '0';

    if (isGameOver()) {
        showGameOver();
    }
}

// --- CORE GAME LOGIC ---

function updateDiveSeeds() {
    if (config.GAME_MODE !== 'dive') return;

    // Add new seeds from merged tiles
    const newPrimes = new Set();
    mergeAnimations.forEach(anim => {
        const factors = getPrimeFactorization(anim.mergedValue);
        Object.keys(factors).forEach(p => newPrimes.add(Number(p)));
    });

    newPrimes.forEach(p => {
        if (!gameState.diveSeeds.includes(p)) {
            gameState.diveSeeds.push(p);
        }
    });

    // Remove seeds that are no longer factors of any tile on the board
    const allFactorsOnBoard = new Set();
    gameState.tiles.forEach(tile => {
        const factors = getPrimeFactorization(tile.value);
        Object.keys(factors).forEach(p => allFactorsOnBoard.add(Number(p)));
    });

    gameState.diveSeeds = gameState.diveSeeds.filter(seed => allFactorsOnBoard.has(seed));
}

export function move(direction) {
    resetMergedState();
    gameState.beforeMovePositions = {};
    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            const id = gameState.grid[r] && gameState.grid[r][c];
            if (id) gameState.beforeMovePositions[id] = { row: r, col: c };
        }
    }

    const scoreBeforeMove = gameState.score;
    const anyTileMoved = calculateMove(direction);

    if (anyTileMoved) {
        // track moves for the current game
        gameState.moves = (gameState.moves || 0) + 1;
        const scoreGained = gameState.score - scoreBeforeMove;
        if (scoreGained > 0) {
            let totalScore = parseFloat(localStorage.getItem('totalScore') || '0');
            totalScore += scoreGained;
            localStorage.setItem('totalScore', totalScore);
        }
        if (config.GAME_MODE === 'dive') {
            updateDiveSeeds();
        }
        addRandomTile();
        updateUI();
        saveGameState();
        saveState(); // For undo/redo

        gameState.beforeMovePositions = null;

        if (isGameOver()) {
            finalizeCurrentGame();
            stopAIMode();
            setTimeout(showGameOver, 100);
        }
        if (isGameWon() && !gameState.hasShownGameWon) {
            gameState.hasShownGameWon = true;
            stopAIMode();
            setTimeout(showGameWon, 100);
        }
    }
}

// --- UNDO/REDO ---

function saveState() {
    const newState = {
        grid: gameState.grid.map(row => [...row]),
        tiles: gameState.tiles.map(t => ({ ...t })),
        score: gameState.score,
        tileIdCounter: gameState.tileIdCounter,
        lastNewTileId: gameState.lastNewTileId,
        hasShownGameWon: gameState.hasShownGameWon,
        diveSeeds: gameState.diveSeeds ? [...gameState.diveSeeds] : [],
        moves: gameState.moves || 0,
        playtime: (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0)
    };
    undoStack.push(newState);
    if (undoStack.length > config.maxUndoMemory) undoStack.shift();
    redoStack = [];
    updateUndoRedoUI(undoStack.length, redoStack.length);
}

function restoreState(state) {
    const scoreBeforeRestore = gameState.score;

    gameState.grid = state.grid.map(row => [...row]);
    gameState.tiles = state.tiles.map(t => ({ ...t }));
    gameState.score = state.score;
    gameState.previousScore = state.score;
    gameState.tileIdCounter = state.tileIdCounter;
    gameState.lastNewTileId = state.lastNewTileId;
    gameState.hasShownGameWon = state.hasShownGameWon;
    gameState.diveSeeds = state.diveSeeds ? [...state.diveSeeds] : (config.GAME_MODE === 'dive' ? [2] : []);
    gameState.moves = state.moves || 0;
    gameState.playtimeAccumulated = state.playtime || 0;
    gameState.startedAt = Date.now();
    gameState.finalized = false;

    const scoreDifference = gameState.score - scoreBeforeRestore;
    if (scoreDifference !== 0) {
        let totalScore = parseFloat(localStorage.getItem('totalScore') || '0');
        totalScore += scoreDifference;
        localStorage.setItem('totalScore', totalScore);
    }

    if (aiModeActive) {
        stopAIMode();
    }
    updateUI();
    updateUndoRedoUI(undoStack.length, redoStack.length);
}

export function undo() {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        restoreState(undoStack[undoStack.length - 1]);
        saveGameState();
        hideGameOver();
    }
}

export function redo() {
    if (redoStack.length > 0) {
        const state = redoStack.pop();
        undoStack.push(state);
        restoreState(state);
        saveGameState();
        if (isGameOver()) {
            showGameOver();
        }
    }
}

export function handlePracticeModeChange(enabled) {
    config.practiceMode = enabled;
    initGrid();
    saveSettings();
    if (!enabled) {
        clearUndoRedoStacks();
    }
}

export function clearUndoRedoStacks() {
    undoStack = [];
    redoStack = [];
    updateUndoRedoUI(0, 0);
}

export function clearHistory() {
    clearUndoRedoStacks();
    clearGameState();
}


// --- AI LOGIC ---

import { canMove as originalCanMove } from './grid.js';

function aiCanMove(direction) {
    // Use the original check first.
    if (originalCanMove(direction)) {
        return true;
    }

    // If the original check fails, and we're in "power-of-three" mode,
    // perform a specific check for three-tile merges.
    if (config.GAME_MODE !== 'power-of-three') {
        return false;
    }

    const vector = { 0: { r: 0, c: -1 }, 1: { r: 1, c: 0 }, 2: { r: 0, c: 1 }, 3: { r: -1, c: 0 } }[direction];

    const getTile = (row, col) => {
        const tileId = gameState.grid[row]?.[col];
        return tileId ? gameState.tiles.find(t => t.id === tileId) : null;
    };

    const isWithinBounds = (row, col) => row >= 0 && row < config.GRID_SIZE && col >= 0 && col < config.GRID_SIZE;

    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            const tile1 = getTile(r, c);
            if (!tile1) continue;

            const r2 = r + vector.r, c2 = c + vector.c;
            const r3 = r + 2 * vector.r, c3 = c + 2 * vector.c;

            if (isWithinBounds(r3, c3)) {
                const tile2 = getTile(r2, c2);
                const tile3 = getTile(r3, c3);
                if (tile2 && tile3 && tile1.value === tile2.value && tile1.value === tile3.value) {
                    return true;
                }
            }
        }
    }

    return false;
}

export const AI_STRATEGIES = {
    'random': { /* ...omitted for brevity... */ },
    'corner': { /* ...omitted for brevity... */ },
    'swirl': { /* ...omitted for brevity... */ },
    'swing': { /* ...omitted for brevity... */ }
};
// Copying the full AI_STRATEGIES object from script.js
Object.assign(AI_STRATEGIES, {
    'random': {
        name: 'Random',
        getMove: function() {
            const dirs = [0, 1, 2, 3];
            const valid = dirs.filter(aiCanMove);
            if (valid.length === 0) return 0;
            return valid[Math.floor(Math.random() * valid.length)];
        }
    },
    'corner': {
        name: 'Corner',
        getMove: (function() {
            let state = 'primary'; let lastPrimary = 'up'; let lastRecovery = 'up';
            return function() {
                const canLeft = aiCanMove(0), canUp = aiCanMove(3), canRight = aiCanMove(2), canDown = aiCanMove(1);
                if (state === 'primary' && !canLeft && !canUp) state = 'recovery';
                else if (state === 'recovery' && !canRight && !canUp) state = 'primary';
                if (state === 'primary') {
                    if (lastPrimary === 'up' && canLeft) { lastPrimary = 'left'; return 0; }
                    if (canUp) { lastPrimary = 'up'; return 3; }
                    if (canLeft) { lastPrimary = 'left'; return 0; }
                }
                if (state === 'recovery') {
                    if (lastRecovery === 'up' && canRight) { lastRecovery = 'right'; return 2; }
                    if (canUp) { lastRecovery = 'up'; return 3; }
                    if (canRight) { lastRecovery = 'right'; return 2; }
                }
                if (canDown) return 1;
                return 0;
            };
        })()
    },
    'swirl': {
        name: 'Swirl',
        getMove: (function() {
            let idx = 0; const order = [3, 2, 1, 0];
            return function() {
                for (let i = 0; i < 4; i++) {
                    const dir = order[(idx + i) % 4];
                    if (aiCanMove(dir)) { idx = (idx + 1) % 4; return dir; }
                }
                return 0;
            };
        })()
    },
    'swing': {
        name: 'Swing',
        getMove: (function() {
            let state = 'primary'; let lastPrimary = 'down'; let lastRecovery = 'right';
            return function() {
                const canUp = aiCanMove(3), canDown = aiCanMove(1), canLeft = aiCanMove(0), canRight = aiCanMove(2);
                if (state === 'recovery' && !canLeft && !canRight) state = 'primary';
                if (state === 'primary' && !canUp && !canDown) state = 'recovery';
                if (state === 'primary') {
                    if (lastPrimary === 'down' && canUp) { lastPrimary = 'up'; return 3; }
                    if (canDown) { lastPrimary = 'down'; return 1; }
                    if (canUp) { lastPrimary = 'up'; return 3; }
                }
                if (state === 'recovery') {
                    if (lastRecovery === 'right' && canLeft) { lastRecovery = 'left'; return 0; }
                    if (canRight) { lastRecovery = 'right'; return 2; }
                    if (canLeft) { lastRecovery = 'left'; return 0; }
                }
                return Math.floor(Math.random() * 4);
            };
        })()
    }
});


export function startAIMode() {
    if (aiModeActive) return;
    aiModeActive = true;
    // updateGridContainerAnimations(); // This will be in ui.js
    aiIntervalId = setInterval(() => {
        if (!aiModeActive) return;
        let direction = AI_STRATEGIES[config.aiStrategy]?.getMove() || 0;
        move(direction);
    }, config.aiMoveDelay);
}

export function stopAIMode() {
    aiModeActive = false;
    if (aiIntervalId) {
        clearInterval(aiIntervalId);
        aiIntervalId = null;
    }
    // updateGridContainerAnimations(); // This will be in ui.js
    const aiStatus = document.getElementById('ai-status');
    if (aiStatus) aiStatus.textContent = 'AI Mode: Off';
    const aiToggleButtonIcon = document.getElementById('ai-toggle-button-icon');
    if (aiToggleButtonIcon) aiToggleButtonIcon.className = 'fas fa-play';
}

export function finalizeCurrentGame() {
    if (gameState.finalized) return;
    gameState.finalized = true;
    const playtimeMs = (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0);
    const prevTotalPlaytime = parseInt(localStorage.getItem('totalPlaytime') || '0', 10) || 0;
    localStorage.setItem('totalPlaytime', prevTotalPlaytime + playtimeMs);

    const prevTotalMoves = parseInt(localStorage.getItem('totalMoves') || '0', 10) || 0;
    localStorage.setItem('totalMoves', prevTotalMoves + (gameState.moves || 0));

    // record final playtime in the game state and stop the timer
    gameState.playtimeAccumulated = playtimeMs;
    gameState.startedAt = null;

    // Persist any final game state (optional)
    saveGameState();
}

// --- HELPERS ---
// --- STATISTICS ---

function formatDuration(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
}

export function incrementGamesPlayed(gameMode, practiceMode, gridSize) {
    const key = getGamesPlayedKey(gameMode, practiceMode, gridSize);
    let gamesPlayed = parseInt(localStorage.getItem(key) || '0');
    gamesPlayed++;
    localStorage.setItem(key, gamesPlayed);
}

export function updateStatistics() {
    const gameStatisticsContainer = document.getElementById('game-statistics');
    if (!gameStatisticsContainer) return;

    gameStatisticsContainer.innerHTML = '';

    const gridSizes = [3, 4, 5, 6, 7, 8];
    const gameModes = ['classic', 'fibonacci', 'power-of-three', 'supermerging', 'dive', 'zero', 'negative', 'math'];
    const gameModesDisplay = {
        'classic': 'Classic',
        'fibonacci': 'Fibonacci',
        'power-of-three': 'Powers of 3',
        'supermerging': 'Supermerging',
        'dive': 'DIVE',
        'zero': 'Zero',
        'negative': 'Negative',
        'math': 'Math'
    };
    const practiceModes = [false, true];
    let totalGamesPlayed = 0;
    let overallHighestTile = 0;

    for (const size of gridSizes) {
        for (const mode of gameModes) {
            for (const practice of practiceModes) {
                const highScoreKey = getHighScoreKey(mode, practice, size);
                const highestTileKey = getHighestTileKey(mode, practice, size);
                const gamesPlayedKey = getGamesPlayedKey(mode, practice, size);

                const gamesPlayed = parseInt(localStorage.getItem(gamesPlayedKey) || '0');

                if (gamesPlayed === 0) {
                    continue;
                }

                let highScore = parseFloat(localStorage.getItem(highScoreKey) || '0');
                const highestTile = parseFloat(localStorage.getItem(highestTileKey) || '0');

                // If the current game matches this statistics entry, consider its score for the total.
                if (size === config.GRID_SIZE && mode === config.GAME_MODE && practice === config.practiceMode) {
                    highScore = Math.max(highScore, gameState.score);
                }

                totalGamesPlayed += gamesPlayed;
                overallHighestTile = Math.max(overallHighestTile, highestTile);

                const statsElement = document.createElement('div');
                statsElement.classList.add('statistics-entry');

                const title = document.createElement('h4');
                title.textContent = `${size}x${size}, ${gameModesDisplay[mode]}, practice mode ${practice ? 'enabled' : 'disabled'}`;
                statsElement.appendChild(title);

                // Visual highest tile display for this entry
                const highestTileContainer = document.createElement('div');
                highestTileContainer.classList.add('highest-tile-container');

                statsElement.appendChild(highestTileContainer);

                const highestTileLabel = document.createElement('p');
                highestTileLabel.textContent = 'Highest tile';
                highestTileContainer.appendChild(highestTileLabel);

                const individualTileDiv = document.createElement('div');
                individualTileDiv.classList.add('tile-individual');

                const tileDiv = document.createElement('div');
                if (mode === 'supermerging' || mode === 'dive') {
                    applySupermergingStyle(tileDiv, highestTile);
                } else {
                    tileDiv.classList.add('tile', `tile-${highestTile}`);
                    // Apply consistent font sizing as used in the main grid
                    const charCount = String(highestTile).length;
                    const fs = getFontSizeByChars(charCount);
                    if (fs) tileDiv.style.fontSize = fs;
                };
                tileDiv.textContent = highestTile;
                individualTileDiv.appendChild(tileDiv);
                highestTileContainer.appendChild(individualTileDiv);

                const statMainContainer = document.createElement('div');
                statMainContainer.classList.add("statistics-main-container");
                statsElement.appendChild(statMainContainer);

                const gamesPlayedElement = document.createElement('div');
                gamesPlayedElement.classList.add("statistics-main-item");
                statMainContainer.appendChild(gamesPlayedElement);

                const gamesPlayedHead = document.createElement('div');
                gamesPlayedHead.classList.add("statistics-main-head");
                gamesPlayedHead.textContent = `Games played`;
                gamesPlayedElement.appendChild(gamesPlayedHead);

                const gamesPlayedValue = document.createElement('div');
                gamesPlayedValue.classList.add("statistics-main-value");
                gamesPlayedValue.textContent = gamesPlayed;
                gamesPlayedElement.appendChild(gamesPlayedValue);

                const bestScoreElement = document.createElement('div');
                bestScoreElement.classList.add("statistics-main-item");
                statMainContainer.appendChild(bestScoreElement);

                const bestScoreHead = document.createElement('div');
                bestScoreHead.classList.add("statistics-main-head");
                bestScoreHead.textContent = `Best Score`;
                bestScoreElement.appendChild(bestScoreHead);

                const bestScoreValue = document.createElement('div');
                bestScoreValue.classList.add("statistics-main-value");
                bestScoreValue.textContent = formatScore(highScore);
                bestScoreElement.appendChild(bestScoreValue);

                gameStatisticsContainer.appendChild(statsElement);
            }
        }
    }
    const totalGamesPlayedElement = document.getElementById('games-played');
    if (totalGamesPlayedElement) {
        totalGamesPlayedElement.textContent = totalGamesPlayed;
    }

    const totalScoreElement = document.getElementById('total-score');
    if (totalScoreElement) {
        const totalScore = parseFloat(localStorage.getItem('totalScore') || '0');
        totalScoreElement.textContent = formatScore(totalScore);
    }

    // Total playtime (across all games)
    const totalPlaytimeElement = document.getElementById('total-playtime');
    if (totalPlaytimeElement) {
        const storedTotalPlaytimeMs = parseInt(localStorage.getItem('totalPlaytime') || '0', 10) || 0;
        const currentPlaytimeRaw = (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0);
        const currentPlaytimeForTotals = gameState.finalized ? 0 : currentPlaytimeRaw;
        totalPlaytimeElement.textContent = formatDuration(storedTotalPlaytimeMs + currentPlaytimeForTotals);
    }

    // Total moves (across all games)
    const totalMovesElement = document.getElementById('total-moves');
    if (totalMovesElement) {
        const storedTotalMoves = parseInt(localStorage.getItem('totalMoves') || '0', 10) || 0;
        const currentMovesForTotals = gameState.finalized ? 0 : (gameState.moves || 0);
        totalMovesElement.textContent = storedTotalMoves + currentMovesForTotals;
    }

    // Statistics for the current game
    const statsGameScoreEl = document.getElementById('stats-game-score');
    if (statsGameScoreEl) statsGameScoreEl.textContent = formatScore(gameState.score);

    const gamePlaytimeEl = document.getElementById('game-playtime');
    if (gamePlaytimeEl) {
        const currentPlaytimeMs = (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0);
        gamePlaytimeEl.textContent = formatDuration(currentPlaytimeMs);
    }

    const gameMovesEl = document.getElementById('game-moves');
    if (gameMovesEl) gameMovesEl.textContent = (gameState.moves || 0);
}

export function updateStatisticsLive() {
    const statsGameScoreEl = document.getElementById('stats-game-score');
    if (statsGameScoreEl) statsGameScoreEl.textContent = formatScore(gameState.score);

    const gamePlaytimeEl = document.getElementById('game-playtime');
    if (gamePlaytimeEl) {
        const currentPlaytimeMs = (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0);
        gamePlaytimeEl.textContent = formatDuration(currentPlaytimeMs);
    }

    const gameMovesEl = document.getElementById('game-moves');
    if (gameMovesEl) gameMovesEl.textContent = (gameState.moves || 0);

    const totalPlaytimeElement = document.getElementById('total-playtime');
    if (totalPlaytimeElement) {
        const storedTotalPlaytimeMs = parseInt(localStorage.getItem('totalPlaytime') || '0', 10) || 0;
        const currentPlaytimeRaw = (gameState.playtimeAccumulated || 0) + (gameState.startedAt ? (Date.now() - gameState.startedAt) : 0);
        const currentPlaytimeForTotals = gameState.finalized ? 0 : currentPlaytimeRaw;
        totalPlaytimeElement.textContent = formatDuration(storedTotalPlaytimeMs + currentPlaytimeForTotals);
    }

    const totalMovesElement = document.getElementById('total-moves');
    if (totalMovesElement) {
        const storedTotalMoves = parseInt(localStorage.getItem('totalMoves') || '0', 10) || 0;
        const currentMovesForTotals = gameState.finalized ? 0 : (gameState.moves || 0);
        totalMovesElement.textContent = storedTotalMoves + currentMovesForTotals;
    }
}

// --- APP ENTRY POINT ---

window.onload = function() {
    loadSettings();
    initializeUI();
    initializeColorPicker();
    initGrid();
    updateGoalDisplay();
};