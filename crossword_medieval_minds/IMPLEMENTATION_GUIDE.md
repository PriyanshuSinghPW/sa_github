# Game Implementation Guide
## Analytics Integration & How to Play Instructions

This guide provides step-by-step instructions for implementing **JS Analytics** and **text-based "How to Play" instructions** in any game template.

---

## Table of Contents
1. [Analytics Integration](#analytics-integration)
2. [Text-Based How to Play Instructions](#text-based-how-to-play-instructions)
3. [Testing & Verification](#testing--verification)

---

## Analytics Integration

### Step 1: Copy AnalyticsManager.js

**Action:** Copy the `AnalyticsManager.js` file to your game's root directory.

**File Location:** 
```
your-game/
├── AnalyticsManager.js  ← Copy this file
├── index.html
├── game.html
└── script.js
```

### Step 2: Include Analytics in HTML

**Action:** Add the analytics script **before** your main game script in the HTML file.

**Example (game.html):**
```html
<body>
    <!-- Your game content -->
    
    <script src="AnalyticsManager.js"></script>
    <script src="script.js"></script>
</body>
```

**⚠️ Important:** AnalyticsManager.js must load BEFORE your game script.

### Step 3: Initialize Analytics in Game Script

**Action:** At the top of your main game script, initialize the analytics manager.

**Add to script.js:**
```javascript
document.addEventListener('DOMContentLoaded', () => {
    // Analytics Setup
    const analytics = new AnalyticsManager();
    analytics.initialize('your_game_id', 'session_' + Date.now());
    let levelStartTime = 0;
    let currentLevelId = null;
    let checkAttempts = 0;

    // Rest of your game code...
});
```

**Customize:**
- `'your_game_id'` → Replace with your game's unique identifier (e.g., `'crossword_puzzle'`, `'word_search'`, `'trivia_game'`)

### Step 4: Track Level Start

**Action:** When your game/level begins, start tracking.

**Pattern:**
```javascript
function startLevel() {
    // Generate level ID based on your game's structure
    currentLevelId = 'level_' + levelNumber; // or metadata.title, difficulty, etc.
    
    analytics.startLevel(currentLevelId);
    levelStartTime = Date.now();
    console.log('[Analytics] Level started:', currentLevelId);
    
    // Your game initialization code...
}
```

**Customize:**
- Level ID can be based on: level number, difficulty, puzzle name, etc.
- Must be unique for each level/puzzle

### Step 5: Track User Actions

**Action:** Record significant user interactions as "tasks".

**Pattern:**
```javascript
function handleUserAction(userAnswer, correctAnswer) {
    checkAttempts++;
    
    analytics.recordTask(
        currentLevelId,                          // Current level ID
        'action_' + checkAttempts,              // Unique task ID
        'Description of action',                // What the user did
        correctAnswer,                          // Correct value
        userAnswer,                             // User's value
        Date.now() - levelStartTime,           // Time taken
        userAnswer === correctAnswer ? 50 : 10 // XP earned
    );
}
```

**Use Cases:**
- Quiz games: Track each question answered
- Puzzle games: Track "check answer" attempts
- Action games: Track checkpoints reached

### Step 6: Track Custom Metrics

**Action:** Add game-specific metrics throughout gameplay.

**Pattern:**
```javascript
// Track any metric as key-value pairs
analytics.addRawMetric('score', currentScore);
analytics.addRawMetric('lives_remaining', lives);
analytics.addRawMetric('accuracy_percent', accuracy);
analytics.addRawMetric('power_ups_used', powerUps);
```

**Examples by Game Type:**
- **Puzzle:** accuracy, hints_used, time_remaining
- **Quiz:** correct_answers, wrong_answers, streak
- **Action:** enemies_defeated, damage_taken, collectibles

### Step 7: Track Level Completion

**Action:** When level ends (success or failure), record the outcome.

**Pattern:**
```javascript
function endLevel(success) {
    const timeTaken = Date.now() - levelStartTime;
    
    // Calculate XP based on performance
    let xp = 0;
    if (success) {
        const baseXP = 100;
        const timeBonus = calculateTimeBonus(timeTaken);
        const performanceBonus = calculatePerformanceBonus();
        xp = baseXP + timeBonus + performanceBonus;
    }
    
    analytics.endLevel(currentLevelId, success, timeTaken, xp);
    analytics.submitReport();
    console.log('[Analytics] Level ended. XP:', xp);
}
```

**XP Calculation Tips:**
- Base XP for completion
- Bonuses for: speed, accuracy, no hints used, perfect score
- Penalties for: multiple attempts, hints used

### Step 8: Track Incomplete Sessions

**Action:** Capture data when users leave before completing.

**Add to script.js:**
```javascript
// At the end of your DOMContentLoaded listener
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

### Analytics Data Structure

The submitted report includes:
```javascript
{
    gameId: "your_game_id",
    name: "session_xxx",
    sessionId: "unique_session_id",
    timestamp: "2026-02-14T10:30:00.000Z",
    xpEarnedTotal: 150,
    rawData: [
        { key: "check_attempts", value: "3" },
        { key: "accuracy_percent", value: "92.5" }
    ],
    diagnostics: {
        levels: [
            {
                levelId: "level_1",
                successful: true,
                timeTaken: 45000,
                xpEarned: 150,
                tasks: [
                    {
                        taskId: "check_1",
                        question: "Check attempt #1",
                        correctChoice: "answer",
                        choiceMade: "answer",
                        successful: true,
                        timeTaken: 45000,
                        xpEarned: 50
                    }
                ]
            }
        ]
    }
}
```

---

## Text-Based How to Play Instructions

### Step 1: Remove Image Dependencies

**Action:** Find and remove references to "How to Play" images.

**Search for:**
- `howToPlayImg` variable declarations
- `<img>` tags with how-to-play images
- CSS classes like `.how-to-play-img`
- Event listeners for image errors

**Remove from JavaScript:**
```javascript
// REMOVE THIS:
const howToPlayImg = document.getElementById('howToPlayImg');
howToPlayImg.addEventListener('error', function() {
    this.style.display = 'none';
});
```

### Step 2: Create HTML Structure

**Action:** Replace the image with styled HTML content.

**Template:**
```html
<!-- How to Play Popup -->
<div class="popup-overlay" id="howToPopup">
    <div class="popup-content">
        <div class="how-to-play-content">
            <h2 class="how-to-title">
                <span class="title-letter">H</span>ow 
                <span class="title-letter">T</span>o 
                <span class="title-letter">P<sub>La</sub></span>y
            </h2>
            
            <!-- Instruction 1 -->
            <div class="instruction-item">
                <div class="instruction-number">1</div>
                <div class="instruction-text">
                    <strong>First instruction for your game</strong>
                </div>
                <div class="instruction-visual">
                    <!-- Add visual demo here (mini grid, buttons, etc.) -->
                </div>
            </div>

            <!-- Instruction 2 -->
            <div class="instruction-item">
                <div class="instruction-number">2</div>
                <div class="instruction-text">
                    <strong>Second instruction for your game</strong>
                </div>
                <div class="instruction-visual">
                    <!-- Add visual demo here -->
                </div>
            </div>

            <!-- Add more instructions as needed -->
        </div>
        <button class="back-btn" id="backBtn">BACK</button>
    </div>
</div>
```

### Step 3: Add CSS Styling

**Action:** Style the how-to-play content to match your game's theme.

**Add to your CSS or `<style>` block:**
```css
/* How to Play Content Styles */
.how-to-play-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px;
    padding: 40px;
    max-width: 700px;
    box-shadow: 0 10px 40px rgba(3, 218, 198, 0.2);
    border: 2px solid var(--accent-color);
}

.how-to-title {
    font-size: 2.5em;
    text-align: center;
    margin-bottom: 40px;
    color: var(--text-color);
    font-weight: 700;
    letter-spacing: 3px;
}

.title-letter {
    display: inline-block;
    border: 3px solid var(--accent-color);
    padding: 5px 15px;
    margin: 0 3px;
    background-color: rgba(3, 218, 198, 0.1);
    border-radius: 5px;
    color: var(--accent-color);
}

.title-letter sub {
    font-size: 0.5em;
    color: var(--accent-color);
    vertical-align: sub;
}

.instruction-item {
    display: flex;
    align-items: flex-start;
    margin-bottom: 35px;
    padding: 20px;
    background-color: rgba(3, 218, 198, 0.05);
    border-radius: 12px;
    border-left: 4px solid var(--accent-color);
}

.instruction-number {
    font-size: 2em;
    font-weight: bold;
    color: var(--accent-color);
    background-color: rgba(3, 218, 198, 0.2);
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20px;
    flex-shrink: 0;
    border: 2px solid var(--accent-color);
}

.instruction-text {
    flex: 1;
    color: var(--text-color);
    font-size: 1.1em;
    line-height: 1.6;
}

.instruction-text strong {
    color: var(--accent-color);
}

.instruction-visual {
    margin-top: 15px;
    display: flex;
    justify-content: center;
    width: 100%;
}

.back-btn {
    margin-top: 20px;
    padding: 15px 50px;
    font-size: 1.1em;
    font-family: inherit;
    font-weight: bold;
    text-transform: uppercase;
    background-color: var(--accent-color);
    color: var(--background-color);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    letter-spacing: 2px;
}

.back-btn:hover {
    background-color: var(--button-hover);
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(3, 218, 198, 0.6);
}
```

### Step 4: Customize Instructions

**Action:** Adapt the instructions to your specific game.

**Game-Specific Visual Examples:**

**For Crossword/Word Puzzles:**
```html
<div class="instruction-visual">
    <div class="mini-grid">
        <div class="mini-cell"></div>
        <div class="mini-cell filled">W</div>
        <div class="mini-cell"></div>
        <div class="mini-cell filled">O</div>
        <div class="mini-cell filled">R</div>
        <div class="mini-cell filled">D</div>
    </div>
</div>

<style>
.mini-grid {
    display: grid;
    grid-template-columns: repeat(4, 50px);
    gap: 3px;
}

.mini-cell {
    width: 50px;
    height: 50px;
    border: 2px solid rgba(68, 68, 68, 0.5);
    background-color: rgba(42, 42, 42, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    font-weight: bold;
    color: var(--text-color);
    border-radius: 4px;
}

.mini-cell.filled {
    background-color: rgba(3, 218, 198, 0.15);
    border-color: var(--accent-color);
    color: var(--accent-color);
}
</style>
```

**For Button-Based Games:**
```html
<div class="instruction-visual">
    <button class="demo-btn">CLICK ME</button>
</div>

<style>
.demo-btn {
    padding: 15px 40px;
    font-size: 1.1em;
    font-family: inherit;
    font-weight: bold;
    background-color: var(--accent-color);
    color: var(--background-color);
    border: none;
    border-radius: 8px;
    cursor: default;
    letter-spacing: 2px;
    box-shadow: 0 4px 15px rgba(3, 218, 198, 0.4);
}
</style>
```

**For Card/Match Games:**
```html
<div class="instruction-visual">
    <div class="demo-cards">
        <div class="demo-card">🎮</div>
        <div class="demo-card">🎮</div>
        <div class="demo-card">?</div>
    </div>
</div>

<style>
.demo-cards {
    display: flex;
    gap: 10px;
}

.demo-card {
    width: 60px;
    height: 80px;
    background-color: rgba(3, 218, 198, 0.2);
    border: 2px solid var(--accent-color);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2em;
}
</style>
```

### Step 5: Add Mobile Responsiveness

**Action:** Ensure instructions look good on all screen sizes.

**Add responsive CSS:**
```css
@media (max-width: 768px) {
    .how-to-play-content {
        padding: 20px;
        max-width: 90%;
    }

    .how-to-title {
        font-size: 1.8em;
        margin-bottom: 25px;
    }

    .instruction-item {
        flex-direction: column;
        padding: 15px;
    }

    .instruction-number {
        margin-right: 0;
        margin-bottom: 15px;
    }

    .instruction-text {
        font-size: 1em;
    }

    .mini-grid {
        grid-template-columns: repeat(3, 40px);
    }

    .mini-cell {
        width: 40px;
        height: 40px;
        font-size: 1em;
    }
}
```

---

## Testing & Verification

### Analytics Testing Checklist

- [ ] Analytics initializes on game load
- [ ] Level start is tracked with correct ID
- [ ] User actions are recorded as tasks
- [ ] Custom metrics are captured
- [ ] Level completion submits data
- [ ] Incomplete sessions are tracked on page unload
- [ ] Console shows analytics logs
- [ ] No JavaScript errors in console

**Test Commands (Browser Console):**
```javascript
// Check analytics data
analytics.getReportData();

// Verify level tracking
console.log(analytics._reportData.diagnostics.levels);

// Check raw metrics
console.log(analytics._reportData.rawData);
```

### How to Play Testing Checklist

- [ ] "How to Play" button opens popup
- [ ] All instructions are visible and readable
- [ ] Visual demos display correctly
- [ ] Back button closes popup
- [ ] Styling matches game theme
- [ ] Responsive on mobile devices
- [ ] No broken image references
- [ ] No console errors

### Browser Console Debugging

**Expected Console Logs:**
```
[Analytics] Initialized for: your_game_id
[Analytics] Level started: level_1
[Analytics] Payload: { ... full data object ... }
```

**If you see errors:**
1. Check that AnalyticsManager.js is loaded before your script
2. Verify analytics variable is in scope
3. Ensure all function names are correct
4. Check that level is started before recording tasks

---

## Quick Reference

### Analytics Methods

```javascript
// Initialize
analytics.initialize(gameId, sessionName);

// Level tracking
analytics.startLevel(levelId);
analytics.endLevel(levelId, successful, timeMs, xp);

// Task tracking
analytics.recordTask(levelId, taskId, question, correctChoice, choiceMade, timeMs, xp);

// Metrics
analytics.addRawMetric(key, value);

// Submit
analytics.submitReport();

// Debug
analytics.getReportData();
analytics.reset();
```

### Common Patterns

**Pattern 1: Simple Quiz Game**
```javascript
// On quiz start
analytics.startLevel('quiz_' + quizId);
levelStartTime = Date.now();

// After each question
analytics.recordTask(
    'quiz_' + quizId,
    'question_' + questionNum,
    questionText,
    correctAnswer,
    userAnswer,
    Date.now() - questionStartTime,
    isCorrect ? 10 : 0
);

// On quiz complete
analytics.endLevel('quiz_' + quizId, true, Date.now() - levelStartTime, totalScore);
analytics.submitReport();
```

**Pattern 2: Puzzle Game**
```javascript
// On puzzle start
analytics.startLevel('puzzle_' + puzzleId);
startTime = Date.now();

// On check/verify
analytics.addRawMetric('attempts', attemptCount);
analytics.recordTask(puzzleId, 'check_' + attemptCount, 'Check puzzle', 'solved', status, timeSoFar, 0);

// On completion
analytics.endLevel(puzzleId, true, totalTime, calculateXP());
analytics.submitReport();
```

**Pattern 3: Timed Game**
```javascript
// On game start
analytics.startLevel('game_' + timestamp);
analytics.addRawMetric('difficulty', difficulty);

// During gameplay
analytics.addRawMetric('score', currentScore);
analytics.addRawMetric('time_remaining', timeLeft);

// On game end
analytics.endLevel(gameId, score > 0, elapsedTime, score);
analytics.submitReport();
```

---

## Customization Tips

### Color Schemes

Replace these CSS variables in your theme:
```css
:root {
    --background-color: #121212;
    --accent-color: #03dac6;
    --button-hover: #02b8a8;
    --text-color: #e0e0e0;
}
```

### XP Calculation Formulas

**Simple:**
```javascript
const xp = successful ? 100 : 0;
```

**Time-based:**
```javascript
const baseXP = 100;
const timeBonus = Math.max(0, 50 - Math.floor(timeTaken / 10000));
const xp = baseXP + timeBonus;
```

**Performance-based:**
```javascript
const baseXP = 100;
const accuracyBonus = Math.floor(accuracy * 0.5);
const speedBonus = timeTaken < targetTime ? 50 : 0;
const attemptPenalty = (attempts - 1) * 10;
const xp = Math.max(0, baseXP + accuracyBonus + speedBonus - attemptPenalty);
```

---

## Troubleshooting

### Issue: "AnalyticsManager is not defined"
**Solution:** Ensure AnalyticsManager.js is loaded before your game script in HTML.

### Issue: Analytics not submitting
**Solution:** Check browser console for errors. Verify submitReport() is called.

### Issue: Level not found warning
**Solution:** Ensure startLevel() is called before recordTask() or endLevel().

### Issue: How to Play button doesn't work
**Solution:** Verify popup overlay has correct ID and JavaScript event listener is attached.

### Issue: Instructions not visible
**Solution:** Check z-index values and that popup has class "active" when opened.

---

## Support

For issues or questions:
1. Check browser console for errors
2. Verify all files are in correct locations
3. Review this guide's patterns and examples
4. Test with console.log statements

---

**Last Updated:** February 14, 2026  
**Version:** 1.0  
**Compatible with:** All modern browsers (Chrome, Firefox, Safari, Edge)
