/**
 * AnalyticsManager - Tracks game analytics and submits to React Native WebView
 */
class AnalyticsManager {
  constructor() {
    if (AnalyticsManager.instance) {
      return AnalyticsManager.instance;
    }

    this._isInitialized = false;
    this._gameId = '';
    this._sessionId = '';
    
    this._reportData = {
      gameId: '',
      sessionId: '',
      timestamp: '',
      name: '',
      xpEarnedTotal: 0,
      xpEarned: 0,
      xpTotal: 0,
      bestXp: 0,
      highestLevelPlayed: 0,
      rawData: [],
      diagnostics: {
        levels: []
      }
    };

    AnalyticsManager.instance = this;
  }
  
  static getInstance() {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }
  
  /**
   * Initialize the analytics session
   * @param {string} gameId - Unique game identifier
   * @param {string} sessionName - Session/player identifier
   */
  _generateSessionId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `session_${ts}_${rand}`;
  }

  initialize(gameId, sessionName) {
    this._gameId = gameId;
    this._sessionId = this._generateSessionId();

    this._reportData.gameId = gameId;
    this._reportData.sessionId = this._sessionId;
    this._reportData.timestamp = new Date().toISOString();
    this._reportData.name = this._sessionId;
    this._reportData.diagnostics.levels = [];
    this._reportData.rawData = [];
    this._reportData.xpEarnedTotal = 0;
    this._reportData.xpEarned = 0;
    this._reportData.xpTotal = 0;
    this._reportData.bestXp = 0;
    this._reportData.highestLevelPlayed = 0;
    
    this._isInitialized = true;
    console.log(`[Analytics] Initialized for: ${gameId} | session: ${this._sessionId}`);
  }
  
  /**
   * Add a generic metric (FPS, Latency, etc)
   * @param {string} key - Metric name
   * @param {string|number} value - Metric value
   */
  addRawMetric(key, value) {
    if (!this._isInitialized) {
      console.warn('[Analytics] Not initialized');
      return;
    }
    
    this._reportData.rawData.push({ key, value: String(value) });
  }
  
  /**
   * Start tracking a new level
   * @param {string} levelId - Unique level identifier
   */
  startLevel(levelId) {
    if (!this._isInitialized) {
      console.warn('[Analytics] Not initialized');
      return;
    }
    
    const levelEntry = {
      levelId,
      successful: false,
      timeTaken: 0,
      timeDirection: false,
      xpEarned: 0,
      tasks: []
    };
    
    this._reportData.diagnostics.levels.push(levelEntry);
    console.log('[Analytics] Level started:', levelId);
  }
  
  /**
   * Complete a level and update totals
   * @param {string} levelId - Level identifier
   * @param {boolean} successful - Whether level was completed successfully
   * @param {number} timeTakenMs - Time taken in milliseconds
   * @param {number} xp - XP earned for this level
   */
  endLevel(levelId, successful, timeTakenMs, xp) {
    const level = this._getLevelById(levelId);
    
    if (level) {
      level.successful = successful;
      level.timeTaken = timeTakenMs;
      level.xpEarned = xp;
      
      // Update global session totals
      this._reportData.xpEarnedTotal += xp;
      this._reportData.xpEarned = this._reportData.xpEarnedTotal;
      this._reportData.xpTotal = this._reportData.xpEarnedTotal;
      if (this._reportData.xpEarnedTotal > this._reportData.bestXp) {
        this._reportData.bestXp = this._reportData.xpEarnedTotal;
      }
      this._reportData.highestLevelPlayed += 1;

      // Emit auto-save payload for this level
      this._sendAutoPayload(levelId, timeTakenMs);

      console.log('[Analytics] Level ended:', {
        levelId,
        successful,
        timeTaken: (timeTakenMs / 1000).toFixed(2) + 's',
        xpEarned: xp
      });
    } else {
      console.warn(`[Analytics] End Level called for unknown level: ${levelId}`);
    }
  }

  _sendAutoPayload(levelId, timeTakenMs) {
    const autoPayload = {
      highestLevelPlayed: this._reportData.highestLevelPlayed,
      xpEarnedTotal: this._reportData.xpEarnedTotal,
      name: 'Level Complete',
      diagnostics: {
        levels: [
          {
            levelId: levelId,
            timeTaken: timeTakenMs
          }
        ]
      }
    };

    console.log('[Analytics] Auto-Save Payload:', autoPayload);
    this._dispatchPayload(autoPayload);
  }
  
  /**
   * Record a specific user action/task within a level
   * @param {string} levelId - Level identifier
   * @param {string} taskId - Task identifier
   * @param {string} question - Question text
   * @param {string} correctChoice - Correct answer
   * @param {string} choiceMade - User's answer
   * @param {number} timeMs - Time taken in milliseconds
   * @param {number} xp - XP earned for this task
   */
  recordTask(levelId, taskId, question, correctChoice, choiceMade, timeMs, xp) {
    const level = this._getLevelById(levelId);
    
    if (level) {
      const isSuccessful = (correctChoice === choiceMade);
      const taskData = {
        taskId,
        question,
        options: '[]',
        correctChoice,
        choiceMade,
        successful: isSuccessful,
        timeTaken: timeMs,
        xpEarned: xp
      };
      
      level.tasks.push(taskData);
      
      console.log('[Analytics] Task recorded:', {
        taskId,
        question,
        successful: isSuccessful,
        xpEarned: xp
      });
    } else {
      console.warn(`[Analytics] Record Task called for unknown level: ${levelId}`);
    }
  }
  
  /**
   * Submit the final report to React Native WebView
   */
  submitReport() {
    if (!this._isInitialized) {
      console.error('[Analytics] Attempted to submit without initialization.');
      return;
    }

    // Build full session payload
    const payload = JSON.parse(JSON.stringify(this._reportData));
    payload.timestamp = new Date().toISOString();

    console.log('═══════════════════════════════════════════════════════');
    console.log('[Analytics] FULL SESSION PAYLOAD SUBMITTED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Full Payload:', payload);
    console.log('═══════════════════════════════════════════════════════');

    const _bXpCur = payload.xpEarnedTotal || 0;
    const _bXpKey = 'bestXp_' + (payload.gameId || '');
    let _bXpPrev = 0; try { _bXpPrev = parseInt(localStorage.getItem(_bXpKey) || '0', 10) || 0; } catch (_e) {}
    payload.bestXp = Math.max(_bXpCur, _bXpPrev);
    if (_bXpCur > _bXpPrev) { try { localStorage.setItem(_bXpKey, String(_bXpCur)); } catch (_e) {} }
    this._dispatchPayload(payload);
  }

  _dispatchPayload(payload) {
    if (typeof window === 'undefined') {
      return payload;
    }

    const LS_KEY = 'ignite_pending_sessions_jsplugin';

    function savePending(p) {
      try {
        const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        list.push(p);
        localStorage.setItem(LS_KEY, JSON.stringify(list));
      } catch (e) { /* ignore */ }
    }

    function trySend(p) {
      let sent = false;

      try {
        if (window.myJsAnalytics && typeof window.myJsAnalytics.trackGameSession === 'function') {
          window.myJsAnalytics.trackGameSession(p);
          sent = true;
        }
      } catch (e) { /* continue */ }

      try {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify(p));
          sent = true;
        }
      } catch (e) { /* continue */ }

      try {
        const target = window.__GodotAnalyticsParentOrigin || '*';
        window.parent.postMessage(p, target);
        sent = true;
      } catch (e) { /* continue */ }

      if (!sent) {
        try { console.log('[Analytics] Payload (fallback):', JSON.stringify(p)); } catch (e) { /* swallow */ }
      }

      return sent;
    }

    function flushPending() {
      try {
        const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        if (!list || !list.length) return;
        list.forEach(function (p) { trySend(p); });
        localStorage.removeItem(LS_KEY);
      } catch (e) { /* ignore */ }
    }

    const ok = trySend(payload);
    if (!ok) savePending(payload);

    try {
      window.addEventListener && window.addEventListener('online', flushPending);
      window.addEventListener && window.addEventListener('load', flushPending);
      window.addEventListener && window.addEventListener('message', function (ev) {
        try {
          const msg = (typeof ev.data === 'string') ? JSON.parse(ev.data) : ev.data;
          if (msg && msg.type === 'ANALYTICS_CONFIG' && msg.parentOrigin) {
            window.__GodotAnalyticsParentOrigin = msg.parentOrigin;
          }
        } catch (e) { /* ignore */ }
      });
      setTimeout(flushPending, 2000);
    } catch (e) { /* ignore */ }
  }
  
  /**
   * Get current report data (for debugging)
   * @returns {Object} Current analytics data
   */
  getReportData() {
    return JSON.parse(JSON.stringify(this._reportData)); // Deep clone
  }
  
  /**
   * Reset analytics data (useful for new sessions)
   */
  reset() {
    this._reportData.xpEarnedTotal = 0;
    this._reportData.rawData = [];
    this._reportData.diagnostics.levels = [];
    console.log('[Analytics] Data reset');
  }
  
  // --- Internal Helpers ---
  
  /**
   * Find level by ID (searches backwards for most recent)
   * @private
   * @param {string} levelId
   * @returns {Object|null}
   */
  _getLevelById(levelId) {
    const levels = this._reportData.diagnostics.levels;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].levelId === levelId) {
        return levels[i];
      }
    }
    return null;
  }
}

// Support both module and global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsManager;
}
if (typeof window !== 'undefined') {
  window.AnalyticsManager = AnalyticsManager;
}
