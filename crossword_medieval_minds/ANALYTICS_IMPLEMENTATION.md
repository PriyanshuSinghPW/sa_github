# Analytics Implementation Guide for Game Templates
## Complete Step-by-Step Integration with Enhanced Logging

This guide shows you how to implement **full analytics tracking with detailed console logging** in any HTML5 game template.

---

## 📋 Prerequisites

- Basic HTML5 game structure
- JavaScript code for game logic
- Browser with developer console support

---

## 🚀 Quick Start (5 Steps)

1. Copy `AnalyticsManager.js` to your game folder
2. Include script in HTML before your game script
3. Initialize analytics in your game code
4. Track game events (level start, actions, completion)
5. Test in browser console

---

## 📁 Step 1: File Setup

### Copy AnalyticsManager.js

**Location:** Place in your game's root directory

```
your-game/
├── AnalyticsManager.js  ← Copy this file here
├── index.html
├── game.html
├── script.js
└── style.css
```

### Update HTML

Add the script **before** your main game script:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Game</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Your game HTML here -->
    
    <!-- IMPORTANT: Analytics must load FIRST -->
    <script src="AnalyticsManager.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

**⚠️ Critical:** AnalyticsManager.js MUST be loaded before your game script!

---

## 💻 Step 2: Initialize Analytics

### Basic Setup

