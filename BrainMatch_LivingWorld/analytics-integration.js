// ====================================================================
// ANALYTICS INTEGRATION FOR BRAINMATCH GAME
// ====================================================================
// This file hooks into the game functions without modifying the original
// game code. It uses the monkey-patching pattern to intercept function
// calls and add analytics tracking.
// ====================================================================

console.log('[Analytics] Loading integration script...');

// ====================================================================
// INITIALIZATION
// ====================================================================

// Generate unique session ID
const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initialize Analytics Manager
const analytics = new AnalyticsManager();
analytics.initialize('BrainMatch_LivingWorld', sessionID);

console.log(`[Analytics] Initialized with Session ID: ${sessionID}`);

// ====================================================================
// HELPER VARIABLES
// ====================================================================

let levelStartTime = null;
let currentLevelId = null;
let taskCounter = 0;

// ====================================================================
// HOOK: CAMPAIGN LEVEL START
// ====================================================================

const originalStartGame = window.startGame;
window.startGame = function(level) {
  try {
    // Generate level ID
    currentLevelId = `campaign_level_${level}`;
    
    // Record start time
    levelStartTime = Date.now();
    
    // Reset task counter for new level
    taskCounter = 0;
    
    // Track level start
    analytics.startLevel(currentLevelId);
    
    console.log(`[Analytics] Started Level: ${currentLevelId}`);
  } catch (error) {
    console.error('[Analytics] Error in startGame hook:', error);
  }
  
  // Always call original function
  return originalStartGame.call(this, level);
};

// ====================================================================
// HOOK: REFLEX MODE START
// ====================================================================

const originalStartReflexMode = window.startReflexMode;
window.startReflexMode = function() {
  try {
    // Generate level ID for reflex mode
    currentLevelId = 'reflex_mode';
    
    // Record start time
    levelStartTime = Date.now();
    
    // Reset task counter
    taskCounter = 0;
    
    // Track level start
    analytics.startLevel(currentLevelId);
    
    console.log('[Analytics] Started Reflex Mode');
  } catch (error) {
    console.error('[Analytics] Error in startReflexMode hook:', error);
  }
  
  // Always call original function
  return originalStartReflexMode.call(this);
};

// ====================================================================
// HOOK: CORRECT MATCH
// ====================================================================

const originalHandleCorrectMatch = window.handleCorrectMatch;
window.handleCorrectMatch = function() {
  try {
    // Capture game state BEFORE calling original function
    const flippedCards = gameState.flippedCards;
    
    if (flippedCards && flippedCards.length === 2) {
      const card1 = flippedCards[0];
      const card2 = flippedCards[1];
      
      const card1Value = card1.dataset.value || 'unknown';
      const card2Value = card2.dataset.value || 'unknown';
      
      // Record the task
      taskCounter++;
      analytics.recordTask(
        currentLevelId,
        `task_${taskCounter}`,
        `Match: ${card1Value}`,
        card1Value,
        card2Value,
        0, // timeTakenMs - could be tracked if needed
        0  // xpEarned - calculated at level end
      );
      
      console.log(`[Analytics] Task Recorded - Correct Match: ${card1Value} = ${card2Value}`);
    }
  } catch (error) {
    console.error('[Analytics] Error in handleCorrectMatch hook:', error);
  }
  
  // Always call original function
  return originalHandleCorrectMatch.call(this);
};

// ====================================================================
// HOOK: INCORRECT MATCH
// ====================================================================

const originalHandleIncorrectMatch = window.handleIncorrectMatch;
window.handleIncorrectMatch = function() {
  try {
    // Capture game state BEFORE calling original function
    const flippedCards = gameState.flippedCards;
    
    if (flippedCards && flippedCards.length === 2) {
      const card1 = flippedCards[0];
      const card2 = flippedCards[1];
      
      const card1Value = card1.dataset.value || 'unknown';
      const card2Value = card2.dataset.value || 'unknown';
      const expectedMatch = card1.dataset.match || 'unknown';
      
      // Record the task (incorrect)
      taskCounter++;
      analytics.recordTask(
        currentLevelId,
        `task_${taskCounter}`,
        `Match: ${card1Value}`,
        expectedMatch,
        card2Value,
        0, // timeTakenMs
        0  // xpEarned
      );
      
      console.log(`[Analytics] Task Recorded - Incorrect Match: ${card1Value}, Expected: ${expectedMatch}, Got: ${card2Value}`);
    }
  } catch (error) {
    console.error('[Analytics] Error in handleIncorrectMatch hook:', error);
  }
  
  // Always call original function
  return originalHandleIncorrectMatch.call(this);
};

// ====================================================================
// HOOK: CAMPAIGN LEVEL WIN
// ====================================================================

