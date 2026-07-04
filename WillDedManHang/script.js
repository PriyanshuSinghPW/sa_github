// ============================================
// ANALYTICS SETUP
// ============================================
const GAME_ID = 'willdedmanhang';
const ENABLE_DEV_COMPLETE_SHORTCUT = false;
const HANGMAN_TOTAL_XP = 200;
const HANGMAN_ROUND_COUNT = 10;
const HANGMAN_LEVEL_XP = HANGMAN_TOTAL_XP / HANGMAN_ROUND_COUNT;
let analytics = null;
let analyticsRunId = null;
let submittedAnalyticsLevels = new Set();
let sessionStartTime = 0;
let roundStartTime = 0;
let currentLevelId = null;
let totalGuesses = 0;
let correctGuesses = 0;
let incorrectGuesses = 0;

// Game State
let currentWord = '';
let currentWordData = null;
let guessedLetters = [];
let wrongGuesses = 0;
const maxWrongGuesses = 6;
let gameActive = false;

// Scoring
let currentRound = 0;
let totalScore = 0;
let wordsSolved = 0;
let startTime = null;
let timerInterval = null;
const POINTS_PER_WORD = 10;
const TIME_BONUS = 10;
const TIME_LIMIT_FOR_BONUS = 300; 
const MAX_ROUNDS = HANGMAN_ROUND_COUNT;

// Audio
const bgMusic = document.getElementById('bgMusic');
let audioEnabled = false;

// Word Bank (Fallback)
let wordBank = [
    { word: 'PYTHON', category: 'Programming', hint: 'Snake-named language', educational: 'Great for data science.' },
    { word: 'GALAXY', category: 'Science', hint: 'System of stars', educational: 'The Milky Way is our galaxy.' }
];

// Hangman body parts
const bodyParts = ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

// DOM Elements
const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');
const startBtn = document.getElementById('startBtn');
const setupModal = document.getElementById('setupModal');
const playBtn = document.getElementById('playBtn');
const backBtn = document.getElementById('backBtn');
const restartBtn = document.getElementById('restartBtn');
const skipBtn = document.getElementById('skipBtn');
const wordDisplay = document.getElementById('wordDisplay');
const keyboard = document.getElementById('keyboard');
const livesCount = document.getElementById('livesCount');
const currentScoreDisplay = document.getElementById('currentScore');
const currentRoundDisplay = document.getElementById('currentRound');
const timerDisplay = document.getElementById('timer');
const categoryDisplay = document.getElementById('categoryDisplay');
const hintDisplay = document.getElementById('hintDisplay');
const hintBtn = document.getElementById('hintBtn');
const educationalInfo = document.getElementById('educationalInfo');
const howToPlayModal = document.getElementById('howToPlayModal');
const gameOverModal = document.getElementById('gameOverModal');
const gameCompleteModal = document.getElementById('gameCompleteModal');
const audioBtn = document.getElementById('audioBtn');

// Game settings from button selection
let selectedCategory = 'technology';
let selectedDifficulty = 'easy';

// Load words from JSON (Optional)
async function loadWords(category, difficulty) {
    try {
        const fileName = `words/${category}-${difficulty}.json`;
        const response = await fetch(fileName);
        const data = await response.json();
        wordBank = data.words;
        console.log(`Loaded ${fileName}`);
    } catch (error) {
        console.log('Using fallback words');
    }
}

