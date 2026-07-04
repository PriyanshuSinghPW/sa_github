import { showVictoryScreen } from './Shared/victoryScreen.js';
import { currentLang, loadTranslations, translateUI } from './Shared/language.js';
import { saveConfig, loadConfig } from './Shared/configStore.js';

// ============================================
// ANALYTICS SETUP
// ============================================
const analytics = new AnalyticsManager();

const WORDSEARCH_LEVEL_ID = 1;
const WORDSEARCH_LEVEL_XP = 5;

let currentLevelId = null;
let currentRunId = '';
let currentLevelSubmitted = false;
let levelStartTime = 0;
let hintsUsed = 0;
let wordsFoundCount = 0;

// Dynamic background gradients
const backgroundGradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #f77062 0%, #fe5196 100%)',
  'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)',
  'linear-gradient(135deg, #feac5e 0%, #c779d0 0%, #4bc0c8 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)'
];

function setRandomBackground() {
  const randomGradient = backgroundGradients[Math.floor(Math.random() * backgroundGradients.length)];
  document.body.style.background = randomGradient;
}

let words = [];
let allCategories = {};
let translations = {};
let gridWidth = 10;
let gridHeight = 10;
let wordCount = 10;
let grid = [];
let positions = {};
let selected = [];
let isDragging = false;

// Timer and scoring variables
let gameStartTime = null;
let timerInterval = null;
let currentScore = 200;
let elapsedSeconds = 0;

// Audio
let themeAudio = null;
let audioEnabled = false;

const directionBias = {
  easy: { horizontalVertical: 0.8, diagonal: 0.2 },
  medium: { horizontalVertical: 0.6, diagonal: 0.4 },
  hard: { horizontalVertical: 0.3, diagonal: 0.7 }
};

const straightDirs = [[0, 1], [1, 0]];
const diagonalDirs = [[1, 1], [-1, 1]];

async function loadCategories() {
  const res = await fetch('wordlists.json');
  allCategories = await res.json();
  populateCategorySelect();
  translateUI();
}

function populateCategorySelect() {
  const select = document.getElementById("categorySelect");
  if (!allCategories[currentLang]) {
    console.error("No categories found for language:", currentLang);
    return;
  }
  
  const categories = Object.keys(allCategories[currentLang]);
  const randomLabel = (translations[currentLang] && translations[currentLang].random) || "🎲 Random";

  select.innerHTML = `
    <option value="__RANDOM__">${randomLabel}</option>
    ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
  `;
}

function wordFitsGrid(word) {
  return word.length <= gridWidth - 2 && word.length <= gridHeight - 2;
}

function placeWords() {
  grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(""));
  positions = {};

  const difficulty = document.getElementById("difficultySelect").value;
  const bias = directionBias[difficulty] || directionBias.easy;

  let dirPool = [];
  dirPool.push(...Array(Math.round(bias.horizontalVertical * 10)).fill(straightDirs).flat());
  dirPool.push(...Array(Math.round(bias.diagonal * 10)).fill(diagonalDirs).flat());

  const placedWords = [];
  const usedWords = new Set();
  let availableWords = [...words];

  while (placedWords.length < wordCount && availableWords.length > 0) {
    const word = availableWords.pop();
    if (!word) break;

    let placed = false;
    for (let attempts = 0; attempts < 100 && !placed; attempts++) {
      const [dx, dy] = dirPool[Math.floor(Math.random() * dirPool.length)];

      const maxX = dx === 1 ? gridWidth - word.length : dx === -1 ? word.length - 1 : gridWidth - 1;
      const maxY = dy === 1 ? gridHeight - word.length : gridHeight - 1;
      const minX = dx === -1 ? word.length - 1 : 0;

      const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
      const y = Math.floor(Math.random() * (maxY + 1));

      if (canPlace(word, x, y, dx, dy)) {
        for (let i = 0; i < word.length; i++) {
          grid[y + i * dy][x + i * dx] = word[i];
        }
        positions[word] = Array.from({ length: word.length }, (_, i) => `${y + i * dy}-${x + i * dx}`);
        placedWords.push(word);
        placed = true;
      }
    }

    if (!placed) {
      const allWords = Object.values(allCategories[currentLang]).flat();
      const unused = allWords
        .filter(w => !usedWords.has(w.toUpperCase()))
        .filter(w => wordFitsGrid(w.toUpperCase()));

      if (unused.length) {
        const newWord = unused[Math.floor(Math.random() * unused.length)].toUpperCase();
        availableWords.unshift(newWord);
        usedWords.add(newWord);
      }
    }
  }

  words = placedWords;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (!grid[y][x]) grid[y][x] = randomLetter();
    }
  }
}

