# Analytics Integration Guide

Complete documentation for implementing and integrating the AnalyticsManager in your game projects.

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Payload Structure](#payload-structure)
4. [Implementation Guide](#implementation-guide)
5. [Integration Steps](#integration-steps)
6. [API Reference](#api-reference)
7. [Examples](#examples)
8. [Receiving Analytics Data](#receiving-analytics-data)

---

## Overview

The AnalyticsManager is a singleton class that tracks game session metrics and submits them to various host environments (React Native WebView, parent frames, or custom bridges). It provides:

- **Session tracking** with unique identifiers
- **Level/stage management** with success metrics
- **Task recording** for individual user actions
- **Custom metrics** for performance data (FPS, accuracy, etc.)
- **Multiple delivery methods** with automatic fallback and offline queueing

---

## How It Works

### Architecture

1. **Singleton Pattern**: One instance manages all analytics across your game
2. **Data Accumulation**: Metrics are collected throughout the session
3. **Structured Reporting**: Data is organized into levels → tasks → metrics
4. **Multi-Channel Delivery**: Attempts multiple delivery methods for reliability
5. **Offline Persistence**: Failed submissions are queued in localStorage

### Delivery Flow

```
Game → AnalyticsManager → submitReport() → Try multiple channels:
                                           ├─ window.myJsAnalytics.trackGameSession()
                                           ├─ window.ReactNativeWebView.postMessage()
                                           ├─ window.parent.postMessage()
                                           └─ console.log (fallback)
                                           
If failed → Save to localStorage → Retry on 'online' or 'load' events
```

---

## Payload Structure

### Complete Payload Schema

When `submitReport()` is called, the following JSON payload is created:

```json
{
  "gameId": "string",              // Unique game identifier
  "name": "string",                // Session/player name
  "sessionId": "string",           // Auto-generated: timestamp-random
  "timestamp": "string",           // ISO 8601 timestamp (2026-02-16T...)
  
  "xpEarnedTotal": 0,              // Total XP earned this session
  "xpEarned": 0,                   // Alias for xpEarnedTotal
  "xpTotal": 0,                    // Alias for xpEarnedTotal
  "bestXp": 0,                     // Alias for xpEarnedTotal
  
  "rawData": [                     // Array of custom metrics
    {
      "key": "string",             // Metric name (e.g., "fps", "check_attempts")
      "value": "string"            // Metric value (always stringified)
    }
  ],
  
  "diagnostics": {
    "levels": [                    // Array of level/stage data
      {
        "levelId": "string",       // Unique level identifier
        "successful": false,       // Whether level was completed successfully
        "timeTaken": 0,            // Time taken in milliseconds
        "timeDirection": false,    // Reserved (currently always false)
        "xpEarned": 0,             // XP earned for this level
        "tasks": [                 // Array of task/action data
          {
            "taskId": "string",    // Unique task identifier
            "question": "string",  // Question/action description
            "options": "[]",       // Options available (JSON string)
            "correctChoice": "string",  // Correct answer
            "choiceMade": "string",     // User's answer/choice
            "successful": false,   // Whether task was successful
            "timeTaken": 0,        // Time taken for this task (ms)
            "xpEarned": 0          // XP earned for this task
          }
        ]
      }
    ]
  }
}
```

### Field Details

#### Root Level Fields

| Field | Type | Description | Auto-Generated |
|-------|------|-------------|----------------|
| `gameId` | string | Unique identifier for your game (set in `initialize()`) | No |
| `name` | string | Session or player name (set in `initialize()`) | No |
| `sessionId` | string | Unique session identifier | Yes (timestamp-random) |
| `timestamp` | string | ISO 8601 timestamp when submitted | Yes |
| `xpEarnedTotal` | number | Total experience points earned | Calculated |
| `xpEarned` | number | Alias for xpEarnedTotal (compatibility) | Yes |
| `xpTotal` | number | Alias for xpEarnedTotal (compatibility) | Yes |
| `bestXp` | number | Alias for xpEarnedTotal (compatibility) | Yes |

#### rawData Array

Contains custom metrics you add via `addRawMetric()`:

```javascript
analytics.addRawMetric('check_attempts', 3);
analytics.addRawMetric('accuracy_percent', 85.5);
analytics.addRawMetric('total_hints_used', 2);
```

Results in:
```json
"rawData": [
  { "key": "check_attempts", "value": "3" },
  { "key": "accuracy_percent", "value": "85.5" },
  { "key": "total_hints_used", "value": "2" }
]
```

#### diagnostics.levels Array

Each level entry contains:

| Field | Type | Description | Set By |
|-------|------|-------------|--------|
| `levelId` | string | Unique level identifier | `startLevel()` |
| `successful` | boolean | Whether level was completed | `endLevel()` |
| `timeTaken` | number | Milliseconds to complete | `endLevel()` |
| `timeDirection` | boolean | Reserved for future use | System |
| `xpEarned` | number | XP earned for this level | `endLevel()` |
| `tasks` | array | All tasks within this level | `recordTask()` |

#### tasks Array (within each level)

Each task entry contains:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `taskId` | string | Unique task identifier | "check_attempt_1" |
| `question` | string | Task description | "Check Puzzle Attempt #1" |
| `options` | string | Available options (JSON) | "[]" or '["A","B","C"]' |
| `correctChoice` | string | Correct answer | "all_correct" |
| `choiceMade` | string | User's choice | "has_errors" |
| `successful` | boolean | Auto-calculated from choices | true/false |
| `timeTaken` | number | Milliseconds elapsed | 45000 |
| `xpEarned` | number | XP for this task | 10 |

---

## Implementation Guide

### Step 1: Include AnalyticsManager

**Option A: Direct Script Include**
```html
<script src="AnalyticsManager.js"></script>
```

**Option B: ES6 Module**
```javascript
import AnalyticsManager from './AnalyticsManager.js';
```

**Option C: NPM Package** (from js-analytics-bridge/)
```bash
npm install ./js-analytics-bridge
```
```javascript
import AnalyticsManager from 'analytics-bridge-js';
```

### Step 2: Initialize at Game Start

```javascript
const analytics = new AnalyticsManager();
// OR use singleton
const analytics = AnalyticsManager.getInstance();

// Initialize with your game ID and session name
analytics.initialize('my_awesome_game', 'session_' + Date.now());
```

### Step 3: Track Level Lifecycle

```javascript
// When level starts
let levelStartTime = Date.now();
analytics.startLevel('level_1');

// During gameplay - track user actions
analytics.recordTask(
  'level_1',              // Level ID
  'puzzle_check_1',       // Task ID
  'Player checked puzzle', // Description
  'correct',              // Expected outcome
  'incorrect',            // Actual outcome
  Date.now() - levelStartTime, // Time taken
  5                       // XP earned
);

// When level ends
analytics.endLevel(
  'level_1',              // Level ID
  true,                   // Success status
  Date.now() - levelStartTime, // Total time
  100                     // Total XP for level
);
```

### Step 4: Add Custom Metrics (Optional)

```javascript
analytics.addRawMetric('fps_average', '58');
analytics.addRawMetric('hints_used', '3');
analytics.addRawMetric('difficulty', 'hard');
```

### Step 5: Submit Report

```javascript
// Submit when level completes or game session ends
analytics.submitReport();
```

---

## Integration Steps

### For Simple HTML5 Games

1. **Copy AnalyticsManager.js to your project**
   ```
   your-game/
   ├── index.html
   ├── game.js
   └── AnalyticsManager.js  ← Copy this
   ```

2. **Include in HTML**
   ```html
   <script src="AnalyticsManager.js"></script>
   <script src="game.js"></script>
   ```

3. **Initialize in your game code**
   ```javascript
   // At the top of game.js
   const analytics = new AnalyticsManager();
   analytics.initialize('your_game_id', 'session_' + Date.now());
   
   let levelStartTime = 0;
   let currentLevelId = null;
   ```

4. **Add tracking to game events**
   ```javascript
   function startLevel(levelNumber) {
     currentLevelId = 'level_' + levelNumber;
     levelStartTime = Date.now();
     analytics.startLevel(currentLevelId);
     // ... rest of your level start code
   }
   
   function checkAnswer(userAnswer, correctAnswer) {
     analytics.recordTask(
       currentLevelId,
       'answer_' + Date.now(),
       'Player answered question',
       correctAnswer,
       userAnswer,
       Date.now() - levelStartTime,
       userAnswer === correctAnswer ? 10 : 0
     );
   }
   
   function completeLevel(success) {
     const timeTaken = Date.now() - levelStartTime;
     const xpEarned = success ? 100 : 0;
     
     analytics.endLevel(currentLevelId, success, timeTaken, xpEarned);
     analytics.submitReport();
   }
   ```

### For React Applications

```jsx
import React, { useEffect, useRef } from 'react';
import AnalyticsManager from './AnalyticsManager';

function Game() {
  const analyticsRef = useRef(null);
  
  useEffect(() => {
    // Initialize once on mount
    analyticsRef.current = new AnalyticsManager();
    analyticsRef.current.initialize('react_game', 'session_' + Date.now());
    
    return () => {
      // Submit on unmount
      analyticsRef.current.submitReport();
    };
  }, []);
  
  const startLevel = (levelId) => {
    analyticsRef.current.startLevel(levelId);
  };
  
  const completeLevel = (levelId, success, time, xp) => {
    analyticsRef.current.endLevel(levelId, success, time, xp);
    analyticsRef.current.submitReport();
  };
  
  return (
    <div>
      {/* Your game UI */}
    </div>
  );
}
```

### For Phaser Games

```javascript
class GameScene extends Phaser.Scene {
  create() {
    this.analytics = new AnalyticsManager();
    this.analytics.initialize('phaser_game', 'session_' + Date.now());
    this.levelStartTime = Date.now();
    
    this.analytics.startLevel('level_1');
  }
  
  onPlayerAction(question, correct, choice) {
    this.analytics.recordTask(
      'level_1',
      'action_' + Date.now(),
      question,
      correct,
      choice,
      Date.now() - this.levelStartTime,
      correct === choice ? 10 : 0
    );
  }
  
  onLevelComplete() {
    const timeTaken = Date.now() - this.levelStartTime;
    this.analytics.endLevel('level_1', true, timeTaken, 100);
    this.analytics.submitReport();
  }
}
```

---

## API Reference

### Constructor & Initialization

#### `new AnalyticsManager()`
Creates a new instance (or returns existing singleton).

#### `AnalyticsManager.getInstance()`
Returns the singleton instance.

#### `initialize(gameId, sessionName)`
Initializes analytics tracking.

**Parameters:**
- `gameId` (string): Unique identifier for your game
- `sessionName` (string): Session or player identifier

**Example:**
```javascript
analytics.initialize('crossword_puzzle', 'player_12345');
```

---

### Level Tracking

#### `startLevel(levelId)`
Begins tracking a new level.

**Parameters:**
- `levelId` (string): Unique level identifier

**Example:**
```javascript
analytics.startLevel('level_1');
```

#### `endLevel(levelId, successful, timeTakenMs, xp)`
Completes a level and records results.

**Parameters:**
- `levelId` (string): Level identifier (must match `startLevel()`)
- `successful` (boolean): Whether level was completed successfully
- `timeTakenMs` (number): Time taken in milliseconds
- `xp` (number): Experience points earned

**Example:**
```javascript
analytics.endLevel('level_1', true, 45000, 150);
```

---

### Task Recording

#### `recordTask(levelId, taskId, question, correctChoice, choiceMade, timeMs, xp)`
Records a specific user action or decision within a level.

**Parameters:**
- `levelId` (string): Level this task belongs to
- `taskId` (string): Unique task identifier
- `question` (string): Description of the task/question
- `correctChoice` (string): The correct answer
- `choiceMade` (string): The user's answer
- `timeMs` (number): Time taken for this task in milliseconds
- `xp` (number): XP earned for this task

**Example:**
```javascript
analytics.recordTask(
  'level_1',
  'puzzle_check_1',
  'Check Puzzle Attempt #1',
  'all_correct',
  'has_errors',
  15000,
  10
);
```

---

### Custom Metrics

#### `addRawMetric(key, value)`
Adds a custom metric to the session data.

**Parameters:**
- `key` (string): Metric name
- `value` (string|number): Metric value (will be converted to string)

**Example:**
```javascript
analytics.addRawMetric('check_attempts', 3);
analytics.addRawMetric('accuracy_percent', 87.5);
analytics.addRawMetric('hints_used', 2);
```

---

### Reporting

#### `submitReport()`
Submits the accumulated analytics data to the host environment.

**Attempts delivery via:**
1. `window.myJsAnalytics.trackGameSession()` - Custom site bridge
2. `window.ReactNativeWebView.postMessage()` - React Native WebView
3. `window.parent.postMessage()` - Parent frame (configurable origin)
4. `console.log()` - Fallback for debugging

**If delivery fails:** Payload is saved to localStorage (`ignite_pending_sessions_jsplugin`) and retried when online.

**Example:**
```javascript
analytics.submitReport();
```

---

### Utility Methods

#### `getReportData()`
Returns a deep clone of current analytics data (for debugging).

**Returns:** Object containing all analytics data

**Example:**
```javascript
const currentData = analytics.getReportData();
console.log('Current XP:', currentData.xpEarnedTotal);
console.log('Levels:', currentData.diagnostics.levels);
```

#### `reset()`
Clears all accumulated data (useful for new sessions).

**Example:**
```javascript
analytics.reset();
```

---

## Examples

### Example 1: Crossword Puzzle (Current Implementation)

```javascript
// Initialize
const analytics = new AnalyticsManager();
analytics.initialize('crossword_puzzle', 'session_' + Date.now());

let levelStartTime = Date.now();
let checkAttempts = 0;
const currentLevelId = 'level_easy';

// Start level
analytics.startLevel(currentLevelId);

// Track check attempts
function checkPuzzle() {
  checkAttempts++;
  const allCorrect = checkAllCells(); // Your validation logic
  const timeSinceStart = Date.now() - levelStartTime;
  
  // Record this check as a task
  analytics.recordTask(
    currentLevelId,
    'check_attempt_' + checkAttempts,
    `Check Puzzle Attempt #${checkAttempts}`,
    'all_correct',
    allCorrect ? 'all_correct' : 'has_errors',
    timeSinceStart,
    allCorrect ? 50 : 10
  );
  
  // Add metrics
  analytics.addRawMetric('check_attempts', checkAttempts);
  analytics.addRawMetric('time_elapsed_seconds', Math.floor(timeSinceStart / 1000));
  
  if (allCorrect) {
    // Calculate XP with bonuses
    const baseXP = 100;
    const timeBonus = Math.max(0, 50 - Math.floor(timeSinceStart / 10000));
    const attemptBonus = Math.max(0, 50 - (checkAttempts - 1) * 10);
    const totalXP = baseXP + timeBonus + attemptBonus;
    
    // End level and submit
    analytics.endLevel(currentLevelId, true, timeSinceStart, totalXP);
    analytics.submitReport();
  }
}
```

### Example 2: Quiz Game

```javascript
const analytics = new AnalyticsManager();
analytics.initialize('trivia_quiz', 'player_' + userId);

let currentQuestion = 0;
let questionStartTime = 0;

function startQuiz() {
  analytics.startLevel('quiz_round_1');
  nextQuestion();
}

function nextQuestion() {
  currentQuestion++;
  questionStartTime = Date.now();
}

function answerQuestion(selectedAnswer, correctAnswer) {
  const timeTaken = Date.now() - questionStartTime;
  const isCorrect = selectedAnswer === correctAnswer;
  
  analytics.recordTask(
    'quiz_round_1',
    'q' + currentQuestion,
    questions[currentQuestion].text,
    correctAnswer,
    selectedAnswer,
    timeTaken,
    isCorrect ? 20 : 0
  );
  
  if (currentQuestion >= 10) {
    finishQuiz();
  } else {
    nextQuestion();
  }
}

function finishQuiz() {
  const totalTime = Date.now() - quizStartTime;
  const score = calculateScore(); // Your scoring logic
  
  analytics.addRawMetric('final_score', score);
  analytics.addRawMetric('questions_answered', currentQuestion);
  
  analytics.endLevel('quiz_round_1', true, totalTime, score);
  analytics.submitReport();
}
```

### Example 3: Platformer Game

```javascript
const analytics = new AnalyticsManager();
analytics.initialize('platform_game', 'guest_' + Date.now());

class Level {
  constructor(levelNum) {
    this.levelId = 'stage_' + levelNum;
    this.startTime = Date.now();
    this.coinsCollected = 0;
    this.enemiesDefeated = 0;
    this.deaths = 0;
    
    analytics.startLevel(this.levelId);
  }
  
  collectCoin() {
    this.coinsCollected++;
    analytics.addRawMetric('coins_collected', this.coinsCollected);
  }
  
  defeatEnemy(enemyType) {
    this.enemiesDefeated++;
    analytics.recordTask(
      this.levelId,
      'enemy_' + this.enemiesDefeated,
      'Defeated ' + enemyType,
      'defeated',
      'defeated',
      Date.now() - this.startTime,
      10
    );
  }
  
  playerDied() {
    this.deaths++;
    analytics.addRawMetric('deaths', this.deaths);
  }
  
  complete(reachedEnd) {
    const timeTaken = Date.now() - this.startTime;
    const xp = this.coinsCollected * 5 + this.enemiesDefeated * 10;
    
    analytics.addRawMetric('completion_time_sec', Math.floor(timeTaken / 1000));
    analytics.endLevel(this.levelId, reachedEnd, timeTaken, xp);
    analytics.submitReport();
  }
}
```

---

## Receiving Analytics Data

### In React Native WebView

```javascript
import { WebView } from 'react-native-webview';

function GameWebView() {
  const handleMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      
      // Check if it's analytics data
      if (payload.gameId && payload.diagnostics) {
        console.log('Analytics received:', payload);
        
        // Send to your backend
        fetch('https://your-api.com/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };
  
  return (
    <WebView
      source={{ uri: 'https://your-game.com' }}
      onMessage={handleMessage}
    />
  );
}
```

### In Parent Frame (iframe)

```javascript
// Parent page hosting game in iframe
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== 'https://trusted-game-domain.com') {
    return;
  }
  
  const payload = event.data;
  
  if (payload.gameId && payload.diagnostics) {
    console.log('Game analytics:', payload);
    
    // Process the data
    saveAnalytics(payload);
  }
});

// Optional: Send configuration to game
const gameIframe = document.getElementById('game-frame');
gameIframe.contentWindow.postMessage({
  type: 'ANALYTICS_CONFIG',
  parentOrigin: window.location.origin
}, '*');
```

### Custom Bridge

```javascript
// Define your custom bridge before loading the game
window.myJsAnalytics = {
  trackGameSession: function(payload) {
    console.log('Analytics received via custom bridge:', payload);
    
    // Send to your analytics service
    gtag('event', 'game_session', {
      game_id: payload.gameId,
      session_id: payload.sessionId,
      xp_earned: payload.xpEarnedTotal,
      levels_completed: payload.diagnostics.levels.length
    });
  }
};
```

### Retrieving from localStorage

If offline, failed submissions are stored:

```javascript
const LS_KEY = 'ignite_pending_sessions_jsplugin';

function getPendingSessions() {
  try {
    const stored = localStorage.getItem(LS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function clearPendingSessions() {
  localStorage.removeItem(LS_KEY);
}

// Example: Manual flush
function manualFlush() {
  const pending = getPendingSessions();
  pending.forEach(payload => {
    sendToServer(payload);
  });
  clearPendingSessions();
}
```

---

## Best Practices

### 1. Initialize Early
```javascript
// ✅ Good - Initialize before any game logic
const analytics = new AnalyticsManager();
analytics.initialize('my_game', 'session_' + Date.now());
startGame();

// ❌ Bad - Initializing after level starts
startGame();
analytics.initialize('my_game', 'session'); // Data may be lost
```

### 2. Use Descriptive IDs
```javascript
// ✅ Good
analytics.startLevel('world_1_stage_3');
analytics.recordTask('world_1_stage_3', 'boss_fight_1', '...', '...', '...', 1000, 50);

// ❌ Bad
analytics.startLevel('lvl1');
analytics.recordTask('lvl1', 'task1', '...', '...', '...', 1000, 50);
```

### 3. Track Meaningful Metrics
```javascript
// ✅ Good - Actionable metrics
analytics.addRawMetric('completion_rate_percent', 87.5);
analytics.addRawMetric('average_response_time_ms', 1250);
analytics.addRawMetric('difficulty_rating', 'medium');

// ❌ Bad - Not useful
analytics.addRawMetric('random_number', Math.random());
```

### 4. Handle Failed Sessions
```javascript
// Track incomplete sessions on page unload
window.addEventListener('beforeunload', () => {
  if (currentLevelActive) {
    analytics.endLevel(currentLevelId, false, Date.now() - levelStartTime, 0);
    analytics.submitReport();
  }
});
```

### 5. Don't Over-Track
```javascript
// ✅ Good - Track significant events
analytics.recordTask(levelId, 'question_1', 'What is 2+2?', '4', userAnswer, time, xp);

// ❌ Bad - Too granular
analytics.recordTask(levelId, 'mouse_move_1', 'Mouse moved', 'x123y456', 'x124y457', 1, 0);
```

---

## Troubleshooting

### Data Not Being Sent

1. **Check initialization**
   ```javascript
   console.log(analytics._isInitialized); // Should be true
   ```

2. **Verify the payload**
   ```javascript
   console.log(analytics.getReportData());
   ```

3. **Check browser console** for delivery errors

4. **Inspect localStorage** for pending sessions
   ```javascript
   console.log(localStorage.getItem('ignite_pending_sessions_jsplugin'));
   ```

### XP Not Calculating

- Ensure you're calling `endLevel()` with XP values
- Check that `recordTask()` XP is being added correctly
- Verify `xpEarnedTotal` in the payload

### Missing Level Data

- Make sure `startLevel()` is called before any `recordTask()` or `endLevel()`
- Level IDs must match exactly across all calls

---

## License

MIT License - See js-analytics-bridge package for details.

---

## Support

For issues, questions, or contributions, please contact the development team or raise an issue in the project repository.
