// 2048 Game Logic
let GRID_SIZE = 4;
let grid = [];
let score = 0;
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

function initGrid() {
	generateGridCells();
	grid = Array(GRID_SIZE)
		.fill()
		.map(() => Array(GRID_SIZE).fill(null));
	tiles = [];
	tileIdCounter = 1;
	score = 0;
	hasShownGameWon = false;
	addRandomTile();
	addRandomTile();
	updateUI();
	// Hide game over container
	const gameOverContainer = document.getElementById('game-over-container');
	if (gameOverContainer) gameOverContainer.classList.add('hidden');
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
                tileA.value = tileA.value + tileB.value;
                tileA.merged = true;
                score += tileA.value;
                const tileBEl = document.getElementById('tile-' + tileB.id);
                if (tileBEl) tileBEl.remove();
                grid[tileB.row][tileB.col] = null;
                tiles = tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
        return { row, rowChanged };
    }
    for (let i = 0; i < GRID_SIZE - 1; i++) {
        const tileA = row[i] ? getTileById(row[i]) : null;
        const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
        if (tileA && tileB && tileA.value === tileB.value) {
            if (tileA.merged || tileB.merged) continue; // Prevent double merges
            tileA.value *= 2;
            tileA.merged = true;
            score += tileA.value;
            const tileBEl = document.getElementById('tile-' + tileB.id);
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

function operate(row) {
    let rowChanged = false;

    const afterFirstSlide = slide(row);
    if (JSON.stringify(afterFirstSlide) !== JSON.stringify(row)) {
        rowChanged = true; // sliding changed the row
    }

    row = afterFirstSlide;
    const combineResult = combine(row);
    row = combineResult.row;
    if (combineResult.rowChanged) rowChanged = true;

    const afterSecondSlide = slide(row);
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

function updateUI() {
    console.log("Updating UI with grid:", grid);
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
			if (!tile.classList.contains(`tile-${t.value}`)) {
				tile.className = `tile tile-${t.value}`;
			}
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
	lastNewTileId = null;
	// Update score
	document.getElementById('score').textContent = score;
	// Optionally update best score
	let best = localStorage.getItem('bestScore') || 0;
	if (score > best) {
		best = score;
		localStorage.setItem('bestScore', best);
	}
	document.getElementById('best-score').textContent = best;
}

function saveState() {
	undoStack.push({
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
	});
	if (undoStack.length > 100) undoStack.shift(); // Limit stack size
	redoStack = [];
}

function restoreState(state) {
	grid = state.grid.map(row => [...row]);
	tiles = state.tiles.map(t => ({ ...t }));
	score = state.score;
	tileIdCounter = state.tileIdCounter;
	lastNewTileId = state.lastNewTileId;
	hasShownGameWon = state.hasShownGameWon;

	// Handle AI state restoration
	if (state.aiState) {
		// Stop current AI mode if active
		if (aiModeActive) {
			stopAIMode();
		}
		
		// Set the AI move delay first
		aiMoveDelay = state.aiState.aiMoveDelay;
		const aiMoveDurationInput = document.getElementById('ai-move-duration-input');
		if (aiMoveDurationInput) {
			aiMoveDurationInput.value = aiMoveDelay;
		}

		// Restore AI mode if it was active
		if (state.aiState.aiModeActive) {
			startAIMode();
		}
	}
	
	updateUI();
	updateGridContainerAnimations();
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
	} else {
		// Nothing changed: don't restore previous state to avoid reintroducing
		// transient animation flags (merged/merging). Just skip saving.
		console.log('Move had no effect; no state saved.');
	}
};

// Undo button
const undoButton = document.getElementById('undo-button');
if (undoButton) {
	undoButton.addEventListener('click', function () {
		if (undoStack.length > 1) {
			// Only pop one state and restore the previous
			const prevState = undoStack[undoStack.length - 2];
			redoStack.push(undoStack.pop());
			restoreState(prevState);
			// Hide game over screen if visible
			const gameOverContainer = document.getElementById('game-over-container');
			if (gameOverContainer) gameOverContainer.classList.add('hidden');
			// Do NOT call updateGridContainerAnimations here
		}
	});
}

// Redo button
const redoButton = document.getElementById('redo-button');
if (redoButton) {
	redoButton.addEventListener('click', function () {
		if (redoStack.length > 0) {
			const state = redoStack.pop();
			undoStack.push(state);
			restoreState(state);
			// Show game over container if the restored state is game over
			if (isGameOver()) {
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.remove('hidden');
			}
			// Do NOT call updateGridContainerAnimations here
		}
	});
}

// Reset button
const resetButton = document.getElementById('reset-button');
if (resetButton) {
	resetButton.addEventListener('click', function () {
		clearHistory();
		initGrid();
		saveState();
	});
}

function clearHistory() {
	undoStack = [];
	redoStack = [];
}

// Save initial state after grid is initialized
const originalInitGrid = initGrid;
initGrid = function() {
	originalInitGrid();
	saveState();
};

function generateGridCells() {
	const gridContainerInner = document.querySelector('.grid-container-inner');
	if (!gridContainerInner) return;
	// Remove all existing grid cells
	while (gridContainerInner.firstChild) {
		gridContainerInner.removeChild(gridContainerInner.firstChild);
	}
	// Generate new grid cells
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			const cell = document.createElement('div');
			cell.className = 'grid-cell';
			cell.id = `cell-${r}-${c}`;
			gridContainerInner.appendChild(cell);
		}
	}
	// Update CSS variable
	const gridContainer = document.querySelector('.grid-container');
	if (gridContainer) {
		gridContainer.style.setProperty('--grid-size', GRID_SIZE);
	}
}