Add this at the **very top** of your main game script:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // ANALYTICS SETUP
    // ============================================
    const analytics = new AnalyticsManager();
    analytics.initialize('your_game_id', 'session_' + Date.now());
    
    let levelStartTime = 0;
    let currentLevelId = null;
    let checkAttempts = 0;
    
    // Your existing game code continues below...
});
```

### Customize Game ID

Replace `'your_game_id'` with a unique identifier:

**Examples:**
- Crossword: `'crossword_puzzle'`
- Word Search: `'word_search_game'`
- Trivia: `'trivia_quiz'`
- Sudoku: `'sudoku_puzzle'`
- Memory Game: `'memory_match'`

---

## 📊 Step 3: Track Level/Game Start

### When Game/Level Begins

```javascript
function startGame() {
    // Generate unique level ID
    currentLevelId = 'level_' + levelNumber; // or use puzzle name, difficulty, etc.
    
    // Start tracking
    analytics.startLevel(currentLevelId);
    levelStartTime = Date.now();
    console.log('[Analytics] Level started:', currentLevelId);
    
    // Reset attempt counter
    checkAttempts = 0;
    
    // Your game initialization code...
}
```

### Level ID Patterns

Choose based on your game type:

| Game Type | Level ID Example |
|-----------|------------------|
| Level-based | `'level_' + levelNum` |
| Named puzzles | `'level_' + puzzleName.toLowerCase().replace(/\s+/g, '_')` |
| Difficulty-based | `difficulty + '_level_' + levelNum` |
| Timed rounds | `'round_' + timestamp` |

---

## 🎮 Step 4: Track User Actions

### Check/Verify Button

Every time the user checks their answer or verifies progress:

```javascript
function checkAnswer() {
    checkAttempts++;
    
    // Your verification logic
    let correctCount = 0;
    let incorrectCount = 0;
    let totalItems = 0;
    
    // ... count correct/incorrect ...
    
    const accuracy = totalItems > 0 ? (correctCount / totalItems * 100).toFixed(1) : 0;
    
    // Log check attempt
    console.log('[Analytics] Check attempt #' + checkAttempts, {
        correct: correctCount,
        incorrect: incorrectCount,
        accuracy: accuracy + '%'
    });
    
    // Record task
    analytics.recordTask(
        currentLevelId,
        'check_attempt_' + checkAttempts,
        `Check Attempt #${checkAttempts}`,
        'all_correct',                          // Expected outcome
        allCorrect ? 'all_correct' : 'has_errors',  // Actual outcome
        Date.now() - levelStartTime,            // Time taken
        allCorrect ? 50 : 10                    // XP earned
    );
    
    // Track metrics
    analytics.addRawMetric('check_attempts', checkAttempts);
    analytics.addRawMetric('accuracy_percent', accuracy);
    analytics.addRawMetric('correct_items', correctCount);
    analytics.addRawMetric('incorrect_items', incorrectCount);
    
    console.log('[Analytics] Metrics tracked:', analytics.getReportData().rawData);
    
    // Handle completion if all correct
    if (allCorrect) {
        completeLevel(true);
    }
}
```

### Custom Metrics by Game Type

**Puzzle Games:**
```javascript
analytics.addRawMetric('hints_used', hintsUsed);
analytics.addRawMetric('mistakes_made', mistakes);
analytics.addRawMetric('cells_filled', filledCells);
```

**Quiz Games:**
```javascript
analytics.addRawMetric('questions_answered', questionsAnswered);
analytics.addRawMetric('correct_answers', correctAnswers);
analytics.addRawMetric('current_streak', streak);
```

**Action Games:**
```javascript
analytics.addRawMetric('score', currentScore);
analytics.addRawMetric('lives_remaining', lives);
analytics.addRawMetric('enemies_defeated', enemiesKilled);
analytics.addRawMetric('power_ups_collected', powerUps);
```

---

## 🏆 Step 5: Track Completion

### When Level/Game Ends Successfully

```javascript
function completeLevel(success) {
    const timeTaken = Date.now() - levelStartTime;
    
    // Calculate XP with bonuses
    let totalXP = 0;
    
    if (success) {
        const baseXP = 100;
        const timeBonus = Math.max(0, 50 - Math.floor(timeTaken / 10000));
        const attemptBonus = Math.max(0, 50 - (checkAttempts - 1) * 10);
        totalXP = baseXP + timeBonus + attemptBonus;
        
        console.log('[Analytics] Level completed!', {
            timeTaken: (timeTaken / 1000).toFixed(2) + 's',
            baseXP: baseXP,
            timeBonus: timeBonus,
            attemptBonus: attemptBonus,
            totalXP: totalXP
        });
    }
    
    // End level tracking
    analytics.endLevel(currentLevelId, success, timeTaken, totalXP);
    
    // Log full report before submission
    console.log('[Analytics] Full Report:', analytics.getReportData());
    
    // Submit the report
    analytics.submitReport();
    
    // Show success screen
    if (success) {
        showSuccessScreen();
    }
}
```

### XP Calculation Formulas

**Simple (Fixed):**
```javascript
const totalXP = success ? 100 : 0;
```

**Time-Based Bonus:**
```javascript
const baseXP = 100;
const timeBonus = Math.max(0, 50 - Math.floor(timeTaken / 10000));
const totalXP = baseXP + timeBonus;
```

**Performance-Based:**
```javascript
const baseXP = 100;
const accuracyBonus = Math.floor(accuracy * 0.5);
const speedBonus = timeTaken < targetTime ? 50 : 0;
const attemptPenalty = (checkAttempts - 1) * 10;
const totalXP = Math.max(0, baseXP + accuracyBonus + speedBonus - attemptPenalty);
```

**Difficulty Multiplier:**
```javascript
const baseXP = 100;
const difficultyMultiplier = {easy: 1, medium: 1.5, hard: 2, expert: 3};
const totalXP = Math.floor(baseXP * difficultyMultiplier[difficulty]);
```

---

## ⚠️ Step 6: Track Incomplete Sessions

### Capture Abandoned Games

Add this at the **end** of your main script:

```javascript
// Inside your DOMContentLoaded listener, at the very end
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
```

This tracks when users:
- Close the tab/window
- Navigate away
- Refresh the page
- Before completing the game

---

## 🔍 Step 7: Testing & Verification

### Open Browser Console

**Chrome/Edge:** `F12` or `Ctrl+Shift+I`  
**Firefox:** `F12` or `Ctrl+Shift+K`  
**Safari:** `Cmd+Option+I` (macOS)

### Expected Console Output

#### When Game Starts:
```
[Analytics] Initialized for: your_game_id
[Analytics] Level started: level_1
```

#### During Check Attempts:
```
[Analytics] Check attempt #1 {correct: 5, incorrect: 2, empty: 3, accuracy: "71.4%"}
[Analytics] Metrics tracked: [
  {key: "check_attempts", value: "1"},
  {key: "accuracy_percent", value: "71.4"},
  {key: "correct_items", value: "5"},
  {key: "incorrect_items", value: "2"}
]
```

#### On Completion:
```
[Analytics] Level completed! {
  timeTaken: "45.23s",
  baseXP: 100,
  timeBonus: 45,
  attemptBonus: 50,
  totalXP: 195
}
[Analytics] Full Report: {
  gameId: "your_game_id",
  name: "session_1739501234567",
  xpEarnedTotal: 195,
  rawData: [...],
  diagnostics: {...}
}
═══════════════════════════════════════════════════════
[Analytics] REPORT SUBMITTED
═══════════════════════════════════════════════════════
Game ID: your_game_id
Session: session_1739501234567
Total XP: 195
Levels Completed: 1
Raw Metrics: [{key: "check_attempts", value: "3"}, ...]
Full Payload: {gameId: "your_game_id", ...}
═══════════════════════════════════════════════════════
```

### Testing Checklist

- [ ] Console shows initialization message
- [ ] Level start is logged with ID
- [ ] Check attempts are tracked with metrics
- [ ] Metrics array updates after each action
- [ ] Completion shows XP breakdown
- [ ] Full report displays before submission
- [ ] Submission banner appears with payload
- [ ] No JavaScript errors in console

---

## 📤 What Gets Sent

### Complete Data Structure

```javascript
{
  // Session Info
  gameId: "your_game_id",
  name: "session_1739501234567",
  sessionId: "1739501234567-abc123",
  timestamp: "2026-02-14T15:30:00.000Z",
  
  // Total Scores
  xpEarnedTotal: 195,
  xpEarned: 195,
  xpTotal: 195,
  bestXp: 195,
  
  // Custom Metrics
  rawData: [
    {key: "check_attempts", value: "3"},
    {key: "accuracy_percent", value: "100.0"},
    {key: "correct_items", value: "25"},
    {key: "incorrect_items", value: "0"},
    {key: "hints_used", value: "2"}
  ],
  
  // Detailed Level Data
  diagnostics: {
    levels: [
      {
        levelId: "level_chemistry_crossword",
        successful: true,
        timeTaken: 45230,  // milliseconds
        xpEarned: 195,
        tasks: [
          {
            taskId: "check_attempt_1",
            question: "Check Attempt #1",
            correctChoice: "all_correct",
            choiceMade: "has_errors",
            successful: false,
            timeTaken: 20000,
            xpEarned: 10
          },
          {
            taskId: "check_attempt_2",
            question: "Check Attempt #2",
            correctChoice: "all_correct",
            choiceMade: "all_correct",
            successful: true,
            timeTaken: 45230,
            xpEarned: 50
          }
        ]
      }
    ]
  }
}
```

### Where Data Is Sent

Analytics attempts delivery via **multiple channels** (in order):

1. **React Native WebView** - `window.ReactNativeWebView.postMessage()`
2. **Parent Window/iFrame** - `window.parent.postMessage()`
3. **Custom Bridge** - `window.myJsAnalytics.trackGameSession()`
4. **LocalStorage Queue** - Saved for retry if offline
5. **Console Log** - Fallback for debugging

---

## 🎯 Common Implementation Patterns

### Pattern 1: Quiz Game

```javascript
// Initialize
analytics.initialize('trivia_quiz', 'session_' + Date.now());

