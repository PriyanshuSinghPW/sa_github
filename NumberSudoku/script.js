// AnalyticsManager is loaded globally from AnalyticsManager.js script tag
// No import needed when not using ES6 modules

document.addEventListener("DOMContentLoaded", () => {
  const ENABLE_DEV_COMPLETE_SHORTCUT = false;
  const DIFFICULTY_LEVEL_NUMBER = {
    easy: 1,
    medium: 2,
    hard: 3
  };

  // Screen Navigation Elements
  const homeScreen = document.getElementById("home-screen");
  const gameScreen = document.getElementById("game-screen");
  const playGameBtn = document.getElementById("play-game-btn");
  const howToPlayBtn = document.getElementById("how-to-play-btn");
  const howToPlayModal = document.getElementById("how-to-play-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const themeToggleHome = document.getElementById("theme-toggle-home");
  const themeToggleGame = document.getElementById("theme-toggle-game");
  const homeBtn = document.getElementById("home-btn");

  // Game Elements
  const boardElement = document.getElementById("sudoku-board");
  const numpad = document.querySelector(".numpad");
  const newGameBtn = document.getElementById("new-game-btn");
  const undoBtn = document.getElementById("undo-btn");
  const eraseBtn = document.getElementById("erase-btn");
  const submitBtn = document.getElementById("submit-btn");
  const messageElement = document.getElementById("message");
  const diffBtns = document.querySelectorAll(".diff-btn");
  const timerElement = document.getElementById("timer");

  // ============================================
  // ANALYTICS SETUP
  // ============================================
  const analytics = AnalyticsManager.getInstance();
  let analyticsRunId = "";
  
  let levelStartTime = 0;
  let currentLevelNumber = 1;
  let currentLevelSubmitted = false;
  let submitAttempts = 0;
  let movesMade = 0;
  let undoCount = 0;
  let hintsUsed = 0;

  let board = [];
  let solution = [];
  let initialBoard = [];
  let history = [];
  let selectedCell = null;
  let difficulty = "easy";
  let timerInterval;
  let seconds = 0;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function toggleTheme() {
    const html = document.documentElement;
    if (html.getAttribute("data-theme") === "dark") {
      html.setAttribute("data-theme", "light");
    } else {
      html.setAttribute("data-theme", "dark");
    }
  }

  function showMessage(text, type) {
    messageElement.textContent = text;
    messageElement.classList.remove("hidden");

    setTimeout(() => {
      messageElement.classList.add("hidden");
    }, 3000);
  }

  function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `number_sudoku_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getDifficultyLevelNumber(value) {
    return DIFFICULTY_LEVEL_NUMBER[value] || 1;
  }

  function postAnalyticsDebug(event, detail = {}) {
    try {
      window.parent.postMessage({
        __analyticsDebug: true,
        game: "NumberSudoku",
        event,
        detail,
        at: new Date().toISOString()
      }, "*");
    } catch (_error) {
      // Debug-only for local harness visibility.
    }
  }

  // ============================================
  // NAVIGATION FUNCTIONS
  // ============================================
  function showHomeScreen() {
    homeScreen.classList.remove("hidden");
    gameScreen.classList.add("hidden");
    // Stop timer when going back home
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  }

  function showGameScreen() {
    homeScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    // Start a new game when entering game screen
    startNewGame();
  }

  function showModal() {
    howToPlayModal.classList.remove("hidden");
  }

  function closeModal() {
    howToPlayModal.classList.add("hidden");
  }

  // ============================================
  // EVENT LISTENERS (Must be after function definitions)
  // ============================================
  
  // Navigation Event Listeners
  playGameBtn.addEventListener("click", showGameScreen);
  howToPlayBtn.addEventListener("click", showModal);
  closeModalBtn.addEventListener("click", closeModal);
  homeBtn.addEventListener("click", showHomeScreen);

  // Close modal when clicking outside
  howToPlayModal.addEventListener("click", (e) => {
    if (e.target === howToPlayModal) {
      closeModal();
    }
  });

  // Theme Toggle Event Listeners
  themeToggleHome.addEventListener("click", () => {
    toggleTheme();
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    analytics.addRawMetric('theme_toggles', (analytics._themeToggles = (analytics._themeToggles || 0) + 1));
    analytics.addRawMetric('current_theme', currentTheme);
  });

  themeToggleGame.addEventListener("click", () => {
    toggleTheme();
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    analytics.addRawMetric('theme_toggles', (analytics._themeToggles = (analytics._themeToggles || 0) + 1));
    analytics.addRawMetric('current_theme', currentTheme);
  });

  // ============================================
  // GAME FUNCTIONS
  // ============================================
  
  function initGame() {
    createBoardUI();
    // Don't start a new game yet - wait for user to click play
    // startNewGame();
  }

  function createBoardUI() {
    boardElement.innerHTML = "";
    for (let i = 0; i < 81; i++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.index = i;
      cell.addEventListener("click", () => selectCell(cell));
      boardElement.appendChild(cell);
    }
  }

  function startNewGame() {
    stopTimer();
    seconds = 0;
    updateTimerDisplay();

    // Generate a full valid board
    solution = generateSolvedBoard();
    // Create the puzzle by removing numbers
    board = createPuzzle(solution, difficulty);
    initialBoard = [...board];
    history = [];

    updateBoardUI();
    messageElement.classList.add("hidden");
    selectedCell = null;

    // Clear any previous highlights
    document.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove(
        "selected",
        "highlighted",
        "error",
        "same-num",
        "correct"
      );
    });

    updateSubmitButton();
    startTimer();

    // ============================================
    // ANALYTICS: Start tracking new puzzle
    // ============================================
    analyticsRunId = createRunId();
    currentLevelNumber = getDifficultyLevelNumber(difficulty);
    currentLevelSubmitted = false;
    analytics.initialize("NumberSudoku", analyticsRunId);
    analytics.startLevel(currentLevelNumber, { levelNumber: currentLevelNumber });
    levelStartTime = Date.now();
    submitAttempts = 0;
    movesMade = 0;
    undoCount = 0;
    hintsUsed = 0;
    
    // Reset per-game analytics counters
    analytics._correctMoves = 0;
    analytics._incorrectMoves = 0;
    analytics._eraseClicks = 0;
    // notes feature removed
    
    analytics.addRawMetric('difficulty', difficulty);
    analytics.addRawMetric('level_number', currentLevelNumber);
    analytics.addRawMetric('initial_empty_cells', initialBoard.filter(val => val === 0).length);
    analytics.addRawMetric('puzzle_start_time', new Date().toISOString());
    console.log('[Analytics] New Sudoku puzzle started:', { runId: analyticsRunId, difficulty, levelNumber: currentLevelNumber });
    postAnalyticsDebug("level_started", { runId: analyticsRunId, difficulty, levelNumber: currentLevelNumber });
  }

  function updateBoardUI() {
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell, index) => {
      const val = board[index];
      cell.textContent = val === 0 ? "" : val;

      cell.className = "cell"; // Reset classes
      if (initialBoard[index] !== 0) {
        cell.classList.add("fixed");
      }
    });
  }

  function selectCell(cell) {
    if (selectedCell) {
      selectedCell.classList.remove("selected");
    }

    selectedCell = cell;
    selectedCell.classList.add("selected");

    highlightRelatedCells(cell);
  }

  function highlightRelatedCells(cell) {
    const index = parseInt(cell.dataset.index);
    const row = Math.floor(index / 9);
    const col = index % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    const cells = document.querySelectorAll(".cell");
    cells.forEach((c) => {
      c.classList.remove("highlighted");
    });

    // Highlight row, col, and box
    for (let i = 0; i < 9; i++) {
      cells[row * 9 + i].classList.add("highlighted");
      cells[i * 9 + col].classList.add("highlighted");
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells[(boxRow + r) * 9 + (boxCol + c)].classList.add("highlighted");
      }
    }
  }

  function fillCell(cell, num) {
    const index = parseInt(cell.dataset.index);

    // Don't change fixed cells
    if (initialBoard[index] !== 0) return;

    const prevVal = board[index];
    if (prevVal === num) return;

    // Add to history
    history.push({ index, prevVal, newVal: num });

    board[index] = num;
    cell.textContent = num === 0 ? "" : num;

      
      // Analytics: Track if move is correct or incorrect
      const isCorrect = (solution[index] === num);
      if (isCorrect) {
        analytics.addRawMetric('correct_moves', (analytics._correctMoves = (analytics._correctMoves || 0) + 1));
      } else {
        analytics.addRawMetric('incorrect_moves', (analytics._incorrectMoves = (analytics._incorrectMoves || 0) + 1));
      }
      analytics.addRawMetric('total_moves', movesMade);
    // Remove any feedback classes
    cell.classList.remove("error", "correct");

    highlightRelatedCells(cell);
    updateSubmitButton();

    // Track move
    if (num !== 0) {
      movesMade++;
    }
  }

  function undoMove() {
    if (history.length === 0) return;

    const lastMove = history.pop();
    const { index, prevVal } = lastMove;

    board[index] = prevVal;
    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    cell.textContent = prevVal === 0 ? "" : prevVal;
    cell.classList.remove("error", "correct");

    if (selectedCell) {
      highlightRelatedCells(selectedCell);
    }

    updateSubmitButton();

    // Track undo
    undoCount++;
  }

  function moveSelection(key) {
    if (!selectedCell) return;
    const index = parseInt(selectedCell.dataset.index);
    let newIndex = index;

    if (key === "ArrowUp") newIndex -= 9;
    if (key === "ArrowDown") newIndex += 9;
    if (key === "ArrowLeft") newIndex -= 1;
    if (key === "ArrowRight") newIndex += 1;

    if (newIndex >= 0 && newIndex < 81) {
      const cells = document.querySelectorAll(".cell");
      selectCell(cells[newIndex]);
    }
  }

  function updateSubmitButton() {
    if (!submitBtn) return;
    const allFilled = !board.includes(0);
    submitBtn.disabled = !allFilled;
  }

  async function submitGame() {
    if (currentLevelSubmitted) {
      console.log('[Analytics] Sudoku level already submitted for this puzzle.');
      return;
    }

    const cells = document.querySelectorAll(".cell");

    // Clear previous feedback
    cells.forEach((cell) => {
      cell.classList.remove("error", "correct");
    });

    // 1. Run row checks in parallel
    const validationResults = await Promise.all(
      Array.from({ length: 9 }, (_, row) => CheckCompletion(row))
    );

    // 2. Apply results in parallel
    const appliedResults = await Promise.all(
      validationResults.map((result) => applyRowResult(result, cells))
    );

    // 3. Aggregate counts
    let totalCorrect = 0;
    let totalWrong = 0;

    appliedResults.forEach(({ correct, wrong }) => {
      totalCorrect += correct;
      totalWrong += wrong;
    });

    // 4. Final solved check
    const isSolved = totalWrong === 0 && !board.includes(0);

    // ============================================
    // ANALYTICS: Track submit attempt
    // ============================================
    submitAttempts++;
    const timeTaken = Date.now() - levelStartTime;
    const totalCells = 81;
    const filledCells = board.filter(val => val !== 0).length;
    const accuracy = totalCells > 0 ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(1) : 0;

    console.log('[Analytics] Submit attempt #' + submitAttempts, {
      correct: totalCorrect,
      wrong: totalWrong,
      accuracy: accuracy + '%',
      filled: filledCells + '/' + totalCells
    });

    // Record this submit attempt as a task
    analytics.recordTask(
      currentLevelNumber,
      'submit_attempt_' + submitAttempts,
      `Submit Attempt #${submitAttempts}`,
      'solved',
      isSolved ? 'solved' : 'has_errors',
      timeTaken,
      isSolved ? 50 : 10
    );

    // Track metrics
    analytics.addRawMetric('submit_attempts', submitAttempts);
    analytics.addRawMetric('accuracy_percent', accuracy);
    analytics.addRawMetric('correct_cells', totalCorrect);
    analytics.addRawMetric('wrong_cells', totalWrong);
    analytics.addRawMetric('filled_cells', filledCells);
    analytics.addRawMetric('moves_made', movesMade);
    analytics.addRawMetric('undo_count', undoCount);
    analytics.addRawMetric('time_seconds', Math.floor(timeTaken / 1000));
    analytics.addRawMetric('correct_moves', analytics._correctMoves || 0);
    analytics.addRawMetric('incorrect_moves', analytics._incorrectMoves || 0);
    analytics.addRawMetric('erase_clicks', analytics._eraseClicks || 0);

    console.log('[Analytics] Metrics tracked:', analytics.getReportData().rawData);

    if (isSolved) {
      stopTimer();
      showMessage(`Solved in ${formatTime(seconds)}!`, "success");

      // ============================================
      // ANALYTICS: Puzzle completed!
      // ============================================
      const totalTime = Date.now() - levelStartTime;
      
      // Calculate XP with bonuses
      const baseXP = 100;
      const timeBonus = Math.max(0, 50 - Math.floor(totalTime / 10000));
      const attemptBonus = Math.max(0, 50 - (submitAttempts - 1) * 10);
      const difficultyMultiplier = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1.5 : 2;
      const totalXP = Math.floor((baseXP + timeBonus + attemptBonus) * difficultyMultiplier);

      console.log('[Analytics] Puzzle completed!', {
        timeTaken: (totalTime / 1000).toFixed(2) + 's',
        baseXP: baseXP,
        timeBonus: timeBonus,
        attemptBonus: attemptBonus,
        difficultyMultiplier: difficultyMultiplier,
        totalXP: totalXP
      });

      // Add final completion metrics
      analytics.addRawMetric('completion_time_ms', totalTime);
      analytics.addRawMetric('xp_breakdown_base', baseXP);
      analytics.addRawMetric('xp_breakdown_time_bonus', timeBonus);
      analytics.addRawMetric('xp_breakdown_attempt_bonus', attemptBonus);
      analytics.addRawMetric('xp_breakdown_difficulty_multiplier', difficultyMultiplier);
      analytics.addRawMetric('puzzle_completed', 'true');

      // End level tracking and submit the level-wise payload.
      analytics.endLevel(currentLevelNumber, true, totalTime, totalXP);
      const payload = analytics.submitLevel(currentLevelNumber, { runId: analyticsRunId });
      if (payload && payload.success === false) {
        console.error('[Analytics] Sudoku level submit rejected:', payload.errors);
        postAnalyticsDebug("submit_rejected", { runId: analyticsRunId, levelNumber: currentLevelNumber, errors: payload.errors });
      } else {
        currentLevelSubmitted = true;
        console.log('[Analytics] Sudoku level submitted:', { runId: analyticsRunId, levelNumber: currentLevelNumber, xpEarned: totalXP });
        postAnalyticsDebug("submit_success", { runId: analyticsRunId, levelNumber: currentLevelNumber, xpEarned: totalXP });
      }
    } else {
      showMessage(
        `${totalCorrect} correct, ${totalWrong} wrong. Keep trying!`,
        "info"
      );
    }
  }

  function CheckCompletion(row) {
    return new Promise((resolve) => {
      const start = row * 9;
      const end = start + 9;

      const wrongCells = [];
      const correctCells = [];

      for (let i = start; i < end; i++) {
        // only user-filled cells
        if (initialBoard[i] === 0) {
          if (board[i] === solution[i]) {
            correctCells.push(i);
          } else {
            wrongCells.push(i);
          }
        }
      }

      resolve({ correctCells, wrongCells });
    });
  }

  async function applyRowResult({ correctCells, wrongCells }, cells) {
    let correct = 0;
    let wrong = 0;

    correctCells.forEach((index) => {
      cells[index].classList.add("correct");
      correct++;
    });

    wrongCells.forEach((index) => {
      cells[index].classList.add("error");
      wrong++;
    });

    return { correct, wrong };
  }

  function solveGame() {
    board = [...solution];
    updateBoardUI();
    stopTimer();
    showMessage("Solved!", "success");
    updateSubmitButton();
  }

  async function completeCurrentPuzzleForTest() {
    if (!ENABLE_DEV_COMPLETE_SHORTCUT) {
      console.log("DEV: Auto-complete ignored because debug shortcut is disabled.");
      return;
    }

    solveGame();
    await submitGame();
  }

  window.__completeLevelForTest = completeCurrentPuzzleForTest;

  // --- Timer Logic ---
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      seconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    timerElement.textContent = formatTime(seconds);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // --- Sudoku Logic ---

  function generateSolvedBoard() {
    const newBoard = new Array(81).fill(0);
    fillBoard(newBoard);
    return newBoard;
  }

  function fillBoard(board) {
    const emptyIndex = board.indexOf(0);
    if (emptyIndex === -1) return true;

    const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (let num of numbers) {
      if (isValidMove(board, emptyIndex, num)) {
        board[emptyIndex] = num;
        if (fillBoard(board)) return true;
        board[emptyIndex] = 0;
      }
    }
    return false;
  }

  function isValidMove(board, index, num) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    // Check row
    for (let i = 0; i < 9; i++) {
      if (board[row * 9 + i] === num && row * 9 + i !== index) return false;
    }

    // Check col
    for (let i = 0; i < 9; i++) {
      if (board[i * 9 + col] === num && i * 9 + col !== index) return false;
    }

    // Check box
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = (boxRow + r) * 9 + (boxCol + c);
        if (board[idx] === num && idx !== index) return false;
      }
    }

    return true;
  }

  function createPuzzle(solvedBoard, difficulty) {
    const puzzle = [...solvedBoard];
    let attempts =
      difficulty === "easy" ? 30 : difficulty === "medium" ? 45 : 60;

    while (attempts > 0) {
      let idx = Math.floor(Math.random() * 81);
      while (puzzle[idx] === 0) {
        idx = Math.floor(Math.random() * 81);
      }
      puzzle[idx] = 0;
      attempts--;
    }
    return puzzle;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ============================================
  // GAME EVENT LISTENERS (After all functions are defined)
  // ============================================
  newGameBtn.addEventListener("click", () => startNewGame());
  submitBtn.addEventListener("click", submitGame);

  undoBtn.addEventListener("click", () => {
    undoMove();
    analytics.addRawMetric('undo_button_clicks', undoCount);
  });
  
  eraseBtn.addEventListener("click", () => {
    if (selectedCell) {
      fillCell(selectedCell, 0);
      analytics.addRawMetric('erase_button_clicks', (analytics._eraseClicks = (analytics._eraseClicks || 0) + 1));
    }
  });
  // Notes button and related logic removed

  diffBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      diffBtns.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      const previousDifficulty = difficulty;
      difficulty = e.target.dataset.diff;
      
      // Track difficulty change
      if (previousDifficulty !== difficulty) {
        analytics.addRawMetric('difficulty_changes', (analytics._difficultyChanges = (analytics._difficultyChanges || 0) + 1));
        analytics.addRawMetric('difficulty_changed_from', previousDifficulty);
        analytics.addRawMetric('difficulty_changed_to', difficulty);
      }
      
      startNewGame();
    });
  });

  numpad.addEventListener("click", (e) => {
    if (!selectedCell) return;

    if (e.target.classList.contains("num-btn")) {
      const num = parseInt(e.target.dataset.num);
      fillCell(selectedCell, num);
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key && e.key.toLowerCase() === "c") || e.code === "KeyC") {
      if (e.__numberSudokuDevCompleteHandled) {
        return;
      }
      e.__numberSudokuDevCompleteHandled = true;
      completeCurrentPuzzleForTest();
      return;
    }

    if (!selectedCell) return;

    const key = e.key;
    if (key >= "1" && key <= "9") {
      fillCell(selectedCell, parseInt(key));
    } else if (key === "Backspace" || key === "Delete") {
      fillCell(selectedCell, 0);
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)
    ) {
      moveSelection(key);
    } else if (key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
      undoMove();
    }
  });

  // Initialize the game (create board UI, but don't start game yet)
  initGame();

  // ============================================
  // ANALYTICS: Track incomplete sessions
  // ============================================
  window.addEventListener('beforeunload', () => {
    if (analyticsRunId && levelStartTime > 0 && !currentLevelSubmitted) {
      postAnalyticsDebug("session_left_incomplete", {
        runId: analyticsRunId,
        levelNumber: currentLevelNumber,
        difficulty
      });
      console.log('[Analytics] Sudoku session ended before puzzle completion.');
    }
  });
});
