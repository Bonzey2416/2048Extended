export function getGameStateKey(gameMode, practiceMode, gridSize) {
    return `gameState-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

export function getHighScoreKey(gameMode, practiceMode, gridSize) {
    return `highScore-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

export function getHighestTileKey(gameMode, practiceMode, gridSize) {
    return `highestTile-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

export function getGamesPlayedKey(gameMode, practiceMode, gridSize) {
    return `gamesPlayed-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}