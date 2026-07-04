// ============================================
// PROGRESS SAVE BRIDGE
// ============================================
const PROGRESS_STORAGE_KEY = 'spellbee_progress';
const GAME_ID = 'spellbee';
const ENABLE_DEV_COMPLETE_SHORTCUT = false;
const SPELLBEE_TOTAL_XP = 200;
const SPELLBEE_LEVEL_COUNT = 10;
const SPELLBEE_LEVEL_XP = SPELLBEE_TOTAL_XP / SPELLBEE_LEVEL_COUNT;

function readUserInfo() {
    try {
        return window.userInfo || null;
    } catch (e) {
        return null;
    }
}

function loadHighestLevelPlayed() {
    // Priority 1: window.BACKEND_PAYLOAD (blackhole-style injection)
    try {
        const bp = window.BACKEND_PAYLOAD;
        if (bp && bp.userId && bp.gameId) {
            const hlp = typeof bp.highestLevelPlayed === 'number' ? bp.highestLevelPlayed : 1;
            saveHighestLevelPlayed(hlp, bp.userId, bp.gameId);
            console.log('[ProgressBridge] BACKEND_PAYLOAD — highestLevelPlayed:', hlp);
            return Math.max(1, hlp);
        }
    } catch (e) { /* ignore */ }

    // Priority 2: window.userInfo (legacy RN injection)
    const userInfo = readUserInfo();
    if (userInfo) {
        const userId = userInfo.UserID || userInfo.userId || '';
        const gameId = userInfo.GameID || userInfo.gameId || '';
        const hlp = typeof userInfo.highestLevelPlayed === 'number'
            ? userInfo.highestLevelPlayed
            : parseInt(userInfo.highestLevelPlayed, 10) || 1;
        if (userId && gameId && hlp >= 1) {
            saveHighestLevelPlayed(hlp, userId, gameId);
            console.log('[ProgressBridge] WebView userInfo — highestLevelPlayed:', hlp);
            return hlp;
        }
    }

    // Priority 3: localStorage fallback
    try {
        const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.highestLevelPlayed === 'number' && parsed.highestLevelPlayed >= 1) {
                console.log('[ProgressBridge] localStorage — highestLevelPlayed:', parsed.highestLevelPlayed);
                return parsed.highestLevelPlayed;
            }
        }
    } catch (e) { /* ignore */ }

    console.log('[ProgressBridge] No saved progress — starting at level 1');
    return 1;
}

function saveHighestLevelPlayed(level, userId, gameId) {
    try {
        const bp = window.BACKEND_PAYLOAD;
        const userInfo = readUserInfo();
        const resolvedUserId = userId || bp?.userId || userInfo?.UserID || userInfo?.userId || '';
        const resolvedGameId = gameId || bp?.gameId || userInfo?.GameID || userInfo?.gameId || 'spellbee';
        const data = {
            highestLevelPlayed: level,
            userId: resolvedUserId,
            gameId: resolvedGameId,
            lastUpdated: Date.now()
        };
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
        console.log('[ProgressBridge] Saved highestLevelPlayed:', level);

        // Post progress update back to React Native host (matches blackhole pattern)
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PROGRESS_UPDATE',
                payload: data
            }));
        }
    } catch (e) { /* storage unavailable */ }
}

// Game State
let gameData = null;
let dictionary = null;
let currentLevel = 1;
let currentWord = '';
let foundWords = new Set();
let score = 0;
let centerLetter = '';
let outerLetters = [];
let allLetters = [];
let validWords = [];
let targetScore = 20;
let timeRemaining = 300; 
let timerInterval = null;
let musicStarted = false;

// ============================================
// ANALYTICS SETUP
// ============================================
let analytics = null;
let currentLevelId = null;
let levelStartTime = 0;
let wordAttempts = 0;
let sessionStartTime = 0;
let analyticsRunId = null;
let submittedAnalyticsLevels = new Set();