// Start quiz
analytics.startLevel('quiz_' + quizCategory);
levelStartTime = Date.now();

// After each question
function answerQuestion(userAnswer, correctAnswer) {
    const questionTime = Date.now() - questionStartTime;
    const isCorrect = userAnswer === correctAnswer;
    
    analytics.recordTask(
        'quiz_' + quizCategory,
        'question_' + currentQuestion,
        questions[currentQuestion].text,
        correctAnswer,
        userAnswer,
        questionTime,
        isCorrect ? 10 : 0
    );
    
    if (isCorrect) correctAnswers++;
    
    analytics.addRawMetric('questions_answered', currentQuestion);
    analytics.addRawMetric('correct_answers', correctAnswers);
}

// End quiz
function endQuiz() {
    const totalTime = Date.now() - levelStartTime;
    const score = correctAnswers * 10;
    
    analytics.endLevel('quiz_' + quizCategory, true, totalTime, score);
    analytics.submitReport();
}
```

### Pattern 2: Timed Puzzle

```javascript
// Initialize
analytics.initialize('sudoku_game', 'session_' + Date.now());

// Start puzzle
analytics.startLevel('sudoku_' + difficulty);
levelStartTime = Date.now();
analytics.addRawMetric('difficulty', difficulty);

// Track moves/hints
function useHint() {
    hintsUsed++;
    analytics.addRawMetric('hints_used', hintsUsed);
}