function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `willdedmanhang_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function postAnalyticsDebug(event, detail = {}) {
    try {
        window.parent.postMessage({
            __analyticsDebug: true,
            type: 'ANALYTICS_DEBUG',
            gameId: GAME_ID,
            event,
            detail
        }, '*');
    } catch (error) {
        // Debug-only for the local launcher.
    }
}

function initializeAnalyticsRun(forceNewRun = false) {
    if (!analytics && window.AnalyticsManager) {
        analytics = typeof AnalyticsManager.getInstance === 'function'
            ? AnalyticsManager.getInstance()
            : new AnalyticsManager();
    }

    if (!analytics) {
        console.warn('[Analytics] AnalyticsManager unavailable');
        return;
    }

    if (forceNewRun || !analyticsRunId) {
        analyticsRunId = createRunId();
        submittedAnalyticsLevels = new Set();
        analytics.initialize(GAME_ID, analyticsRunId);
        sessionStartTime = Date.now();
        console.log('[Analytics] Game run started:', analyticsRunId);
        postAnalyticsDebug('run_started', {
            runId: analyticsRunId,
            maxRounds: MAX_ROUNDS,
            xpPerRound: HANGMAN_LEVEL_XP
        });
    }
}

// Initialize Keyboard
function createKeyboard() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    keyboard.innerHTML = '';
    letters.forEach(letter => {
        const key = document.createElement('button');
        key.className = 'key';
        key.textContent = letter;
        key.addEventListener('click', () => handleGuess(letter, key));
        keyboard.appendChild(key);
    });
}

// Start New Game
function startNewGame() {
    currentRound = 0;
    totalScore = 0;
    wordsSolved = 0;
    currentScoreDisplay.textContent = totalScore;
    
    const cat = selectedCategory;
    const diff = selectedDifficulty;
    
    initializeAnalyticsRun(true);
    
    // Track game metadata
    if (analytics) {
        analytics.addRawMetric('category', cat);
        analytics.addRawMetric('difficulty', diff);
        analytics.addRawMetric('max_rounds', MAX_ROUNDS);
        analytics.addRawMetric('xp_per_round', HANGMAN_LEVEL_XP);
    }
    
    loadWords(cat, diff).then(() => {
        homeScreen.classList.remove('active');
        gameScreen.classList.add('active');
        startNewRound();
    });
}

// Start New Round
function startNewRound() {
    if (currentRound >= MAX_ROUNDS) {
        showGameComplete();
        return;
    }
    
    currentRound++;
    // Cycle through words, loop if not enough
    const index = (currentRound - 1) % wordBank.length;
    currentWordData = wordBank[index];
    currentWord = currentWordData.word.toUpperCase();
    
    guessedLetters = [];
    wrongGuesses = 0;
    gameActive = true;
    
    // Start Analytics Level Tracking
    initializeAnalyticsRun(false);
    currentLevelId = currentRound;
    if (analytics) {
        analytics.startLevel(currentLevelId, { levelNumber: currentRound });
        analytics.addRawMetric(`round_${currentRound}_word`, currentWord);
        analytics.addRawMetric(`round_${currentRound}_category`, currentWordData.category);
        analytics.addRawMetric(`round_${currentRound}_difficulty`, selectedDifficulty);
        postAnalyticsDebug('level_started', {
            runId: analyticsRunId,
            levelNumber: currentRound,
            word: currentWord
        });
    }
    roundStartTime = Date.now();
    totalGuesses = 0;
    correctGuesses = 0;
    incorrectGuesses = 0;
    
    // Reset Timer
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    // Update UI
    currentRoundDisplay.textContent = currentRound;
    livesCount.textContent = maxWrongGuesses;
    categoryDisplay.textContent = currentWordData.category;
    hintDisplay.textContent = '';
    
    createKeyboard();
    displayWord();
    resetHangman();
}

function updateTimer() {
    if (!gameActive) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function displayWord() {
    wordDisplay.innerHTML = '';
    for (let letter of currentWord) {
        const box = document.createElement('div');
        box.className = 'letter-box';
        box.textContent = guessedLetters.includes(letter) ? letter : '';
        wordDisplay.appendChild(box);
    }
}

function handleGuess(letter, keyElement) {
    if (!gameActive || keyElement.classList.contains('used')) return;
    
    keyElement.classList.add('used');
    guessedLetters.push(letter);
    totalGuesses++;
    
    const isCorrect = currentWord.includes(letter);
    const timeTaken = Date.now() - roundStartTime;
    
    if (isCorrect) {
        keyElement.classList.add('correct');
        correctGuesses++;
        
        // Track correct guess
        if (analytics) analytics.recordTask(
            currentLevelId,
            'guess_' + totalGuesses + '_' + letter,
            'Guessed letter: ' + letter,
            'correct',
            'correct',
            timeTaken,
            0
        );
        
        displayWord();
        checkWin();
    } else {
        keyElement.classList.add('wrong');
        wrongGuesses++;
        incorrectGuesses++;
        
        // Track wrong guess
        if (analytics) analytics.recordTask(
            currentLevelId,
            'guess_' + totalGuesses + '_' + letter,
            'Guessed letter: ' + letter,
            'correct',
            'wrong',
            timeTaken,
            0
        );
        
        updateHangman();
        livesCount.textContent = maxWrongGuesses - wrongGuesses;
        if (wrongGuesses >= maxWrongGuesses) endGame(false);
    }
    
    // Track guess metrics
    if (analytics) {
        analytics.addRawMetric('total_guesses_round_' + currentRound, totalGuesses);
        analytics.addRawMetric('correct_guesses_round_' + currentRound, correctGuesses);
        analytics.addRawMetric('wrong_guesses_round_' + currentRound, incorrectGuesses);
    }
}

function updateHangman() {
    if (wrongGuesses <= bodyParts.length) {
        document.getElementById(bodyParts[wrongGuesses - 1]).classList.remove('hidden');
        document.getElementById(bodyParts[wrongGuesses - 1]).classList.add('show');
    }
}

function resetHangman() {
    bodyParts.forEach(id => {
        const part = document.getElementById(id);
        part.classList.remove('show');
        part.classList.add('hidden');
    });
}

function checkWin() {
    const won = currentWord.split('').every(l => guessedLetters.includes(l));
    if (won) endGame(true);
}

function submitSuccessfulRoundAnalytics(timeTaken) {
    initializeAnalyticsRun(false);
    if (!analytics || !currentLevelId || !analyticsRunId) {
        return null;
    }

    const levelNumber = Number(currentRound);
    const submitKey = `${analyticsRunId}:${levelNumber}`;
    if (submittedAnalyticsLevels.has(submitKey)) {
        return null;
    }

    const accuracy = totalGuesses > 0 ? Number((correctGuesses / totalGuesses * 100).toFixed(1)) : 0;
    const xpEarned = HANGMAN_LEVEL_XP;

    analytics.addRawMetric(`round_${currentRound}_accuracy`, accuracy);
    analytics.addRawMetric(`round_${currentRound}_time_seconds`, (timeTaken / 1000).toFixed(2));
    analytics.addRawMetric(`round_${currentRound}_xp`, xpEarned);
    analytics.addRawMetric(`round_${currentRound}_word`, currentWord);
    analytics.addRawMetric(`round_${currentRound}_result`, 'won');
    analytics.addRawMetric(`round_${currentRound}_wrong_guesses`, wrongGuesses);
    analytics.recordTask(
        currentLevelId,
        `willdedmanhang_round_${levelNumber}_solve`,
        `Solve hangman word ${levelNumber}: ${currentWord}`,
        'completed',
        'completed',
        timeTaken,
        xpEarned
    );
    analytics.endLevel(currentLevelId, true, timeTaken, xpEarned);
    const payload = analytics.submitLevel(currentLevelId, { runId: analyticsRunId });
    submittedAnalyticsLevels.add(submitKey);

    console.log('[Analytics] Round payload submitted:', payload);
    postAnalyticsDebug('submit_success', {
        runId: analyticsRunId,
        levelNumber,
        xpEarned,
        word: currentWord,
        payload
    });

    return payload;
}

function endGame(won) {
    gameActive = false;
    clearInterval(timerInterval);
    const msg = document.getElementById('gameOverMessage');
    const timeTaken = Date.now() - roundStartTime;

    if (won) {
        totalScore += POINTS_PER_WORD;
        wordsSolved++;
        currentScoreDisplay.textContent = totalScore;
        msg.innerHTML = `<div class="win-message">🎉 Correct! Word: ${currentWord}</div>`;
        submitSuccessfulRoundAnalytics(timeTaken);
    } else {
        msg.innerHTML = `<div class="lose-message">💀 Failed! Word: ${currentWord}</div>`;

        postAnalyticsDebug('level_failed', {
            runId: analyticsRunId,
            levelNumber: currentRound,
            word: currentWord,
            wrongGuesses,
            timeTaken
        });
    }

    educationalInfo.innerHTML = `<strong>Did you know?</strong> ${currentWordData.educational}`;
    gameOverModal.classList.add('active');
}

function showGameComplete() {
    gameScreen.classList.remove('active');
    document.getElementById('finalScore').textContent = totalScore;
    document.getElementById('wordsSolved').textContent = wordsSolved;
    
    // Calculate final game metrics
    const totalTime = Date.now() - sessionStartTime;
    const accuracy = MAX_ROUNDS > 0 ? ((wordsSolved / MAX_ROUNDS) * 100).toFixed(1) : 0;
    
    // Update accuracy display
    document.getElementById('accuracy').textContent = accuracy + '%';
    
    if (analytics) {
        analytics.addRawMetric('total_score', totalScore);
        analytics.addRawMetric('words_solved', wordsSolved);
        analytics.addRawMetric('words_failed', MAX_ROUNDS - wordsSolved);
        analytics.addRawMetric('overall_accuracy', accuracy);
        analytics.addRawMetric('total_time_seconds', (totalTime / 1000).toFixed(2));
        analytics.addRawMetric('game_completed', true);
    }

    console.log('[Analytics] Game Complete!', {
        totalScore: totalScore,
        wordsSolved: wordsSolved,
        accuracy: accuracy + '%',
        totalTime: (totalTime / 1000).toFixed(2) + 's'
    });

    gameCompleteModal.classList.add('active');
}

// Event Listeners
// Home screen - open setup modal
startBtn.addEventListener('click', () => {
    setupModal.classList.add('active');
});

// Category button selection
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedCategory = e.target.dataset.category;
    });
});

// Difficulty button selection
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedDifficulty = e.target.dataset.difficulty;
    });
});

// Start game from setup modal
playBtn.addEventListener('click', () => {
    setupModal.classList.remove('active');
    startNewGame();
});

document.getElementById('howToPlayBtn').addEventListener('click', () => {
    setupModal.classList.remove('active');
    howToPlayModal.classList.add('active');
});
document.querySelector('.close-btn').addEventListener('click', () => howToPlayModal.classList.remove('active'));
backBtn.addEventListener('click', () => {
    gameScreen.classList.remove('active');
    homeScreen.classList.add('active');
    gameActive = false;
    clearInterval(timerInterval);
});
restartBtn.addEventListener('click', startNewGame);
skipBtn.addEventListener('click', () => { if(gameActive) endGame(false); });
document.getElementById('nextWordBtn').addEventListener('click', () => {
    gameOverModal.classList.remove('active');
    startNewRound();
});
document.getElementById('playNewGameBtn').addEventListener('click', () => {
    gameCompleteModal.classList.remove('active');
    startNewGame();
});
document.getElementById('homeFromCompleteBtn').addEventListener('click', () => {
    gameCompleteModal.classList.remove('active');
    homeScreen.classList.add('active');
});

hintBtn.addEventListener('click', () => {
    if(!gameActive) return;
    hintDisplay.textContent = currentWordData.hint;
});

if (audioBtn) {
    audioBtn.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        if(audioEnabled) {
            bgMusic.play().catch(e => {});
            audioBtn.classList.remove('muted');
            audioBtn.querySelector('.audio-icon').textContent = '🔊';
        } else {
            bgMusic.pause();
            audioBtn.classList.add('muted');
            audioBtn.querySelector('.audio-icon').textContent = '🔇';
        }
    });
}

// Track incomplete sessions when user leaves
window.addEventListener('beforeunload', () => {
    if (currentLevelId && gameActive) {
        postAnalyticsDebug('session_abandoned', {
            runId: analyticsRunId,
            levelNumber: currentRound,
            word: currentWord,
            wrongGuesses
        });
    }
});

window.__completeLevelForTest = () => {
    if (!ENABLE_DEV_COMPLETE_SHORTCUT || !gameActive) {
        return false;
    }

    guessedLetters = Array.from(new Set(currentWord.split('')));
    displayWord();
    endGame(true);
    return true;
};