// Call generateGridCells whenever grid size changes
const originalInitGrid2 = initGrid;
initGrid = function() {
	generateGridCells();
	originalInitGrid2();
};

document.addEventListener('keydown', function (e) {
	// Prevent scrolling for movement keys only
	if (["ArrowLeft","ArrowUp","ArrowRight","ArrowDown","w","a","s","d","W","A","S","D"].includes(e.key)) {
		e.preventDefault();
	}

	// Movement keys
	switch (e.key) {
		case 'ArrowLeft':
		case 'a':
		case 'A':
			move(0); // left
			break;
		case 'ArrowUp':
		case 'w':
		case 'W':
			move(3); // up
			break;
		case 'ArrowRight':
		case 'd':
		case 'D':
			move(2); // right
			break;
		case 'ArrowDown':
		case 's':
		case 'S':
			move(1); // down
			break;
	}

	// Undo/Redo shortcuts
	if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
		if (e.key === 'z' || e.key === 'Z') {
			if (undoStack.length > 1) {
				const prevState = undoStack[undoStack.length - 2];
				redoStack.push(undoStack.pop());
				restoreState(prevState);
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.add('hidden');
			}
		} else if (e.key === 'y' || e.key === 'Y') {
			if (redoStack.length > 0) {
				const state = redoStack.pop();
				undoStack.push(state);
				restoreState(state);
				// Show game over container if the restored state is game over
				if (isGameOver()) {
					const gameOverContainer = document.getElementById('game-over-container');
					if (gameOverContainer) gameOverContainer.classList.remove('hidden');
				}
			}
		}
	}
});

// Touch swipe support
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function (e) {
	if (e.touches.length === 1) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}
});

document.addEventListener('touchend', function (e) {
	if (e.changedTouches.length === 1) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
			if (Math.abs(dx) > Math.abs(dy)) {
				if (dx > 0) {
					move(2); // swipe right
				} else {
					move(0); // swipe left
				}
			} else {
				if (dy > 0) {
					move(1); // swipe down
				} else {
					move(3); // swipe up
				}
			}
		}
	}
});

