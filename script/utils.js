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

export function getPrimeFactorization(num) {
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

const scoreFormatter = new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: 7,
    useGrouping: false
});

export function formatScore(score) {
    const numScore = Number(score);
    if (isNaN(numScore)) return score;

    if (numScore >= 1000000) {
        return Math.round(numScore).toString();
    } else {
        return scoreFormatter.format(numScore);
    }
}