function canPlace(word, x, y, dx, dy) {
  for (let i = 0; i < word.length; i++) {
    const nx = x + i * dx, ny = y + i * dy;
    if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) return false;
    if (grid[ny][nx] && grid[ny][nx] !== word[i]) return false;
  }
  return true;
}

function randomLetter() {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function drawGrid() {
  const gridDiv = document.getElementById("grid");
  gridDiv.style.gridTemplateColumns = `repeat(${gridWidth}, 1fr)`;
  gridDiv.innerHTML = "";

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = grid[y][x];
      div.dataset.pos = `${y}-${x}`;
      gridDiv.appendChild(div);
    }
  }
}

function drawWordList() {
  const toFind = document.getElementById("wordListToFind");
  toFind.innerHTML = "";

  words.forEach(word => {
    const div = document.createElement("div");
    div.id = "word-" + word;
    div.className = "word-entry";
    div.textContent = word;
    toFind.appendChild(div);
  });
  
  updateFoundDisplay();
}

// Timer functions
function startTimer() {
  gameStartTime = Date.now();
  elapsedSeconds = 0;
  currentScore = 200;
  
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
    updateTimerDisplay();
    updateScore();
    
    // Game over after 10 minutes
    if (elapsedSeconds >= 600) {
      endGame(false);
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  document.getElementById("timerDisplay").textContent = display;
}

function updateScore() {
  // Scoring: 200 if < 5 min, 100 if < 7 min, 50 if < 9 min, 0 if > 10 min
  if (elapsedSeconds < 300) { // < 5 minutes
    currentScore = 200;
  } else if (elapsedSeconds < 420) { // < 7 minutes
    currentScore = 100;
  } else if (elapsedSeconds < 540) { // < 9 minutes
    currentScore = 50;
  } else {
    currentScore = 0;
  }
  
  document.getElementById("scoreDisplay").textContent = currentScore;
}

function updateFoundDisplay() {
  const foundCount = words.filter(w => {
    const el = document.getElementById("word-" + w);
    return el && el.classList.contains("found");
  }).length;
  document.getElementById("foundDisplay").textContent = `${foundCount}/${words.length}`;
}

function createRunId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `wordsearch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function endGame(won) {
  stopTimer();
  
  // ============================================
  // ANALYTICS: Track Game Completion
  // ============================================
  const timeTaken = Date.now() - levelStartTime;
  let totalXP = 0;
  
  if (won) {
    // Backend progression XP must be the current level award only.
    totalXP = WORDSEARCH_LEVEL_XP;
    
    // Track final metrics
    analytics.addRawMetric('completion_time_seconds', Math.floor(timeTaken / 1000));
    analytics.addRawMetric('final_score', currentScore);
    analytics.addRawMetric('accuracy_percent', 100); // All words found = 100%
    analytics.addRawMetric('total_xp_earned', totalXP);
    
    console.log('[Analytics] Game completed!', {
      timeTaken: (timeTaken / 1000).toFixed(2) + 's',
      wordsFound: wordsFoundCount,
      score: currentScore,
      totalXP: totalXP
    });

    if (!currentLevelSubmitted) {
      analytics.endLevel(currentLevelId, true, timeTaken, totalXP);
      const submitResult = analytics.submitLevel(currentLevelId, { runId: currentRunId });
      currentLevelSubmitted = !(submitResult && submitResult.success === false);
      console.log('[Analytics] Level submitted:', submitResult);
    }
    
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById("finalScore").textContent = 
      `Time: ${timeStr} | Score: ${currentScore} points`;
    
    setTimeout(() => {
      showVictoryScreen({
        message: translations[currentLang].completed || "🎉 You Won!",
        duration: 5000,
        onComplete: () => switchScreen('home')
      });
    }, 300);
  } else {
    // Time's up - incomplete
    const completionPercent = Math.floor((wordsFoundCount / words.length) * 100);
    analytics.addRawMetric('completion_time_seconds', Math.floor(timeTaken / 1000));
    analytics.addRawMetric('completion_percent', completionPercent);
    analytics.addRawMetric('total_xp_earned', 0);
    
    console.log('[Analytics] Game ended (timeout):', {
      timeTaken: (timeTaken / 1000).toFixed(2) + 's',
      wordsFound: wordsFoundCount,
      totalWords: words.length,
      completionPercent: completionPercent + '%'
    });
    
    alert(translations[currentLang].timeUp || "Time's up! Try again!");
    switchScreen('home');
  }
}

// Screen switching
function switchScreen(screenName) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  
  if (screenName === 'home') {
    document.getElementById('homeScreen').classList.add('active');
    stopTimer();
  } else if (screenName === 'game') {
    document.getElementById('gameScreen').classList.add('active');
  }
}

// Audio functions
function initAudio() {
  themeAudio = new Audio('themeAudio.mp3');
  themeAudio.loop = true;
  themeAudio.volume = 0.3; // Set to 30% volume for background music
  
  // Load saved audio preference
  const savedAudioState = localStorage.getItem('audioEnabled');
  audioEnabled = savedAudioState === 'true';
  updateAudioButton();
  
  if (audioEnabled) {
    playAudio();
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  localStorage.setItem('audioEnabled', audioEnabled);
  updateAudioButton();
  
  if (audioEnabled) {
    playAudio();
  } else {
    pauseAudio();
  }
}

function playAudio() {
  if (themeAudio && audioEnabled) {
    themeAudio.play().catch(err => {
      console.log("Audio play failed:", err);
    });
  }
}

function pauseAudio() {
  if (themeAudio) {
    themeAudio.pause();
  }
}

function updateAudioButton() {
  const btn = document.getElementById('audioToggle');
  if (btn) {
    btn.textContent = audioEnabled ? '🔊' : '🔇';
    btn.title = audioEnabled ? 'Mute Music' : 'Play Music';
  }
}

function giveHint() {
  const unfound = words.filter(w => {
    const el = document.getElementById("word-" + w);
    return el && !el.classList.contains("found");
  });

  if (unfound.length === 0) return;

  const randomWord = unfound[Math.floor(Math.random() * unfound.length)];
  const wordCells = positions[randomWord] || [];

  const unmarkedCells = wordCells.filter(pos => {
    const cell = document.querySelector(`[data-pos="${pos}"]`);
    return cell && !cell.classList.contains("found-cell");
  });

  if (unmarkedCells.length === 0) return;

  const randomPos = unmarkedCells[Math.floor(Math.random() * unmarkedCells.length)];
  const cell = document.querySelector(`[data-pos="${randomPos}"]`);
  if (cell) {
    cell.classList.add("hinted");
    setTimeout(() => cell.classList.remove("hinted"), 1500);
    
    // Track hint usage
    hintsUsed++;
    analytics.addRawMetric('hints_used', hintsUsed);
    console.log('[Analytics] Hint used:', hintsUsed);
  }
}

function initGame() {
  const categorySelect = document.getElementById("categorySelect");
  const difficultySelect = document.getElementById("difficultySelect");
  const wordCountInput = document.getElementById("wordCount");

  // Fixed grid size - always 10x10
  gridWidth = 10;
  gridHeight = 10;

  // Validate word count - must be between 1 and 20
  let count = parseInt(wordCountInput.value);
  if (count > 20 || count < 1) {
    wordCountInput.classList.add('invalid');
    const message = translations[currentLang]?.maxWords || 
                   "Maximum 20 words allowed! Please enter a number between 1 and 20.";
    alert(message);
    return; // Prevent game from starting
  }
  
  wordCountInput.classList.remove('invalid');
  wordCount = count;

  const settings = {
    category: categorySelect.value,
    difficulty: difficultySelect.value,
    count: wordCount
  };

  saveConfig("wordsearch", settings);

  let categoryWords = settings.category === "__RANDOM__"
    ? [...new Set(Object.values(allCategories[currentLang]).flat())]
    : allCategories[currentLang][settings.category] || [];

  words = categoryWords
    .filter(word => wordFitsGrid(word.toUpperCase()))
    .sort(() => 0.5 - Math.random())
    .slice(0, wordCount)
    .map(w => w.toUpperCase());

  placeWords();
  drawGrid();
  drawWordList();
  
  // Switch to game screen and start timer
  switchScreen('game');
  startTimer();
  
  // ============================================
  // ANALYTICS: Track Game Start
  // ============================================
  const difficulty = settings.difficulty;
  const category = settings.category === "__RANDOM__" ? "random" : settings.category;
  currentRunId = createRunId();
  currentLevelId = WORDSEARCH_LEVEL_ID;
  currentLevelSubmitted = false;
  
  analytics.initialize('word_search_game', currentRunId);
  analytics.startLevel(currentLevelId, { levelNumber: WORDSEARCH_LEVEL_ID });
  levelStartTime = Date.now();
  hintsUsed = 0;
  wordsFoundCount = 0;
  
  // Track game configuration
  analytics.addRawMetric('difficulty', difficulty);
  analytics.addRawMetric('category', category);
  analytics.addRawMetric('word_count', wordCount);
  analytics.addRawMetric('grid_size', `${gridWidth}x${gridHeight}`);
  
  console.log('[Analytics] Game started:', { currentLevelId, currentRunId });
}

let startPos = null;
let currentDirection = null;

document.addEventListener("pointerdown", e => {
  // Only handle pointer events on game screen
  if (!document.getElementById('gameScreen').classList.contains('active')) return;
  
  const cell = document.elementFromPoint(e.clientX, e.clientY);
  if (cell?.classList.contains("cell")) {
    isDragging = true;
    selected = [cell.dataset.pos];
    startPos = cell.dataset.pos.split('-').map(Number);
    currentDirection = null;
    cell.classList.add("highlight");
  }
});

document.addEventListener("pointermove", e => {
  if (!isDragging || !startPos) return;

  const cell = document.elementFromPoint(e.clientX, e.clientY);
  if (!cell?.classList.contains("cell")) return;

  const pos = cell.dataset.pos.split('-').map(Number);
  if (selected.includes(cell.dataset.pos)) return;

  if (selected.length === 1) {
    // Determine direction after second cell
    currentDirection = [pos[0] - startPos[0], pos[1] - startPos[1]];
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const norm = Math.abs(gcd(currentDirection[0], currentDirection[1]));
    currentDirection = currentDirection.map(n => n / norm);
  }

  // Check direction consistency
  const lastPos = selected[selected.length - 1].split('-').map(Number);
  const delta = [pos[0] - lastPos[0], pos[1] - lastPos[1]];
  if (
    currentDirection &&
    delta[0] === currentDirection[0] &&
    delta[1] === currentDirection[1]
  ) {
    selected.push(cell.dataset.pos);
    cell.classList.add("highlight");
  }
});

document.addEventListener("pointerup", () => {
  if (!isDragging) return;
  isDragging = false;

  for (const word of words) {
    const wordPositions = positions[word];
    if (arraysEqual(wordPositions, selected) || arraysEqual(wordPositions.slice().reverse(), selected)) {
      const wordElement = document.getElementById("word-" + word);
      wordElement.classList.add("found", "animated");
      setTimeout(() => {
        wordElement.style.textDecoration = "line-through";
        wordElement.classList.remove("animated");
      }, 300);

      wordPositions.forEach(pos => {
        const cell = document.querySelector(`[data-pos="${pos}"]`);
        if (cell) {
          cell.classList.add("found-cell", "animated");
          setTimeout(() => cell.classList.remove("animated"), 500);
        }
      });
      
      updateFoundDisplay();
      
      // ============================================
      // ANALYTICS: Track Word Found
      // ============================================
      wordsFoundCount++;
      const wordFindTime = Date.now() - levelStartTime;
      
      analytics.recordTask(
        currentLevelId,
        'word_found_' + wordsFoundCount,
        `Found word: ${word}`,
        word,
        word,
        wordFindTime,
        0 // XP tracked at game end via time-based score
      );
      
      analytics.addRawMetric('words_found', wordsFoundCount);
      analytics.addRawMetric('words_remaining', words.length - wordsFoundCount);
      
      console.log('[Analytics] Word found:', {
        word: word,
        wordsFound: wordsFoundCount,
        totalWords: words.length,
        timeElapsed: (wordFindTime / 1000).toFixed(2) + 's'
      });
    }
  }

  selected = [];
  document.querySelectorAll(".cell").forEach(c => c.classList.remove("highlight"));

  const foundCount = words.filter(w => document.getElementById("word-" + w).classList.contains("found")).length;
  if (foundCount === words.length) {
    endGame(true);
  }
});

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function showConfirmModal(callback) {
  const modal = document.getElementById('confirmModal');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');
  
  modal.classList.add('active');
  
  const handleYes = () => {
    modal.classList.remove('active');
    yesBtn.removeEventListener('click', handleYes);
    noBtn.removeEventListener('click', handleNo);
    callback(true);
  };
  
  const handleNo = () => {
    modal.classList.remove('active');
    yesBtn.removeEventListener('click', handleYes);
    noBtn.removeEventListener('click', handleNo);
    callback(false);
  };
  
  yesBtn.addEventListener('click', handleYes);
  noBtn.addEventListener('click', handleNo);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      handleNo();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Set random background on page load
  setRandomBackground();
  
  translations = await loadTranslations('wordsearch-translations.json');
  await loadCategories();
  translateUI();

  const defaults = {
    category: "__RANDOM__",
    difficulty: "medium",
    count: 10
  };

  const restored = loadConfig("wordsearch", defaults);
  document.getElementById("categorySelect").value = restored.category;
  document.getElementById("difficultySelect").value = restored.difficulty;
  
  // Set active difficulty button
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    if (btn.dataset.difficulty === restored.difficulty) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Ensure word count doesn't exceed 20
  const restoredCount = Math.min(restored.count || 10, 20);
  document.getElementById("wordCount").value = restoredCount;

  // Initialize audio
  initAudio();

  // Event listeners
  document.getElementById("startButton")?.addEventListener("click", initGame);
  document.getElementById("hintButton")?.addEventListener("click", giveHint);
  document.getElementById("audioToggle")?.addEventListener("click", toggleAudio);
  
  // Difficulty button listeners
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active class from all buttons
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      this.classList.add('active');
      // Update hidden select
      const difficulty = this.dataset.difficulty;
      document.getElementById('difficultySelect').value = difficulty;
    });
  });
  
  // Word count increment/decrement listeners
  document.getElementById("increaseWords")?.addEventListener("click", () => {
    const input = document.getElementById("wordCount");
    let value = parseInt(input.value) || 10;
    if (value < 20) {
      input.value = value + 1;
    }
  });
  
  document.getElementById("decreaseWords")?.addEventListener("click", () => {
    const input = document.getElementById("wordCount");
    let value = parseInt(input.value) || 10;
    if (value > 1) {
      input.value = value - 1;
    }
  });
  
  // Add real-time validation for word count input
  document.getElementById("wordCount")?.addEventListener("input", (e) => {
    const value = parseInt(e.target.value);
    if (value > 20 || value < 1 || isNaN(value)) {
      e.target.classList.add('invalid');
    } else {
      e.target.classList.remove('invalid');
    }
  });
  
  document.getElementById("backToHome")?.addEventListener("click", () => {
    showConfirmModal((confirmed) => {
      if (confirmed) {
        switchScreen('home');
      }
    });
  });
  
  // Make sure home screen is shown initially
  switchScreen('home');
  
  // ============================================
  // ANALYTICS: Track Abandoned Sessions
  // ============================================
  window.addEventListener('beforeunload', () => {
    if (currentLevelId && levelStartTime > 0 && !currentLevelSubmitted) {
      console.log('[Analytics] Session abandoned; no level payload submitted.');
    }
  });
});
