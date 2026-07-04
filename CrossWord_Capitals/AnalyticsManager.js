/**
 * AnalyticsManager - Tracks game analytics and submits data
 */
class AnalyticsManager {
  constructor() {
    if (AnalyticsManager.instance) {
      return AnalyticsManager.instance;
    }

    this._isInitialized = false;
    this._gameId = '';
    this._sessionName = '';
    
    this._reportData = {
      gameId: '',
      name: '',
      xpEarnedTotal: 0,
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
  
  initialize(gameId, sessionName) {
    this._gameId = gameId;
    this._sessionName = sessionName;
    
    this._reportData.gameId = gameId;
    this._reportData.name = sessionName;
    this._reportData.diagnostics.levels = [];
    this._reportData.rawData = [];
    this._reportData.xpEarnedTotal = 0;
    
    this._isInitialized = true;
    console.log(`[Analytics] Initialized for: ${gameId}`);
  }
  
  addRawMetric(key, value) {
    if (!this._isInitialized) {
      console.warn('[Analytics] Not initialized');
      return;
    }
    
    this._reportData.rawData.push({ key, value: String(value) });
    console.log(`[Analytics] Metric added: ${key} = ${value}`);
  }
  
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
    console.log(`[Analytics] Level started: ${levelId}`);
  }
  
  endLevel(levelId, successful, timeTakenMs, xp) {
    const level = this._getLevelById(levelId);
    
    if (level) {
      level.successful = successful;
      level.timeTaken = timeTakenMs;
      level.xpEarned = xp;
      
      this._reportData.xpEarnedTotal += xp;
      
      console.log(`[Analytics] Level completed! { levelId: "${levelId}", success: ${successful}, time: ${(timeTakenMs/1000).toFixed(2)}s, xp: ${xp} }`);
    } else {
      console.warn(`[Analytics] End Level called for unknown level: ${levelId}`);
    }
  }
  
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
      console.log(`[Analytics] Task recorded: ${question} - ${isSuccessful ? '✓ Success' : '✗ Failed'} (XP: ${xp})`);
    } else {
      console.warn(`[Analytics] Record Task called for unknown level: ${levelId}`);
    }
  }
  
  submitReport() {
    if (!this._isInitialized) {
      console.error('[Analytics] Attempted to submit without initialization.');
      return;
    }

    const payload = JSON.parse(JSON.stringify(this._reportData));
    
    if (!payload.sessionId) payload.sessionId = (Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    if (!payload.timestamp) payload.timestamp = new Date().toISOString();
    
    payload.xpEarned = payload.xpEarnedTotal;
    payload.xpTotal = payload.xpEarnedTotal;
    const _bestXpCur = payload.xpEarnedTotal || 0;
    const _bestXpKey = 'bestXp_' + (payload.gameId || '');
    let _bestXpPrev = 0;
    try { _bestXpPrev = parseInt(localStorage.getItem(_bestXpKey) || '0', 10) || 0; } catch (_e) {}
    payload.bestXp = Math.max(_bestXpCur, _bestXpPrev);
    if (_bestXpCur > _bestXpPrev) { try { localStorage.setItem(_bestXpKey, String(_bestXpCur)); } catch (_e) {} }

    console.log('═══════════════════════════════════════════════════════');
    console.log('[Analytics] REPORT SUBMITTED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Game ID:', payload.gameId);
    console.log('Session:', payload.sessionId);
    console.log('Total XP:', payload.xpEarnedTotal);
    console.log('Levels Completed:', payload.diagnostics.levels.length);
    console.log('Raw Metrics:', payload.rawData);
    console.log('Full Payload:', payload);
    console.log('═══════════════════════════════════════════════════════');

    this._sendPayload(payload);
  }
  
  _sendPayload(payload) {
    let sent = false;

    try {
      if (window.myJsAnalytics && typeof window.myJsAnalytics.trackGameSession === 'function') {
        console.log('[Analytics] Sending via window.myJsAnalytics');
        window.myJsAnalytics.trackGameSession(payload);
        sent = true;
      }
    } catch (e) {}

    try {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        console.log('[Analytics] Sending via ReactNativeWebView');
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        sent = true;
      }
    } catch (e) {}

    try {
      const target = window.__GodotAnalyticsParentOrigin || '*';
      console.log('[Analytics] Sending via window.parent.postMessage');
      window.parent.postMessage(payload, target);
      sent = true;
    } catch (e) {}

    if (!sent) {
      console.warn('[Analytics] No bridge available - logging to console:');
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log('[Analytics] ✓ Payload sent successfully');
    }

    this._savePending(payload);
  }

  _savePending(payload) {
    try {
      const LS_KEY = 'ignite_pending_sessions_jsplugin';
      const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      list.push(payload);
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) {}
  }
  
  getReportData() {
    return JSON.parse(JSON.stringify(this._reportData));
  }
  
  reset() {
    this._reportData.xpEarnedTotal = 0;
    this._reportData.rawData = [];
    this._reportData.diagnostics.levels = [];
    console.log('[Analytics] Data reset');
  }
  
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

if (typeof window !== 'undefined') {
  window.AnalyticsManager = AnalyticsManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsManager;
}
