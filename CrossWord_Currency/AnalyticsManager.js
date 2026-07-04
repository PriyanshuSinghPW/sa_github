/**
 * AnalyticsManager.js
 * Comprehensive analytics tracking for HTML5 games
 * Supports multiple delivery channels: ReactNativeWebView, Parent Window, Custom Bridge, LocalStorage
 */

class AnalyticsManager {
    constructor() {
        this.session = {
            game_name: '',
            session_id: '',
            timestamp: 0
        };
        this.levels = [];
        this.currentLevel = null;
        this.rawData = {};
        this.initialized = false;
    }

    /**
     * Initialize analytics session
     * @param {string} gameName - Name of the game
     * @param {string} sessionId - Unique session identifier
     */
    initialize(gameName, sessionId) {
        this.session.game_name = gameName;
        this.session.session_id = sessionId;
        this.session.timestamp = Date.now();
        this.initialized = true;

        console.log('\n╔══════════════════════════════════════╗');
        console.log('║    🎮 ANALYTICS INITIALIZED 🎮      ║');
        console.log(`║  Game: ${gameName.padEnd(26)} ║`);
        console.log(`║  Session: ${sessionId.padEnd(23)} ║`);
        console.log('╚══════════════════════════════════════╝\n');
    }

    /**
     * Start tracking a new level
     * @param {string} levelId - Unique level identifier
     */
    startLevel(levelId) {
        if (!this.initialized) {
            console.warn('[Analytics] Warning: Not initialized. Call initialize() first.');
            return;
        }

        this.currentLevel = {
            level_id: levelId,
            start_time: Date.now(),
            end_time: null,
            duration_ms: 0,
            completed: false,
            xp_earned: 0,
            tasks: []
        };

        console.log(`[Analytics] 🎮 Level Started: ${levelId}`);
    }

    /**
     * Record a task/action within the current level
     * @param {string} levelId - Level identifier
     * @param {string} taskId - Unique task identifier
     * @param {string} taskName - Human-readable task name
     * @param {string} taskType - Type of task (e.g., 'check', 'hint', 'answer')
     * @param {string} result - Result of the task (e.g., 'success', 'fail', 'incomplete')
     * @param {number} timeTakenMs - Time taken in milliseconds
     * @param {number} pointsEarned - Points earned from this task
     */
    recordTask(levelId, taskId, taskName, taskType, result, timeTakenMs, pointsEarned) {
        if (!this.currentLevel || this.currentLevel.level_id !== levelId) {
            console.warn(`[Analytics] Warning: No active level ${levelId}. Call startLevel() first.`);
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
     * Add custom metrics to raw data
     * @param {string} key - Metric name
     * @param {any} value - Metric value
     */
    addRawMetric(key, value) {
        this.rawData[key] = value;
    }

    /**
     * Mark current level as ended
     * @param {string} levelId - Level identifier
     * @param {boolean} completed - Whether level was completed successfully
     * @param {number} durationMs - Total duration in milliseconds
     * @param {number} xpEarned - Total XP earned
     */
    endLevel(levelId, completed, durationMs, xpEarned) {
        if (!this.currentLevel || this.currentLevel.level_id !== levelId) {
            console.warn(`[Analytics] Warning: No active level ${levelId}.`);
            return;
        }

        this.currentLevel.end_time = Date.now();
        this.currentLevel.duration_ms = durationMs;
        this.currentLevel.completed = completed;
        this.currentLevel.xp_earned = xpEarned;

        this.levels.push(this.currentLevel);

        console.log(`[Analytics] ✅ Level Ended: ${levelId}`);
        console.log(`  ├─ Completed: ${completed}`);
        console.log(`  ├─ Duration: ${durationMs}ms`);
        console.log(`  └─ XP Earned: ${xpEarned}`);

        this.currentLevel = null;
    }

    /**
     * Get the complete analytics report
     * @returns {Object} Complete analytics payload
     */
    getReportData() {
        return {
            session: this.session,
            levels: this.levels,
            rawData: this.rawData
        };
    }

    /**
     * Submit analytics report through available channels
     */
    submitReport() {
        const payload = this.getReportData();
        // Add canonical bestXp field with cross-session persistence
        const _xpCur = (payload.levels || []).reduce((s, l) => s + (l.xp_earned || 0), 0);
        const _gId = (payload.session && payload.session.game_name) || '';
        payload.gameId = _gId;
        payload.xpEarnedTotal = _xpCur;
        payload.xpEarned = _xpCur;
        payload.xpTotal = _xpCur;
        const _bKey = 'bestXp_' + _gId;
        let _bPrev = 0; try { _bPrev = parseInt(localStorage.getItem(_bKey) || '0', 10) || 0; } catch (_e) {}
        payload.bestXp = Math.max(_xpCur, _bPrev);
        if (_xpCur > _bPrev) { try { localStorage.setItem(_bKey, String(_xpCur)); } catch (_e) {} }
        const payloadString = JSON.stringify(payload);

        console.log('\n[Analytics] 📊 SUBMITTING REPORT 📊');
        console.log('════════════════════════════════════════');
        console.log('📋 Session Info:');
        console.log(`  Game: ${this.session.game_name}`);
        console.log(`  Session: ${this.session.session_id}`);
        console.log('  ');
        console.log('🎯 Metrics:');
        for (const [key, value] of Object.entries(this.rawData)) {
            console.log(`  ${key}: ${value}`);
        }
        console.log('  ');
        console.log('📦 Full Payload:');
        console.log(payload);
        console.log('════════════════════════════════════════\n');

        // Try multiple delivery channels
        let delivered = false;

        // 1. React Native WebView
        if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            try {
                window.ReactNativeWebView.postMessage(payloadString);
                console.log('✅ Sent via: ReactNativeWebView');
                delivered = true;
            } catch (e) {
                console.warn('⚠️ ReactNativeWebView failed:', e.message);
            }
        }

        // 2. Parent Window (iframe)
        if (!delivered && typeof window !== 'undefined' && window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({ type: 'GAME_ANALYTICS', data: payload }, '*');
                console.log('✅ Sent via: Parent Window');
                delivered = true;
            } catch (e) {
                console.warn('⚠️ Parent Window failed:', e.message);
            }
        }

        // 3. Custom Analytics Bridge
        if (!delivered && typeof window !== 'undefined' && window.AnalyticsBridge && typeof window.AnalyticsBridge.sendAnalytics === 'function') {
            try {
                window.AnalyticsBridge.sendAnalytics(payloadString);
                console.log('✅ Sent via: Custom AnalyticsBridge');
                delivered = true;
            } catch (e) {
                console.warn('⚠️ AnalyticsBridge failed:', e.message);
            }
        }

        // 4. LocalStorage fallback
        if (!delivered) {
            try {
                const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]');
                queue.push({
                    timestamp: Date.now(),
                    payload: payload
                });
                localStorage.setItem('analytics_queue', JSON.stringify(queue));
                console.log('✅ Queued in: LocalStorage (fallback)');
            } catch (e) {
                console.error('❌ All delivery methods failed:', e.message);
            }
        }
    }

    /**
     * Clear all analytics data (useful for testing)
     */
    reset() {
        this.levels = [];
        this.currentLevel = null;
        this.rawData = {};
        console.log('[Analytics] 🔄 Reset complete');
    }
}

// Export for module systems, or attach to window for direct use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsManager;
} else if (typeof window !== 'undefined') {
    window.AnalyticsManager = AnalyticsManager;
}
