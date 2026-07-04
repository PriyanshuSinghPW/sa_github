(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
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
        document.getElementById('max-xp');
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
        let level1Completed = false;
        let level2Completed = false;
        let wordAttempts = {}; // Track attempts per word

        // Analytics Setup
        const analytics = new AnalyticsManager();
        analytics.initialize('modal_mastery_crossword', 'session_' + Date.now());
        let levelStartTime = 0;
        let currentLevelId = null;
        let checkAttempts = 0;

        // --- GAME FLOW & INITIALIZATION ---

        async function startGame() {
            // Try to load saved progress
            const savedProgress = localStorage.getItem('modalMasteryProgress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                totalXP = progress.totalXP || 0;
                level1Completed = progress.level1Completed || false;
                level2Completed = progress.level2Completed || false;
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
            if (level1Completed) {
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
                level1Completed,
                level2Completed,
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
                titleElement.textContent = `🏰 Crossword Medieval Minds`;
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

                // Start analytics tracking for this level
                currentLevelId = 'level_' + metadata.level + '_' + metadata.title.toLowerCase().replace(/\s+/g, '_');
                analytics.startLevel(currentLevelId);
                levelStartTime = Date.now();
                console.log('[Analytics] Level started:', currentLevelId);
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
            
            console.log('[Analytics] Check attempt #' + checkAttempts, {
                correct: correctCount,
                incorrect: incorrectCount,
                empty: emptyCount,
                accuracy: accuracy + '%',
                earnedXP: earnedXP
            });
            
            analytics.recordTask(
                currentLevelId,
                'check_attempt_' + checkAttempts,
                `Check Puzzle Attempt #${checkAttempts}`,
                'all_correct',
                allCorrect ? 'all_correct' : 'has_errors',
                Date.now() - levelStartTime,
                earnedXP
            );
            
            analytics.addRawMetric('check_attempts', checkAttempts);
            analytics.addRawMetric('accuracy_percent', accuracy);
            analytics.addRawMetric('correct_cells', correctCount);
            analytics.addRawMetric('incorrect_cells', incorrectCount);
            analytics.addRawMetric('empty_cells', emptyCount);
            
            if (allCorrect) {
                const timeTaken = Date.now() - levelStartTime;
                
                // Calculate bonuses
                let bonusXP = 0;
                const hintsUsed = Object.values(wordAttempts).filter(attempts => attempts >= 2).length;
                if (hintsUsed === 0) {
                    bonusXP += currentPuzzleData.metadata.bonusXP || 20; // No hints bonus
                }
                
                const totalEarnedXP = earnedXP + bonusXP;
                totalXP += totalEarnedXP;
                
                // Mark level as completed
                if (currentLevel === 1) {
                    level1Completed = true;
                    level2Btn.disabled = false;
                    level2Btn.textContent = 'Level 2';
                } else if (currentLevel === 2) {
                    level2Completed = true;
                }
                
                saveProgress();
                updateXPDisplay();
                
                console.log('[Analytics] Puzzle completed!', {
                    timeTaken: (timeTaken / 1000).toFixed(2) + 's',
                    earnedXP: earnedXP,
                    bonusXP: bonusXP,
                    totalEarnedXP: totalEarnedXP,
                    totalXP: totalXP
                });
                
                analytics.endLevel(currentLevelId, true, timeTaken, totalEarnedXP);
                analytics.submitReport();
                
                showSuccessOverlay(totalEarnedXP, accuracy, timeTaken);
            } else {
                // Update live stats
                currentAccuracyValue.textContent = `${accuracy}%`;
                attemptsValue.textContent = checkAttempts;
                alert(`Not quite right! Keep trying. 💚\n\nCorrect: ${correctCount} | Incorrect: ${incorrectCount} | Empty: ${emptyCount}`);
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
            
            if (currentLevel === 1 && !level2Completed) {
                completionMessage.textContent = '🎉 Level 1 Complete! 🎉';
                nextLevelBtn.classList.remove('hidden');
            } else if (currentLevel === 2) {
                completionMessage.textContent = '🏆 All Levels Complete! 🏆';
                nextLevelBtn.classList.add('hidden');
            } else {
                completionMessage.textContent = '🎉 Level Complete! 🎉';
                nextLevelBtn.classList.add('hidden');
            }
            
            successOverlay.classList.remove('hidden');
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
            if (currentLevelId && levelStartTime > 0) {
                const level = analytics._getLevelById(currentLevelId);
                if (level && !level.successful) {
                    const timeTaken = Date.now() - levelStartTime;
                    analytics.endLevel(currentLevelId, false, timeTaken, 0);
                    analytics.submitReport();
                    console.log('[Analytics] Session ended (incomplete)');
                }
            }
        });
        
        // Start Game
        startGame();
    });

})();
