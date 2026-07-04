// ============================================================================
// Analytics Integration for BrainMatch - Antonyms Game
// ============================================================================
// This file integrates the JS Analytics Bridge with BrainMatch game
// using a non-invasive monkey-patching approach.
// No modifications to the original game code (script.js) are required.
// ============================================================================

// --- INITIALIZATION ---
const analytics = AnalyticsManager.getInstance();

// --- STATE TRACKING VARIABLES ---
let levelStartTime = null;
let currentLevelId = null;
let currentGameMode = null;
let taskCounter = 0;
let currentRunId = '';
const submittedLevelsByRun = new Map();

// --- HELPER FUNCTIONS ---

/**
 * Generates a unique task ID for each card match attempt
 */
function generateTaskId() {
  return `task_${++taskCounter}`;
}

/**
 * Generates a stable run id for one continuous campaign run.
 */
function createRunId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `brainmatch_antonyms_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function postAnalyticsDebug(event, detail = {}) {
  try {
    window.parent.postMessage({
      __analyticsDebug: true,
      game: 'BrainMatch_Antonyms',
      event,
      detail,
      at: new Date().toISOString()
    }, '*');
  } catch (_error) {
    // Debug-only for local harness visibility.
  }
}

function ensureCampaignRun(level) {
  if (!currentRunId || level === 1) {
    currentRunId = createRunId();
    submittedLevelsByRun.set(currentRunId, new Set());
    analytics.initialize('BrainMatch_Antonyms', currentRunId);
    console.log('[Analytics] Started campaign run:', currentRunId);
    postAnalyticsDebug('campaign_run_started', { runId: currentRunId, level });
  }
}

function submitCompletedCampaignLevel(level, xp) {
  if (!currentRunId) {
    console.warn('[Analytics] Missing runId; level submit skipped.');
    postAnalyticsDebug('submit_skipped_missing_run_id', { level, xp });
    return;
  }

  const submittedLevels = submittedLevelsByRun.get(currentRunId) || new Set();
  if (submittedLevels.has(level)) {
    console.warn(`[Analytics] Duplicate submit skipped for run ${currentRunId}, level ${level}`);
    postAnalyticsDebug('submit_skipped_duplicate', { runId: currentRunId, level, xp });
    return;
  }

  const result = analytics.submitLevel(level, { runId: currentRunId });
  if (result && result.success === false) {
    console.error('[Analytics] Level submit rejected:', result.errors);
    postAnalyticsDebug('submit_rejected', { runId: currentRunId, level, xp, errors: result.errors });
    return;
  }

  try {
    window.parent.postMessage(result, '*');
  } catch (_error) {
    // The bridge already attempted delivery; this fallback is only for local harness visibility.
  }

  submittedLevels.add(level);
  submittedLevelsByRun.set(currentRunId, submittedLevels);
  console.log(`[Analytics] Level ${level} submitted for run ${currentRunId}, XP: ${xp}`);
  postAnalyticsDebug('submit_success', { runId: currentRunId, level, xp });
}

// --- HOOK: CAMPAIGN MODE START ---
const originalStartGame = window.startGame;
window.startGame = function(level) {
  try {
    ensureCampaignRun(level);

    // Initialize tracking variables
    currentGameMode = 'campaign';
    currentLevelId = level;
    levelStartTime = Date.now();
    taskCounter = 0;
    
    // Track level start
    analytics.startLevel(currentLevelId, { levelNumber: level });
    console.log(`[Analytics] Started Level: ${currentLevelId}`);
    postAnalyticsDebug('level_started', { runId: currentRunId, level: currentLevelId });
  } catch (error) {
    console.error('[Analytics] Error in startGame hook:', error);
  }
  
  // Always call original function
  return originalStartGame.call(this, level);
};
startGame = window.startGame;

// --- HOOK: REFLEX MODE START ---
const originalStartReflexMode = window.startReflexMode;
window.startReflexMode = function() {
  try {
    // Initialize tracking variables
    currentGameMode = 'reflex';
    currentLevelId = 0;
    levelStartTime = Date.now();
    taskCounter = 0;
    currentRunId = '';
    
    analytics.initialize('BrainMatch_Antonyms', createRunId());
    analytics.startLevel(currentLevelId, { levelNumber: 0 });
    console.log(`[Analytics] Started Reflex Mode`);
  } catch (error) {
    console.error('[Analytics] Error in startReflexMode hook:', error);
  }
  
  // Always call original function
  return originalStartReflexMode.call(this);
};
startReflexMode = window.startReflexMode;

// --- HOOK: CORRECT MATCH ---
const originalHandleCorrectMatch = window.handleCorrectMatch;
window.handleCorrectMatch = function() {
  try {
    // Capture game state before calling original function
    const flippedCards = gameState.flippedCards || [];
    
    if (flippedCards.length === 2) {
      const card1Text = flippedCards[0]?.textContent || 'Unknown';
      const card2Text = flippedCards[1]?.textContent || 'Unknown';
      
      // Record the successful match
      analytics.recordTask(
        currentLevelId,
        generateTaskId(),
        `Match: ${card1Text} ↔ ${card2Text}`,
        card2Text,
        card2Text,
        0,
        0
      );
      
      console.log(`[Analytics] Task Recorded - Correct Match: ${card1Text} ↔ ${card2Text}`);
    }
  } catch (error) {
    console.error('[Analytics] Error in handleCorrectMatch hook:', error);
  }
  
  // Always call original function
  return originalHandleCorrectMatch.call(this);
};
handleCorrectMatch = window.handleCorrectMatch;

// --- HOOK: INCORRECT MATCH ---
const originalHandleIncorrectMatch = window.handleIncorrectMatch;
window.handleIncorrectMatch = function() {
  try {
    // Capture game state before calling original function
    const flippedCards = gameState.flippedCards || [];
    
    if (flippedCards.length === 2) {
      const card1Text = flippedCards[0]?.textContent || 'Unknown';
      const card2Text = flippedCards[1]?.textContent || 'Unknown';
      
      // Record the failed match
      analytics.recordTask(
        currentLevelId,
        generateTaskId(),
        `Match: ${card1Text} ↔ ${card2Text}`,
        card1Text, // Expected (first card)
        card2Text, // User selected (second card, incorrect)
        0,
        0
      );
      
      console.log(`[Analytics] Task Recorded - Incorrect Match: ${card1Text} ≠ ${card2Text}`);
    }
  } catch (error) {
    console.error('[Analytics] Error in handleIncorrectMatch hook:', error);
  }
  
  // Always call original function
  return originalHandleIncorrectMatch.call(this);
};
handleIncorrectMatch = window.handleIncorrectMatch;

// --- HOOK: CAMPAIGN LEVEL WIN ---
const originalHandleCampaignWin = window.handleCampaignWin;
window.handleCampaignWin = function() {
  try {
    // Capture game state before calling original function
    const level = gameState.currentCampaignLevel;
    const turns = gameState.turns || 0;
    const timeTaken = Date.now() - levelStartTime;
    
    // Calculate XP using game's function
    let xp = 0;
    if (typeof calculateXP === 'function') {
      xp = calculateXP(level, turns);
    }
    
    // Track level completion
    analytics.endLevel(currentLevelId, true, timeTaken, xp);
    
    // Add additional metrics
    analytics.addRawMetric('level', level.toString());
    analytics.addRawMetric('turns', turns.toString());
    analytics.addRawMetric('xp_earned', xp.toString());
    analytics.addRawMetric('game_mode', 'campaign');
    postAnalyticsDebug('campaign_win_hook', { runId: currentRunId, level, turns, xp, timeTaken });
    submitCompletedCampaignLevel(level, xp);
    levelStartTime = null;
    
    console.log(`[Analytics] Campaign Level ${level} Completed - Success: true, Time: ${timeTaken}ms, XP: ${xp}, Turns: ${turns}`);
  } catch (error) {
    console.error('[Analytics] Error in handleCampaignWin hook:', error);
  }
  
  // Always call original function
  return originalHandleCampaignWin.call(this);
};
handleCampaignWin = window.handleCampaignWin;

// --- HOOK: REFLEX MODE END ---
const originalHandleReflexModeEnd = window.handleReflexModeEnd;
window.handleReflexModeEnd = function() {
  try {
    // Capture game state before calling original function
    const turns = gameState.turns || 0;
    const timeTaken = Date.now() - levelStartTime;
    const score = gameState.reflexScore || 0;
    
    // Add additional metrics
    analytics.addRawMetric('turns', turns.toString());
    analytics.addRawMetric('score', score.toString());
    analytics.addRawMetric('game_mode', 'reflex');
    
    console.log('[Analytics] Reflex mode is telemetry-only; no level XP payload submitted.');
    console.log(`[Analytics] Reflex Mode Completed - Success: true, Time: ${timeTaken}ms, Score: ${score}, Turns: ${turns}`);
  } catch (error) {
    console.error('[Analytics] Error in handleReflexModeEnd hook:', error);
  }
  
  // Always call original function
  return originalHandleReflexModeEnd.call(this);
};
handleReflexModeEnd = window.handleReflexModeEnd;

// --- HOOK: TIMER FAILURE (TIME'S UP) ---
const originalStartTimer = window.startTimer;
window.startTimer = function(duration) {
  try {
    // Call original function first
    const result = originalStartTimer.call(this, duration);
    
    // Intercept the timer's end condition
    // We need to track when time runs out (level failure)
    const originalTimerId = gameState.timerId;
    
    // Store reference to check for time-up condition
    const checkInterval = setInterval(() => {
      if (gameState.timeRemaining !== undefined && gameState.timeRemaining <= 0) {
        try {
          const timeTaken = Date.now() - levelStartTime;
          const turns = gameState.turns || 0;
          
          analytics.addRawMetric('failure_reason', 'timeout');
          analytics.addRawMetric('turns', turns.toString());
          
          console.log(`[Analytics] Level Failed - Timeout at ${timeTaken}ms, Turns: ${turns}`);
          console.log('[Analytics] Failed attempts are telemetry-only; no level XP payload submitted.');
        } catch (error) {
          console.error('[Analytics] Error tracking timeout:', error);
        }
        
        clearInterval(checkInterval);
      }
    }, 1000);
    
    return result;
  } catch (error) {
    console.error('[Analytics] Error in startTimer hook:', error);
    return originalStartTimer.call(this, duration);
  }
};
startTimer = window.startTimer;

// --- HOOK: RETURN TO MAIN MENU (SESSION END / ABANDON) ---
const originalShowStartScreen = window.showStartScreen;
window.showStartScreen = function() {
  try {
    if (currentLevelId && levelStartTime) {
      const timeTaken = Date.now() - levelStartTime;
      const turns = gameState.turns || 0;
      
      analytics.addRawMetric('failure_reason', 'abandoned');
      analytics.addRawMetric('turns', turns.toString());
      
      console.log(`[Analytics] Level Abandoned - ${currentLevelId} at ${timeTaken}ms`);
      console.log('[Analytics] Abandoned attempts are telemetry-only; no level XP payload submitted.');
    }
    
    // Reset tracking variables
    currentLevelId = null;
    levelStartTime = null;
    currentGameMode = null;
    currentRunId = '';
  } catch (error) {
    console.error('[Analytics] Error in showStartScreen hook:', error);
  }
  
  // Always call original function
  return originalShowStartScreen.call(this);
};
showStartScreen = window.showStartScreen;

// --- FINAL SCORE SCREEN — single submit with full campaign XP ---
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

    console.log(`[Analytics] Campaign complete — levels were submitted individually. Total XP: ${totalXP}, Stars: ${finalStars}`);
  } catch (error) {
    console.error('[Analytics] Error in showFinalScoreScreen hook:', error);
  }

  return originalShowFinalScoreScreen.call(this);
};
showFinalScoreScreen = window.showFinalScoreScreen;

// --- INITIALIZATION COMPLETE ---
console.log('[Analytics] All hooks successfully installed');
console.log('[Analytics] Tracking: Level Start, Level End, Matches (Correct/Incorrect), Timeouts, Abandonment');
