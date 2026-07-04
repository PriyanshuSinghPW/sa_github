/**
 * AnalyticsManager - Comprehensive Analytics Tracking System
 * Tracks game sessions, levels, tasks, and custom metrics
 * Supports multiple delivery channels: ReactNativeWebView, PostMessage, Custom Bridge, LocalStorage
 */

class AnalyticsManager {
    constructor() {
        this.session = null;
        this.levels = [];
        this.currentLevel = null;
        this.rawData = {};
        this.queue = [];
    }

    /**
     * Initialize analytics session
     * @param {string} gameName - Name of the game
     * @param {string} sessionId - Unique session identifier
     */
    initialize(gameName, sessionId) {
        this.session = {
            game_name: gameName,
            session_id: sessionId,
            timestamp: Date.now()
        };

        // Display initialization banner
        console.log('%c╔══════════════════════════════════════╗', 'color: #03dac6; font-weight: bold;');
        console.log('%c║    🎮 ANALYTICS INITIALIZED 🎮      ║', 'color: #03dac6; font-weight: bold;');
        console.log(`%c║  Game: ${gameName.padEnd(24)} ║`, 'color: #03dac6; font-weight: bold;');
        console.log(`%c║  Session: ${sessionId.padEnd(21)} ║`, 'color: #03dac6; font-weight: bold;');
        console.log('%c╚══════════════════════════════════════╝', 'color: #03dac6; font-weight: bold;');
    }

    /**
     * Start tracking a new level
     * @param {string} levelId - Unique level identifier
     */
    startLevel(levelId) {
        this.currentLevel = {
            level_id: levelId,
            start_time: Date.now(),
            end_time: null,
            duration_ms: null,
            completed: false,
            xp_earned: 0,
            tasks: []
        };
        this.levels.push(this.currentLevel);
        console.log(`[Analytics] 🎮 Level Started: ${levelId}`);
    }

    /**
     * Record a task/action within the current level
     * @param {string} levelId - Level identifier
     * @param {string} taskId - Unique task identifier
     * @param {string} taskName - Human-readable task name
     * @param {string} taskType - Type of task
     * @param {string} result - Result of the task
     * @param {number} timeTakenMs - Time taken in milliseconds
     * @param {number} pointsEarned - Points earned for this task
     */
    recordTask(levelId, taskId, taskName, taskType, result, timeTakenMs, pointsEarned) {
        if (!this.currentLevel || this.currentLevel.level_id !== levelId) {
            console.warn(`[Analytics] ⚠️ Warning: No active level ${levelId} to record task`);
            return;
        }

        const task = {
            task_id: taskId,
            task_name: taskName,
            task_type: taskType,
            result: result,
            time_taken_ms: timeTakenMs,
            points_earned: pointsEarned
        };

        this.currentLevel.tasks.push(task);
        
        console.log(`[Analytics] 📝 Task Recorded: ${taskId}`);
        console.log(`  ├─ Level: ${levelId}`);
        console.log(`  ├─ Type: ${taskType}`);
        console.log(`  ├─ Result: ${result}`);
        console.log(`  ├─ Duration: ${timeTakenMs}ms`);
        console.log(`  └─ Points: ${pointsEarned}`);
    }

    /**
     * Add a raw metric to the analytics data
     * @param {string} key - Metric key
     * @param {any} value - Metric value
     */
    addRawMetric(key, value) {
        this.rawData[key] = value;
    }

    /**
     * End the current level
     * @param {string} levelId - Level identifier
     * @param {boolean} completed - Whether the level was completed
     * @param {number} durationMs - Total duration in milliseconds
     * @param {number} xpEarned - Total XP earned
     */
    endLevel(levelId, completed, durationMs, xpEarned) {
        if (!this.currentLevel || this.currentLevel.level_id !== levelId) {
            console.warn(`[Analytics] ⚠️ Warning: No active level ${levelId} to end`);
            return;
        }

        this.currentLevel.end_time = Date.now();
        this.currentLevel.duration_ms = durationMs;
        this.currentLevel.completed = completed;
        this.currentLevel.xp_earned = xpEarned;

        console.log(`[Analytics] ✅ Level Ended: ${levelId}`);
        console.log(`  ├─ Completed: ${completed}`);
        console.log(`  ├─ Duration: ${durationMs}ms`);
        console.log(`  └─ XP Earned: ${xpEarned}`);

        this.currentLevel = null;
    }

