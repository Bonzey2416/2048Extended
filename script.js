// 2048 Game Logic
const GRID_SIZE = 4;
let grid = [];
let score = 0;
let tiles = [];
let tileIdCounter = 1;
let lastNewTileId = null;
let hasShownGameWon = false;

// Undo/Redo support
let undoStack = [];
let redoStack = [];

function initGrid() {
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
	const value = Math.random() < 0.9 ? 2 : 4;
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

function combine(row) {
	for (let i = 0; i < GRID_SIZE - 1; i++) {
		const tileA = row[i] ? getTileById(row[i]) : null;
		const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
		if (tileA && tileB && tileA.value === tileB.value) {
			if (tileA.merged) continue; // Only merge into a tile once per move
			tileA.value *= 2;
			tileA.merged = true;
			score += tileA.value;
			// Remove tileB from tiles array
			grid[tileB.row][tileB.col] = null;
			tiles = tiles.filter(t => t.id !== tileB.id);
			row[i + 1] = null;
			i++; // Skip next index to prevent double merge
		}
	}
	return row;
}

function operate(row) {
	row = slide(row);
	row = combine(row);
	row = slide(row);
	return row;
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
	// Reset merged state
	tiles.forEach(t => t.merged = false);
	
	// Store initial state to check if anything moved
	let oldGrid = JSON.stringify(grid);
	
	// Create a copy of the grid for rotation
	let currentGrid = grid.map(row => [...row]);
	
	// Rotate to make all moves work like moving left
	for (let i = 0; i < direction; i++) {
		currentGrid = rotateGrid(currentGrid);
	}
	
	// Process each row
	for (let r = 0; r < GRID_SIZE; r++) {
		const newRow = operate(currentGrid[r]);
		currentGrid[r] = newRow;
	}
	
	// Rotate back
	for (let i = 0; i < (4 - direction) % 4; i++) {
		currentGrid = rotateGrid(currentGrid);
	}
	
	// Update the main grid and tile positions
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
	if (JSON.stringify(grid) !== oldGrid) {
		addRandomTile();
		updateUI();
		if (isGameOver()) {
			setTimeout(() => {
				const gameOverContainer = document.getElementById('game-over-container');
				if (gameOverContainer) gameOverContainer.classList.remove('hidden');
			}, 100);
		}
		if (isGameWon() && !hasShownGameWon) {
			hasShownGameWon = true;
			setTimeout(() => {
				const gameWonContainer = document.getElementById('game-won-container');
				if (gameWonContainer) gameWonContainer.classList.remove('hidden');
			}, 100);
		}
	}
}

function isGameOver() {
	// Check for empty cells
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			if (grid[r][c] === null) return false;
		}
	}
	// Check for possible merges
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

function isGameWon() {
	for (const t of tiles) {
		if (t.value === 16) return true;
	}
	return false;
}

function updateUI() {
	const tileContainer = document.getElementById('tile-container');
	// Remove DOM tiles that no longer exist, but keep the game over and game won containers
	const tileIds = new Set(tiles.map(t => 'tile-' + t.id));
	Array.from(tileContainer.children).forEach(tile => {
		if (!tileIds.has(tile.id) && tile.id !== 'game-over-container' && tile.id !== 'game-won-container') {
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
		// Always update position
		tile.style.top = (t.row * 87.5 / GRID_SIZE + 12.5 * (t.row + 1) / (GRID_SIZE + 1)) + '%';
		tile.style.left = (t.col * 87.5 / GRID_SIZE + 12.5 * (t.col + 1) / (GRID_SIZE + 1)) + '%';
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
		hasShownGameWon
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
	updateUI();
}

// Patch move to save state before moving
const originalMove = move;
move = function(direction) {
	saveState();
	originalMove(direction);
};

// Undo button
const undoButton = document.getElementById('undo-button');
if (undoButton) {
	undoButton.addEventListener('click', function () {
		if (undoStack.length > 1) {
			redoStack.push(undoStack.pop());
			restoreState(undoStack[undoStack.length - 1]);
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
		}
	});
}

// Reset button
const resetButton = document.getElementById('reset-button');
if (resetButton) {
	resetButton.addEventListener('click', function () {
		initGrid();
		undoStack = [];
		redoStack = [];
		saveState();
	});
}

// Save initial state after grid is initialized
const originalInitGrid = initGrid;
initGrid = function() {
	originalInitGrid();
	saveState();
};

document.addEventListener('keydown', function (e) {
	e.preventDefault(); // Prevent scrolling
	switch (e.key) {
		case 'ArrowLeft':
			move(0); // left (no rotation needed)
			break;
		case 'ArrowUp':
			move(3); // up (rotate once clockwise)
			break;
		case 'ArrowRight':
			move(2); // right (rotate twice)
			break;
		case 'ArrowDown':
			move(1); // down (rotate three times clockwise)
			break;
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
			initGrid();
		});
	}

	const gameWonRestart = document.getElementById('game-won-restart');
	if (gameWonRestart) {
		gameWonRestart.addEventListener('click', function () {
			const gameWonContainer = document.getElementById('game-won-container');
			if (gameWonContainer) gameWonContainer.classList.add('hidden');
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

window.onload = initGrid;
