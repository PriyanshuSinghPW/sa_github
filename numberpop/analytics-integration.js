(() => {
  const GAME_ID = 'numberpop';

  const state = {
    analytics: null,
    runId: '',
    startedLevels: new Set(),
    submittedLevels: new Set(),
    levelStartTimes: new Map(),
    levelStartScores: new Map(),
    currentLevel: 0
  };

  function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return `numberpop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureAnalytics(resetRun = false) {
    if (!window.AnalyticsManager) {
      console.warn('[Analytics] NumberPop bridge is not loaded yet.');
      return null;
    }

    if (!state.analytics) {
      state.analytics = window.AnalyticsManager.getInstance();
    }

    if (!state.runId || resetRun) {
      state.runId = createRunId();
      state.startedLevels.clear();
      state.submittedLevels.clear();
      state.levelStartTimes.clear();
      state.levelStartScores.clear();
      state.analytics.initialize(GAME_ID, state.runId);
      postAnalyticsDebug('run_started', { runId: state.runId });
    }

    return state.analytics;
  }

  function postAnalyticsDebug(event, detail = {}) {
    try {
      window.parent.postMessage({
        __analyticsDebug: true,
        game: 'NumberPop',
        event,
        detail,
        at: new Date().toISOString()
      }, '*');
    } catch (_error) {
      // Debug-only for the local launcher harness.
    }
  }

  function objectiveLabel(objective) {
    if (!objective || !objective.type) {
      return 'Complete NumberPop objective';
    }

    if (objective.type === 'CREATE_VALUE') {
      return `Create ${objective.targetCount || 1} tile(s) with value ${objective.targetValue}`;
    }

    if (objective.type === 'CLEAR_FROZEN') {
      return `Clear ${objective.targetCount || 0} frozen tile(s)`;
    }

    return objective.type;
  }

  function startLevel(levelNumber, details = {}) {
    const numericLevel = Number(levelNumber);
    if (!Number.isFinite(numericLevel) || numericLevel <= 0) {
      return;
    }

    const analytics = ensureAnalytics(Boolean(details.resetRun));
    if (!analytics) {
      return;
    }

    state.currentLevel = numericLevel;
    state.levelStartTimes.set(numericLevel, Date.now());
    state.levelStartScores.set(numericLevel, Number(details.scoreStart || 0));

    if (!state.startedLevels.has(numericLevel)) {
      analytics.startLevel(numericLevel, { levelNumber: numericLevel });
      state.startedLevels.add(numericLevel);
    }

    analytics.addRawMetric(`level_${numericLevel}_objective`, objectiveLabel(details.objective));
    analytics.addRawMetric(`level_${numericLevel}_moves_available`, String(details.moves || 0));
    analytics.addRawMetric(`level_${numericLevel}_grid_size`, String(details.gridSize || 7));
    postAnalyticsDebug('level_started', {
      runId: state.runId,
      levelNumber: numericLevel,
      objective: details.objective,
      moves: details.moves,
      scoreStart: details.scoreStart || 0
    });
  }

  function completeLevel(levelNumber, details = {}) {
    const numericLevel = Number(levelNumber);
    if (!Number.isFinite(numericLevel) || numericLevel <= 0 || state.submittedLevels.has(numericLevel)) {
      return null;
    }

    const analytics = ensureAnalytics(false);
    if (!analytics) {
      return null;
    }

    if (!state.startedLevels.has(numericLevel)) {
      startLevel(numericLevel, {
        objective: details.objective,
        moves: details.movesRemaining,
        gridSize: details.gridSize,
        scoreStart: details.scoreBeforeMove || 0
      });
    }

    const startedAt = state.levelStartTimes.get(numericLevel) || Date.now();
    const startScore = Number(state.levelStartScores.get(numericLevel) || 0);
    const scoreAfter = Number(details.scoreAfter ?? details.scoreBeforeMove ?? startScore);
    const scoreGain = Number(details.scoreGain || 0);
    const xpEarned = Math.max(0, Math.round(scoreAfter - startScore || scoreGain));
    const timeTaken = Math.max(0, Date.now() - startedAt);

    analytics.addRawMetric(`level_${numericLevel}_moves_remaining`, String(details.movesRemaining || 0));
    analytics.addRawMetric(`level_${numericLevel}_objective_progress`, String(details.objectiveProgress || 0));
    analytics.addRawMetric(`level_${numericLevel}_score_before`, String(details.scoreBeforeMove || 0));
    analytics.addRawMetric(`level_${numericLevel}_score_after`, String(scoreAfter));
    analytics.addRawMetric(`level_${numericLevel}_created_values`, JSON.stringify(details.createdValues || []));
    analytics.addRawMetric(`level_${numericLevel}_destroyed_frozen_count`, String(details.destroyedFrozenCount || 0));

    analytics.recordTask(
      numericLevel,
      `numberpop_level_${numericLevel}_objective`,
      objectiveLabel(details.objective),
      'completed',
      'completed',
      timeTaken,
      xpEarned
    );
    analytics.endLevel(numericLevel, true, timeTaken, xpEarned);

    const payload = analytics.submitLevel(numericLevel, { runId: state.runId });
    if (payload && payload.success === false) {
      console.error('[Analytics] NumberPop level submit rejected:', payload.errors);
      postAnalyticsDebug('submit_rejected', { levelNumber: numericLevel, runId: state.runId, errors: payload.errors });
      return payload;
    }

    state.submittedLevels.add(numericLevel);
    console.log('[Analytics] NumberPop level submitted:', {
      levelNumber: numericLevel,
      runId: state.runId,
      xpEarned
    });
    postAnalyticsDebug('submit_success', { levelNumber: numericLevel, runId: state.runId, xpEarned });
    return payload;
  }

  window.__numberPopAnalytics = {
    startLevel,
    completeLevel,
    getRunId: () => state.runId,
    getCurrentLevel: () => state.currentLevel
  };
})();