    /**
     * Get the complete analytics report data
     * @returns {object} Complete analytics payload
     */
    getReportData() {
        return {
            session: this.session,
            levels: this.levels,
            rawData: this.rawData
        };
    }

    /**
     * Submit the analytics report through available channels
     */
    submitReport() {
        const payload = this.getReportData();
        
        console.log('%c[Analytics] 📊 SUBMITTING REPORT 📊', 'color: #03dac6; font-weight: bold; font-size: 14px;');
        console.log('════════════════════════════════════════');
        console.log('📋 Session Info:');
        console.log(`  Game: ${payload.session.game_name}`);
        console.log(`  Session: ${payload.session.session_id}`);
        console.log('');
        console.log('🎯 Metrics:');
        for (const [key, value] of Object.entries(payload.rawData)) {
            console.log(`  ${key}: ${value}`);
        }
        console.log('');
        console.log('📦 Full Payload:');
        console.log(JSON.stringify(payload, null, 2));
        console.log('════════════════════════════════════════');

        // Add canonical bestXp field with cross-session persistence
        const _xpCurO = (payload.levels || []).reduce((s, l) => s + (l.xp_earned || 0), 0);
        const _gIdO = (payload.session && payload.session.game_name) || '';
        payload.gameId = _gIdO;
        payload.xpEarnedTotal = _xpCurO;
        payload.xpEarned = _xpCurO;
        payload.xpTotal = _xpCurO;
        const _bKeyO = 'bestXp_' + _gIdO;
        let _bPrevO = 0; try { _bPrevO = parseInt(localStorage.getItem(_bKeyO) || '0', 10) || 0; } catch (_e) {}
        payload.bestXp = Math.max(_xpCurO, _bPrevO);
        if (_xpCurO > _bPrevO) { try { localStorage.setItem(_bKeyO, String(_xpCurO)); } catch (_e) {} }
        const payloadString = JSON.stringify(payload);
        let sent = false;

        // Try ReactNativeWebView (mobile)
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            try {
                window.ReactNativeWebView.postMessage(payloadString);
                console.log('✅ Sent via: ReactNativeWebView');
                sent = true;
            } catch (e) {
                console.warn('❌ ReactNativeWebView failed:', e);
            }
        }

        // Try parent window postMessage (iframe)
        if (!sent && window.parent && window.parent !== window) {
            try {
                window.parent.postMessage(payload, '*');
                console.log('✅ Sent via: Parent Window (postMessage)');
                sent = true;
            } catch (e) {
                console.warn('❌ Parent postMessage failed:', e);
            }
        }

        // Try custom bridge
        if (!sent && window.AnalyticsBridge && typeof window.AnalyticsBridge.sendAnalytics === 'function') {
            try {
                window.AnalyticsBridge.sendAnalytics(payload);
                console.log('✅ Sent via: Custom AnalyticsBridge');
                sent = true;
            } catch (e) {
                console.warn('❌ Custom AnalyticsBridge failed:', e);
            }
        }

        // Fallback: LocalStorage queue
        if (!sent) {
            try {
                this.queue.push(payload);
                localStorage.setItem('analytics_queue', JSON.stringify(this.queue));
                console.log('✅ Sent via: LocalStorage Queue (fallback)');
                sent = true;
            } catch (e) {
                console.error('❌ All delivery methods failed:', e);
            }
        }

        return sent;
    }

    /**
     * Clear all analytics data
     */
    reset() {
        this.session = null;
        this.levels = [];
        this.currentLevel = null;
        this.rawData = {};
        console.log('[Analytics] 🔄 Data reset');
    }
}

// Make it available globally if needed
if (typeof window !== 'undefined') {
    window.AnalyticsManager = AnalyticsManager;
}