// Sound Effects - Using actual audio URLs (you can replace with your own audio files)
const correctSound = new Audio();
correctSound.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const incorrectSound = new Audio();
incorrectSound.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

// Background music - Using your provided file
const bgMusic = new Audio('bgMusic1.mp3');

// Configure audio
correctSound.volume = 0.4;
incorrectSound.volume = 0.3;
bgMusic.volume = 0.2;
bgMusic.loop = true;

// Play sound helper function
function playSound(sound) {
    try {
        sound.currentTime = 0;
        sound.play().catch(err => console.log('Audio play failed:', err));
    } catch(e) {
        console.log('Sound error:', e);
    }
}

// Start background music
function startBackgroundMusic() {
    if (musicStarted) return;
    musicStarted = true;
    
    bgMusic.play().catch(err => {
        console.log('BG music autoplay blocked, will start on interaction');
    });
}

// DOM Elements
const scoreElement = document.getElementById('score');
const targetScoreElement = document.getElementById('target-score');
const currentWordElement = document.getElementById('current-word');
const messageElement = document.getElementById('message');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const rankElement = document.getElementById('rank');
const wordsListElement = document.getElementById('words-list');
const foundCountElement = document.getElementById('found-count');
const currentLevelElement = document.getElementById('current-level');
const timerElement = document.getElementById('timer');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const nextLevelBtn = document.getElementById('next-level-btn');
const homeScreen = document.getElementById('home-screen');
const gameContainer = document.getElementById('game-container');
const howToPlayModal = document.getElementById('how-to-play-modal');
const confirmModal = document.getElementById('confirm-modal');

// Home Screen Functions
function showHomeScreen() {
    homeScreen.style.display = 'flex';
    gameContainer.style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
}

function hideHomeScreen() {
    homeScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    startBackgroundMusic();

    initializeAnalyticsRun(true);
}