function makeMove() {
    movesCount++;
    analytics.addRawMetric('moves_count', movesCount);
}

// Check solution
function checkSolution() {
    checkAttempts++;
    const isValid = validatePuzzle();
    
    analytics.recordTask(
        'sudoku_' + difficulty,
        'check_' + checkAttempts,
        'Validate Puzzle',
        'valid',
        isValid ? 'valid' : 'invalid',
        Date.now() - levelStartTime,
        0
    );
    
    if (isValid) completePuzzle();
}

// Complete
function completePuzzle() {
    const totalTime = Date.now() - levelStartTime;
    const penalty = hintsUsed * 10;
    const xp = Math.max(0, 100 - penalty);
    
    analytics.endLevel('sudoku_' + difficulty, true, totalTime, xp);
    analytics.submitReport();
}
```

### Pattern 3: Score-Based Game

```javascript
// Initialize
analytics.initialize('match3_game', 'session_' + Date.now());

// Start level
analytics.startLevel('level_' + currentLevel);
levelStartTime = Date.now();

// Track score continuously
function updateScore(points) {
    score += points;
    analytics.addRawMetric('score', score);
    analytics.addRawMetric('moves_remaining', movesLeft);
}

// Track special actions
function usePowerUp(type) {
    powerUpsUsed++;
    analytics.addRawMetric('power_ups_used', powerUpsUsed);
    analytics.addRawMetric('power_up_last', type);
}

// End level
function endLevel(reason) {
    const totalTime = Date.now() - levelStartTime;
    const success = score >= targetScore;
    const xp = Math.floor(score / 10);
    
    analytics.endLevel('level_' + currentLevel, success, totalTime, xp);
    analytics.submitReport();
}
```

---

## 🛠️ Customization Guide

### Change Colors in Console Logs

The submission banner uses ASCII borders. You can customize it in `AnalyticsManager.js`:

```javascript
// Find this section and modify:
console.log('═══════════════════════════════════════════════════════');
console.log('[Analytics] REPORT SUBMITTED');
console.log('═══════════════════════════════════════════════════════');
```

### Add Custom Metrics

Track anything relevant to your game:

```javascript
// Player stats
analytics.addRawMetric('player_level', playerLevel);
analytics.addRawMetric('coins_earned', coins);

// Performance
analytics.addRawMetric('fps_average', avgFPS);
analytics.addRawMetric('load_time_ms', loadTime);

// Engagement
analytics.addRawMetric('time_played_seconds', Math.floor(timePlayed / 1000));
analytics.addRawMetric('sessions_today', sessionCount);
```

### Task Names Best Practices

Make task IDs descriptive and unique:

```javascript
// ✅ Good
analytics.recordTask(levelId, 'word_guess_attempt_3', 'Guessed word: HELLO', ...);
analytics.recordTask(levelId, 'checkpoint_reached_castle', 'Reached castle area', ...);

// ❌ Bad (too generic)
analytics.recordTask(levelId, 'task1', 'Task', ...);
analytics.recordTask(levelId, 'action', 'Action', ...);
```

---

## 🐛 Troubleshooting

### Problem: "AnalyticsManager is not defined"

**Solution:** Check script loading order in HTML:

```html
<!-- WRONG ORDER -->
<script src="script.js"></script>
<script src="AnalyticsManager.js"></script>

