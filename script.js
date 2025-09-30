// 2048 Game Logic
let GRID_SIZE = 4;
let grid = [];
let score = 0;
let previousScore = 0;
let tiles = [];
let tileIdCounter = 1;
let lastNewTileId = null;
let hasShownGameWon = false;

// Undo/Redo support
let undoStack = [];
let redoStack = [];

let aiModeActive = false;
let aiIntervalId = null;
let aiMoveDelay = 100;

let GAME_MODE = 'classic';
let practiceMode = false;

// Function to load game settings from local storage
function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        GRID_SIZE = settings.GRID_SIZE || 4;
        GAME_MODE = settings.GAME_MODE || 'classic';
        practiceMode = settings.practiceMode || false;
        aiMoveDelay = settings.aiMoveDelay || 100;
        aiStrategy = settings.aiStrategy || 'random';

        // Update UI elements
        const gridSizeSelect = document.getElementById('grid-size-select');
        if (gridSizeSelect) gridSizeSelect.value = GRID_SIZE;
        document.documentElement.style.setProperty('--grid-size', GRID_SIZE);

        const gameModeSelect = document.getElementById('game-mode-select');
        if (gameModeSelect) gameModeSelect.value = GAME_MODE;

        const practiceModeToggle = document.getElementById('practice-mode-toggle');
        if (practiceModeToggle) practiceModeToggle.checked = practiceMode;
        // Directly update undo/redo button visibility instead of calling handlePracticeModeChange()
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');
        if (undoButton) {
            if (practiceMode) undoButton.classList.remove('hidden');
            else undoButton.classList.add('hidden');
        }
        if (redoButton) {
            if (practiceMode) redoButton.classList.remove('hidden');
            else redoButton.classList.add('hidden');
        }

        const aiMoveDelaySlider = document.getElementById('ai-move-delay-slider');
        if (aiMoveDelaySlider) aiMoveDelaySlider.value = aiMoveDelay;
        const aiMoveDelayValue = document.getElementById('ai-move-delay-value');
        if (aiMoveDelayValue) aiMoveDelayValue.textContent = `${aiMoveDelay}ms`;

        const aiMoveDurationInput = document.getElementById('ai-move-duration-input');
        if (aiMoveDurationInput) aiMoveDurationInput.value = aiMoveDelay;

        const aiStrategySelect = document.getElementById('ai-strategy-select');
        if (aiStrategySelect) aiStrategySelect.value = aiStrategy;
    }
}

// Function to save game settings to local storage
function saveSettings() {
    const settings = {
        GRID_SIZE: GRID_SIZE,
        GAME_MODE: GAME_MODE,
        practiceMode: practiceMode,
        aiMoveDelay: aiMoveDelay,
        aiStrategy: aiStrategy
    };
    localStorage.setItem('gameSettings', JSON.stringify(settings));
}

// Track merges for animation
let mergeAnimations = [];
// Snapshot of tile positions before a move (id -> {row,col})
let beforeMovePositions = null;