function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `spellbee_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function postAnalyticsDebug(event, data = {}) {
    try {
        window.parent.postMessage({
            __analyticsDebug: true,
            type: 'ANALYTICS_DEBUG',
            gameId: GAME_ID,
            event,
            detail: data
        }, '*');
    } catch (e) { /* parent frame unavailable */ }
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
        postAnalyticsDebug('run_started', { runId: analyticsRunId });
    }
}

// Custom Confirm Dialog
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmModal.classList.add('show');
    
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    
    const handleConfirm = () => {
        confirmModal.classList.remove('show');
        onConfirm();
        cleanup();
    };
    
    const handleCancel = () => {
        confirmModal.classList.remove('show');
        cleanup();
    };
    
    const cleanup = () => {
        confirmOk.removeEventListener('click', handleConfirm);
        confirmCancel.removeEventListener('click', handleCancel);
    };
    
    confirmOk.addEventListener('click', handleConfirm);
    confirmCancel.addEventListener('click', handleCancel);
}

// Load game data and dictionary
async function loadGameData() {
    try {
        // Load game data
        const gameResponse = await fetch('words.json');
        gameData = await gameResponse.json();
        
        // Load dictionary if not already loaded
        if (!dictionary) {
            const dictResponse = await fetch('dictionary.json');
            dictionary = await dictResponse.json();
            console.log('Dictionary loaded with', Object.keys(dictionary).length, 'words');
        }
        
        loadLevel(currentLevel);
    } catch (error) {
        console.error('Error loading game data:', error);
        showMessage('Error loading game data', 'error');
    }
}

// Load specific level
function loadLevel(level) {
    const levelData = gameData.levels.find(l => l.level === level);
    if (!levelData) {
        showMessage('Level not found', 'error');
        return;
    }

    currentLevel = level;
    centerLetter = levelData.centerLetter;
    outerLetters = [...levelData.letters];
    allLetters = [centerLetter, ...outerLetters];
    validWords = levelData.words;
    targetScore = levelData.targetScore;
    timeRemaining = levelData.timeLimit;
    
    // Reset game state
    currentWord = '';
    foundWords.clear();
    score = 0;
    
    // Analytics: Start tracking new level
    initializeAnalyticsRun(false);
    if (analytics) {
        currentLevelId = level;
        analytics.startLevel(currentLevelId, { levelNumber: level });
        levelStartTime = Date.now();
        wordAttempts = 0;
        
        // Track initial metrics
        analytics.addRawMetric('level_number', level);
        analytics.addRawMetric('target_score', targetScore);
        analytics.addRawMetric('time_limit', levelData.timeLimit);
        analytics.addRawMetric('center_letter', centerLetter);
        postAnalyticsDebug('level_started', {
            runId: analyticsRunId,
            levelNumber: level
        });
    }
    
    // Update UI
    currentLevelElement.textContent = `Level ${level}`;
    targetScoreElement.textContent = targetScore;
    updateScore();
    updateWordDisplay();
    updateFoundWords();
    renderHive();
    updateProgress();
    
    // Start timer
    startTimer();
    
    // Load from localStorage if exists
    loadGameState();
}

// Render hexagons
function renderHive() {
    // Shuffle outer letters
    shuffleLetters();
    
    // Set center letter
    document.getElementById('hex-center').textContent = centerLetter;
    
    // Set outer letters
    outerLetters.forEach((letter, index) => {
        const hex = document.getElementById(`hex-${index}`);
        if(hex) hex.textContent = letter;
    });
}

// Shuffle outer letters
function shuffleLetters() {
    for (let i = outerLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [outerLetters[i], outerLetters[j]] = [outerLetters[j], outerLetters[i]];
    }
    
    // Update hex display
    outerLetters.forEach((letter, index) => {
        const hex = document.getElementById(`hex-${index}`);
        if (hex) {
            hex.textContent = letter;
            hex.style.transform = 'scale(0.8)';
            setTimeout(() => hex.style.transform = '', 150);
        }
    });
}

// Handle letter click
function handleLetterClick(letter) {
    currentWord += letter;
    updateWordDisplay();
}

// Update word display (Logic for Placeholder included)
function updateWordDisplay() {
    if (currentWord.length > 0) {
        currentWordElement.textContent = currentWord;
        currentWordElement.classList.remove('placeholder');
    } else {
        currentWordElement.textContent = 'Type letters...';
        currentWordElement.classList.add('placeholder');
    }
}

// Validate and submit word
function submitWord() {
    if (currentWord.length < 4) {
        showMessage('Too short! Need 4+ letters', 'error');
        playSound(incorrectSound);
        shakeWordDisplay();
        return;
    }

    if (!currentWord.includes(centerLetter)) {
        showMessage(`Missing center letter "${centerLetter}"`, 'error');
        playSound(incorrectSound);
        shakeWordDisplay();
        return;
    }

    const wordLetters = currentWord.split('');
    const isValid = wordLetters.every(letter => allLetters.includes(letter));
    
    if (!isValid) {
        showMessage('Invalid letters used', 'error');
        playSound(incorrectSound);
        shakeWordDisplay();
        return;
    }

    if (foundWords.has(currentWord)) {
        showMessage('Already found that one!', 'error');
        playSound(incorrectSound);
        shakeWordDisplay();
        return;
    }

    // Check if word exists in predefined list or dictionary
    const validWord = validWords.find(w => w.word === currentWord);
    const isInDictionary = dictionary && dictionary[currentWord.toLowerCase()];
    
    if (validWord || isInDictionary) {
        foundWords.add(currentWord);
        
        // Calculate points
        let points;
        if (validWord) {
            points = validWord.points;
        } else {
            // Calculate points for dictionary words
            const wordLength = currentWord.length;
            const isPangram = allLetters.every(letter => currentWord.includes(letter));
            
            if (wordLength === 4) {
                points = 1;
            } else if (isPangram) {
                points = wordLength + 7; // Bonus for pangram
            } else {
                points = wordLength;
            }
        }
        
        score += points;
        
        const isPangram = allLetters.every(letter => currentWord.includes(letter));
        
        // Analytics: Track successful word submission
        if (analytics && currentLevelId) {
            wordAttempts++;
            const wordTime = Date.now() - levelStartTime;
            analytics.recordTask(
                currentLevelId,
                'word_' + wordAttempts + '_' + currentWord.toLowerCase(),
                `Word: ${currentWord} (${currentWord.length} letters${isPangram ? ', PANGRAM' : ''})`,
                'valid',
                'valid',
                wordTime,
                0
            );
            
            // Update analytics metrics
            analytics.addRawMetric('words_found', foundWords.size);
            analytics.addRawMetric('current_score', score);
            analytics.addRawMetric('last_word', currentWord);
            analytics.addRawMetric('last_word_points', points);
            if (isPangram) {
                analytics.addRawMetric('pangrams_found', Array.from(foundWords).filter(w => 
                    allLetters.every(letter => w.includes(letter))
                ).length);
            }
        }
        
        if (isPangram) {
            showMessage(`🌟 SUPER! Pangram! +${points}!`, 'success');
        } else if (!validWord) {
            showMessage(`Great find! +${points}`, 'success');
        } else {
            showMessage(`Nice! +${points}`, 'success');
        }
        
        playSound(correctSound);
        updateScore();
        updateFoundWords();
        updateProgress();
        checkLevelComplete();
        saveGameState();
        pulseScore();
    } else {
        showMessage('Not in word list', 'error');
        playSound(incorrectSound);
        shakeWordDisplay();
        
        // Analytics: Track failed word attempt
        if (analytics && currentLevelId) {
            wordAttempts++;
            const wordTime = Date.now() - levelStartTime;
            analytics.recordTask(
                currentLevelId,
                'word_attempt_' + wordAttempts,
                `Invalid word attempt: ${currentWord}`,
                'valid',
                'invalid',
                wordTime,
                0
            );
            analytics.addRawMetric('failed_attempts', wordAttempts - foundWords.size);
        }
    }
    
    currentWord = '';
    updateWordDisplay();
}

function deleteLetter() {
    currentWord = currentWord.slice(0, -1);
    updateWordDisplay();
}

function updateScore() {
    scoreElement.textContent = score;
    document.getElementById('found-count').textContent = foundWords.size;
}

function updateFoundWords() {
    wordsListElement.innerHTML = '';
    const sortedWords = Array.from(foundWords).sort();
    
    sortedWords.forEach(word => {
        const wordElement = document.createElement('div');
        wordElement.className = 'word-item';
        const isPangram = allLetters.every(letter => word.includes(letter));
        if (isPangram) wordElement.classList.add('pangram');
        wordElement.textContent = word;
        wordsListElement.appendChild(wordElement);
    });
    
    foundCountElement.textContent = foundWords.size;
}

function updateProgress() {
    const progress = Math.min((score / targetScore) * 100, 100);
    progressFill.style.width = `${progress}%`;
    progressPercent.textContent = `${Math.round(progress)}%`;
    const rank = getRank(progress);
    rankElement.textContent = rank;
}

function getRank(progress) {
    if (progress >= 100) return 'Genius 🧠';
    if (progress >= 90) return 'Amazing 🤩';
    if (progress >= 80) return 'Great 😄';
    if (progress >= 70) return 'Nice 🙂';
    if (progress >= 60) return 'Solid';
    if (progress >= 50) return 'Good';
    if (progress >= 40) return 'Moving Up';
    if (progress >= 20) return 'Good Start';
    return 'Beginner';
}

function showMessage(text, type) {
    messageElement.textContent = text;
    messageElement.className = `message ${type}`;
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }, 2000);
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeRemaining <= 30) {
        timerElement.style.color = '#FF6B6B'; 
    } else if (timeRemaining <= 60) {
        timerElement.style.color = '#FFD93D'; 
    } else {
        timerElement.style.color = 'inherit';
    }
}

function handleTimeUp() {
    showMessage('Time\'s up!', 'error');
    modalTitle.textContent = '⏰ Time\'s Up!';
    modalMessage.textContent = `You scored ${score} out of ${targetScore} points.`;
    
    const levelSuccess = score >= targetScore;
    
    // Analytics: only successful levels submit XP through the level-wise bridge.
    if (levelSuccess) {
        submitSuccessfulLevelAnalytics('time_up_success');
    } else {
        postAnalyticsDebug('level_failed', {
            runId: analyticsRunId,
            levelNumber: currentLevel,
            score,
            targetScore
        });
    }
    
    if (score >= targetScore) {
        document.getElementById('modal-next').style.display = 'inline-block';
    } else {
        document.getElementById('modal-next').style.display = 'none';
    }
    modal.classList.add('show');
}

function checkLevelComplete(submitAnalytics = true) {
    if (score >= targetScore) {
        nextLevelBtn.disabled = false;
        if (score === targetScore) {
           nextLevelBtn.classList.add('pulse');
        }
        if (submitAnalytics) {
            submitSuccessfulLevelAnalytics('target_score');
        }
    }
}

function submitSuccessfulLevelAnalytics(completionReason) {
    initializeAnalyticsRun(false);
    if (!analytics || !currentLevelId || !analyticsRunId) {
        return null;
    }

    const levelNumber = Number(currentLevel);
    const submitKey = `${analyticsRunId}:${levelNumber}`;
    if (submittedAnalyticsLevels.has(submitKey)) {
        return null;
    }

    const totalTime = Math.max(0, Date.now() - levelStartTime);
    const xp = calculateLevelXP(true, totalTime);

    analytics.addRawMetric('completion_reason', completionReason);
    analytics.addRawMetric('final_score', score);
    analytics.addRawMetric('score_percentage', Math.round((score / targetScore) * 100));
    analytics.addRawMetric('words_found_total', foundWords.size);
    analytics.recordTask(
        currentLevelId,
        `spellbee_level_${levelNumber}_target_score`,
        `Reach ${targetScore} points in SpellBee level ${levelNumber}`,
        'completed',
        'completed',
        totalTime,
        xp
    );
    analytics.endLevel(currentLevelId, true, totalTime, xp);
    const payload = analytics.submitLevel(currentLevelId, { runId: analyticsRunId });
    submittedAnalyticsLevels.add(submitKey);

    console.log('[Analytics] Level payload submitted:', payload);
    postAnalyticsDebug('submit_success', {
        runId: analyticsRunId,
        levelNumber,
        xpEarned: xp,
        payload
    });

    return payload;
}

// Calculate XP for level completion
function calculateLevelXP(success) {
    if (!success) return 0;

    console.log('[Analytics] XP Calculation:', {
        totalGameXP: SPELLBEE_TOTAL_XP,
        levelCount: SPELLBEE_LEVEL_COUNT,
        levelXP: SPELLBEE_LEVEL_XP
    });

    return SPELLBEE_LEVEL_XP;
}

function resetLevel() {
    showConfirm(
        'Reset Game',
        'Are you sure? This will reset ALL progress and start from Level 1.',
        () => {
            // Clear all localStorage (level state + progress save)
            for (let i = 1; i <= 10; i++) {
                localStorage.removeItem(`spellbee_level_${i}`);
            }
            localStorage.removeItem(PROGRESS_STORAGE_KEY);
            initializeAnalyticsRun(true);
            // Reset to level 1
            currentLevel = 1;
            loadLevel(1);
        }
    );
}

function loadNextLevel() {
    if (currentLevel < 10) {
        submitSuccessfulLevelAnalytics('manual_next');

        // Save progress: next level becomes the new highest level played
        const nextLevel = currentLevel + 1;
        saveHighestLevelPlayed(nextLevel);

        loadLevel(nextLevel);
        modal.classList.remove('show');
        nextLevelBtn.disabled = true;
    } else {
        submitSuccessfulLevelAnalytics('game_completed');
        
        modalTitle.textContent = '🎊 YOU WON!';
        modalMessage.textContent = 'You completed all 10 levels!';
        document.getElementById('modal-next').style.display = 'none';
        modal.classList.add('show');
    }
}

function saveGameState() {
    const state = {
        currentWord,
        foundWords: Array.from(foundWords),
        score,
        timeRemaining,
        level: currentLevel
    };
    localStorage.setItem(`spellbee_level_${currentLevel}`, JSON.stringify(state));
}

function loadGameState() {
    const saved = localStorage.getItem(`spellbee_level_${currentLevel}`);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            if(state.level === currentLevel) {
                foundWords = new Set(state.foundWords);
                score = state.score;
                timeRemaining = state.timeRemaining;
                currentWord = state.currentWord || '';
                updateScore();
                updateFoundWords();
                updateProgress();
                updateWordDisplay();
                checkLevelComplete(false);
            }
        } catch(e) { console.error(e); }
    }
}

function shakeWordDisplay() {
    currentWordElement.parentElement.classList.remove('shake');
    // Force reflow/repaint
    void currentWordElement.parentElement.offsetWidth; 
    currentWordElement.parentElement.classList.add('shake');
    setTimeout(() => {
        currentWordElement.parentElement.classList.remove('shake');
    }, 500);
}

function pulseScore() {
    scoreElement.classList.add('pulse');
    setTimeout(() => scoreElement.classList.remove('pulse'), 500);
}

// Event Listeners
document.getElementById('play-btn').addEventListener('click', () => {
    hideHomeScreen();
    // Resolve starting level from saved progress
    currentLevel = loadHighestLevelPlayed();
    loadGameData();
});

document.getElementById('how-to-play-btn').addEventListener('click', () => {
    howToPlayModal.classList.add('show');
});

document.getElementById('close-instructions').addEventListener('click', () => {
    howToPlayModal.classList.remove('show');
});

document.getElementById('close-instructions-btn').addEventListener('click', () => {
    howToPlayModal.classList.remove('show');
});

document.getElementById('delete-btn').addEventListener('click', deleteLetter);
document.getElementById('shuffle-btn').addEventListener('click', shuffleLetters);
document.getElementById('enter-btn').addEventListener('click', submitWord);
document.getElementById('reset-btn').addEventListener('click', resetLevel);
document.getElementById('next-level-btn').addEventListener('click', () => {
    if(modal.classList.contains('show')) {
        loadNextLevel();
    } else {
        modalTitle.textContent = '🎉 Level Complete!';
        modalMessage.textContent = `You scored ${score} points!`;
        document.getElementById('modal-next').style.display = 'inline-block';
        modal.classList.add('show');
    }
});
document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('show'));
document.getElementById('modal-next').addEventListener('click', loadNextLevel);

// Hex click (Delegate)
document.querySelector('.hive').addEventListener('click', (e) => {
    if(e.target.classList.contains('hex')) {
        handleLetterClick(e.target.textContent);
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();
    if (allLetters.includes(key)) {
        handleLetterClick(key);
    } else if (e.key === 'Enter') {
        submitWord();
    } else if (e.key === 'Backspace') {
        deleteLetter();
    } else if (e.key === ' ') {
        e.preventDefault();
        shuffleLetters();
    }
});

// Track abandoned sessions
window.addEventListener('beforeunload', () => {
    if (analytics && currentLevelId && levelStartTime > 0) {
        postAnalyticsDebug('session_abandoned', {
            runId: analyticsRunId,
            levelNumber: currentLevel,
            score,
            timeRemaining
        });
    }
});

window.__completeLevelForTest = () => {
    if (!ENABLE_DEV_COMPLETE_SHORTCUT) {
        return false;
    }

    score = targetScore;
    updateScore();
    updateProgress();
    checkLevelComplete(true);
    return true;
};

// Initialize - Show home screen first
showHomeScreen();