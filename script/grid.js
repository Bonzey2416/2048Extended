import { gameState, config } from './main.js';

// Track merges for animation
export let mergeAnimations = [];

export function getTileById(id) {
    return gameState.tiles.find(t => t.id === id);
}

export function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            if (gameState.grid[r][c] === null) {
                emptyCells.push([r, c]);
            }
        }
    }
    if (emptyCells.length === 0) return;
    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    let value;

    switch (config.GAME_MODE) {
        case 'dive':
            if (!gameState.diveSeeds || gameState.diveSeeds.length === 0) return; // No seeds, no spawn
            value = gameState.diveSeeds[Math.floor(Math.random() * gameState.diveSeeds.length)];
            break;
        case 'fibonacci':
            value = Math.random() < 0.9 ? 1 : 2;
            break;
        case 'power-of-three':
            value = 1;
            break;
        case 'zero': {
            const rand = Math.random();
            if (rand < 0.2) value = 0;
            else if (rand < 0.9) value = 2;
            else value = 4;
            break;
        }
        case 'negative': {
            const rand = Math.random();
            if (rand < 0.45) value = 2;
            else if (rand < 0.90) value = -2;
            else if (rand < 0.95) value = 4;
            else value = -4;
            break;
        }
        case 'classic':
        case 'supermerging':
        default:
            value = Math.random() < 0.9 ? 2 : 4;
            break;
    }

    const tile = { id: gameState.tileIdCounter++, value, row: r, col: c, merged: false };
    gameState.tiles.push(tile);
    gameState.grid[r][c] = tile.id;
    gameState.lastNewTileId = tile.id;
}