function getGameStateKey(gameMode, practiceMode, gridSize) {
    return `gameState-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

function saveGameState() {
    const gameState = {
        grid: grid,
        score: score,
        tiles: tiles,
		tileIdCounter: tileIdCounter,
		hasShownGameWon: hasShownGameWon,
		GRID_SIZE: GRID_SIZE,
		GAME_MODE: GAME_MODE,
		practiceMode: practiceMode
    };
    localStorage.setItem(getGameStateKey(GAME_MODE, practiceMode, GRID_SIZE), JSON.stringify(gameState));
}

function clearGameState() {
    localStorage.removeItem(getGameStateKey(GAME_MODE, practiceMode, GRID_SIZE));
}

function restoreGameState() {
    const savedState = localStorage.getItem(getGameStateKey(GAME_MODE, practiceMode, GRID_SIZE));
    if (savedState) {
        const gameState = JSON.parse(savedState);
        grid = gameState.grid;
        score = gameState.score;
        previousScore = score;
        tiles = gameState.tiles;
		tileIdCounter = gameState.tileIdCounter;
		hasShownGameWon = gameState.hasShownGameWon;
		// Restore GRID_SIZE, GAME_MODE, and practiceMode
		GRID_SIZE = gameState.GRID_SIZE || 4; // Default to 4 if not saved
		GAME_MODE = gameState.GAME_MODE || 'classic'; // Default to 'classic' if not saved
		practiceMode = gameState.practiceMode || false; // Default to false if not saved

		// UI elements are now updated by loadSettings() before initGrid() is called

        updateUI();
		return true;
    }
	return false;
}

function generateGridCells() {
    const gridContainerInner = document.getElementById('grid-container-inner');
    if (!gridContainerInner) return;

    // Clear existing grid cells
    gridContainerInner.innerHTML = '';

    // Create new grid cells
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gridContainerInner.appendChild(cell);
        }
    }
}

function initGrid() {
	// loadSettings(); // Removed: loadSettings should only be called once on initial page load
	generateGridCells(); // Call to dynamically generate grid cells
	if (restoreGameState()) {
		// If state was restored, ensure UI is updated and then check for game over
		// The game over check will be done after this if block
	} else {
		grid = Array(GRID_SIZE)
			.fill()
			.map(() => Array(GRID_SIZE).fill(null));
		tiles = [];
		tileIdCounter = 1;
		score = 0;
		previousScore = 0;
		hasShownGameWon = false;
		addRandomTile();
		addRandomTile();
		updateUI();
        incrementGamesPlayed(GAME_MODE, practiceMode, GRID_SIZE);
		// Save the initial state so undo works after the first move
		saveState();
	}

	// Hide game over and game won containers initially
	const gameOverContainer = document.getElementById('game-over-container');
	if (gameOverContainer) gameOverContainer.classList.add('hidden');

	const gameWonContainer = document.getElementById('game-won-container');
	if (gameWonContainer) gameWonContainer.classList.add('hidden');

	const highScoreKey = getHighScoreKey(GAME_MODE, practiceMode, GRID_SIZE);
    const savedHighScore = localStorage.getItem(highScoreKey);
    if (savedHighScore) {
        document.getElementById('high-score').textContent = savedHighScore;
    } else {
        document.getElementById('high-score').textContent = '0';
    }

	// Check for game over immediately after restoring state or initializing new game
	if (isGameOver()) {
		const gameOverContainer = document.getElementById('game-over-container');
		if (gameOverContainer) gameOverContainer.classList.remove('hidden');
	}
	clearUndoRedoStacks(); // Clear undo/redo history on grid initialization
}

function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === null) emptyCells.push([r, c]);
        }
    }
    if (emptyCells.length === 0) return;
    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    let value;
    if (GAME_MODE === 'fibonacci') {
        value = Math.random() < 0.9 ? 1 : 2;
    } else if (GAME_MODE === 'power-of-three') {
        value = 1;
    } else {
        value = Math.random() < 0.9 ? 2 : 4;
    }
    const tile = { id: tileIdCounter++, value, row: r, col: c, merged: false };
    tiles.push(tile);
    grid[r][c] = tile.id;
    lastNewTileId = tile.id;
}


function getTileById(id) {
	return tiles.find(t => t.id === id);
}

function slide(row) {
    const newRow = Array(GRID_SIZE).fill(null);
    let insert = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
        if (row[i] !== null) {
            newRow[insert] = row[i];
            insert++;
        }
    }
    return newRow;
}

function getFibonacciSequence(maxValue) {
    const fib = [1, 1];
    while (fib[fib.length - 1] < maxValue) {
        fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
    }
    return fib;
}

function areFibonacciMergeable(a, b, fibSeq) {
    // 1+1, 1+2, 2+1, 2+3, 3+2, 3+5, 5+3, ...
    for (let i = 0; i < fibSeq.length - 1; i++) {
        if ((a === 1 && b === 1) ||
            (fibSeq[i] === a && fibSeq[i + 1] === b) ||
            (fibSeq[i] === b && fibSeq[i + 1] === a)) {
            return true;
        }
    }
    return false;
}

function combine(row) {
    let rowChanged = false;
    if (GAME_MODE === 'fibonacci') {
        const fibSeq = getFibonacciSequence(Math.pow(2, 20));
        for (let i = 0; i < GRID_SIZE - 1; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            if (tileA && tileB && areFibonacciMergeable(tileA.value, tileB.value, fibSeq)) {
                if (tileA.merged || tileB.merged) continue;
                // Determine starting positions for animation (use beforeMovePositions when available)
                const fromA = (beforeMovePositions && beforeMovePositions[tileA.id]) ? beforeMovePositions[tileA.id] : { row: tileA.row, col: tileA.col };
                const fromB = (beforeMovePositions && beforeMovePositions[tileB.id]) ? beforeMovePositions[tileB.id] : { row: tileB.row, col: tileB.col };
				// Record merge animation info. Keep the id of the merged (kept) tile
				mergeAnimations.push({
					from: { id: tileA.id, row: fromA.row, col: fromA.col, value: tileA.value },
					from2: { id: tileB.id, row: fromB.row, col: fromB.col, value: tileB.value },
					mergedId: tileA.id,
					to: { row: tileA.row, col: tileA.col },
					mergedValue: tileA.value + tileB.value
				});
                score += tileA.value + tileB.value; // Increment score by the value of the new tile
                tileA.value = tileA.value + tileB.value;
                tileA.merged = true;
                // ...existing code...
                const tileBEl = document.getElementById('tile-' + tileB.id);
                // mark DOMs as merging so they persist for animation
				// Remove the non-alias (removed) tile DOM immediately so only the alias and merged tile remain
				if (tileBEl) tileBEl.remove();
                grid[tileB.row][tileB.col] = null;
                // remove tileB logically
                tiles = tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
        return { row, rowChanged };
    }
    if (GAME_MODE === 'power-of-three') {
        for (let i = 0; i < GRID_SIZE - 2; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            const tileC = row[i + 2] ? getTileById(row[i + 2]) : null;
            if (tileA && tileB && tileC && tileA.value === tileB.value && tileA.value === tileC.value) {
                if (tileA.merged || tileB.merged || tileC.merged) continue;
                const fromA = (beforeMovePositions && beforeMovePositions[tileA.id]) ? beforeMovePositions[tileA.id] : { row: tileA.row, col: tileA.col };
                const fromB = (beforeMovePositions && beforeMovePositions[tileB.id]) ? beforeMovePositions[tileB.id] : { row: tileB.row, col: tileB.col };
                const fromC = (beforeMovePositions && beforeMovePositions[tileC.id]) ? beforeMovePositions[tileC.id] : { row: tileC.row, col: tileC.col };
                mergeAnimations.push({
                    from: { id: tileA.id, row: fromA.row, col: fromA.col, value: tileA.value },
                    from2: { id: tileB.id, row: fromB.row, col: fromB.col, value: tileB.value },
                    from3: { id: tileC.id, row: fromC.row, col: fromC.col, value: tileC.value },
                    mergedId: tileA.id,
                    to: { row: tileA.row, col: tileA.col },
                    mergedValue: tileA.value * 3
                });
                tileA.value *= 3;
                tileA.merged = true;
                score += tileA.value;
                const tileBEl = document.getElementById('tile-' + tileB.id);
                if (tileBEl) tileBEl.remove();
                const tileCEl = document.getElementById('tile-' + tileC.id);
                if (tileCEl) tileCEl.remove();
                grid[tileB.row][tileB.col] = null;
                grid[tileC.row][tileC.col] = null;
                tiles = tiles.filter(t => t.id !== tileB.id && t.id !== tileC.id);
                row[i + 1] = null;
                row[i + 2] = null;
                rowChanged = true;
                i += 2;
            }
        }
        return { row, rowChanged };
    }
    for (let i = 0; i < GRID_SIZE - 1; i++) {
        const tileA = row[i] ? getTileById(row[i]) : null;
        const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
			if (tileA && tileB && tileA.value === tileB.value) {
            if (tileA.merged || tileB.merged) continue; // Prevent double merges
            const fromA = (beforeMovePositions && beforeMovePositions[tileA.id]) ? beforeMovePositions[tileA.id] : { row: tileA.row, col: tileA.col };
            const fromB = (beforeMovePositions && beforeMovePositions[tileB.id]) ? beforeMovePositions[tileB.id] : { row: tileB.row, col: tileB.col };
            // Record merge animation info
				// Record merge animation info. Store mergedId so we can reliably
				// target the final DOM element for the merged tile.
				mergeAnimations.push({
					from: { id: tileA.id, row: fromA.row, col: fromA.col, value: tileA.value },
					from2: { id: tileB.id, row: fromB.row, col: fromB.col, value: tileB.value },
					mergedId: tileA.id,
					to: { row: tileA.row, col: tileA.col },
					mergedValue: tileA.value * 2
				});
            tileA.value *= 2;
            tileA.merged = true;
            score += tileA.value;
            const tileBEl = document.getElementById('tile-' + tileB.id);
            // Mark DOMs as merging so they persist for animation
			if (tileBEl) tileBEl.remove();
            grid[tileB.row][tileB.col] = null;
            tiles = tiles.filter(t => t.id !== tileB.id);
            row[i + 1] = null;
            rowChanged = true;
            i++; // Skip next index to prevent double merge
        }
    }
    return { row, rowChanged };
}

// Patch operate to record merge targets after final slide
function operate(row) {
    let rowChanged = false;
    const afterFirstSlide = slide(row);
    if (JSON.stringify(afterFirstSlide) !== JSON.stringify(row)) {
        rowChanged = true;
    }
    row = afterFirstSlide;
	// Track merges created by this combine call so we can map their final positions
	const beforeCombineCount = mergeAnimations.length;
	const combineResult = combine(row);
    row = combineResult.row;
    if (combineResult.rowChanged) rowChanged = true;
    const afterSecondSlide = slide(row);
	// Map the mergeAnimations entries created by this combine call to their
	// final positions after the second slide. We use mergedId to locate the
	// kept tile and set anim.to accordingly.
	const newAnims = mergeAnimations.slice(beforeCombineCount);
	newAnims.forEach(anim => {
		if (anim.mergedId) {
			// After we've updated positions below, the merged tile should be
			// present in the global tiles list with updated row/col.
			const mergedTile = getTileById(anim.mergedId);
			if (mergedTile) {
				anim.to = { row: mergedTile.row, col: mergedTile.col };
			} else {
				// Fallback: scan the afterSecondSlide for a tile with matching value
				for (let i = 0; i < afterSecondSlide.length; i++) {
					const id = afterSecondSlide[i];
					if (!id) continue;
					const tile = getTileById(id);
					if (tile && tile.value === anim.mergedValue) {
						anim.to = { row: tile.row, col: tile.col };
						break;
					}
				}
			}
		}
	});
    if (JSON.stringify(afterSecondSlide) !== JSON.stringify(row)) {
        rowChanged = true;
    }
    row = afterSecondSlide;

    return { row, rowChanged };
}

function rotateGrid(grid) {
	// Transpose and reverse rows
	let newGrid = Array(GRID_SIZE)
		.fill()
		.map(() => Array(GRID_SIZE).fill(null));
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			newGrid[c][GRID_SIZE - 1 - r] = grid[r][c];
		}
	}
	return newGrid;
}

function move(direction) {
    resetMergedState();

    // Snapshot positions before the move (use current grid)
    beforeMovePositions = {};
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const id = grid[r] && grid[r][c];
            if (id) beforeMovePositions[id] = { row: r, col: c };
        }
    }

    let oldGrid = JSON.stringify(grid);
    let currentGrid = grid.map(row => [...row]);

    for (let i = 0; i < direction; i++) {
        currentGrid = rotateGrid(currentGrid);
    }

    let anyTileMoved = false;
    for (let r = 0; r < GRID_SIZE; r++) {
        const operateResult = operate(currentGrid[r]);
        currentGrid[r] = operateResult.row;
        if (operateResult.rowChanged) {
            anyTileMoved = true;
        }
    }

    for (let i = 0; i < (4 - direction) % 4; i++) {
        currentGrid = rotateGrid(currentGrid);
    }

    if (anyTileMoved) {
        grid = currentGrid;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const id = grid[r][c];
                if (id) {
                    const tile = getTileById(id);
                    if (tile) {
                        tile.row = r;
                        tile.col = c;
                    }
                }
            }
        }
        addRandomTile();
        updateUI();
		saveGameState();

        // clear snapshot after UI updated
        beforeMovePositions = null;

        if (isGameOver()) {
            stopAIMode();
            setTimeout(() => {
                const gameOverContainer = document.getElementById('game-over-container');
                if (gameOverContainer) gameOverContainer.classList.remove('hidden');
            }, 100);
        }
        if (isGameWon() && !hasShownGameWon) {
            hasShownGameWon = true;
            stopAIMode();
            setTimeout(() => {
                const gameWonContainer = document.getElementById('game-won-container');
                if (gameWonContainer) gameWonContainer.classList.remove('hidden');
            }, 100);
        }
    }
}

// Ensure merged animation only triggers once per move
function resetMergedState() {
	tiles.forEach(tile => {
		tile.merged = false;
		const tileElement = document.getElementById('tile-' + tile.id);
		if (tileElement) {
			tileElement.classList.remove('merged');
		}
	});
}

function isGameOver() {
	// Check for empty cells
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			if (grid[r][c] === null) return false;
		}
	}
	// Check for possible merges
	if (GAME_MODE === 'fibonacci') {
		const fibSeq = getFibonacciSequence(Math.pow(2, 20));
		for (let r = 0; r < GRID_SIZE; r++) {
			for (let c = 0; c < GRID_SIZE; c++) {
				const tile = getTileById(grid[r][c]);
				// Check right
				if (c < GRID_SIZE - 1) {
					const rightTile = getTileById(grid[r][c + 1]);
					if (tile && rightTile && areFibonacciMergeable(tile.value, rightTile.value, fibSeq)) return false;
				}
				// Check down
				if (r < GRID_SIZE - 1) {
					const downTile = getTileById(grid[r + 1][c]);
					if (tile && downTile && areFibonacciMergeable(tile.value, downTile.value, fibSeq)) return false;
				}
			}
		}
		return true;
	}
	if (GAME_MODE === 'power-of-three') {
		for (let r = 0; r < GRID_SIZE; r++) {
			for (let c = 0; c < GRID_SIZE; c++) {
				const tile = getTileById(grid[r][c]);
				if (!tile) continue;
				// Check right for 3-in-a-row
				if (c < GRID_SIZE - 2) {
					const rightTile1 = getTileById(grid[r][c + 1]);
					const rightTile2 = getTileById(grid[r][c + 2]);
					if (rightTile1 && rightTile2 && tile.value === rightTile1.value && tile.value === rightTile2.value) {
						return false;
					}
				}
				// Check down for 3-in-a-row
				if (r < GRID_SIZE - 2) {
					const downTile1 = getTileById(grid[r + 1][c]);
					const downTile2 = getTileById(grid[r + 2][c]);
					if (downTile1 && downTile2 && tile.value === downTile1.value && tile.value === downTile2.value) {
						return false;
					}
				}
			}
		}
		return true;
	}
	// Classic mode
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			const tile = getTileById(grid[r][c]);
			// Check right
			if (c < GRID_SIZE - 1) {
				const rightTile = getTileById(grid[r][c + 1]);
				if (tile && rightTile && tile.value === rightTile.value) return false;
			}
			// Check down
			if (r < GRID_SIZE - 1) {
				const downTile = getTileById(grid[r + 1][c]);
				if (tile && downTile && tile.value === downTile.value) return false;
			}
		}
	}
	return true;
}

function getGoalValue(size) {
    if (GAME_MODE === 'fibonacci') {
        const n = Math.pow(size, 2);
        const idx = Math.round(n * 0.77 + 5);
        // Generate Fibonacci sequence up to idx
        const fib = [1, 1];
        while (fib.length <= idx) {
            fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
        }
        return fib[idx];
	} else if (GAME_MODE === 'power-of-three') {
		return Math.pow(3, Math.round(Math.pow(size, 2) * 0.2));
    } else {
        // Classic mode
        return Math.pow(2, Math.round(Math.pow(size, 2) * 0.53 + 3));
    }
}

function updateGoalDisplay() {
    const goalValue = getGoalValue(GRID_SIZE);
    document.querySelectorAll('.goal-number').forEach(el => {
        el.textContent = goalValue;
    });
}

function isGameWon() {
    const goalValue = getGoalValue(GRID_SIZE);
    for (const t of tiles) {
        if (t.value === goalValue) return true;
    }
    return false;
}

function getHighScoreKey(gameMode, practiceMode, gridSize) {
    return `highScore-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

function updateUI() {
	const tileContainer = document.getElementById('tile-container');
	// Remove DOM tiles that no longer exist, but keep the game over and game won containers
	// Only remove tiles that are not in the tiles array
	const tileIds = new Set(tiles.map(t => 'tile-' + t.id));
	Array.from(tileContainer.children).forEach(tile => {
		// Never remove tiles that are in the merge animation or special containers
		if (!tileIds.has(tile.id) && 
			tile.id !== 'game-over-container' && 
			tile.id !== 'game-won-container' && 
			!tile.classList.contains('merging')) {
			tileContainer.removeChild(tile);
		}
	});
	// Update or create DOM tiles
	for (const t of tiles) {
		let tile = document.getElementById('tile-' + t.id);
		if (!tile) {
			tile = document.createElement('div');
			tile.id = 'tile-' + t.id;
			tile.className = `tile tile-${t.value}`;
			if (t.id === lastNewTileId) tile.classList.add('new');
			tile.textContent = t.value;
			tile.style.position = 'absolute';
			tileContainer.appendChild(tile);
		} else {
			// Update value and class if changed
			const existingMerging = tile.classList.contains('merging');
            if (!tile.classList.contains(`tile-${t.value}`)) {
                tile.className = `tile tile-${t.value}`;
            }
            // restore merging class if it was present
            if (existingMerging) tile.classList.add('merging');
			tile.textContent = t.value;
			if (t.id === lastNewTileId) tile.classList.add('new');
			else tile.classList.remove('new');
		}
		// Animation classes
		if (t.sliding) {
			tile.classList.add('sliding');
			if (t.merging) {
				tile.classList.add('merging');
			}
				tile.classList.remove('sliding');
				t.sliding = false;
				// Only remove 'merging' class for original tiles, not merged tile
				if (t.merging) {
					tile.classList.remove('merging');
					t.merging = false;
				}
				if (t.merged) {
					tile.classList.add('merged');
					setTimeout(() => tile.classList.remove('merged'), 300);
				}
		} else {
			tile.classList.remove('sliding');
			// Only add 'merging' class for original tiles, not merged tile
			if (t.merging) {
				tile.classList.add('merging');
			} else {
				tile.classList.remove('merging');
			}
			if (t.merged) {
				tile.classList.add('merged');
				setTimeout(() => tile.classList.remove('merged'), 300);
			} else {
				tile.classList.remove('merged');
			}
		}
		// Always update position
		tile.style.top = ((100 - 10 / GRID_SIZE) / GRID_SIZE * t.row + 10 / GRID_SIZE) + '%';
		tile.style.left = ((100 - 10 / GRID_SIZE) / GRID_SIZE * t.col + 10 / GRID_SIZE) + '%';
	}
	// Animate merge alias tiles
	mergeAnimations.forEach(anim => {
		const tileContainer = document.getElementById('tile-container');
		// First merging alias at original pre-move position
		const alias1 = document.createElement('div');
		alias1.id = `tile-${anim.from.id}-merge`;
		alias1.className = `tile tile-${anim.from.value} tile-merging merging`;
		alias1.textContent = anim.from.value;
		alias1.style.position = 'absolute';
		alias1.style.top = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.from.row + 10 / GRID_SIZE) + '%';
		alias1.style.left = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.from.col + 10 / GRID_SIZE) + '%';
		alias1.style.opacity = '1';
		alias1.style.zIndex = '5';
		tileContainer.appendChild(alias1);
		// Second merging alias at original pre-move position
		const alias2 = document.createElement('div');
		alias2.id = `tile-${anim.from2.id}-merge`;
		alias2.className = `tile tile-${anim.from2.value} tile-merging merging`;
		alias2.textContent = anim.from2.value;
		alias2.style.position = 'absolute';
		alias2.style.top = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.from2.row + 10 / GRID_SIZE) + '%';
		alias2.style.left = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.from2.col + 10 / GRID_SIZE) + '%';
		alias2.style.opacity = '1';
		alias2.style.zIndex = '5';
		tileContainer.appendChild(alias2);
		if (aiModeActive && aiMoveDelay < 50) {
			// Instantly move and fade out aliases (no transition)
			const top = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.to.row + 10 / GRID_SIZE) + '%';
			const left = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.to.col + 10 / GRID_SIZE) + '%';
			alias1.style.top = top;
			alias1.style.left = left;
			alias2.style.top = top;
			alias2.style.left = left;
			alias1.style.opacity = '0';
			alias2.style.opacity = '0';
            if (anim.from3) {
                const alias3 = document.getElementById(`tile-${anim.from3.id}-merge`);
                if (alias3) {
                    alias3.style.top = top;
                    alias3.style.left = left;
                    alias3.style.opacity = '0';
                }
            }
			// Remove immediately after a short timeout
			setTimeout(() => {
				if (alias1.parentNode) alias1.parentNode.removeChild(alias1);
				if (alias2.parentNode) alias2.parentNode.removeChild(alias2);
                if (anim.from3) {
                    const alias3 = document.getElementById(`tile-${anim.from3.id}-merge`);
                    if (alias3 && alias3.parentNode) alias3.parentNode.removeChild(alias3);
                }
				const removedOrig = document.getElementById('tile-' + anim.from2.id);
				if (removedOrig && removedOrig.classList.contains('merging')) removedOrig.remove();
                if (anim.from3) {
                    const removedOrig2 = document.getElementById('tile-' + anim.from3.id);
                    if (removedOrig2 && removedOrig2.classList.contains('merging')) removedOrig2.remove();
                }
			}, 30);
		} else {
			// Animate to merged position and fade out
			setTimeout(() => {
				alias1.style.transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s';
				alias2.style.transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s';
				const top = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.to.row + 10 / GRID_SIZE) + '%';
				const left = ((100 - 10 / GRID_SIZE) / GRID_SIZE * anim.to.col + 10 / GRID_SIZE) + '%';
				alias1.style.top = top;
				alias1.style.left = left;
				alias2.style.top = top;
				alias2.style.left = left;
				alias1.style.opacity = '0';
				alias2.style.opacity = '0';
                if (anim.from3) {
                    const alias3 = document.getElementById(`tile-${anim.from3.id}-merge`);
                    if (alias3) {
                        alias3.style.transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s';
                        alias3.style.top = top;
                        alias3.style.left = left;
                        alias3.style.opacity = '0';
                    }
                }
			}, 10);
			setTimeout(() => {
				if (alias1.parentNode) alias1.parentNode.removeChild(alias1);
				if (alias2.parentNode) alias2.parentNode.removeChild(alias2);
                if (anim.from3) {
                    const alias3 = document.getElementById(`tile-${anim.from3.id}-merge`);
                    if (alias3 && alias3.parentNode) alias3.parentNode.removeChild(alias3);
                }
				// Remove only the original tile that was removed as part of the
				// merge (anim.from2). Do NOT remove the merged/kept tile (mergedId)
				// as it should remain in the DOM and show the merged value.
				const removedOrig = document.getElementById('tile-' + anim.from2.id);
				if (removedOrig && removedOrig.classList.contains('merging')) removedOrig.remove();
                if (anim.from3) {
                    const removedOrig2 = document.getElementById('tile-' + anim.from3.id);
                    if (removedOrig2 && removedOrig2.classList.contains('merging')) removedOrig2.remove();
                }
			}, 300);
		}
	});
    mergeAnimations = [];
	// Update score
	document.getElementById('score').textContent = score;
	const highScoreKey = getHighScoreKey(GAME_MODE, practiceMode, GRID_SIZE);
    let highScore = parseInt(localStorage.getItem(highScoreKey) || '0');
    
    const highestTileKey = getHighestTileKey(GAME_MODE, practiceMode, GRID_SIZE);
    let highestTile = parseInt(localStorage.getItem(highestTileKey) || '0');

    for (const t of tiles) {
        if (t.value > highestTile) {
            highestTile = t.value;
        }
    }

    if (score > highScore) {
        highScore = score;
        localStorage.setItem(highScoreKey, highScore);
    }
    localStorage.setItem(highestTileKey, highestTile);
    document.getElementById('high-score').textContent = highScore;

    // Update total score
    const totalScoreKey = 'totalScore';
    let totalScore = parseInt(localStorage.getItem(totalScoreKey) || '0');
    const scoreDelta = score - previousScore;
    if (scoreDelta > 0) {
        totalScore += scoreDelta;
        localStorage.setItem(totalScoreKey, totalScore);
    }
    previousScore = score;

    // Auto-update statistics if menu is visible
    const statisticsMenu = document.getElementById('statistics-menu');
    if (statisticsMenu && !statisticsMenu.classList.contains('hidden')) {
        if (typeof updateStatistics === 'function') {
            updateStatistics();
        }
    }
}