<!-- CORRECT ORDER -->
<script src="AnalyticsManager.js"></script>
<script src="script.js"></script>
```

### Problem: No console logs appearing

**Solution:** Open browser console (F12) and check:
1. Console filter is not hiding logs
2. Log level is set to "All" or "Info"
3. No JavaScript errors preventing execution

### Problem: "analytics is not defined" in function

**Solution:** Ensure `analytics` is in scope:

```javascript
// ✅ Correct - analytics declared at top level
document.addEventListener('DOMContentLoaded', () => {
    const analytics = new AnalyticsManager();
    
    function myFunction() {
        analytics.addRawMetric('test', 1); // ✅ Works
    }
});

// ❌ Wrong - analytics not accessible
function myFunction() {
    analytics.addRawMetric('test', 1); // ❌ Error
}
```

### Problem: Level not found warning

**Solution:** Always call `startLevel()` before `recordTask()` or `endLevel()`:

```javascript
// ✅ Correct order
analytics.startLevel('level_1');
analytics.recordTask('level_1', ...); // ✅ Works

// ❌ Wrong order
analytics.recordTask('level_1', ...); // ❌ Warning: level not found
analytics.startLevel('level_1');
```

### Problem: Data not submitting

**Check:**
1. Is `analytics.submitReport()` being called?
2. Check console for payload log
3. Verify no JavaScript errors
4. Test with: `analytics.getReportData()` in console

---

## ✅ Final Verification

Run this checklist after implementation:

### Basic Integration
- [ ] AnalyticsManager.js copied to project
- [ ] Script included in HTML before game script
- [ ] Analytics initialized with unique game ID
- [ ] No console errors on page load

### Tracking
- [ ] Level start logs when game begins
- [ ] User actions tracked with recordTask()
- [ ] Custom metrics added with addRawMetric()
- [ ] Level completion tracked with endLevel()
- [ ] Report submitted on completion

### Console Output
- [ ] Initialization message appears
- [ ] Check attempts logged with metrics
- [ ] Full report logged before submission
- [ ] Submission banner displays
- [ ] Payload shows correct data

### Data Quality
- [ ] Game ID is meaningful
- [ ] Level IDs are unique per level
- [ ] Task IDs are unique per task
- [ ] XP values make sense
- [ ] All metrics are tracked

---

## 🎓 Advanced Tips

### Multiple Levels in One Session

```javascript
let sessionStartTime = Date.now();

function startNewLevel(levelNum) {
    currentLevelId = 'level_' + levelNum;
    analytics.startLevel(currentLevelId);
    levelStartTime = Date.now();
}

function completeLevel() {
    // End current level (but don't submit yet)
    analytics.endLevel(currentLevelId, true, Date.now() - levelStartTime, 100);
}

function endSession() {
    // Submit all levels at once
    analytics.submitReport();
}
```

### A/B Testing

```javascript
const variant = Math.random() < 0.5 ? 'A' : 'B';
analytics.addRawMetric('ab_test_variant', variant);
```

### Session Duration Tracking

```javascript
setInterval(() => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    analytics.addRawMetric('session_duration_seconds', sessionDuration);
}, 30000); // Update every 30 seconds
```

---

## 📞 Support & Resources

### Quick Debug Commands

Run these in browser console:

```javascript
// View current analytics data
analytics.getReportData();

// Check if initialized
analytics._isInitialized;

// View all levels
analytics._reportData.diagnostics.levels;

// View all metrics
analytics._reportData.rawData;

// Force submit (testing)
analytics.submitReport();
```

---

## 📝 Summary

**Minimum Required Code:**

```javascript
// 1. Initialize
const analytics = new AnalyticsManager();
analytics.initialize('game_id', 'session_' + Date.now());

// 2. Start level
analytics.startLevel('level_1');
let levelStartTime = Date.now();

// 3. Track actions
analytics.recordTask('level_1', 'task_1', 'Action', 'expected', 'actual', 1000, 10);
analytics.addRawMetric('score', 100);

// 4. Complete
analytics.endLevel('level_1', true, Date.now() - levelStartTime, 100);
analytics.submitReport();
```

That's it! You now have full analytics tracking with detailed console logging. 🎉

---

**Version:** 2.0  
**Last Updated:** February 14, 2026  
**Tested On:** Chrome, Firefox, Safari, Edge
