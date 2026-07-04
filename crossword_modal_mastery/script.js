document.addEventListener('DOMContentLoaded', () => {
    const ENABLE_DEV_COMPLETE_SHORTCUT = false;
    const CROSSWORD_MAX_TOTAL_XP = 200;

    // DOM Elements
    const gridElement = document.getElementById('crossword-grid');
    const acrossCluesElement = document.getElementById('across-clues');
    const downCluesElement = document.getElementById('down-clues');
    const titleElement = document.getElementById('puzzle-title');
    const levelSubtitle = document.getElementById('level-subtitle');
    const checkButton = document.getElementById('check-btn');
    const clearButton = document.getElementById('clear-btn');
    const successOverlay = document.getElementById('success-overlay');
    const adminPanel = document.getElementById('admin-panel');
    const gameContainer = document.querySelector('.game-container');
    const hintDisplay = document.getElementById('hint-display');
    const currentXPElement = document.getElementById('current-xp');
    const maxXPElement = document.getElementById('max-xp');
    const earnedXPElement = document.getElementById('earned-xp');
    const completionMessage = document.getElementById('completion-message');
    const accuracyDisplayElement = document.getElementById('accuracy-display');
    const timeDisplayElement = document.getElementById('time-display');
    const factTextElement = document.getElementById('fact-text');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const replayBtn = document.getElementById('replay-btn');
    const currentAccuracyValue = document.getElementById('accuracy-value');
    const attemptsValue = document.getElementById('attempts-value');
    const level1Btn = document.querySelector('.level-btn[data-level="1"]');
    const level2Btn = document.querySelector('.level-btn[data-level="2"]');

    // State Management
    let currentPuzzleData = null;
    let gridState;
    let currentDirection = 'across';
    let activeClueInfo = null;
    let lastFocusedCell = { row: -1, col: -1 };
    let currentLevel = 1;
    let totalXP = 0;
    let level1XP = 0;
    let level2XP = 0;
    let level1Completed = false;
    let level2Completed = false;
    let level1Attempted = false;
    let wordAttempts = {}; // Track attempts per word

    // Analytics Setup
    const analytics = AnalyticsManager.getInstance();
    let analyticsRunId = '';
    let levelStartTime = 0;
    let checkAttempts = 0;
    let allPuzzleAnswerCounts = { 1: 10, 2: 10 };
    let currentAnswerLevels = [];
    const submittedModalLevels = new Set();

    function createRunId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `crossword_modal_mastery_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function postAnalyticsDebug(event, detail = {}) {
        try {
            window.parent.postMessage({
                __analyticsDebug: true,
                game: 'crossword_modal_mastery',
                event,
                detail,
                at: new Date().toISOString()
            }, '*');
        } catch (_error) {
            // Debug-only for local harness visibility.
        }
    }

    function getTotalAnswerCount() {
        return Object.values(allPuzzleAnswerCounts).reduce((total, count) => total + count, 0);
    }

    function getLevelOffset(levelNumber) {
        let offset = 0;
        for (let level = 1; level < levelNumber; level++) {
            offset += allPuzzleAnswerCounts[level] || 0;
        }
        return offset;
    }

    function getModalLevelXp(levelNumber) {
        const totalLevels = getTotalAnswerCount();
        const baseXp = Math.floor(CROSSWORD_MAX_TOTAL_XP / totalLevels);
        const extraXpLevels = CROSSWORD_MAX_TOTAL_XP % totalLevels;
        return baseXp + (levelNumber <= extraXpLevels ? 1 : 0);
    }

    function buildAnswerLevels(puzzleData) {
        const puzzleLevel = puzzleData.metadata.level || currentLevel;
        const offset = getLevelOffset(puzzleLevel);
        const allClues = [...puzzleData.clues.across, ...puzzleData.clues.down];
        return allClues.map((clue, index) => {
            const levelNumber = offset + index + 1;
            return {
                clue,
                puzzleLevel,
                levelNumber,
                xp: getModalLevelXp(levelNumber)
            };
        });
    }

    function isClueSolved(clue) {
        const expectedAnswer = clue.answer.toUpperCase();
        for (let i = 0; i < expectedAnswer.length; i++) {
            const row = clue.direction === 'across' ? clue.row : clue.row + i;
            const col = clue.direction === 'across' ? clue.col + i : clue.col;
            const input = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"] input`);
            if (!input || input.value.toUpperCase() !== expectedAnswer[i]) {
                return false;
            }
        }

        return true;
    }

    async function loadPuzzleAnswerCounts() {
        try {
            const [level1Response, level2Response] = await Promise.all([
                fetch('puzzle.json'),
                fetch('puzzle-level2.json')
            ]);
            const [level1Data, level2Data] = await Promise.all([
                level1Response.json(),
                level2Response.json()
            ]);
            allPuzzleAnswerCounts = {
                1: level1Data.clues.across.length + level1Data.clues.down.length,
                2: level2Data.clues.across.length + level2Data.clues.down.length
            };
        } catch (error) {
            console.warn('[Analytics] Could not preload answer counts, using defaults.', error);
        }
    }

    function initializeAnalyticsRun() {
        if (analyticsRunId) {
            return;
        }

        analyticsRunId = createRunId();
        analytics.initialize('crossword_modal_mastery', analyticsRunId);
        analytics.addRawMetric('max_total_xp', String(CROSSWORD_MAX_TOTAL_XP));
        analytics.addRawMetric('total_answer_count', String(getTotalAnswerCount()));
        analytics.addRawMetric('level_1_answer_count', String(allPuzzleAnswerCounts[1] || 0));
        analytics.addRawMetric('level_2_answer_count', String(allPuzzleAnswerCounts[2] || 0));
        postAnalyticsDebug('run_started', { runId: analyticsRunId, totalAnswers: getTotalAnswerCount() });
    }

    function startAnalyticsLevelsForCurrentPuzzle(metadata) {
        initializeAnalyticsRun();
        currentAnswerLevels = buildAnswerLevels(currentPuzzleData);
        currentAnswerLevels.forEach(({ clue, levelNumber, puzzleLevel, xp }) => {
            if (submittedModalLevels.has(levelNumber)) {
                return;
            }

            analytics.startLevel(levelNumber, { levelNumber });
            analytics.addRawMetric(`level_${levelNumber}_puzzle_level`, String(puzzleLevel));
            analytics.addRawMetric(`level_${levelNumber}_answer`, clue.answer.toUpperCase());
            analytics.addRawMetric(`level_${levelNumber}_clue`, clue.clue);
            analytics.addRawMetric(`level_${levelNumber}_xp`, String(xp));
        });
        levelStartTime = Date.now();
        console.log('[Analytics] Modal answer levels started:', {
            puzzleLevel: metadata.level,
            count: currentAnswerLevels.length,
            runId: analyticsRunId
        });
        postAnalyticsDebug('levels_started', {
            puzzleLevel: metadata.level,
            count: currentAnswerLevels.length,
            runId: analyticsRunId
        });
    }

    function submitModalLevel(levelInfo, metrics = {}) {
        const { clue, levelNumber, puzzleLevel, xp } = levelInfo;
        if (submittedModalLevels.has(levelNumber)) {
            postAnalyticsDebug('submit_skipped_duplicate', { level: levelNumber, runId: analyticsRunId });
            return null;
        }

        Object.entries(metrics).forEach(([key, value]) => {
            analytics.addRawMetric(key, String(value));
        });
        const timeTaken = Date.now() - levelStartTime;
        analytics.endLevel(levelNumber, true, timeTaken, xp);
        analytics.recordTask(
            levelNumber,
            `modal_answer_${levelNumber}`,
            clue.clue,
            clue.answer.toUpperCase(),
            clue.answer.toUpperCase(),
            timeTaken,
            xp
        );

        const payload = analytics.submitLevel(levelNumber, { runId: analyticsRunId });
        if (payload && payload.success === false) {
            console.error('[Analytics] Level submit rejected:', payload.errors);
            postAnalyticsDebug('submit_rejected', { level: levelNumber, runId: analyticsRunId, errors: payload.errors });
            return payload;
        }

        submittedModalLevels.add(levelNumber);
        try {
            window.parent.postMessage(payload, '*');
        } catch (_error) {
            // Bridge already attempted delivery; this supports the local harness.
        }
        console.log('[Analytics] Modal answer level submitted:', {
            level: levelNumber,
            puzzleLevel,
            runId: analyticsRunId,
            xp,
            answer: clue.answer
        });
        postAnalyticsDebug('submit_success', {
            level: levelNumber,
            puzzleLevel,
            runId: analyticsRunId,
            xpEarned: xp,
            answer: clue.answer
        });
        return payload;
    }

    function submitCompletedModalAnswers(metrics = {}) {
        let submittedCount = 0;
        currentAnswerLevels.forEach(levelInfo => {
            if (!submittedModalLevels.has(levelInfo.levelNumber) && isClueSolved(levelInfo.clue)) {
                submitModalLevel(levelInfo, metrics);
                submittedCount++;
            }
        });

        return submittedCount;
    }

    function getSubmittedXpForPuzzle(puzzleLevel) {
        return currentAnswerLevels.reduce((total, levelInfo) => {
            return total + (
                levelInfo.puzzleLevel === puzzleLevel && submittedModalLevels.has(levelInfo.levelNumber)
                    ? levelInfo.xp
                    : 0
            );
        }, 0);
    }

    // --- GAME FLOW & INITIALIZATION ---

    async function startGame() {
        await loadPuzzleAnswerCounts();
        initializeAnalyticsRun();

        // Try to load saved progress
        const savedProgress = localStorage.getItem('modalMasteryProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            totalXP = progress.totalXP || 0;
            level1XP = progress.level1XP || 0;
            level2XP = progress.level2XP || 0;
            level1Completed = progress.level1Completed || false;
            level2Completed = progress.level2Completed || false;
            level1Attempted = progress.level1Attempted || false;
            currentLevel = progress.currentLevel || 1;
        }
        
        updateXPDisplay();
        unlockLevelsBasedOnProgress();
        await loadLevel(currentLevel);
    }

    async function loadLevel(levelNum) {
        try {
            const puzzleFile = levelNum === 1 ? 'puzzle.json' : 'puzzle-level2.json';
            const response = await fetch(puzzleFile);
            currentPuzzleData = await response.json();
            currentLevel = levelNum;
            initializeGame();
            updateLevelButtons();
        } catch(error) {
            console.error("Failed to load level:", error);
            alert(`Could not load Level ${levelNum}. Please check the puzzle file.`);
        }
    }

    function unlockLevelsBasedOnProgress() {
        if (level1Attempted || level1Completed) {
            level2Btn.disabled = false;
            level2Btn.textContent = 'Level 2';
        }
    }

    function updateLevelButtons() {
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.level) === currentLevel) {
                btn.classList.add('active');
            }
        });
    }

    function updateXPDisplay() {
        currentXPElement.textContent = totalXP;
    }

    function saveProgress() {
        const progress = {
            totalXP,
            level1XP,
            level2XP,
            level1Completed,
            level2Completed,
            level1Attempted,
            currentLevel
        };
        localStorage.setItem('modalMasteryProgress', JSON.stringify(progress));
    }

    function initializeGame() {
        lastFocusedCell = { row: -1, col: -1 };
        currentDirection = 'across';
        checkAttempts = 0;
        wordAttempts = {};
        hintDisplay.classList.add('hidden');
        document.getElementById('hint-text').innerHTML = '';
        currentAccuracyValue.textContent = '100%';
        attemptsValue.textContent = '0';
        
        try {
            const { metadata, clues } = currentPuzzleData;
            const { rows, cols } = metadata.size;
            titleElement.textContent = `📚 Crossword Modal Mastery`;
            levelSubtitle.textContent = `${metadata.title} - ${metadata.difficulty}`;
            gridState = Array(rows).fill(null).map(() => Array(cols).fill(null));
            gridElement.innerHTML = '';
            acrossCluesElement.innerHTML = '';
            downCluesElement.innerHTML = '';
            
            // Set CSS variables for grid dimensions
            gridElement.style.setProperty('--grid-rows', rows);
            gridElement.style.setProperty('--grid-cols', cols);
            
            populateGridState(clues.across);
            populateGridState(clues.down);
            renderGrid(rows, cols);
            renderClues(clues.across, acrossCluesElement, 'across');
            renderClues(clues.down, downCluesElement, 'down');

            startAnalyticsLevelsForCurrentPuzzle(metadata);
        } catch (error) {
            console.error("CRITICAL ERROR building puzzle:", error);
            alert("A critical error occurred while building the puzzle.");
        }
    }

    // --- GRID & CLUE RENDERING ---

    function populateGridState(clueList) {
        clueList.forEach(clue => {
            const answer = clue.answer.toUpperCase();
            for (let i = 0; i < answer.length; i++) {
                const r = clue.direction === 'across' ? clue.row : clue.row + i;
                const c = clue.direction === 'across' ? clue.col + i : clue.col;
                if (!gridState[r][c]) {
                    gridState[r][c] = { answer: '', words: [] };
                }
                gridState[r][c].answer = answer[i];
                if (!gridState[r][c].words.some(w => w.number === clue.number && w.direction === clue.direction)) {
                    gridState[r][c].words.push({ number: clue.number, direction: clue.direction });
                }
                if (i === 0) gridState[r][c].clueNumber = clue.number;
            }
        });
    }

    function renderGrid(rows, cols) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellData = gridState[r][c];
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                const devCoords = document.createElement('div');
                devCoords.className = 'dev-coords';
                devCoords.textContent = `${r},${c}`;
                cell.appendChild(devCoords);

                if (!cellData) {
                    cell.classList.add('empty');
                } else {
                    const devAnswer = document.createElement('div');
                    devAnswer.className = 'dev-answer';
                    devAnswer.textContent = cellData.answer;
                    cell.appendChild(devAnswer);

                    if (cellData.clueNumber) {
                        const numDiv = document.createElement('div');
                        numDiv.className = 'clue-number';
                        numDiv.textContent = cellData.clueNumber;
                        cell.appendChild(numDiv);
                    }
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.maxLength = 1;
                    input.className = 'cell-input';
                    input.dataset.answer = cellData.answer.toUpperCase();
                    input.addEventListener('input', handleCellInput);
                    input.addEventListener('focus', () => handleFocus(r, c));
                    input.addEventListener('keydown', handleKeyDown);
                    cell.appendChild(input);
                }
                gridElement.appendChild(cell);
            }
        }
    }

    function renderClues(clueList, listElement, direction) {
        clueList.forEach(clue => {
            const li = document.createElement('li');
            li.textContent = clue.number + '. ' + clue.clue;
            li.dataset.number = clue.number;
            li.dataset.direction = direction;
            li.addEventListener('click', handleClueClick);
            listElement.appendChild(li);
        });
    }

    // --- USER INPUT & INTERACTION ---

    function handleCellInput(e) {
        e.target.value = e.target.value.toUpperCase();
        if (e.target.value.length === 0) return;
        if (activeClueInfo) {
            const { row: startRow, col: startCol, answer } = activeClueInfo;
            const currentCellPos = e.target.parentElement.dataset;
            let currentWordIndex = (currentDirection === 'across')
                ? parseInt(currentCellPos.col) - startCol
                : parseInt(currentCellPos.row) - startRow;
            for (let i = currentWordIndex + 1; i < answer.length; i++) {
                const r = (currentDirection === 'across') ? startRow : startRow + i;
                const c = (currentDirection === 'across') ? startCol + i : startCol;
                const nextCell = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
                if (nextCell) {
                    const nextInput = nextCell.querySelector('input');
                    if (nextInput && nextInput.value === '' && !nextInput.readOnly) {
                        nextInput.focus();
                        return;
                    }
                }
            }
        }
    }

    function handleKeyDown(e) {
        const cell = e.target.parentElement;
        let { row, col } = cell.dataset;
        row = parseInt(row);
        col = parseInt(col);
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (e.target.value !== '') {
                e.target.value = '';
                return;
            }
            if (activeClueInfo) {
                const isAtStart = (currentDirection === 'across' && col === activeClueInfo.col) ||
                                (currentDirection === 'down' && row === activeClueInfo.row);
                if (isAtStart) return;
            }
            let prevR = row, prevC = col;
            if (currentDirection === 'across') prevC--;
            else prevR--;
            const prevCell = document.querySelector(`.grid-cell[data-row="${prevR}"][data-col="${prevC}"]`);
            if (prevCell && prevCell.querySelector('input')) prevCell.querySelector('input').focus();
            return;
        }
        let nextR = row, nextC = col;
        switch (e.key) {
            case 'ArrowUp': nextR--; break;
            case 'ArrowDown': nextR++; break;
            case 'ArrowLeft': nextC--; break;
            case 'ArrowRight': nextC++; break;
            default: return;
        }
        const nextCell = document.querySelector(`.grid-cell[data-row="${nextR}"][data-col="${nextC}"]`);
        if (nextCell && nextCell.querySelector('input')) {
            e.preventDefault();
            nextCell.querySelector('input').focus();
        }
    }
    
    function handleFocus(row, col) {
        const cellData = gridState[row][col];
        if (!cellData) return;
        const hasAcross = cellData.words.some(w => w.direction === 'across');
        const hasDown = cellData.words.some(w => w.direction === 'down');
        if (lastFocusedCell.row === row && lastFocusedCell.col === col) {
            if (hasAcross && hasDown) {
                currentDirection = currentDirection === 'across' ? 'down' : 'across';
            }
        } else {
            const isCurrentDirectionValid = (currentDirection === 'across' && hasAcross) ||
                                            (currentDirection === 'down' && hasDown);
            if (!isCurrentDirectionValid) {
                currentDirection = hasAcross ? 'across' : 'down';
            }
        }
        lastFocusedCell = { row, col };
        highlightWord(row, col, currentDirection);
    }

    function handleClueClick(e) {
        const { number, direction } = e.target.dataset;
        const clue = currentPuzzleData.clues[direction].find(c => c.number == number);
        if (clue) {
            currentDirection = direction;
            const firstCellInput = document.querySelector(`.grid-cell[data-row="${clue.row}"][data-col="${clue.col}"] input`);
            if (firstCellInput) firstCellInput.focus();
        }
    }

    function highlightWord(row, col, direction) {
        document.querySelectorAll('.focused-word, li.highlighted').forEach(el => el.classList.remove('highlighted', 'focused-word'));
        const cellData = gridState[row][col];
        if (!cellData) return;
        const wordInfo = cellData.words.find(w => w.direction === direction);
        if (!wordInfo) return;
        activeClueInfo = currentPuzzleData.clues[direction].find(c => c.number === wordInfo.number);
        if (!activeClueInfo) return;
        document.querySelector(`li[data-number="${activeClueInfo.number}"][data-direction="${direction}"]`)?.classList.add('highlighted');
        const answerLength = activeClueInfo.answer.length;
        for (let i = 0; i < answerLength; i++) {
            const r = direction === 'across' ? activeClueInfo.row : activeClueInfo.row + i;
            const c = direction === 'across' ? activeClueInfo.col + i : activeClueInfo.col;
            document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`)?.classList.add('focused-word');
        }
    }

    // --- PUZZLE CHECKING ---

    function checkWord(clueNumber, direction) {
        const clue = currentPuzzleData.clues[direction].find(c => c.number === clueNumber);
        if (!clue) return { isCorrect: false, isEmpty: true };

        const answer = clue.answer.toUpperCase();
        let userAnswer = '';
        let isEmpty = false;

        for (let i = 0; i < answer.length; i++) {
            const r = direction === 'across' ? clue.row : clue.row + i;
            const c = direction === 'across' ? clue.col + i : clue.col;
            const cell = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
            const input = cell?.querySelector('input');
            const letter = input?.value.toUpperCase() || '';
            
            if (!letter) isEmpty = true;
            userAnswer += letter;
        }

        const isCorrect = userAnswer === answer && !isEmpty;
        const wordKey = `${direction}_${clueNumber}`;
        
        // Initialize attempt counter if not exists
        if (!wordAttempts[wordKey]) {
            wordAttempts[wordKey] = 0;
        }

        // Increment attempts only if the word is wrong
        if (!isCorrect && !isEmpty) {
            wordAttempts[wordKey]++;
        }

        return { isCorrect, isEmpty, attempts: wordAttempts[wordKey], clue };
    }

    function showHint(clue, direction) {
        if (!clue.hint) return;
        
        hintDisplay.classList.remove('hidden');
        const hintText = document.getElementById('hint-text');
        const hintContent = `<strong>${clue.number} ${direction.toUpperCase()}:</strong> ${clue.hint}`;
        
        // Check if this hint is already shown
        if (!hintText.innerHTML.includes(hintContent)) {
            if (hintText.innerHTML) {
                hintText.innerHTML += '<br><br>' + hintContent;
            } else {
                hintText.innerHTML = hintContent;
            }
        }
    }

    function checkPuzzle() {
        const inputs = document.querySelectorAll('.cell-input');
        let allCorrect = true;
        let correctCount = 0;
        let incorrectCount = 0;
        let emptyCount = 0;
        let earnedXP = 0;
        
        checkAttempts++;
        
        // Check each word individually
        const checkedWords = new Set();
        
        ['across', 'down'].forEach(direction => {
            currentPuzzleData.clues[direction].forEach(clue => {
                const wordKey = `${direction}_${clue.number}`;
                if (checkedWords.has(wordKey)) return;
                checkedWords.add(wordKey);

                const result = checkWord(clue.number, direction);
                
                // Mark cells visually
                const answer = clue.answer.toUpperCase();
                for (let i = 0; i < answer.length; i++) {
                    const r = direction === 'across' ? clue.row : clue.row + i;
                    const c = direction === 'across' ? clue.col + i : clue.col;
                    const cell = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
                    const input = cell?.querySelector('input');
                    
                    if (input) {
                        input.classList.remove('correct', 'incorrect');
                        
                        if (result.isCorrect) {
                            input.classList.add('correct');
                            input.readOnly = true;
                        } else if (!result.isEmpty) {
                            allCorrect = false;
                            input.classList.add('incorrect');
                        } else {
                            allCorrect = false;
                        }
                    }
                }

                // Award XP and show hints
                if (result.isCorrect) {
                    const attempts = wordAttempts[wordKey] || 0;
                    if (attempts === 0) {
                        earnedXP += 10; // Full XP for first try
                    } else if (attempts === 1) {
                        earnedXP += 5; // Half XP for second try
                    }
                    // No XP for more than 2 attempts
                } else if (!result.isEmpty && result.attempts >= 2) {
                    // Show hint after 2 wrong attempts
                    showHint(clue, direction);
                }
            });
        });

        // Count cells
        inputs.forEach(input => {
            const enteredValue = input.value.toUpperCase();
            const correctValue = input.dataset.answer;
            if (enteredValue) {
                if (enteredValue === correctValue) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            } else {
                emptyCount++;
            }
        });

        // Track analytics
        const totalCells = inputs.length;
        const accuracy = totalCells > 0 ? (correctCount / totalCells * 100).toFixed(1) : 0;
        const metrics = {
            check_attempts: checkAttempts,
            accuracy_percent: accuracy,
            correct_cells: correctCount,
            incorrect_cells: incorrectCount,
            empty_cells: emptyCount,
            puzzle_level: currentLevel
        };
        
        console.log('[Analytics] Check attempt #' + checkAttempts, {
            correct: correctCount,
            incorrect: incorrectCount,
            empty: emptyCount,
            accuracy: accuracy + '%',
            earnedXP: earnedXP
        });

        // On first check of Level 1, unlock Level 2 regardless of correctness
        if (currentLevel === 1 && !level1Attempted) {
            level1Attempted = true;
            level2Btn.disabled = false;
            level2Btn.textContent = 'Level 2';
            saveProgress();
        }

        const timeTaken = Date.now() - levelStartTime;

        if (allCorrect) {
            const newlySubmittedAnswers = submitCompletedModalAnswers({
                ...metrics,
                completed_puzzle: true,
                time_taken_seconds: (timeTaken / 1000).toFixed(2)
            });
            const puzzleXp = getSubmittedXpForPuzzle(currentLevel);

            // Only award XP if not already completed this level (no double-dipping)
            let xpToAward = 0;
            if (currentLevel === 1 && !level1Completed) {
                xpToAward = puzzleXp;
                level1XP = xpToAward;
                level1Completed = true;
                level2Btn.disabled = false;
                level2Btn.textContent = 'Level 2';
            } else if (currentLevel === 2 && !level2Completed) {
                xpToAward = puzzleXp;
                level2XP = xpToAward;
                level2Completed = true;
            }
            
            totalXP = level1XP + level2XP;
            
            saveProgress();
            updateXPDisplay();
            
            console.log('[Analytics] Puzzle completed!', {
                timeTaken: (timeTaken / 1000).toFixed(2) + 's',
                xpToAward: xpToAward,
                totalXP: totalXP,
                newlySubmittedAnswers
            });

            if (currentLevel === 2) {
                showEndGameOverlay();
            } else {
                showSuccessOverlay(xpToAward, accuracy, timeTaken);
            }
        } else {
            // Update live stats
            currentAccuracyValue.textContent = `${accuracy}%`;
            attemptsValue.textContent = checkAttempts;

            const xpBeforeSubmit = getSubmittedXpForPuzzle(currentLevel);
            const newlySubmittedAnswers = submitCompletedModalAnswers({
                ...metrics,
                failed_submit: true
            });
            earnedXP = getSubmittedXpForPuzzle(currentLevel) - xpBeforeSubmit;
            console.log('[Analytics] Newly completed modal answers submitted:', newlySubmittedAnswers);

            showSubmitModal(correctCount, incorrectCount, emptyCount, accuracy, earnedXP);
        }
    }

    function showSuccessOverlay(xpEarned, accuracy, timeTaken) {
        earnedXPElement.textContent = xpEarned;
        accuracyDisplayElement.textContent = `${accuracy}%`;
        
        const minutes = Math.floor(timeTaken / 60000);
        const seconds = Math.floor((timeTaken % 60000) / 1000);
        timeDisplayElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Educational facts
        const facts = [
            "A single teaspoon of soil contains more microorganisms than there are people on Earth!",
            "Bacteria are the oldest organisms on Earth, existing for over 3.5 billion years.",
            "Your body contains trillions of helpful bacteria that aid in digestion and immunity.",
            "Yeast is a single-celled fungus that makes bread rise and ferments sugar into alcohol.",
            "Rhizobium bacteria in plant roots help convert nitrogen from air into plant food.",
            "Lactobacillus bacteria turn milk into yogurt and help keep our gut healthy!",
            "Without decomposers like fungi and bacteria, dead matter would pile up endlessly.",
            "Microalgae produces over half of the oxygen we breathe through photosynthesis!",
            "A cell is like a tiny city, with organelles acting as different departments.",
            "The human body has about 37 trillion cells, all working together!"
        ];
        factTextElement.textContent = facts[Math.floor(Math.random() * facts.length)];
        
        completionMessage.textContent = '🎉 Level 1 Complete! 🎉';
        nextLevelBtn.classList.remove('hidden');
        
        successOverlay.classList.remove('hidden');
    }

    function showSubmitModal(correctCount, incorrectCount, emptyCount, accuracy, earnedXP) {
        const existing = document.getElementById('submit-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'submit-modal-overlay';
        overlay.innerHTML = `
            <div class="endgame-box">
                <h2 class="endgame-title">📊 Level ${currentLevel} Progress</h2>
                <p class="endgame-subtitle">Not all answers are correct yet!</p>
                <div class="endgame-breakdown">
                    <div class="endgame-level-row">✅ Correct: <strong>${correctCount}</strong></div>
                    <div class="endgame-level-row">❌ Incorrect: <strong>${incorrectCount}</strong></div>
                    <div class="endgame-level-row">⬜ Empty: <strong>${emptyCount}</strong></div>
                    <div class="endgame-level-row">🎯 Accuracy: <strong>${accuracy}%</strong></div>
                    <div class="endgame-level-row">⭐ XP Earned: <strong>${earnedXP}</strong></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px;">
                    ${currentLevel === 1 ? '<button class="endgame-play-again" id="submit-next-level" style="background-color:#03dac6;color:#040804;">Continue to Level 2 →</button>' : ''}
                    <button class="endgame-play-again" id="submit-retry">↻ Retry Level ${currentLevel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const nextBtn = document.getElementById('submit-next-level');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                overlay.remove();
                // Unlock level 2 if not already
                if (!level1Attempted) {
                    level1Attempted = true;
                    level2Btn.disabled = false;
                    level2Btn.textContent = 'Level 2';
                    saveProgress();
                }
                loadLevel(2);
            });
        }

        document.getElementById('submit-retry').addEventListener('click', () => {
            overlay.remove();
        });
    }

    function showEndGameOverlay() {
        // Remove existing end game overlay if present
        const existing = document.getElementById('endgame-overlay');
        if (existing) existing.remove();

        postAnalyticsDebug('game_completed', {
            runId: analyticsRunId,
            finalTotalXp: totalXP,
            perLevelXp: [level1XP, level2XP],
            submittedLevels: submittedModalLevels.size
        });

        const overlay = document.createElement('div');
        overlay.id = 'endgame-overlay';
        overlay.innerHTML = `
            <div class="endgame-box">
                <h2 class="endgame-title">🏆 Game Complete! 🏆</h2>
                <p class="endgame-subtitle">You have conquered Crossword Modal Mastery!</p>
                <div class="endgame-xp-total">
                    <span class="endgame-xp-number">${totalXP}</span>
                    <span class="endgame-xp-max">/ 200</span>
                </div>
                <div class="endgame-breakdown">
                    <div class="endgame-level-row">Level 1: <strong>${level1XP}</strong> / 100 XP</div>
                    <div class="endgame-level-row">Level 2: <strong>${level2XP}</strong> / 100 XP</div>
                </div>
                <button class="endgame-play-again" id="endgame-play-again">Play Again</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('endgame-play-again').addEventListener('click', () => {
            // Reset all progress
            totalXP = 0;
            level1XP = 0;
            level2XP = 0;
            level1Completed = false;
            level2Completed = false;
            level1Attempted = false;
            currentLevel = 1;
            localStorage.removeItem('modalMasteryProgress');
            overlay.remove();
            analyticsRunId = '';
            submittedModalLevels.clear();
            initializeAnalyticsRun();
            updateXPDisplay();
            level2Btn.disabled = true;
            level2Btn.textContent = 'Level 2 🔒';
            loadLevel(1);
        });
    }

    // --- SECRET CODES & EVENT LISTENERS ---

    let keySequence = "";
    const adminCode = "~asd";
    const devCode = "~dev";
    const devAnswersCode = "~adev";
    const stopDevCode = "~sdev";

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const key = (e.key === '`' || e.key === '~') ? '~' : e.key.toLowerCase();
        keySequence += key;

        if (keySequence.endsWith(adminCode)) {
            adminPanel.classList.toggle('hidden');
            keySequence = "";
        } else if (keySequence.endsWith(devAnswersCode)) {
            gameContainer.classList.add('dev-mode', 'dev-answers-mode');
            keySequence = "";
        } else if (keySequence.endsWith(devCode)) {
            gameContainer.classList.toggle('dev-mode');
            gameContainer.classList.remove('dev-answers-mode');
            keySequence = "";
        } else if (keySequence.endsWith(stopDevCode)) {
            gameContainer.classList.remove('dev-mode', 'dev-answers-mode');
            keySequence = "";
        }

        if (keySequence.length > 10) {
            keySequence = "";
        }
    });

    checkButton.addEventListener('click', checkPuzzle);
    
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire grid?')) {
            document.querySelectorAll('.cell-input').forEach(input => {
                if (!input.readOnly) {
                    input.value = '';
                    input.classList.remove('correct', 'incorrect');
                }
            });
            hintDisplay.classList.add('hidden');
            document.getElementById('hint-text').innerHTML = '';
        }
    });
    
    // Level button event listeners
    level1Btn.addEventListener('click', () => {
        if (currentLevel !== 1) {
            loadLevel(1);
            successOverlay.classList.add('hidden');
        }
    });
    
    level2Btn.addEventListener('click', () => {
        if (!level2Btn.disabled && currentLevel !== 2) {
            loadLevel(2);
            successOverlay.classList.add('hidden');
        }
    });
    
    // Success overlay buttons
    nextLevelBtn.addEventListener('click', () => {
        loadLevel(currentLevel + 1);
        successOverlay.classList.add('hidden');
    });
    
    replayBtn.addEventListener('click', () => {
        loadLevel(currentLevel);
        successOverlay.classList.add('hidden');
    });
    
    // Track incomplete sessions when user leaves
    window.addEventListener('beforeunload', () => {
        if (analyticsRunId && levelStartTime > 0) {
            postAnalyticsDebug('session_left_incomplete', {
                runId: analyticsRunId,
                puzzleLevel: currentLevel,
                submittedLevels: submittedModalLevels.size
            });
            console.log('[Analytics] Session ended before completing all modal answers.');
        }
    });

    function completeCurrentPuzzleForTest() {
        if (!ENABLE_DEV_COMPLETE_SHORTCUT) {
            console.log('DEV: Auto-complete ignored because debug shortcut is disabled.');
            return;
        }

        const inputs = document.querySelectorAll('.cell-input');
        if (!inputs.length) {
            console.log('DEV: Auto-complete ignored because puzzle inputs are not ready.');
            return;
        }

        inputs.forEach(input => {
            input.value = input.dataset.answer || '';
            input.readOnly = false;
            input.classList.remove('incorrect');
        });
        console.log('DEV: Auto-completing modal mastery puzzle...');
        checkPuzzle();
    }

    window.__completeLevelForTest = completeCurrentPuzzleForTest;

    function handleDevCompleteKey(event) {
        if ((event.key && event.key.toLowerCase() === 'c') || event.code === 'KeyC') {
            if (event.__crosswordModalMasteryDevCompleteHandled) {
                return;
            }
            event.__crosswordModalMasteryDevCompleteHandled = true;
            event.preventDefault();
            completeCurrentPuzzleForTest();
        }
    }

    window.addEventListener('keydown', handleDevCompleteKey, true);
    document.addEventListener('keydown', handleDevCompleteKey, true);

    window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'DEV_COMPLETE_LEVEL') {
            completeCurrentPuzzleForTest();
        }
    });
    
    // Start Game
    startGame();
});