function getHighestTileKey(gameMode, practiceMode, gridSize) {
    return `highestTile-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

function saveState() {
	const newState = {
		grid: grid.map(row => [...row]),
		tiles: tiles.map(t => ({ ...t })),
		score,
		tileIdCounter,
		lastNewTileId,
		hasShownGameWon,
		aiState: {
			aiModeActive,
			aiMoveDelay,
			aiIntervalId
		}
	};
	// Always push a new state after a valid move
	undoStack.push(newState);
	if (undoStack.length > 256) undoStack.shift(); // Limit stack size
	// debug: state pushed
	redoStack = [];
	// debug: redoStack cleared
	updateUndoRedoUI();
}

function restoreState(state) {
	grid = state.grid.map(row => [...row]);
	tiles = state.tiles.map(t => ({ ...t }));
	score = state.score;
	previousScore = score;
	tileIdCounter = state.tileIdCounter;
	lastNewTileId = state.lastNewTileId;
	hasShownGameWon = state.hasShownGameWon;

	// Prevent AI mode from starting on undo/redo
	if (aiModeActive) {
		stopAIMode();
	}
	if (typeof state.aiState !== 'undefined') {
		aiMoveDelay = state.aiState.aiMoveDelay;
		const aiMoveDurationInput = document.getElementById('ai-move-duration-input');
		if (aiMoveDurationInput) {
			aiMoveDurationInput.value = aiMoveDelay;
		}
		// Do NOT start AI mode automatically on restore
		aiModeActive = false;
	}
	updateUI();
	updateGridContainerAnimations();
	updateUndoRedoUI();
}

// Patch move to save state before moving
const originalMove = move;
move = function(direction) {
	// Check if move will change the grid
	let oldGrid = JSON.stringify(grid);
	originalMove(direction);
	let newGrid = JSON.stringify(grid);
	if (oldGrid !== newGrid) {
		saveState();
		redoStack = [];
		updateUndoRedoUI();
	} else {
	// Nothing changed: don't restore previous state to avoid reintroducing
	// transient animation flags (merged/merging). Just skip saving.
	}
};

// Undo button

const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const practiceModeToggle = document.getElementById('practice-mode-toggle');

function updateUndoRedoUI() {
	const undoCounter = document.getElementById('undo-counter');
	const redoCounter = document.getElementById('redo-counter');
	if (undoCounter) undoCounter.textContent = Math.max(0, undoStack.length - 1);
	if (redoCounter) redoCounter.textContent = redoStack.length;
	if (undoButton) undoButton.disabled = undoStack.length <= 1;
	if (redoButton) redoButton.disabled = redoStack.length === 0;
}

function setUndoRedoEnabled(enabled) {
	if (undoButton) undoButton.disabled = !enabled;
	if (redoButton) redoButton.disabled = !enabled;
}

function clearUndoRedoStacks() {
	undoStack = [];
	redoStack = [];
	updateUndoRedoUI();
}

function clearHistory() {
    clearUndoRedoStacks();
    clearGameState();
}

function handlePracticeModeChange() {
	const enabled = practiceModeToggle && practiceModeToggle.checked;
	practiceMode = enabled; // Update the global practiceMode variable
	setUndoRedoEnabled(enabled);
	// Do NOT clear history on toggle, initGrid will handle state restoration
	// clearHistory(); // Removed
	initGrid();
	saveSettings(); // Save settings after changing practice mode
	// Show/hide undo/redo buttons
	if (undoButton) {
		if (enabled) undoButton.classList.remove('hidden');
		else undoButton.classList.add('hidden');
	}
	if (redoButton) {
		if (enabled) redoButton.classList.remove('hidden');
		else redoButton.classList.add('hidden');
	}
	if (!enabled) {
		clearUndoRedoStacks();
	}
}

if (undoButton) {
	undoButton.addEventListener('click', function () {
		if (practiceModeToggle && !practiceModeToggle.checked) return;
		if (undoStack.length > 1) {
			redoStack.push(undoStack.pop());
			restoreState(undoStack[undoStack.length - 1]);
			const gameOverContainer = document.getElementById('game-over-container');
			if (gameOverContainer) gameOverContainer.classList.add('hidden');
			updateUndoRedoUI();
		}
	});
	undoButton.addEventListener('touchstart', function (event) {
		event.preventDefault();
		if (practiceModeToggle && !practiceModeToggle.checked) return;
		if (undoStack.length > 1) {
			redoStack.push(undoStack.pop());
			restoreState(undoStack[undoStack.length - 1]);
			const gameOverContainer = document.getElementById('game-over-container');
			if (gameOverContainer) gameOverContainer.classList.add('hidden');
			updateUndoRedoUI();
		}
	});
}
if (redoButton) {
	redoButton.addEventListener('click', function () {
		if (practiceModeToggle && !practiceModeToggle.checked) return;
		if (redoStack.length > 0) {
			const state = redoStack.pop();
			undoStack.push(state);
			restoreState(state);
			if (isGameOver()) {
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.remove('hidden');
			}
			updateUndoRedoUI();
		}
	});
	redoButton.addEventListener('touchstart', function (event) {
		event.preventDefault();
		if (practiceModeToggle && !practiceModeToggle.checked) return;
		if (redoStack.length > 0) {
			const state = redoStack.pop();
			undoStack.push(state);
			restoreState(state);
			if (isGameOver()) {
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.remove('hidden');
			}
			updateUndoRedoUI();
		}
	});
}
if (practiceModeToggle) {
	practiceModeToggle.addEventListener('change', handlePracticeModeChange);
	practiceModeToggle.addEventListener('touchstart', function (event) {
		event.preventDefault();
		handlePracticeModeChange();
	});
}

// Restart button
const restartButton = document.getElementById('restart-button');
if (restartButton) {
	restartButton.addEventListener('click', function () {
		stopAIMode();
		clearGameState(); // Clear saved state on restart
		initGrid();
	});
	restartButton.addEventListener('touchstart', function (event) {
		event.preventDefault();
		stopAIMode();
		clearGameState(); // Clear saved state on restart
		initGrid();
	});
}

document.addEventListener('DOMContentLoaded', function () {
	const gameOverRestart = document.getElementById('game-over-restart');
	if (gameOverRestart) {
		gameOverRestart.addEventListener('click', function () {
			stopAIMode();
			clearGameState(); // Clear saved state on restart
			initGrid();
		});
		gameOverRestart.addEventListener('touchstart', function (event) {
		event.preventDefault();
		stopAIMode();
		clearGameState(); // Clear saved state on restart
		initGrid();
		});
	}

	const gameWonRestart = document.getElementById('game-won-restart');
	if (gameWonRestart) {
		gameWonRestart.addEventListener('click', function () {
			stopAIMode();
			clearGameState(); // Clear saved state on restart
			initGrid();
		});
		gameWonRestart.addEventListener('touchstart', function (event) {
		event.preventDefault();
		stopAIMode();
		clearGameState(); // Clear saved state on restart
		initGrid();
		});
	}

	const gameWonKeepGoing = document.getElementById('game-won-keep-going');
	if (gameWonKeepGoing) {
		gameWonKeepGoing.addEventListener('click', function () {
			const gameWonContainer = document.getElementById('game-won-container');
			if (gameWonContainer) gameWonContainer.classList.add('hidden');
		});
		gameWonKeepGoing.addEventListener('touchstart', function (event) {
		event.preventDefault();
		const gameWonContainer = document.getElementById('game-won-container');
			if (gameWonContainer) gameWonContainer.classList.add('hidden');
		});
	}
});

// Modes overlay handlers
(function() {
	const modeButton = document.getElementById('mode-button');
    const modesMenu = document.getElementById('modes-menu');
    const closeModes = document.getElementById('close-modes-menu');
	const aiOptionButton = document.getElementById('ai-option-button');
	const aiOptionsMenu = document.getElementById('ai-options-menu');
	const closeAiOptions = document.getElementById('close-ai-options-menu');
	const statisticsButton = document.getElementById('statistics-button');
	const statisticsMenu = document.getElementById('statistics-menu');
	const closeStatistics = document.getElementById('close-statistics-menu');
	const aboutButton = document.getElementById('about-button');
	const aboutMenu = document.getElementById('about-menu');
	const closeAbout = document.getElementById('close-about-menu');
    const overlayBackdrop = document.getElementById('overlay-backdrop');

    function showModesMenu() {
        if (modesMenu && overlayBackdrop) {
            modesMenu.classList.remove('hidden');
            overlayBackdrop.classList.remove('hidden');
			gameContainer.classList.add('covered');
        }
    }

    function hideModesMenu() {
        if (modesMenu && overlayBackdrop) {
            modesMenu.classList.add('hidden');
            overlayBackdrop.classList.add('hidden');
			gameContainer.classList.remove('covered');
        }
    }

	function showAiOptionsMenu() {
		if (aiOptionsMenu && overlayBackdrop) {
			aiOptionsMenu.classList.remove('hidden');
			overlayBackdrop.classList.remove('hidden');
			gameContainer.classList.add('covered');
		}
	}

	function hideAiOptionsMenu() {
		if (aiOptionsMenu && overlayBackdrop) {
			aiOptionsMenu.classList.add('hidden');
			overlayBackdrop.classList.add('hidden');
			gameContainer.classList.remove('covered');
		}
	}

	function showStatisticsMenu() {
		if (statisticsMenu && overlayBackdrop) {
			statisticsMenu.classList.remove('hidden');
			overlayBackdrop.classList.remove('hidden');
			gameContainer.classList.add('covered');
		}
	}

	function hideStatisticsMenu() {
		if (statisticsMenu && overlayBackdrop) {
			statisticsMenu.classList.add('hidden');
			overlayBackdrop.classList.add('hidden');
			gameContainer.classList.remove('covered');
		}
	}

	function showAboutMenu() {
		if (aboutMenu && overlayBackdrop) {
			aboutMenu.classList.remove('hidden');
			overlayBackdrop.classList.remove('hidden');
			gameContainer.classList.add('covered');
		}
	}

	function hideAboutMenu() {
		if (aboutMenu && overlayBackdrop) {
			aboutMenu.classList.add('hidden');
			overlayBackdrop.classList.add('hidden');
			gameContainer.classList.remove('covered');
		}
	}

    if (closeModes) closeModes.addEventListener('click', hideModesMenu);
    if (overlayBackdrop) {
        overlayBackdrop.addEventListener('click', function () {
            hideModesMenu();
			hideAiOptionsMenu();
            hideStatisticsMenu();
            hideAboutMenu();
        });
        overlayBackdrop.addEventListener('touchstart', function (event) {
            event.preventDefault();
            hideModesMenu();
			hideAiOptionsMenu();
			hideStatisticsMenu();
            hideAboutMenu();
        });
    }

    if (modeButton) {
		modeButton.addEventListener('click', showModesMenu);
        modeButton.addEventListener('touchstart', function (event) {
            event.preventDefault();
            showModesMenu();
        });
    }

	if (aiOptionButton) {
		aiOptionButton.addEventListener('click', showAiOptionsMenu);
		aiOptionButton.addEventListener('touchstart', function (event) {
			event.preventDefault();
			showAiOptionsMenu();
		});
	}

	if (statisticsButton) {
        statisticsButton.addEventListener('click', showStatisticsMenu);
        statisticsButton.addEventListener('touchstart', function (event) {
            event.preventDefault();
            showStatisticsMenu();
        });
    }

	if (aboutButton) {
		aboutButton.addEventListener('click', showAboutMenu);
        aboutButton.addEventListener('touchstart', function (event) {
            event.preventDefault();
            showAboutMenu();
        });
    }

	if (closeAiOptions) closeAiOptions.addEventListener('click', hideAiOptionsMenu);
	if (closeStatistics) closeStatistics.addEventListener('click', hideStatisticsMenu);
	if (closeAbout) closeAbout.addEventListener('click', hideAboutMenu);
	if (overlayBackdrop) overlayBackdrop.addEventListener('click', hideAiOptionsMenu);
	if (aboutButton) aboutButton.addEventListener('click', showAboutMenu);

    // Close with ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideModesMenu();
			hideAiOptionsMenu();
			hideStatisticsMenu();
			hideAboutMenu();
        }

		// Handle Ctrl+Z for undo and Ctrl+Y for redo
		if (e.ctrlKey || e.metaKey) { // Check for Ctrl on Windows/Linux or Command on Mac
            if (e.key === 'z' || e.key === 'Z') {
                if (practiceModeToggle && practiceModeToggle.checked && undoStack.length > 1) {
                    redoStack.push(undoStack.pop());
                    restoreState(undoStack[undoStack.length - 1]);
                    const gameOverContainer = document.getElementById('game-over-container');
                    if (gameOverContainer) gameOverContainer.classList.add('hidden');
					updateUndoRedoUI();
                }
                e.preventDefault();
            } else if (e.key === 'y' || e.key === 'Y') {
                if (practiceModeToggle && practiceModeToggle.checked && redoStack.length > 0) {
                    const state = redoStack.pop();
                    undoStack.push(state);
                    restoreState(state);
                    if (isGameOver()) {
                        const gameOverContainer = document.getElementById('game-over-container');
                        if (gameOverContainer) gameOverContainer.classList.remove('hidden');
                    }
					updateUndoRedoUI();
                }
                e.preventDefault();
            }
        }

		if (modesMenu.classList.contains('hidden') && aiOptionsMenu.classList.contains('hidden') && aboutMenu.classList.contains('hidden')) {
			switch (e.key) {
				case 'ArrowLeft':
				case 'a':
					move(0); // Left
					e.preventDefault();
					break;
				case 'ArrowDown':
				case 's':
					move(1); // Down
					e.preventDefault();
					break;
				case 'ArrowRight':
				case 'd':
					move(2); // Right
					e.preventDefault();
					break;
				case 'ArrowUp':
				case 'w':
					move(3); // Up
					e.preventDefault();
					break;
			}
		}
    });

	// Touch event listeners for swipe gestures
	let touchStartX = 0;
	let touchStartY = 0;
	const gameContainer = document.getElementById('game-container');

	if (gameContainer) {
		gameContainer.addEventListener('touchstart', function (e) {
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			e.preventDefault();
		}, { passive: false });

		gameContainer.addEventListener('touchmove', function (e) {
			e.preventDefault();
		}, { passive: false });

		gameContainer.addEventListener('touchend', function (e) {
			if (modesMenu.classList.contains('hidden') && aiOptionsMenu.classList.contains('hidden') && aboutMenu.classList.contains('hidden')) {
				const touchEndX = e.changedTouches[0].clientX;
				const touchEndY = e.changedTouches[0].clientY;

				const dx = touchEndX - touchStartX;
				const dy = touchEndY - touchStartY;

				const absDx = Math.abs(dx);
				const absDy = Math.abs(dy);

				if (Math.max(absDx, absDy) > 10) { // Minimum swipe distance
					if (absDx > absDy) {
						// Horizontal swipe
						if (dx > 0) {
							move(2); // Right
						} else {
							move(0); // Left
						}
					} else {
						// Vertical swipe
						if (dy > 0) {
							move(1); // Down
						} else {
							move(3); // Up
						}
					}
				}
			}
			e.preventDefault();
		});
	}
})();

// Grid size change handler
const gridSizeDropdown = document.getElementById('grid-size-select');
if (gridSizeDropdown) {
	gridSizeDropdown.addEventListener('change', function () {
		const newSize = parseInt(gridSizeDropdown.value, 10);
		if (!isNaN(newSize) && newSize > 1 && newSize <= 8) {
			GRID_SIZE = newSize;
			document.documentElement.style.setProperty('--grid-size', GRID_SIZE);
			initGrid();
			updateGoalDisplay();
			saveSettings(); // Save settings after changing grid size
		}
	});
}

// Update goal display on initial load
window.onload = function() {
    loadSettings(); // Load settings once on initial page load
    initGrid();
    updateGoalDisplay();
};

// AI Strategies

const AI_STRATEGIES = {
	'random': {
		name: 'Random',
		getMove: function() {
			// Pick a random valid move direction
			const dirs = [0, 1, 2, 3];
			const valid = dirs.filter(canMove);
			if (valid.length === 0) return 0;
			return valid[Math.floor(Math.random() * valid.length)];
		}
	},
	'corner': {
		name: 'Corner',
		getMove: (function() {
			let state = 'primary'; // 'primary' (left/up) or 'recovery' (right/up)
			let lastPrimary = 'up';
			let lastRecovery = 'up';

			return function() {
				const canLeft = canMove(0);
				const canUp = canMove(3);
				const canRight = canMove(2);
				const canDown = canMove(1);

				// Determine current state based on available moves
				if (state === 'primary' && !canLeft && !canUp) {
					state = 'recovery';
				} else if (state === 'recovery' && !canRight && !canUp) {
					state = 'primary';
				}

				// Execute move based on the determined state
				if (state === 'primary') {
					// Alternate between left and up
					if (lastPrimary === 'up' && canLeft) {
						lastPrimary = 'left';
						return 0; // Move Left
					}
					if (canUp) {
						lastPrimary = 'up';
						return 3; // Move Up
					}
					if (canLeft) { // Fallback if only left is possible
						lastPrimary = 'left';
						return 0; // Move Left
					}
				}

				if (state === 'recovery') {
					// Alternate between right and up
					if (lastRecovery === 'up' && canRight) {
						lastRecovery = 'right';
						return 2; // Move Right
					}
					if (canUp) {
						lastRecovery = 'up';
						return 3; // Move Up
					}
					if (canRight) { // Fallback if only right is possible
						lastRecovery = 'right';
						return 2; // Move Right
					}
				}

				// Last resort if no moves in the current or switched state are possible
				if (canDown) {
					return 1; // Move Down
				}

				// Should only be reached if game is over
				return 0;
			};
		})()
	},
	'swirl': {
		name: 'Swirl',
		getMove: (function() {
			let idx = 0;
			const order = [3, 2, 1, 0]; // up, right, down, left
			return function() {
				for (let i = 0; i < 4; i++) {
					const dir = order[(idx + i) % 4];
					if (canMove(dir)) {
						idx = (idx + 1) % 4;
						return dir;
					}
				}
				return 0;
			};
		})()
	},
	'swing': {
		name: 'Swing',
		getMove: (function() {
			let state = 'primary'; // 'primary' (up/down) or 'recovery' (left/right)
			let lastPrimary = 'down';
			let lastRecovery = 'right';

			return function() {
				const canUp = canMove(3);
				const canDown = canMove(1);
				const canLeft = canMove(0);
				const canRight = canMove(2);

				// Prioritize returning to primary state if possible
				if (state === 'recovery' && !canLeft && !canRight) {
					state = 'primary';
				}
				
				// Switch to recovery if primary moves are not possible
				if (state === 'primary' && !canUp && !canDown) {
					state = 'recovery';
				}

				if (state === 'primary') {
					// Alternate between up and down
					if (lastPrimary === 'down' && canUp) {
						lastPrimary = 'up';
						return 3; // Move Up
					}
					if (canDown) {
						lastPrimary = 'down';
						return 1; // Move Down
					}
					if (canUp) { // Fallback if only up is possible
						lastPrimary = 'up';
						return 3; // Move Up
					}
				}

				if (state === 'recovery') {
					// Alternate between left and right
					if (lastRecovery === 'right' && canLeft) {
						lastRecovery = 'left';
						return 0; // Move Left
					}
					if (canRight) {
						lastRecovery = 'right';
						return 2; // Move Right
					}
					if (canLeft) { // Fallback if only left is possible
						lastRecovery = 'left';
						return 0; // Move Left
					}
				}
				
				// Last resort if no moves are possible
				return Math.floor(Math.random() * 4);
			};
		})()
	}
};

let aiStrategy = 'random';

function canMove(direction) {
	// Simulate a move and see if it changes the grid
	let testGrid = grid.map(row => [...row]);
	let testTiles = tiles.map(t => ({ ...t }));
	let before = JSON.stringify(testGrid);
	// Use a copy of move logic, but don't update real state
	// Only check if any tile would move or merge
	// We'll use operate/slide/combine logic, but on testGrid/testTiles
	// For brevity, just check if any row/col would change
	function testOperate(row) {
		let afterFirstSlide = slide(row);
		let combineResult = combineTest(row);
		let afterSecondSlide = slide(combineResult.row);
		return JSON.stringify(row) !== JSON.stringify(afterSecondSlide);
	}
	function combineTest(row) {
		let rowChanged = false;
		if (GAME_MODE === 'fibonacci') {
			const fibSeq = getFibonacciSequence(Math.pow(2, 20));
			for (let i = 0; i < GRID_SIZE - 1; i++) {
				const a = row[i], b = row[i + 1];
				if (a && b) {
					const tileA = testTiles.find(t => t.id === a);
					const tileB = testTiles.find(t => t.id === b);
					if (tileA && tileB && areFibonacciMergeable(tileA.value, tileB.value, fibSeq)) {
						row[i] = a;
						row[i + 1] = null;
						// Simulate the merge for subsequent checks in the same row
						const mergedValue = tileA.value + tileB.value;
						const originalTileAValue = tileA.value;
						tileA.value = mergedValue;
						rowChanged = true;
						i++;
						// Restore value after check to not affect other directions
						setTimeout(() => tileA.value = originalTileAValue, 0);
					}
				}
			}
			return { row, rowChanged };
		}
		if (GAME_MODE === 'power-of-three') {
			for (let i = 0; i < GRID_SIZE - 2; i++) {
				const a = row[i], b = row[i + 1], c = row[i + 2];
				if (a && b && c) {
					const tileA = testTiles.find(t => t.id === a);
					const tileB = testTiles.find(t => t.id === b);
					const tileC = testTiles.find(t => t.id === c);
					if (tileA && tileB && tileC && tileA.value === tileB.value && tileA.value === tileC.value) {
						row[i] = a;
						row[i + 1] = null;
						row[i + 2] = null;
						tileA.value *= 3;
						rowChanged = true;
						i += 2;
					}
				}
			}
			return { row, rowChanged };
		}
		for (let i = 0; i < GRID_SIZE - 1; i++) {
			const a = row[i], b = row[i + 1];
			if (a && b) {
				const tileA = testTiles.find(t => t.id === a);
				const tileB = testTiles.find(t => t.id === b);
				if (tileA && tileB && tileA.value === tileB.value) {
					row[i] = a;
					row[i + 1] = null;
					tileA.value *= 2;
					rowChanged = true;
					i++;
				}
			}
		}
		return { row, rowChanged };
	}
	// Rotate testGrid as in move()
	let g = testGrid.map(row => [...row]);
	for (let i = 0; i < direction; i++) g = rotateGrid(g);
	let changed = false;
	for (let r = 0; r < GRID_SIZE; r++) {
		if (testOperate(g[r])) changed = true;
	}
	for (let i = 0; i < (4 - direction) % 4; i++) g = rotateGrid(g);
	if (JSON.stringify(g) !== before) return true;
	return changed;
}

function updateGridContainerAnimations() {
	const gridContainer = document.querySelector('.grid-container');
	if (!gridContainer) return;
	if (aiModeActive && aiMoveDelay < 50) {
		gridContainer.classList.add('no-animations');
	} else {
		gridContainer.classList.remove('no-animations');
	}
}

// (Removed duplicate undo/redo patch handlers to avoid double-undo)

function startAIMode() {
	if (aiModeActive) return;
	const aiMoveDurationInput = document.getElementById('ai-move-duration-input');
	if (aiMoveDurationInput) {
		let val = parseInt(aiMoveDurationInput.value, 10);
		if (!isNaN(val) && val > 0) {
			aiMoveDelay = val;
		}
		aiMoveDurationInput.value = aiMoveDelay;
	}
	aiModeActive = true;
	updateGridContainerAnimations();
	aiIntervalId = setInterval(() => {
		if (!aiModeActive) return;
		let direction = 0;
		if (AI_STRATEGIES[aiStrategy]) {
			direction = AI_STRATEGIES[aiStrategy].getMove();
		} else {
			direction = Math.floor(Math.random() * 4);
		}
		move(direction);
	}, aiMoveDelay);
}

function stopAIMode() {
	aiModeActive = false;
	if (aiIntervalId) {
		clearInterval(aiIntervalId);
		aiIntervalId = null;
	}
	updateGridContainerAnimations();
	const aiStatus = document.getElementById('ai-status');
	if (aiStatus) aiStatus.textContent = 'AI Mode: Off';
	const aiToggleButtonIcon = document.getElementById('ai-toggle-button-icon');
	if (aiToggleButtonIcon) aiToggleButtonIcon.className = 'fas fa-play';
}

// Example: wire up AI controls (customize IDs as needed)
document.addEventListener('DOMContentLoaded', function () {
	const aiToggleButton = document.getElementById('ai-toggle-button');
	const aiToggleButtonIcon = document.getElementById('ai-toggle-button-icon');
	const aiStatus = document.getElementById('ai-status');
	const aiMoveDurationInput = document.getElementById('ai-move-duration-input');

	function updateAIToggleButton() {
		if (aiToggleButton && aiToggleButtonIcon && aiStatus) {
			if (aiModeActive) {
				aiToggleButton.title = 'Stop AI Mode';
				aiToggleButtonIcon.className = 'fas fa-stop';
				aiStatus.textContent = 'AI Mode: On';
			} else {
				aiToggleButton.title = 'Start AI Mode';
				aiToggleButtonIcon.className = 'fas fa-play';
				aiStatus.textContent = 'AI Mode: Off';
			}
		}
	}

	if (aiToggleButton) {
		aiToggleButton.addEventListener('click', function () {
			if (!aiModeActive) {
				let val = parseInt(aiMoveDurationInput.value, 10);
				if (!isNaN(val) && val > 0) aiMoveDelay = val;
				startAIMode();
			} else {
				stopAIMode();
			}
			updateAIToggleButton();
		});
		aiToggleButton.addEventListener('touchstart', function (event) {
			event.preventDefault();
			if (!aiModeActive) {
				let val = parseInt(aiMoveDurationInput.value, 10);
				if (!isNaN(val) && val > 0) aiMoveDelay = val;
				startAIMode();
			} else {
				stopAIMode();
			}
			updateAIToggleButton();
		});
		updateAIToggleButton();
	}

	aiMoveDurationInput.addEventListener('change', function () {
		let val = parseInt(aiMoveDurationInput.value, 10);
		if (!isNaN(val) && val > 0) {
			aiMoveDelay = val;
			if (aiModeActive) {
				stopAIMode();
				startAIMode();
			}
			saveSettings();
		}
	});
	if (aiMoveDurationInput) {
		aiMoveDurationInput.addEventListener('input', function () {
			let val = parseInt(aiMoveDurationInput.value, 10);
			if (!isNaN(val) && val > 0) aiMoveDelay = val;
			else aiMoveDelay = 100;
			updateGridContainerAnimations();
		});
	}

	const aiStrategySelect = document.getElementById('ai-strategy-select');
	if (aiStrategySelect) {
		// Set initial strategy from dropdown on load
		// aiStrategy = aiStrategySelect.value;
		// Update strategy when the user changes the selection
		aiStrategySelect.addEventListener('change', function() {
			aiStrategy = this.value;
			saveSettings();
		});
	}
}); // This closes the DOMContentLoaded event listener

// Listen for game mode changes
const gameModeDropdown = document.getElementById('game-mode-select');
if (gameModeDropdown) {
    gameModeDropdown.addEventListener('change', function () {
        GAME_MODE = gameModeDropdown.value;
        initGrid();
        updateGoalDisplay(); // Ensure goal updates when mode changes
		saveSettings(); // Save settings after changing game mode
    });
    GAME_MODE = gameModeDropdown.value;
}

// Initialize grid and UI
initGrid();
updateGoalDisplay();