const originalHandleCampaignWin = window.handleCampaignWin;
window.handleCampaignWin = function() {
  try {
    // Capture game state BEFORE calling original function
    const level = gameState.currentCampaignLevel;
    const turns = gameState.turns;
    
    // Calculate duration
    const duration = Date.now() - levelStartTime;
    
    // Calculate XP (using game's own function if available)
    let xp = 0;
    if (typeof window.calculateXP === 'function') {
      xp = window.calculateXP(level, turns);
    }
    
    // Calculate stars
    let stars = 0;
    if (typeof window.calculateCampaignStars === 'function') {
      stars = window.calculateCampaignStars(level, turns);
    }
    
    // End level tracking
    analytics.endLevel(currentLevelId, true, duration, xp);
    
    // Add custom metrics
    analytics.addRawMetric('level', level.toString());
    analytics.addRawMetric('turns', turns.toString());
    analytics.addRawMetric('xp_earned', xp.toString());
    analytics.addRawMetric('stars', stars.toString());
    analytics.addRawMetric('mode', 'campaign');
    
    // Submit report
    // Do NOT submit here — wait for all 3 levels to finish on the final score screen
    console.log(`[Analytics] Completed Level: ${currentLevelId}, Success: true, Time: ${duration}ms, XP: ${xp}, Stars: ${stars}`);
  } catch (error) {
    console.error('[Analytics] Error in handleCampaignWin hook:', error);
  }
  
  // Always call original function
  return originalHandleCampaignWin.call(this);
};

// ====================================================================
// HOOK: REFLEX MODE END
// ====================================================================

const originalHandleReflexModeEnd = window.handleReflexModeEnd;
window.handleReflexModeEnd = function() {
  try {
    // Capture game state BEFORE calling original function
    const turns = gameState.turns;
    
    // Calculate duration
    const duration = Date.now() - levelStartTime;
    
    // Calculate stars
    let stars = 0;
    if (typeof window.calculateReflexStars === 'function') {
      stars = window.calculateReflexStars(turns);
    }
    
    // End level tracking (no XP in reflex mode)
    analytics.endLevel(currentLevelId, true, duration, 0);
    
    // Add custom metrics
    analytics.addRawMetric('moves', turns.toString());
    analytics.addRawMetric('stars', stars.toString());
    analytics.addRawMetric('mode', 'reflex');
    
    // Reflex is standalone — submit immediately
    analytics.submitReport();
    console.log(`[Analytics] Completed Reflex Mode: Success: true, Time: ${duration}ms, Moves: ${turns}, Stars: ${stars}`);
  } catch (error) {
    console.error('[Analytics] Error in handleReflexModeEnd hook:', error);
  }
  
  // Always call original function
  return originalHandleReflexModeEnd.call(this);
};

// ====================================================================
// HOOK: TIMER TIMEOUT (LEVEL FAILURE)
// ====================================================================

const originalStartTimer = window.startTimer;
window.startTimer = function(duration) {
  // Call original function first
  const result = originalStartTimer.call(this, duration);
  
  try {
    // We need to also hook into the timeout alert to track failures
    // This is done by wrapping the clearInterval logic
    const originalAlert = window.alert;
    window.alert = function(message) {
      try {
        if (message.includes("Time's Up")) {
          // Track level failure
          const timeTaken = Date.now() - levelStartTime;
          analytics.endLevel(currentLevelId, false, timeTaken, 0);
          
          // Add failure metrics
          analytics.addRawMetric('reason', 'timeout');
          analytics.addRawMetric('turns', gameState.turns.toString());
          const earnedSoFar = analytics._reportData.xpEarnedTotal || 0;
          analytics.addRawMetric('total_xp_at_failure', earnedSoFar.toString());
          
          // Submit once on failure with campaign XP earned so far
          analytics.submitReport();
          console.log(`[Analytics] Level Failed: ${currentLevelId}, Reason: Timeout, XP so far: ${earnedSoFar}`);
        }
      } catch (error) {
        console.error('[Analytics] Error in alert hook:', error);
      }
      
      // Call original alert
      return originalAlert.call(this, message);
    };
  } catch (error) {
    console.error('[Analytics] Error in startTimer hook:', error);
  }
  
  return result;
};

// ====================================================================
// HOOK: FINAL SCORE SCREEN — single submit with full campaign XP
// ====================================================================

const originalShowFinalScoreScreen = window.showFinalScoreScreen;
window.showFinalScoreScreen = function() {
  try {
    const totalXP = analytics._reportData.xpEarnedTotal || 0;

    let finalStars = 1;
    if (totalXP >= 150) finalStars = 3;
    else if (totalXP >= 70) finalStars = 2;

    analytics.addRawMetric('campaign_complete', 'true');
    analytics.addRawMetric('total_campaign_xp', totalXP.toString());
    analytics.addRawMetric('final_stars', finalStars.toString());

    // Single report for the entire 3-level campaign
    analytics.submitReport();
    console.log(`[Analytics] Campaign complete — final report submitted. Total XP: ${totalXP}, Stars: ${finalStars}`);
  } catch (error) {
    console.error('[Analytics] Error in showFinalScoreScreen hook:', error);
  }

  return originalShowFinalScoreScreen.call(this);
};

// ====================================================================
// COMPLETION
// ====================================================================

// Expose analytics instance globally for progress system
window.gameAnalytics = analytics;

console.log('[Analytics] Integration loaded successfully');
console.log('[Analytics] Tracking enabled for:');
console.log('  - Campaign levels (start, win, fail)');
console.log('  - Reflex mode (start, complete)');
console.log('  - Card matches (correct and incorrect)');
console.log('  - Performance metrics (time, turns, XP, stars)');
