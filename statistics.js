function getGamesPlayedKey(gameMode, practiceMode, gridSize) {
    return `gamesPlayed-${gameMode}-${practiceMode ? 'practice' : 'normal'}-${gridSize}`;
}

function incrementGamesPlayed(gameMode, practiceMode, gridSize) {
    const key = getGamesPlayedKey(gameMode, practiceMode, gridSize);
    let gamesPlayed = parseInt(localStorage.getItem(key) || '0');
    gamesPlayed++;
    localStorage.setItem(key, gamesPlayed);
}

function initStatistics() {
    const statisticsButton = document.getElementById('statistics-button');
    const statisticsMenu = document.getElementById('statistics-menu');
    const closeStatisticsMenu = document.getElementById('close-statistics-menu');
    const overlayBackdrop = document.getElementById('overlay-backdrop');

    function showStatisticsMenu() {
        if (statisticsMenu && overlayBackdrop) {
            updateStatistics();
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

    if (statisticsButton) {
        statisticsButton.addEventListener('click', showStatisticsMenu);
        statisticsButton.addEventListener('touchstart', (event) => {
            event.preventDefault();
            showStatisticsMenu();
        });
    }

    if (closeStatisticsMenu) {
        closeStatisticsMenu.addEventListener('click', hideStatisticsMenu);
    }
}

function updateStatistics() {
    const gameStatisticsContainer = document.getElementById('game-statistics');
    if (!gameStatisticsContainer) return;

    gameStatisticsContainer.innerHTML = '';

    const gridSizes = [3, 4, 5, 6, 7, 8];
    const gameModes = ['classic', 'fibonacci', 'power-of-three'];
    const gameModesDisplay = {
        'classic': 'Classic',
        'fibonacci': 'Fibonacci',
        'power-of-three': 'Powers of 3'
    };
    const practiceModes = [false, true];
    let totalGamesPlayed = 0;
    let overallTotalScore = 0;
    let overallHighestTile = 0;

    for (const size of gridSizes) {
        for (const mode of gameModes) {
            for (const practice of practiceModes) {
                const highScoreKey = `highScore-${mode}-${practice ? 'practice' : 'normal'}-${size}`;
                const highestTileKey = `highestTile-${mode}-${practice ? 'practice' : 'normal'}-${size}`;
                const gamesPlayedKey = getGamesPlayedKey(mode, practice, size);

                const highScore = localStorage.getItem(highScoreKey) || '0';
                const highestTile = parseInt(localStorage.getItem(highestTileKey) || 'null');
                const gamesPlayed = parseInt(localStorage.getItem(gamesPlayedKey) || '0');
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
                tileDiv.classList.add('tile', `tile-${highestTile}`);
                tileDiv.textContent = highestTile;
                individualTileDiv.appendChild(tileDiv);
                highestTileContainer.appendChild(individualTileDiv);

                const gamesPlayedElement = document.createElement('p');
                gamesPlayedElement.textContent = `Games played: ${gamesPlayed}`;
                statsElement.appendChild(gamesPlayedElement);

                const bestScore = document.createElement('p');
                bestScore.textContent = `Best score: ${highScore}`;
                statsElement.appendChild(bestScore);
                
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
        overallTotalScore = parseInt(localStorage.getItem('totalScore') || '0');
        totalScoreElement.textContent = overallTotalScore;
    }
}

window.updateStatistics = updateStatistics;

document.addEventListener('DOMContentLoaded', initStatistics);