function slide(row) {
    const newRow = Array(config.GRID_SIZE).fill(null);
    let insert = 0;
    for (let i = 0; i < config.GRID_SIZE; i++) {
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
    // Classic Mode
    if (config.GAME_MODE === 'classic' || config.GAME_MODE === 'zero') {
        for (let i = 0; i < config.GRID_SIZE - 1; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            if (tileA && tileB && tileA.value === tileB.value && !tileA.merged && !tileB.merged) {
                const fromA = gameState.beforeMovePositions[tileA.id] || { row: tileA.row, col: tileA.col };
                const fromB = gameState.beforeMovePositions[tileB.id] || { row: tileB.row, col: tileB.col };
                mergeAnimations.push({ from: { ...fromA, id: tileA.id, value: tileA.value }, from2: { ...fromB, id: tileB.id, value: tileB.value }, mergedId: tileA.id, to: { row: tileA.row, col: tileA.col }, mergedValue: tileA.value * 2 });
                tileA.value *= 2;
                tileA.merged = true;
                gameState.score += tileA.value;
                gameState.tiles = gameState.tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
    }
    // DIVE Mode
    if (config.GAME_MODE === 'dive') {
        for (let i = 0; i < config.GRID_SIZE - 1; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            if (tileA && tileB && !tileA.merged && !tileB.merged && tileA.value !== 0 && tileB.value !== 0 && (tileA.value % tileB.value === 0 || tileB.value % tileA.value === 0)) {
                const fromA = gameState.beforeMovePositions[tileA.id] || { row: tileA.row, col: tileA.col };
                const fromB = gameState.beforeMovePositions[tileB.id] || { row: tileB.row, col: tileB.col };
                const newValue = tileA.value + tileB.value;
                mergeAnimations.push({ from: { ...fromA, id: tileA.id, value: tileA.value }, from2: { ...fromB, id: tileB.id, value: tileB.value }, mergedId: tileA.id, to: { row: tileA.row, col: tileA.col }, mergedValue: newValue });
                tileA.value = newValue;
                tileA.merged = true;
                gameState.score += newValue;
                gameState.tiles = gameState.tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
    }
    // Negative Mode
    if (config.GAME_MODE === 'negative') {
        for (let i = 0; i < config.GRID_SIZE - 1; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            if (tileA && tileB && (tileA.value === tileB.value || tileA.value === -tileB.value) && !tileA.merged && !tileB.merged) {
                const fromA = gameState.beforeMovePositions[tileA.id] || { row: tileA.row, col: tileA.col };
                const fromB = gameState.beforeMovePositions[tileB.id] || { row: tileB.row, col: tileB.col };
                const newValue = tileA.value + tileB.value;
                mergeAnimations.push({ from: { ...fromA, id: tileA.id, value: tileA.value }, from2: { ...fromB, id: tileB.id, value: tileB.value }, mergedId: tileA.id, to: { row: tileA.row, col: tileA.col }, mergedValue: newValue });
                tileA.value = newValue;
                tileA.merged = true;
                gameState.score += tileA.value;
                gameState.tiles = gameState.tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
    }
    // Supermerging Mode
    if (config.GAME_MODE === 'supermerging') {
        let i = 0;
        while (i < config.GRID_SIZE) {
            const tileA_id = row[i];
            const tileA = tileA_id ? getTileById(tileA_id) : null;
            if (!tileA || tileA.merged) {
                i++;
                continue;
            }
            // Find contiguous block of identical tiles
            let block_ids = [tileA_id];
            let lookahead = i + 1;
            while (lookahead < config.GRID_SIZE) {
                const tileB_id = row[lookahead];
                const tileB = tileB_id ? getTileById(tileB_id) : null;
                if (tileB && tileB.value === tileA.value && !tileB.merged) {
                    block_ids.push(tileB_id);
                    lookahead++;
                } else {
                    break;
                }
            }

            if (block_ids.length > 1) {
                rowChanged = true;
                const newValue = tileA.value * block_ids.length;
                const block_tiles = block_ids.map(id => getTileById(id));
                const sources = block_tiles.map(t => ({
                    ...(gameState.beforeMovePositions[t.id] || { row: t.row, col: t.col }),
                    id: t.id,
                    value: t.value
                }));
                mergeAnimations.push({
                    sources: sources,
                    to: { row: tileA.row, col: tileA.col },
                    mergedValue: newValue
                });
                tileA.value = newValue;
                tileA.merged = true;
                gameState.score += tileA.value;
                // Remove other tiles in the block
                for (let k = 1; k < block_tiles.length; k++) {
                    const tileToRemove = block_tiles[k];
                    gameState.tiles = gameState.tiles.filter(t => t.id !== tileToRemove.id);
                    row[i + k] = null;
                }
                i += block_ids.length;
            } else {
                i++;
            }
        }
    }
    // Fibonacci Mode
    if (config.GAME_MODE === 'fibonacci') {
        const fibSeq = getFibonacciSequence(Math.pow(2, 20));
        for (let i = 0; i < config.GRID_SIZE - 1; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            if (tileA && tileB && areFibonacciMergeable(tileA.value, tileB.value, fibSeq) && !tileA.merged && !tileB.merged) {
                const fromA = gameState.beforeMovePositions[tileA.id] || { row: tileA.row, col: tileA.col };
                const fromB = gameState.beforeMovePositions[tileB.id] || { row: tileB.row, col: tileB.col };
                mergeAnimations.push({ from: { ...fromA, id: tileA.id, value: tileA.value }, from2: { ...fromB, id: tileB.id, value: tileB.value }, mergedId: tileA.id, to: { row: tileA.row, col: tileA.col }, mergedValue: tileA.value + tileB.value });
                gameState.score += tileA.value + tileB.value;
                tileA.value += tileB.value;
                tileA.merged = true;
                gameState.tiles = gameState.tiles.filter(t => t.id !== tileB.id);
                row[i + 1] = null;
                rowChanged = true;
                i++;
            }
        }
    }
    // Power of Three Mode
    if (config.GAME_MODE === 'power-of-three') {
        for (let i = 0; i < config.GRID_SIZE - 2; i++) {
            const tileA = row[i] ? getTileById(row[i]) : null;
            const tileB = row[i + 1] ? getTileById(row[i + 1]) : null;
            const tileC = row[i + 2] ? getTileById(row[i + 2]) : null;
            if (tileA && tileB && tileC && tileA.value === tileB.value && tileA.value === tileC.value && !tileA.merged && !tileB.merged && !tileC.merged) {
                const fromA = gameState.beforeMovePositions[tileA.id] || { row: tileA.row, col: tileA.col };
                const fromB = gameState.beforeMovePositions[tileB.id] || { row: tileB.row, col: tileB.col };
                const fromC = gameState.beforeMovePositions[tileC.id] || { row: tileC.row, col: tileC.col };
                mergeAnimations.push({ from: { ...fromA, id: tileA.id, value: tileA.value }, from2: { ...fromB, id: tileB.id, value: tileB.value }, from3: { ...fromC, id: tileC.id, value: tileC.value }, mergedId: tileA.id, to: { row: tileA.row, col: tileA.col }, mergedValue: tileA.value * 3 });
                tileA.value *= 3;
                tileA.merged = true;
                gameState.score += tileA.value;
                gameState.tiles = gameState.tiles.filter(t => t.id !== tileB.id && t.id !== tileC.id);
                row[i + 1] = null;
                row[i + 2] = null;
                rowChanged = true;
                i += 2;
            }
        }
    }
    return { row, rowChanged };
}

function operate(row) {
    let rowChanged = false;
    const afterFirstSlide = slide(row);
    if (JSON.stringify(afterFirstSlide) !== JSON.stringify(row)) rowChanged = true;
    row = afterFirstSlide;

    const beforeCombineCount = mergeAnimations.length;
    const combineResult = combine(row);
    row = combineResult.row;
    if (combineResult.rowChanged) rowChanged = true;

    const afterSecondSlide = slide(row);
    if (JSON.stringify(afterSecondSlide) !== JSON.stringify(row)) rowChanged = true;
    row = afterSecondSlide;

    return { row, rowChanged };
}

export function rotateGrid(grid) {
    let newGrid = Array(config.GRID_SIZE).fill().map(() => Array(config.GRID_SIZE).fill(null));
    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            newGrid[c][config.GRID_SIZE - 1 - r] = grid[r][c];
        }
    }
    return newGrid;
}

export function moveGrid(direction) {
    let currentGrid = gameState.grid.map(row => [...row]);
    for (let i = 0; i < direction; i++) {
        currentGrid = rotateGrid(currentGrid);
    }

    let anyTileMoved = false;
    for (let r = 0; r < config.GRID_SIZE; r++) {
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
        gameState.grid = currentGrid;
        for (let r = 0; r < config.GRID_SIZE; r++) {
            for (let c = 0; c < config.GRID_SIZE; c++) {
                const id = gameState.grid[r][c];
                if (id) {
                    const tile = getTileById(id);
                    if (tile) {
                        tile.row = r;
                        tile.col = c;
                    }
                }
            }
        }
    }
    return anyTileMoved;
}

export function resetMergedState() {
    gameState.tiles.forEach(tile => {
        tile.merged = false;
    });
    mergeAnimations.length = 0;
}

export function isGameOver() {
    for (let r = 0; r < config.GRID_SIZE; r++) {
        for (let c = 0; c < config.GRID_SIZE; c++) {
            if (gameState.grid[r][c] === null) return false;
        }
    }
    // Check for possible merges
    if (config.GAME_MODE === 'power-of-three') {
        // Check for 3 consecutive identical tiles horizontally
        for (let r = 0; r < config.GRID_SIZE; r++) {
            for (let c = 0; c < config.GRID_SIZE - 2; c++) {
                const tileA = getTileById(gameState.grid[r][c]);
                const tileB = getTileById(gameState.grid[r][c + 1]);
                const tileC = getTileById(gameState.grid[r][c + 2]);
                if (tileA && tileB && tileC && tileA.value === tileB.value && tileA.value === tileC.value) {
                    return false;
                }
            }
        }
        // Check for 3 consecutive identical tiles vertically
        for (let c = 0; c < config.GRID_SIZE; c++) {
            for (let r = 0; r < config.GRID_SIZE - 2; r++) {
                const tileA = getTileById(gameState.grid[r][c]);
                const tileB = getTileById(gameState.grid[r + 1][c]);
                const tileC = getTileById(gameState.grid[r + 2][c]);
                if (tileA && tileB && tileC && tileA.value === tileB.value && tileA.value === tileC.value) {
                    return false;
                }
            }
        }
    } else {
        for (let r = 0; r < config.GRID_SIZE; r++) {
            for (let c = 0; c < config.GRID_SIZE; c++) {
                const tile = getTileById(gameState.grid[r][c]);
                if (c < config.GRID_SIZE - 1) {
                    const rightTile = getTileById(gameState.grid[r][c + 1]);
                    if (canMerge(tile, rightTile)) return false;
                }
                if (r < config.GRID_SIZE - 1) {
                    const downTile = getTileById(gameState.grid[r + 1][c]);
                    if (canMerge(tile, downTile)) return false;
                }
            }
        }
    }
    return true;
}

function canMerge(tileA, tileB) {
    if (!tileA || !tileB) return false;
    if (config.GAME_MODE === 'classic' || config.GAME_MODE === 'zero' || config.GAME_MODE === 'supermerging') return tileA.value === tileB.value;
    if (config.GAME_MODE === 'dive') return tileA.value !== 0 && tileB.value !== 0 && (tileA.value % tileB.value === 0 || tileB.value % tileA.value === 0);
    if (config.GAME_MODE === 'negative') return tileA.value === tileB.value || tileA.value === -tileB.value;
    if (config.GAME_MODE === 'fibonacci') {
        const fibSeq = getFibonacciSequence(tileA.value + tileB.value + 1);
        return areFibonacciMergeable(tileA.value, tileB.value, fibSeq);
    }
    // Power of three requires 3 tiles, so we check that in a different way
    if (config.GAME_MODE === 'power-of-three') return false; // isGameOver handles this differently
    return false;
}

export function getGoalValue() {
    const size = config.GRID_SIZE;
    if (config.GAME_MODE === 'fibonacci') {
        const n = Math.pow(size, 2);
        const idx = Math.round(n * 0.77 + 5);
        const fib = [1, 1];
        while (fib.length <= idx) {
            fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
        }
        return fib[idx];
    } else if (config.GAME_MODE === 'power-of-three') {
        return Math.pow(3, Math.round(Math.pow(size, 2) * 0.2));
    } else if (config.GAME_MODE === 'negative') {
        const n = Math.pow(size, 2);
        return Math.pow(2, Math.round(n * 0.27 + 2));
    } else if (config.GAME_MODE === 'supermerging') {
        switch (size) {
            case 3: return 12;
            case 4: return 36;
            case 5: return 144;
            case 6: return 720;
            case 7: return 8640;
            case 8: return 181440;
            default: return 36;
        }
    } else {
        return Math.pow(2, Math.round(Math.pow(size, 2) * 0.53 + 3));
    }
}

export function isGameWon() {
    if (config.GAME_MODE === 'negative') {
        const goal = getGoalValue();
        const hasPositive = gameState.tiles.some(t => t.value === goal);
        const hasNegative = gameState.tiles.some(t => t.value === -goal);
        return hasPositive && hasNegative;
    }
    const goal = getGoalValue();
    return gameState.tiles.some(t => t.value === goal);
}

export function canMove(direction) {
    let testGrid = gameState.grid.map(row => [...row]);
    for (let i = 0; i < direction; i++) testGrid = rotateGrid(testGrid);
    for (let r = 0; r < config.GRID_SIZE; r++) {
        const originalRow = JSON.stringify(testGrid[r]);
        const newRow = slide(testGrid[r]);
        if (JSON.stringify(newRow) !== originalRow) return true; // Can slide
        for (let c = 0; c < config.GRID_SIZE - 1; c++) {
            const tileA = getTileById(newRow[c]);
            const tileB = getTileById(newRow[c + 1]);
            if (canMerge(tileA, tileB)) return true; // Can merge
        }
    }
    return false;
}