document.addEventListener('DOMContentLoaded', async () => {
    // MODALS AND SCREENS
    const successModal = document.getElementById('success-modal');
    const homeContent = document.getElementById('home-content');
    const startContent = document.getElementById('start-content');
    const levelContent = document.getElementById('level-content');
    const gameContent = document.getElementById('game-content');

    // HOME / SELECT-MODE NAVIGATION
    const homeCtaGroup = document.querySelector('.home-cta-group');
    const playNowBtn = document.getElementById('play-now-btn');
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const modeBackBtn = document.getElementById('mode-back-btn');

    function setHomeLoading(isLoading) {
        if (!homeCtaGroup) return;
        homeCtaGroup.classList.toggle('is-loading', isLoading);
    }

    // LEVEL SELECTOR
    const levelGrid = document.getElementById('level-grid');
    const levelScreenTitle = document.getElementById('level-screen-title');
    const levelBackBtn = document.getElementById('level-back-btn');
    const continueLevelBtn = document.getElementById('continue-level-btn');
    let activeDifficultyKey = 'easy';

    // NEW ELEMENTS
    const tutorialContent = document.getElementById('tutorial-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const playerLevelInfo = document.getElementById('player-level-info');
    const gameInfoList = document.getElementById('game-info');
    const infoBtn = document.getElementById('info-btn');
    const tutorialCloseBtn = document.getElementById('tutorial-close-btn');

    // GAME ELEMENTS
    const gridElement = document.getElementById('crossword-grid');
    const numberBankElement = document.getElementById('number-bank');
    const levelDisplay = document.getElementById('level-display');
    const difficultyDisplay = document.getElementById('difficulty-display');

    // BUTTONS
    const easyBtn = document.getElementById('easy-btn');
    const mediumBtn = document.getElementById('medium-btn');
    const hardBtn = document.getElementById('hard-btn');
    const resetBtn = document.getElementById('reset-btn');
    const backBtn = document.getElementById('back-btn');
    const clearBtn = document.getElementById('clear-btn');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const playAgainBtn = document.getElementById('play-again-btn');

    let currentLevel = 1;
    let config = {};
    let levels = [];
    let selectedValue = null;
    let selectedElement = null;
    let placementHistory = [];
    let equationStates = new Map();

    // ANALYTICS
    let analytics = null;
    let levelStartTime = 0;
    let isLevelActive = false;
    let taskStartTime = 0;
    let levelResetCount = 0;
    let levelClearCount = 0;
    
    // PROGRESS SYSTEM
    let gameManager = null;
    let playerProgress = { highestLevelCompleted: 0 };

    const GAME_ID = 'crossmath_addition';
    const ENABLE_DEV_COMPLETE_SHORTCUT = false;

    const B = 'B';
    const CROSSMATH_TOTAL_XP = 200;

    function getLevelCompletionXp(_levelNumber) {
        const totalLevels = levels.length || 1;

        return Math.floor(CROSSMATH_TOTAL_XP / totalLevels) + 1;
    }
    let currentRunId = '';
    let submittedAnalyticsLevels = new Set();

    function createRunId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `${GAME_ID}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function postAnalyticsDebug(event, detail = {}) {
        try {
            window.parent.postMessage({
                __analyticsDebug: true,
                game: GAME_ID,
                event,
                detail,
                at: new Date().toISOString()
            }, '*');
        } catch (_error) {
            // Debug-only for the local launcher harness.
        }
    }

    function initializeAnalyticsRun(resetRun = false) {
        if (typeof AnalyticsManager === 'undefined') {
            console.warn('[Analytics] Bridge is not loaded yet.');
            return null;
        }

        if (!analytics) {
            analytics = AnalyticsManager.getInstance();
        }

        if (!currentRunId || resetRun) {
            currentRunId = createRunId();
            sessionStorage.setItem(`${GAME_ID}_runId`, currentRunId);
            submittedAnalyticsLevels.clear();
            analytics.initialize(GAME_ID, currentRunId);
            analytics.addRawMetric('Game_Initialized', new Date().toISOString());
            analytics.addRawMetric('Run_ID', currentRunId);
            postAnalyticsDebug('run_started', { runId: currentRunId });
        }

        return analytics;
    }


    // AUDIO
    const correctSound = new Audio('assets/audio/correct.mp3');
    const incorrectSound = new Audio('assets/audio/incorrect.mp3');
    const completionSound = new Audio('assets/audio/completion.mp3');
    const gameAudio = new Audio('assets/audio/game-audio.mp3');

    // Set volume levels
    correctSound.volume = 0.7;    // 70% volume
    incorrectSound.volume = 0.6;  // 60% volume
    completionSound.volume = 0.8; // 80% volume
    gameAudio.volume = 0.3;       // 40% volume - background music should be softer

    // Set gameAudio to loop
    gameAudio.loop = true;

    // Preload audio files
    function preloadAudio() {
        correctSound.load();
        incorrectSound.load();
        completionSound.load();
        gameAudio.load();
    }

    // Function to play sounds
    function playSound(sound) {
        // Reset the audio to the beginning if it's already playing
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio play failed:", e));
    }

    // Function to start background music
    function startBackgroundMusic() {
        gameAudio.play().catch(e => {
            console.log("Background music failed to start:", e);
        });
    }

    // --- INITIALIZATION ---
    try {
        // Initialize Analytics
        currentRunId = sessionStorage.getItem(`${GAME_ID}_runId`) || '';
        initializeAnalyticsRun(!currentRunId);

        // Initialize Progress System
        if (typeof CONFIG !== 'undefined' && typeof GameManager !== 'undefined') {
            // Create progress bridge (local-only mode, no API)
            const progressBridge = new ProgressBridge({
                useProvidedPayload: false,
                timeout: CONFIG.api.timeout,
                retryAttempts: CONFIG.api.retryAttempts,
            });

            // Create storage manager
            const storageManager = new StorageManager({
                storageKey: CONFIG.storage.storageKey,
                useAsyncStorage: false,
            });

            // Get max level from puzzles data
            const response = await fetch('puzzles.json');
            const puzzleData = await response.json();
            config = puzzleData.config;
            levels = puzzleData.levels;
            
            const maxLevel = levels.length;

            // Create validator
            const validator = new Validator({
                minLevel: CONFIG.levels.minLevel,
                maxLevel: maxLevel,
            });

            // Create game manager
            gameManager = new GameManager({
                progressBridge,
                storageManager,
                validator,
                analyticsBridge: null,
                config: CONFIG,
            });

            // Initialize game manager
            const initResult = await gameManager.initialize();
            console.log('[Game] Progress system initialized:', initResult);

            // Override with injected userInfo from WebView if available
            const injectedLevel = window.userInfo && typeof window.userInfo.highestLevelPlayed === 'number'
                ? window.userInfo.highestLevelPlayed
                : null;
            if (injectedLevel !== null && injectedLevel > (gameManager.getState().highestLevelPlayed || 0)) {
                console.log('[Game] Using injected highestLevelPlayed:', injectedLevel);
                gameManager.highestLevelPlayed = injectedLevel;
                gameManager.currentLevel = injectedLevel;
                if (gameManager.storageManager) {
                    await gameManager.storageManager.saveHighestLevel(injectedLevel);
                }
            }

            // Load player progress
            const state = gameManager.getState();
            playerProgress.highestLevelCompleted = (state.highestLevelPlayed || 1) - 1;
            
            console.log('[Game] Player highest level completed:', playerProgress.highestLevelCompleted);
        } else {
            // Fallback to old progress system if GameManager not available
            const response = await fetch('puzzles.json');
            const puzzleData = await response.json();
            config = puzzleData.config;
            levels = puzzleData.levels;
            loadProgress();
        }
        
        updateStartScreen();
        populateRulesModal();
        preloadAudio();
        startBackgroundMusic();

        // Initialization complete: reveal the home CTAs.
        setHomeLoading(false);
    } catch (error) {
        console.error("Error loading game:", error);
        setHomeLoading(false);
        startContent.innerHTML = `<h1>Error</h1><p>Could not load game data. Please try again later.</p>`;
        return;
    }

    // --- PROGRESS MANAGEMENT ---
    function loadProgress() {
        // Fallback for when GameManager is not available
        const savedProgress = localStorage.getItem('crossMathAdditionPlayerProgress');
        if (savedProgress) {
            playerProgress = JSON.parse(savedProgress);
            console.log("[Fallback] Loaded player progress:", playerProgress);
        }
    }

    function saveProgress() {
        if (gameManager) {
            // Progress is automatically saved by GameManager
            console.log('[Game] Progress saved via GameManager');
        } else {
            // Fallback to old method
            localStorage.setItem('crossMathAdditionPlayerProgress', JSON.stringify(playerProgress));
            console.log('[Fallback] Progress saved to localStorage');
        }
    }

    // --- START SCREEN UPDATES ---
    function updateStartScreen() {
        const { easy, medium, hard } = config.difficulties;

        // Update difficulty buttons
        mediumBtn.disabled = playerProgress.highestLevelCompleted < medium.unlocksAt - 1;
        hardBtn.disabled = playerProgress.highestLevelCompleted < hard.unlocksAt - 1;

        // Get the final level number from the hard difficulty range
        const finalLevel = hard.levelRange[1];

        // Highlight the difficulty the player is currently on with side doodle bursts.
        const currentLevelForMode = Math.min(playerProgress.highestLevelCompleted + 1, finalLevel);
        let currentModeBtn = easyBtn;
        if (currentLevelForMode >= hard.levelRange[0]) {
            currentModeBtn = hardBtn;
        } else if (currentLevelForMode >= medium.levelRange[0]) {
            currentModeBtn = mediumBtn;
        }
        [easyBtn, mediumBtn, hardBtn].forEach(btn => btn.classList.remove('is-current'));
        currentModeBtn.classList.add('is-current');

        // Update welcome message based on player progress
        if (playerProgress.highestLevelCompleted === 0) {
            welcomeMessage.textContent = "Welcome to CrossMath!";
            playerLevelInfo.innerHTML = "Solve math puzzles by completing the crossword grid.";
        } else if (playerProgress.highestLevelCompleted >= finalLevel) {
            // Player has completed all levels
            welcomeMessage.textContent = "Master Puzzler!";
            playerLevelInfo.innerHTML = "Congratulations! You've completed all levels! Play any level again.";
        } else {
            const nextLevel = playerProgress.highestLevelCompleted + 1;
            welcomeMessage.textContent = "Welcome back!";

            // Determine which difficulty the player is currently on
            let currentDifficulty = "Easy";
            if (nextLevel >= hard.levelRange[0]) {
                currentDifficulty = "Hard";
            } else if (nextLevel >= medium.levelRange[0]) {
                currentDifficulty = "Medium";
            }

            playerLevelInfo.innerHTML = `You're on <span class="current-level">Level ${nextLevel}</span> (${currentDifficulty})`;
        }
    }

    // --- RULES MODAL FUNCTIONS ---
    function populateRulesModal() {
        if (!gameInfoList) return;
        // Clear existing content
        gameInfoList.innerHTML = '';

        // Add total levels info
        const totalLevels = levels.length;
        const li1 = document.createElement('li');
        li1.textContent = `Total levels: ${totalLevels}`;
        gameInfoList.appendChild(li1);

        // Add difficulty info
        const { easy, medium, hard } = config.difficulties;

        const li2 = document.createElement('li');
        li2.textContent = `Easy levels: ${easy.levelRange[0]} to ${easy.levelRange[1]}`;
        gameInfoList.appendChild(li2);

        const li3 = document.createElement('li');
        li3.textContent = `Medium levels: ${medium.levelRange[0]} to ${medium.levelRange[1]} (Unlocks after level ${medium.unlocksAt - 1})`;
        gameInfoList.appendChild(li3);

        const li4 = document.createElement('li');
        li4.textContent = `Hard levels: ${hard.levelRange[0]} to ${hard.levelRange[1]} (Unlocks after level ${hard.unlocksAt - 1})`;
        gameInfoList.appendChild(li4);
    }

    // Open the tutorial as a full screen (consistent with other page screens).
    function showRulesModal() {
        homeContent.style.opacity = '0';
        homeContent.style.transform = 'translateY(-15px)';
        homeContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            homeContent.style.display = 'none';
            homeContent.style.opacity = '';
            homeContent.style.transform = '';
            homeContent.style.transition = '';

            tutorialContent.style.display = 'flex';
            startTutorial();
        }, 300);
    }

    // Close the tutorial and return to the home screen.
    function hideRulesModal() {
        tutorialContent.style.opacity = '0';
        tutorialContent.style.transform = 'translateY(15px)';
        tutorialContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            tutorialContent.style.display = 'none';
            tutorialContent.style.opacity = '';
            tutorialContent.style.transform = '';
            tutorialContent.style.transition = '';

            homeContent.style.display = 'flex';
        }, 300);
    }

    // --- INTERACTIVE TUTORIAL (self-contained, independent of game logic) ---
    // Layout of the demo cross. Vertical: 7 + 2 = 9. Horizontal: 8 + 2 = 10.
    // The two empty boxes the player fills are the center (2) and the far right (10).
    const tutorialGridEl = document.getElementById('tutorial-grid');
    const tutorialBankEl = document.getElementById('tutorial-bank');
    const tutorialFingerEl = document.getElementById('tutorial-finger');
    const tutorialBannerTextEl = document.getElementById('tutorial-banner-text');
    const tutorialNextBtn = document.getElementById('tutorial-next-btn');
    const tutorialNextTextEl = document.getElementById('tutorial-next-text');

    // 5x5 grid map. null = blank (no cell). Each cell has a fixed value or is a fillable slot.
    const TUT_LAYOUT = [
        [null,      null,      { v: '7', t: 'static' },  null,      null     ],
        [null,      null,      { v: '+', t: 'op' },      null,      null     ],
        [{ v: '8', t: 'static' }, { v: '+', t: 'op' }, { id: 'c', t: 'slot', answer: '2' }, { v: '=', t: 'op' }, { id: 'r', t: 'slot', answer: '10' }],
        [null,      null,      { v: '=', t: 'op' },      null,      null     ],
        [null,      null,      { v: '9', t: 'static' },  null,      null     ],
    ];
    const TUT_BANK = ['10', '2'];
    // Cells that should turn green when an answer is correctly placed (the equation members).
    const TUT_GREEN_CELLS = ['7', '+', '=', '9', '8'];

    let tutorialStep = 0;
    let tutorialCellEls = {};

    function buildTutorialBoard() {
        tutorialGridEl.innerHTML = '';
        tutorialCellEls = {};
        TUT_LAYOUT.forEach((row, r) => {
            row.forEach((cell, c) => {
                const el = document.createElement('div');
                if (cell === null) {
                    el.className = 'tcell tcell--blank';
                } else if (cell.t === 'slot') {
                    el.className = 'tcell tcell--slot';
                    el.dataset.slot = cell.id;
                    tutorialCellEls[cell.id] = el;
                } else {
                    el.className = 'tcell tcell--static';
                    el.textContent = cell.v;
                    el.dataset.value = cell.v;
                }
                tutorialGridEl.appendChild(el);
            });
        });
    }

    function buildTutorialBank() {
        tutorialBankEl.innerHTML = '';
        TUT_BANK.forEach(num => {
            const el = document.createElement('div');
            el.className = 'tnum';
            el.textContent = num;
            el.dataset.num = num;
            tutorialBankEl.appendChild(el);
        });
    }

    function getTutNum(num) {
        return tutorialBankEl.querySelector(`.tnum[data-num="${num}"]`);
    }

    function clearTutHighlights() {
        tutorialBankEl.querySelectorAll('.tnum').forEach(n => n.classList.remove('selected', 'hint'));
        Object.values(tutorialCellEls).forEach(c => c.classList.remove('active-target'));
        tutorialFingerEl.classList.remove('visible');
    }

    // Point the finger near a target element. Uses offsetLeft/Top within the board
    // so it is unaffected by the modal's open/scale transition.
    function pointFingerAt(el, offsetX = 18, offsetY = 14) {
        const x = el.offsetLeft + el.offsetWidth / 2 + offsetX;
        const y = el.offsetTop + el.offsetHeight / 2 + offsetY;
        tutorialFingerEl.style.left = `${x}px`;
        tutorialFingerEl.style.top = `${y}px`;
        tutorialFingerEl.classList.add('visible');
    }

    function setTutorialBanner(text, state) {
        tutorialBannerTextEl.textContent = text;
        const banner = tutorialBannerTextEl.closest('.tutorial__banner');
        banner.classList.remove('is-correct', 'is-wrong');
        if (state) banner.classList.add(state);
    }

    // --- Tutorial steps ---
    // Step 0: Pick the right number (finger on the correct bank number "2")
    // Step 1: Tap an empty box (number 2 selected, finger on center slot)
    // Step 2: Correct! fill center with 2, then prompt placing 10 in right slot
    // Step 3: Completed -> confetti + "Got It!"
    function startTutorial() {
        tutorialStep = 0;
        buildTutorialBoard();
        buildTutorialBank();
        renderTutorialStep();
    }

    function renderTutorialStep() {
        clearTutHighlights();
        const board = tutorialFingerEl.parentElement;
        board.classList.remove('tutorial--celebrate');
        tutorialNextBtn.classList.remove('visible');

        if (tutorialStep === 0) {
            setTutorialBanner('Pick the right number');
            const two = getTutNum('2');
            two.classList.add('selected');
            getTutNum('10').classList.remove('used');
            requestAnimationFrame(() => pointFingerAt(two, 14, 16));
        } else if (tutorialStep === 1) {
            setTutorialBanner('Tap an empty box');
            getTutNum('2').classList.add('selected');
            const center = tutorialCellEls.c;
            center.classList.add('active-target');
            requestAnimationFrame(() => pointFingerAt(center, 14, 14));
        } else if (tutorialStep === 2) {
            // Place "2" in center, mark correct.
            const center = tutorialCellEls.c;
            center.textContent = '2';
            center.classList.add('tcell--correct');
            getTutNum('2').classList.add('used');
            TUT_GREEN_CELLS.forEach(v => {
                const el = tutorialGridEl.querySelector(`.tcell--static[data-value="${v}"]`);
                if (el) el.classList.add('tcell--correct');
            });
            setTutorialBanner('Correct', 'is-correct');
            // Now prompt the player to place the last number (10) in the right slot.
            setTimeout(() => {
                if (tutorialStep !== 2) return;
                setTutorialBanner('Tap an empty box');
                const ten = getTutNum('10');
                ten.classList.add('selected');
                const right = tutorialCellEls.r;
                right.classList.add('active-target');
                pointFingerAt(right, 14, 14);
            }, 1100);
        } else if (tutorialStep === 3) {
            // Completed state
            const right = tutorialCellEls.r;
            right.textContent = '10';
            right.classList.add('tcell--correct');
            tutorialCellEls.c.classList.add('tcell--correct');
            getTutNum('2').classList.add('used');
            getTutNum('10').classList.add('used');
            setTutorialBanner('Great! You have completed the equation.', 'is-correct');
            board.classList.add('tutorial--celebrate');
            tutorialNextTextEl.textContent = 'GOT IT!';
            tutorialNextBtn.classList.add('visible');
        }
    }

    function advanceTutorial() {
        if (tutorialStep < 3) {
            tutorialStep++;
            renderTutorialStep();
        } else {
            hideRulesModal();
        }
    }

    // --- GAME FLOW ---
    function startGame(levelNumber) {
        if (submittedAnalyticsLevels.has(Number(levelNumber))) {
            initializeAnalyticsRun(true);
            postAnalyticsDebug('run_restarted_for_level_replay', { runId: currentRunId, levelNumber });
        }

        currentLevel = levelNumber;
        generatePuzzle(levelNumber);
        
        // Analytics - Reset level counters
        levelResetCount = 0;
        levelClearCount = 0;
        
        if (analytics) {
            analytics.startLevel(levelNumber, { levelNumber });
            levelStartTime = Date.now();
            isLevelActive = true;
            postAnalyticsDebug('level_started', { runId: currentRunId, levelNumber });
        }

        // UI Transition: Fade out whichever menu screen is active
        const outgoing = (levelContent.style.display === 'flex') ? levelContent : startContent;
        outgoing.style.opacity = '0';
        outgoing.style.transform = 'translateY(-15px)';
        outgoing.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            // Ensure all menu screens are hidden + styles reset for return
            [startContent, levelContent].forEach(el => {
                el.style.display = 'none';
                el.style.opacity = '';
                el.style.transform = '';
                el.style.transition = '';
            });
            
            gameContent.style.display = 'flex';
            
            // Ensure background music is playing when a game starts
            if (gameAudio.paused) {
                startBackgroundMusic();
            }
        }, 300);
    }

    function returnToStartScreen() {
        if (analytics && isLevelActive) {
            const timeTaken = Date.now() - levelStartTime;
            analytics.endLevel(currentLevel, false, timeTaken, 0);
            // Track level abandonment metrics without submitting an XP payload.
            analytics.addRawMetric('Level_Abandoned', currentLevel);
            analytics.addRawMetric(`Level_${currentLevel}_Resets`, levelResetCount);
            analytics.addRawMetric(`Level_${currentLevel}_Clears`, levelClearCount);
            postAnalyticsDebug('level_abandoned', { runId: currentRunId, levelNumber: currentLevel, timeTaken });
            isLevelActive = false;
        }

        // UI Transition: Fade out game screen
        gameContent.style.opacity = '0';
        gameContent.style.transform = 'translateY(15px)';
        gameContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            gameContent.style.display = 'none';
            // Reset styles
            gameContent.style.opacity = '';
            gameContent.style.transform = '';
            gameContent.style.transition = '';

            // Return to the level selection screen for the active difficulty
            // (rather than jumping all the way back to the mode-selection screen).
            if (activeDifficultyKey) {
                buildLevelGrid(activeDifficultyKey);
                levelContent.style.display = 'flex';
            } else {
                startContent.style.display = 'flex';
                updateStartScreen();
            }
        }, 300);
    }

    // --- HOME <-> SELECT MODE NAVIGATION (UI only) ---
    function showSelectMode() {
        homeContent.style.opacity = '0';
        homeContent.style.transform = 'translateY(-15px)';
        homeContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            homeContent.style.display = 'none';
            homeContent.style.opacity = '';
            homeContent.style.transform = '';
            homeContent.style.transition = '';

            startContent.style.display = 'flex';
            updateStartScreen();
        }, 300);
    }

    function showHomeScreen() {
        startContent.style.opacity = '0';
        startContent.style.transform = 'translateY(15px)';
        startContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            startContent.style.display = 'none';
            startContent.style.opacity = '';
            startContent.style.transform = '';
            startContent.style.transition = '';

            homeContent.style.display = 'flex';
        }, 300);
    }

    // --- LEVEL SELECTOR (UI only; uses existing unlock + startGame logic) ---
    const LOCK_SVG = '<svg class="level-lock" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';

    function buildLevelGrid(difficultyKey) {
        const diff = config.difficulties[difficultyKey];
        if (!diff) return;

        levelGrid.innerHTML = '';

        const [rangeStart, rangeEnd] = diff.levelRange;
        // The next level the player can play (first uncompleted level).
        const nextPlayable = playerProgress.highestLevelCompleted + 1;

        for (let lvl = rangeStart; lvl <= rangeEnd; lvl++) {
            // A level exists in data and is unlocked once all prior levels are done.
            const levelExists = levels.some(l => l.level === lvl);
            const unlocked = lvl <= nextPlayable && levelExists;

            const tile = document.createElement('button');
            tile.className = 'level-tile';
            tile.dataset.level = String(lvl);

            const label = document.createElement('span');
            label.textContent = String(lvl);
            tile.appendChild(label);

            if (!unlocked) {
                tile.classList.add('locked');
                tile.disabled = true;
                tile.insertAdjacentHTML('beforeend', LOCK_SVG);
            } else {
                if (lvl === nextPlayable) {
                    tile.classList.add('current');
                }
                tile.addEventListener('click', () => startGame(lvl));
            }

            levelGrid.appendChild(tile);
        }

        // Continue button: jump to the next playable level within this difficulty.
        let continueLevel = nextPlayable;
        if (continueLevel < rangeStart) continueLevel = rangeStart;
        if (continueLevel > rangeEnd) continueLevel = rangeStart;
        continueLevelBtn.querySelector('span').textContent = `CONTINUE LEVEL ${continueLevel}`;
        continueLevelBtn.dataset.level = String(continueLevel);
    }

    function showLevelSelect(difficultyKey) {
        activeDifficultyKey = difficultyKey;
        const diff = config.difficulties[difficultyKey];
        levelScreenTitle.textContent = (diff && diff.displayName ? diff.displayName : difficultyKey).toUpperCase();
        buildLevelGrid(difficultyKey);

        startContent.style.opacity = '0';
        startContent.style.transform = 'translateY(-15px)';
        startContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            startContent.style.display = 'none';
            startContent.style.opacity = '';
            startContent.style.transform = '';
            startContent.style.transition = '';

            levelContent.style.display = 'flex';
        }, 300);
    }

    function backToSelectMode() {
        levelContent.style.opacity = '0';
        levelContent.style.transform = 'translateY(15px)';
        levelContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        setTimeout(() => {
            levelContent.style.display = 'none';
            levelContent.style.opacity = '';
            levelContent.style.transform = '';
            levelContent.style.transition = '';

            startContent.style.display = 'flex';
            updateStartScreen();
        }, 300);
    }

    function onPuzzleComplete() {
        if (analytics && isLevelActive) {
            const timeTaken = Date.now() - levelStartTime;
            analytics.recordTask(
                currentLevel,
                `crossmath_level_${currentLevel}_complete`,
                `Complete CrossMath level ${currentLevel}`,
                'completed',
                'completed',
                timeTaken,
                getLevelCompletionXp(currentLevel)
            );
            analytics.endLevel(currentLevel, true, timeTaken, getLevelCompletionXp(currentLevel));
            analytics.addRawMetric(`Level_${currentLevel}_Completed`, true);
            analytics.addRawMetric(`Level_${currentLevel}_Resets`, levelResetCount);
            analytics.addRawMetric(`Level_${currentLevel}_Clears`, levelClearCount);
            analytics.addRawMetric(`Level_${currentLevel}_TimeTaken`, timeTaken);
            const payload = analytics.submitLevel(currentLevel, { runId: currentRunId });
            if (payload && payload.success === false) {
                console.error('[Analytics] CrossMath level submit rejected:', payload.errors);
                postAnalyticsDebug('submit_rejected', { runId: currentRunId, levelNumber: currentLevel, errors: payload.errors });
            } else {
                submittedAnalyticsLevels.add(currentLevel);
                postAnalyticsDebug('submit_success', { runId: currentRunId, levelNumber: currentLevel, xpEarned: getLevelCompletionXp(currentLevel) });
            }
            isLevelActive = false;
        }

        // Update progress
        const wasNewHighest = currentLevel > playerProgress.highestLevelCompleted;
        
        if (wasNewHighest) {
            playerProgress.highestLevelCompleted = currentLevel;
            
            // Use GameManager to handle level completion
            if (gameManager) {
                gameManager.handleLevelComplete(currentLevel, {
                    xpEarned: getLevelCompletionXp(currentLevel),
                    timeTaken: Date.now() - levelStartTime,
                    resets: levelResetCount,
                    clears: levelClearCount,
                }).then(() => {
                    console.log('[Game] Progress synced via GameManager');
                    updateStartScreen();
                }).catch(err => {
                    console.error('[Game] Error saving progress:', err);
                });
            } else {
                // Fallback to old method
                saveProgress();
                updateStartScreen();
            }
        }

        // Play completion sound
        playSound(completionSound);

        successModal.style.display = 'flex';
        setTimeout(() => {
            successModal.classList.add('visible');
        }, 10);
    }

    // --- PUZZLE GENERATION ---
    function generatePuzzle(levelNumber) {
        const puzzle = levels.find(l => l.level === levelNumber);
        if (!puzzle) {
            console.error(`Puzzle for level ${levelNumber} not found!`);
            returnToStartScreen();
            return;
        }

        const difficultyKey = Object.keys(config.difficulties).find(key => {
            const diff = config.difficulties[key];
            return levelNumber >= diff.levelRange[0] && levelNumber <= diff.levelRange[1];
        });
        const difficulty = config.difficulties[difficultyKey];

        levelDisplay.textContent = `Level ${puzzle.level}`;
        difficultyDisplay.textContent = difficulty.displayName;

        gridElement.innerHTML = '';
        numberBankElement.innerHTML = '';
        placementHistory = [];
        
        // Get grid dimensions
        const gridSize = puzzle.grid.length;
        
        // Calculate cell size based on grid dimensions
        // For larger grids, make cells smaller
        let cellSize;
        if (gridSize <= 5) {
            cellSize = 50; // Original size for 5×5 grids
        } else if (gridSize === 6) {
            cellSize = 45; // Slightly smaller for 6×6
        } else {
            cellSize = 40; // Even smaller for 7×7
        }
        
        // Set grid template columns based on the number of columns in the grid
        // Use 'auto' to allow the column width to adjust based on the cell size (which is controlled by CSS/JS)
        gridElement.style.gridTemplateColumns = `repeat(${puzzle.grid[0].length}, auto)`;
        
        // Add a data attribute to the grid element for CSS targeting
        gridElement.dataset.gridSize = gridSize;

        puzzle.grid.forEach((row, r) => {
            row.forEach((content, c) => {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // Set cell size dynamically
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                
                // Adjust font size for larger grids
                if (gridSize > 5) {
                    cell.style.fontSize = `${24 - (gridSize - 5) * 2}px`;
                }

                if (puzzle.emptyCells.some(ec => ec.r === r && ec.c === c)) {
                    cell.classList.add('empty');
                    cell.addEventListener('click', () => onCellClick(cell));
                } else if (content === B) {
                    cell.classList.add('blank');
                } else {
                    // Display '×' for multiplication instead of '*'
                    cell.textContent = content === '*' ? '×' : content;
                    cell.classList.add('static');
                }
                gridElement.appendChild(cell);
            });
        });

        puzzle.numbers.sort((a, b) => a - b).forEach((num, index) => {
            const numItem = document.createElement('div');
            numItem.classList.add('number-item');
            numItem.textContent = num;
            numItem.dataset.id = `bank-${index}`;
            numItem.addEventListener('click', () => selectNumberFromBank(num, numItem));
            numberBankElement.appendChild(numItem);
        });
        equationStates.clear();

        clearSelection();
    }

    function onCellClick(cell) {
        if (selectedValue !== null) {
            placeNumber(cell);
        } else if (cell.textContent !== '') {
            pickupNumberFromGrid(cell);
        }
    }

    function selectNumberFromBank(num, element) {
        if (element.classList.contains('used')) return;
        if (selectedElement === element) { clearSelection(); return; }
        clearSelection();
        selectedValue = num;
        selectedElement = element;
        element.classList.add('selected');
        
        // Start task timing when number is selected
        taskStartTime = Date.now();
    }

    function pickupNumberFromGrid(cell) {
        const num = parseInt(cell.textContent);

        const bankItems = Array.from(numberBankElement.children);
        for (let i = 0; i < bankItems.length; i++) {
            if (parseInt(bankItems[i].textContent) === num && bankItems[i].classList.contains('used')) {
                bankItems[i].classList.remove('used');
                break;
            }
        }

        cell.textContent = '';
        cell.classList.remove('correct', 'incorrect');
        placementHistory = placementHistory.filter(item => item.cell !== cell);
        validateEquations();
    }

    function placeNumber(targetCell) {
        if (targetCell.textContent !== '') { pickupNumberFromGrid(targetCell); }

        targetCell.textContent = selectedValue;
        
        // Analytics Task Recording with timing
        if (analytics && isLevelActive) {
             const r = parseInt(targetCell.dataset.row);
             const c = parseInt(targetCell.dataset.col);
             const puzzle = levels.find(l => l.level === currentLevel);
             if (puzzle) {
                 const correctVal = puzzle.grid[r][c];
                 const isCorrect = (String(selectedValue) === String(correctVal));
                 const taskTime = taskStartTime > 0 ? Date.now() - taskStartTime : 0;
                 
                 analytics.recordTask(
                     `Level_${currentLevel}`,
                     `Task_Place_${Date.now()}`,
                     `Fill Cell (${r},${c})`,
                     String(correctVal),
                     String(selectedValue),
                     taskTime, 
                     isCorrect ? 1 : 0
                 );
                 
                 // Track incorrect placements as a metric
                 if (!isCorrect) {
                     analytics.addRawMetric(`Level_${currentLevel}_IncorrectPlacements`, 1);
                 }
             }
        }
        
        // Reset task timer for next placement
        taskStartTime = Date.now();

        // Add animation feedback
        targetCell.classList.remove('animate-pop');
        void targetCell.offsetWidth; // Force reflow
        targetCell.classList.add('animate-pop');

        selectedElement.classList.add('used');
        placementHistory.push({ cell: targetCell, bankItem: selectedElement });

        clearSelection();
        validateEquations();
    }

    function clearSelection() {
        if (selectedElement) { selectedElement.classList.remove('selected'); }
        selectedValue = null;
        selectedElement = null;
    }

    function clearLastEntry() {
        if (placementHistory.length > 0) {
            const lastPlacement = placementHistory.pop();
            const lastCell = lastPlacement.cell;
            lastCell.textContent = '';
            lastCell.classList.remove('correct', 'incorrect');
            lastPlacement.bankItem.classList.remove('used');
            validateEquations();
            
            // Analytics - Track clear usage
            if (analytics && isLevelActive) {
                levelClearCount++;
                analytics.addRawMetric('Clear_Button_Used', `Level_${currentLevel}`);
            }
        }
    }

    // --- EQUATION VALIDATION (Corrected for Left-to-Right Calculation) ---
    function validateEquations() {
        // Clear all previous visual styles before re-evaluating
        gridElement.querySelectorAll('.cell.correct, .cell.incorrect').forEach(c => {
            c.classList.remove('correct', 'incorrect');
        });

        const puzzle = levels.find(l => l.level === currentLevel);
        if (!puzzle) return;

        const equations = findEquations();
        const newStates = new Map(); // Temporarily store the new state of all equations
        let allEquationsCorrect = true;

        const allEmptyCellsFilled = puzzle.emptyCells.every(ec => {
            const cell = gridElement.querySelector(`[data-row='${ec.r}'][data-col='${ec.c}']`);
            return cell && cell.textContent;
        });

        equations.forEach(eq => {
            // A unique key to identify each equation (e.g., "H-0-0" for Horizontal at row 0, col 0)
            const eqKey = `${eq.type}-${eq.start.r}-${eq.start.c}`;
            
            const numbers = eq.operandCells.map(cellPos => {
                const cell = gridElement.querySelector(`[data-row='${cellPos.r}'][data-col='${cellPos.c}']`);
                return parseInt(cell.textContent, 10);
            });
            const resultVal = parseInt(gridElement.querySelector(`[data-row='${eq.resultCell.r}'][data-col='${eq.resultCell.c}']`).textContent, 10);

            let currentState;

            // Determine the current state: incomplete, correct, or incorrect
            if (numbers.some(isNaN) || isNaN(resultVal)) {
                currentState = 'incomplete';
                allEquationsCorrect = false;
            } else {
                // This equation is fully populated, so let's validate it
                let finalResult = numbers[0];
                let calculationIsValid = true;
                for (let i = 0; i < eq.operators.length; i++) {
                    const operator = eq.operators[i];
                    const nextNumber = numbers[i + 1];
                    switch (operator) {
                        case '+': finalResult += nextNumber; break;
                        case '-': finalResult -= nextNumber; break;
                        case '*': finalResult *= nextNumber; break;
                        case '/':
                            if (nextNumber === 0 || finalResult % nextNumber !== 0) {
                                calculationIsValid = false;
                            } else {
                                finalResult /= nextNumber;
                            }
                            break;
                    }
                    if (!calculationIsValid) break;
                }

                if (calculationIsValid && finalResult === resultVal) {
                    currentState = 'correct';
                } else {
                    currentState = 'incorrect';
                    allEquationsCorrect = false;
                }
            }

            // --- State Change Logic for Audio Feedback ---
            const oldState = equationStates.get(eqKey);
            if (currentState !== oldState) {
                if (currentState === 'correct') {
                    playSound(correctSound); // Play sound ONLY when it becomes correct
                } else if (currentState === 'incorrect') {
                    playSound(incorrectSound); // Play sound ONLY when it becomes incorrect
                }
            }

            // Apply visual feedback based on the current state (if not incomplete)
            if (currentState === 'correct' || currentState === 'incorrect') {
                const cssClass = currentState; // 'correct' or 'incorrect'
                eq.allCells.forEach(cellPos => {
                    const cell = gridElement.querySelector(`[data-row='${cellPos.r}'][data-col='${cellPos.c}']`);
                    if (cell) cell.classList.add(cssClass);
                });
            }

            newStates.set(eqKey, currentState); // Store the new state
        });
        
        // After checking all equations, update the global state for the next move
        equationStates = newStates;

        // Check for puzzle completion
        if (allEmptyCellsFilled && allEquationsCorrect && equations.length > 0) {
            onPuzzleComplete();
        }
    }



    // *** REWRITTEN FUNCTION ***
    // This new function is more reliable as it looks for the '=' sign to define an equation,
    // which matches the structure of your puzzle grid.
    // Update the findEquations function to work with any grid size

    // This function dynamically finds equations of any length in the grid.
    function findEquations() {
        const puzzle = levels.find(l => l.level === currentLevel);
        if (!puzzle) return [];

        const grid = puzzle.grid;
        const gridSize = grid.length;
        const equations = [];

        // Scan for HORIZONTAL equations
        for (let r = 0; r < gridSize; r++) {
            const eqIndex = grid[r].indexOf('=');
            if (eqIndex > 1 && eqIndex < grid[r].length - 1) {
                const equation = {
                    type: 'H',
                    start: { r: r, c: 0 },
                    operandCells: [],
                    operators: [],
                    resultCell: { r: r, c: eqIndex + 1 },
                    allCells: [{ r: r, c: eqIndex + 1 }]
                };
                for (let c = 0; c < eqIndex; c++) {
                    if (c % 2 === 0) {
                        equation.operandCells.push({ r: r, c: c });
                        equation.allCells.push({ r: r, c: c });
                    } else {
                        equation.operators.push(grid[r][c]);
                    }
                }
                if (equation.operandCells.length > 1) {
                    equations.push(equation);
                }
            }
        }

        // Scan for VERTICAL equations
        for (let c = 0; c < grid[0].length; c++) {
            let eqIndex = -1;
            for (let r = 0; r < gridSize; r++) { if (grid[r][c] === '=') { eqIndex = r; break; } }
            
            if (eqIndex > 1 && eqIndex < gridSize - 1) {
                const equation = {
                    type: 'V',
                    start: { r: 0, c: c },
                    operandCells: [],
                    operators: [],
                    resultCell: { r: eqIndex + 1, c: c },
                    allCells: [{ r: eqIndex + 1, c: c }]
                };
                for (let r = 0; r < eqIndex; r++) {
                    if (r % 2 === 0) {
                        equation.operandCells.push({ r: r, c: c });
                        equation.allCells.push({ r: r, c: c });
                    } else {
                        equation.operators.push(grid[r][c]);
                    }
                }
                if (equation.operandCells.length > 1) {
                    equations.push(equation);
                }
            }
        }
        return equations;
    }
    function completeLevelForTest() {
        const puzzle = levels.find(l => l.level === currentLevel);
        if (!puzzle) {
            return false;
        }

        puzzle.emptyCells.forEach(({ r, c, value }) => {
            const cell = gridElement.querySelector(`[data-row='${r}'][data-col='${c}']`);
            if (cell) {
                cell.textContent = value !== undefined ? value : puzzle.grid[r][c];
                cell.classList.remove('incorrect');
                cell.classList.add('correct');
            }
        });

        validateEquations();
        postAnalyticsDebug('dev_complete_triggered', { runId: currentRunId, levelNumber: currentLevel });
        return true;
    }

    window.__completeLevelForTest = completeLevelForTest;

    document.addEventListener('keydown', (event) => {
        if (!ENABLE_DEV_COMPLETE_SHORTCUT || event.key.toLowerCase() !== 'c') {
            return;
        }

        completeLevelForTest();
    });

    // --- Event Listeners ---
    // New event listeners for rules modal
    infoBtn.addEventListener('click', () => {
        showRulesModal();
        if (analytics) {
            analytics.addRawMetric('Rules_Modal_Opened', Date.now());
        }
    });
    if (tutorialCloseBtn) tutorialCloseBtn.addEventListener('click', hideRulesModal);
    if (tutorialNextBtn) tutorialNextBtn.addEventListener('click', advanceTutorial);

    // Tutorial interactions: clicking the highlighted number or the target box advances.
    if (tutorialBankEl) {
        tutorialBankEl.addEventListener('click', (e) => {
            const num = e.target.closest('.tnum');
            if (!num || num.classList.contains('used')) return;
            if (tutorialStep === 0 && num.dataset.num === '2') {
                advanceTutorial();
            }
        });
    }
    if (tutorialGridEl) {
        tutorialGridEl.addEventListener('click', (e) => {
            const cell = e.target.closest('.tcell--slot');
            if (!cell || !cell.classList.contains('active-target')) return;
            if (tutorialStep === 1 && cell.dataset.slot === 'c') {
                advanceTutorial();
            } else if (tutorialStep === 2 && cell.dataset.slot === 'r') {
                advanceTutorial();
            }
        });
    }

    // Home / Select-mode navigation
    if (playNowBtn) playNowBtn.addEventListener('click', showSelectMode);
    if (modeBackBtn) modeBackBtn.addEventListener('click', showHomeScreen);
    if (howToPlayBtn) {
        howToPlayBtn.addEventListener('click', () => {
            showRulesModal();
            if (analytics) {
                analytics.addRawMetric('Rules_Modal_Opened', Date.now());
            }
        });
    }

    // Existing event listeners
    backBtn.addEventListener('click', returnToStartScreen);
    clearBtn.addEventListener('click', clearLastEntry);
    resetBtn.addEventListener('click', () => {
        generatePuzzle(currentLevel);
        // Analytics - Track reset usage
        if (analytics && isLevelActive) {
            levelResetCount++;
            analytics.addRawMetric('Reset_Button_Used', `Level_${currentLevel}`);
        }
    });

    playAgainBtn.addEventListener('click', () => {
        successModal.classList.remove('visible');
        setTimeout(() => {
            successModal.style.display = 'none';
            generatePuzzle(currentLevel);
            
            // Analytics - Track replay
            levelResetCount = 0;
            levelClearCount = 0;
            if (analytics) {
                if (submittedAnalyticsLevels.has(Number(currentLevel))) {
                    initializeAnalyticsRun(true);
                    postAnalyticsDebug('run_restarted_for_play_again', { runId: currentRunId, levelNumber: currentLevel });
                }

                analytics.startLevel(currentLevel, { levelNumber: currentLevel });
                analytics.addRawMetric('Level_Replayed', currentLevel);
                levelStartTime = Date.now();
                isLevelActive = true;
            }
        }, 300);
    });

    nextLevelBtn.addEventListener('click', () => {
        successModal.classList.remove('visible');
        const nextLevel = currentLevel + 1;
        if (levels.find(l => l.level === nextLevel)) {
            setTimeout(() => {
                successModal.style.display = 'none';
                startGame(nextLevel);
            }, 300);
        } else {
            setTimeout(() => {
                successModal.style.display = 'none';
                alert("Congratulations! You've completed all levels!");
                returnToStartScreen();
            }, 300);
        }
    });

    easyBtn.addEventListener('click', () => {
        // Analytics - Track difficulty selection
        if (analytics) {
            analytics.addRawMetric('Difficulty_Selected', 'Easy');
        }
        showLevelSelect('easy');
    });
    mediumBtn.addEventListener('click', () => {
        // Analytics - Track difficulty selection
        if (analytics) {
            analytics.addRawMetric('Difficulty_Selected', 'Medium');
        }
        showLevelSelect('medium');
    });
    hardBtn.addEventListener('click', () => {
        // Analytics - Track difficulty selection
        if (analytics) {
            analytics.addRawMetric('Difficulty_Selected', 'Hard');
        }
        showLevelSelect('hard');
    });

    // Level selector navigation
    if (levelBackBtn) levelBackBtn.addEventListener('click', backToSelectMode);
    if (continueLevelBtn) {
        continueLevelBtn.addEventListener('click', () => {
            const lvl = parseInt(continueLevelBtn.dataset.level, 10);
            if (!isNaN(lvl)) {
                if (analytics) {
                    analytics.addRawMetric('Level_Started_From_Menu', lvl);
                }
                startGame(lvl);
            }
        });
    }

    // --- DEBUG TOOLS ---
    const debugPanel = document.getElementById('debug-panel');
    const toggleDebugBtn = document.getElementById('toggle-debug-btn');
    const levelInput = document.getElementById('level-input');
    const jumpLevelBtn = document.getElementById('jump-level-btn');
    const validateGridBtn = document.getElementById('validate-grid-btn');
    const resetProgressBtn = document.getElementById('reset-progress-btn');

    // Toggle debug panel visibility
    toggleDebugBtn.addEventListener('click', () => {
        debugPanel.classList.toggle('open');
    });

    // Jump to a specific level
    jumpLevelBtn.addEventListener('click', () => {
        const levelNumber = parseInt(levelInput.value);
        if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > levels.length) {
            alert(`Please enter a valid level number between 1 and ${levels.length}`);
            return;
        }
        
        startGame(levelNumber);
        
        // Optional: Close debug panel after jumping to level
        debugPanel.classList.remove('open');
    });

    // Manually trigger validation for debugging
    validateGridBtn.addEventListener('click', () => {
        validateEquations();
        
        // Log additional debug info
        const puzzle = levels.find(l => l.level === currentLevel);
        if (puzzle) {
            const emptyCellsFilled = puzzle.emptyCells.every(ec => {
                const cell = gridElement.querySelector(`[data-row='${ec.r}'][data-col='${ec.c}']`);
                return cell && cell.textContent;
            });
            
            console.log('Debug validation info:');
            console.log('- All empty cells filled:', emptyCellsFilled);
            console.log('- Expected empty cell values:', puzzle.emptyCells.map(ec => ec.value));
            console.log('- Actual values in grid:');
            
            puzzle.emptyCells.forEach(ec => {
                const cell = gridElement.querySelector(`[data-row='${ec.r}'][data-col='${ec.c}']`);
                console.log(`  Cell [${ec.r},${ec.c}]: expected=${ec.value}, actual=${cell ? cell.textContent : 'empty'}`);
            });
        }
    });

    // Reset player progress (for testing)
    resetProgressBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all progress? This will remove all level completions.')) {
            if (gameManager) {
                // Use GameManager to reset
                gameManager.resetProgress().then(() => {
                    playerProgress = { highestLevelCompleted: 0 };
                    updateStartScreen();
                    alert('Progress has been reset');
                }).catch(err => {
                    console.error('[Game] Error resetting progress:', err);
                });
            } else {
                // Fallback to old method
                playerProgress = { highestLevelCompleted: 0 };
                saveProgress();
                updateStartScreen();
                alert('Progress has been reset');
            }
        }
    });

    // Update level input max value once levels are loaded
    levelInput.max = levels.length;

    // Debug mode key sequence detector (type "debug" to enable)
    const debugSequence = ['d', 'e', 'b', 'u', 'g'];
    let debugKeyBuffer = [];

    document.addEventListener('keydown', (e) => {
        // Only track alphabetic keys
        if (/^[a-z]$/i.test(e.key)) {
            const key = e.key.toLowerCase();
            debugKeyBuffer.push(key);
            
            // Keep only the last 5 keys
            if (debugKeyBuffer.length > 5) {
                debugKeyBuffer.shift();
            }
            
            // Check if the sequence matches
            const sequenceMatches = debugKeyBuffer.join('') === debugSequence.join('');
            
            if (sequenceMatches) {
                // Toggle debug panel visibility
                debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
                debugKeyBuffer = []; // Reset the buffer
            }
        }
    });
});