document.addEventListener('DOMContentLoaded', function () {
	const restartButton = document.getElementById('restart-button');
	if (restartButton) {
		restartButton.addEventListener('click', function () {
			clearHistory();
			initGrid();
		});
	}

	const gameWonRestart = document.getElementById('game-won-restart');
	if (gameWonRestart) {
		gameWonRestart.addEventListener('click', function () {
			const gameWonContainer = document.getElementById('game-won-container');
			if (gameWonContainer) gameWonContainer.classList.add('hidden');
			clearHistory();
			initGrid();
		});
	}

	const gameWonKeepGoing = document.getElementById('game-won-keep-going');
	if (gameWonKeepGoing) {
		gameWonKeepGoing.addEventListener('click', function () {
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
    const overlayBackdrop = document.getElementById('overlay-backdrop');

    function showModesMenu() {
        if (modesMenu && overlayBackdrop) {
            modesMenu.classList.remove('hidden');
            overlayBackdrop.classList.remove('hidden');
        }
    }

    function hideModesMenu() {
        if (modesMenu && overlayBackdrop) {
            modesMenu.classList.add('hidden');
            overlayBackdrop.classList.add('hidden');
        }
    }

	function showAiOptionsMenu() {
		if (aiOptionsMenu && overlayBackdrop) {
			aiOptionsMenu.classList.remove('hidden');
			overlayBackdrop.classList.remove('hidden');
		}
	}

	function hideAiOptionsMenu() {
		if (aiOptionsMenu && overlayBackdrop) {
			aiOptionsMenu.classList.add('hidden');
			overlayBackdrop.classList.add('hidden');
		}
	}

    if (modeButton) modeButton.addEventListener('click', showModesMenu);
    if (closeModes) closeModes.addEventListener('click', hideModesMenu);
    if (overlayBackdrop) overlayBackdrop.addEventListener('click', hideModesMenu);
	if (aiOptionButton) aiOptionButton.addEventListener('click', showAiOptionsMenu);
	if (closeAiOptions) closeAiOptions.addEventListener('click', hideAiOptionsMenu);
	if (overlayBackdrop) overlayBackdrop.addEventListener('click', hideAiOptionsMenu);

    // Close with ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideModesMenu();
			hideAiOptionsMenu();
        }
    });
})();

// Grid size change handler
const gridSizeDropdown = document.getElementById('grid-size-select');
if (gridSizeDropdown) {
	gridSizeDropdown.addEventListener('change', function () {
		const newSize = parseInt(gridSizeDropdown.value, 10);
		if (!isNaN(newSize) && newSize > 1 && newSize <= 8) {
			GRID_SIZE = newSize;
			clearHistory();
			initGrid();
			updateGoalDisplay();
		}
	});
}

// Update goal display on initial load
window.onload = function() {
    initGrid();
    updateGoalDisplay();
};

// AI mode functions
function updateGridContainerAnimations() {
	const gridContainer = document.querySelector('.grid-container');
	if (!gridContainer) return;
	if (aiModeActive && aiMoveDelay < 50) {
		gridContainer.classList.add('no-animations');
	} else {
		gridContainer.classList.remove('no-animations');
	}
}

// Patch undo/redo to NOT call updateGridContainerAnimations
if (undoButton) {
	undoButton.addEventListener('click', function () {
		if (undoStack.length > 1) {
			const prevState = undoStack[undoStack.length - 2];
			redoStack.push(undoStack.pop());
			restoreState(prevState);
			const gameOverContainer = document.getElementById('game-over-container');
			if (gameOverContainer) gameOverContainer.classList.add('hidden');
			// Do NOT call updateGridContainerAnimations here
		}
	});
}

if (redoButton) {
	redoButton.addEventListener('click', function () {
		if (redoStack.length > 0) {
			const state = redoStack.pop();
			undoStack.push(state);
			restoreState(state);
			if (isGameOver()) {
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.remove('hidden');
			}
			// Do NOT call updateGridContainerAnimations here
		}
	});
}

function startAIMode() {
	if (aiModeActive) return;
	const aiMoveDurationInput = document.getElementById('ai-move-duration-input');
	if (aiMoveDurationInput) {
		let val = parseInt(aiMoveDurationInput.value, 10);
		if (!isNaN(val) && val > 0) {
			aiMoveDelay = val;
		}
		// Always keep input value in sync with actual delay
		aiMoveDurationInput.value = aiMoveDelay;
	}
	aiModeActive = true;
	updateGridContainerAnimations();
	aiIntervalId = setInterval(() => {
		if (!aiModeActive) return;
		const direction = Math.floor(Math.random() * 4);
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
				else aiMoveDelay = 100;
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
});

// Listen for game mode changes
const gameModeDropdown = document.getElementById('game-mode-select');
if (gameModeDropdown) {
    gameModeDropdown.addEventListener('change', function () {
        GAME_MODE = gameModeDropdown.value;
        clearHistory();
        initGrid();
        updateGoalDisplay(); // Ensure goal updates when mode changes
    });
    GAME_MODE = gameModeDropdown.value;
}
