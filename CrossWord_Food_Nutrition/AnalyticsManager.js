/**
 * AnalyticsManager.js
 * Comprehensive analytics tracking system for HTML5 games
 * Supports multiple delivery channels: React Native WebView, Parent Window, Custom Bridge, LocalStorage
 */

class AnalyticsManager {
    constructor() {
        this.session = {
            game_name: '',
            session_id: '',
            timestamp: 0
        };
        this.levels = [];
        this.rawData = {};
        this.isInitialized = false;
        this.currentLevel = null;
    }

    /**
     * Initialize the analytics session
     * @param {string} gameName - Name of the game
     * @param {string} sessionId - Unique session identifier
     */
    initialize(gameName, sessionId) {
        this.session = {
            game_name: gameName,
            session_id: sessionId,
            timestamp: Date.now()
        };
        this.isInitialized = true;
        
        // Display initialization banner
        console.log('%c╔══════════════════════════════════════╗', 'color: #03dac6; font-weight: bold;');
        console.log('%c║    🎮 ANALYTICS INITIALIZED 🎮      ║', 'color: #03dac6; font-weight: bold;');
        console.log(`%c║  Game: ${gameName.padEnd(26)} ║`, 'color: #03dac6;');
        console.log(`%c║  Session: ${sessionId.padEnd(22)} ║`, 'color: #03dac6;');
        console.log('%c╚══════════════════════════════════════╝', 'color: #03dac6; font-weight: bold;');
    }

    /**
     * Start tracking a new level
     * @param {string} levelId - Unique identifier for the level
     */
    startLevel(levelId) {
        if (!this.isInitialized) {
            console.warn('[Analytics] Warning: Analytics not initialized. Call initialize() first.');
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
        
        this.levels.push(this.currentLevel);
        console.log(`[Analytics] 🎮 Level Started: ${levelId}`);
    }

    /**
     * Record a task or action within a level
     * @param {string} levelId - Level identifier
     * @param {string} taskId - Unique task identifier
     * @param {string} taskName - Human-readable task name
     * @param {string} taskType - Type of task (e.g., 'check_attempt', 'power_up')
     * @param {string} result - Result of the task (e.g., 'success', 'incomplete')
     * @param {number} timeTakenMs - Time taken in milliseconds
     * @param {number} pointsEarned - Points earned from this task
     */
    recordTask(levelId, taskId, taskName, taskType, result, timeTakenMs, pointsEarned) {
        const level = this.levels.find(l => l.level_id === levelId);
        if (!level) {
            console.warn(`[Analytics] Warning: Level "${levelId}" not found. Start level first.`);
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

        level.tasks.push(task);
        
        console.log(`[Analytics] 📝 Task Recorded: ${taskId}`);
        console.log(`  ├─ Level: ${levelId}`);
        console.log(`  ├─ Type: ${taskType}`);
        console.log(`  ├─ Result: ${result}`);
        console.log(`  ├─ Duration: ${timeTakenMs}ms`);
        console.log(`  └─ Points: ${pointsEarned}`);
    }

    /**
     * Add a custom metric to the raw data
     * @param {string} key - Metric name
     * @param {any} value - Metric value
     */
    addRawMetric(key, value) {
        this.rawData[key] = value;
    }

    /**
     * End the current level
     * @param {string} levelId - Level identifier
     * @param {boolean} completed - Whether the level was completed successfully
     * @param {number} durationMs - Total duration in milliseconds
     * @param {number} xpEarned - Total XP earned
     */
    endLevel(levelId, completed, durationMs, xpEarned) {
        const level = this.levels.find(l => l.level_id === levelId);
        if (!level) {
            console.warn(`[Analytics] Warning: Level "${levelId}" not found.`);
            return;
        }

        level.end_time = Date.now();
        level.duration_ms = durationMs;
        level.completed = completed;
        level.xp_earned = xpEarned;

        console.log(`[Analytics] ✅ Level Ended: ${levelId}`);
        console.log(`  ├─ Completed: ${completed}`);
        console.log(`  ├─ Duration: ${durationMs}ms`);
        console.log(`  └─ XP Earned: ${xpEarned}`);
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
     * Submit the analytics report through available channels
     */
    submitReport() {
        if (!this.isInitialized) {
            console.warn('[Analytics] Warning: Cannot submit - analytics not initialized.');
            return;
        }

        const payload = this.getReportData();
        
        // Log submission banner
        console.log('%c[Analytics] 📊 SUBMITTING REPORT 📊', 'color: #03dac6; font-weight: bold; font-size: 14px;');
        console.log('%c════════════════════════════════════════', 'color: #03dac6;');
        console.log('%c📋 Session Info:', 'color: #03dac6; font-weight: bold;');
        console.log(`  Game: ${this.session.game_name}`);
        console.log(`  Session: ${this.session.session_id}`);
        console.log('');
        console.log('%c🎯 Metrics:', 'color: #03dac6; font-weight: bold;');
        for (const [key, value] of Object.entries(this.rawData)) {
            console.log(`  ${key}: ${value}`);
        }
        console.log('');
        console.log('%c📦 Full Payload:', 'color: #03dac6; font-weight: bold;');
        console.log(JSON.stringify(payload, null, 2));
        console.log('%c════════════════════════════════════════', 'color: #03dac6;');

        const payloadString = JSON.stringify(payload);
        // Add canonical bestXp field with cross-session persistence
        const _xpCur2 = (payload.levels || []).reduce((s, l) => s + (l.xp_earned || 0), 0);
        const _gId2 = (payload.session && payload.session.game_name) || '';
        payload.gameId = _gId2;
        payload.xpEarnedTotal = _xpCur2;
        payload.xpEarned = _xpCur2;
        payload.xpTotal = _xpCur2;
        const _bKey2 = 'bestXp_' + _gId2;
        let _bPrev2 = 0; try { _bPrev2 = parseInt(localStorage.getItem(_bKey2) || '0', 10) || 0; } catch (_e) {}
        payload.bestXp = Math.max(_xpCur2, _bPrev2);
        if (_xpCur2 > _bPrev2) { try { localStorage.setItem(_bKey2, String(_xpCur2)); } catch (_e) {} }
        let deliveryChannel = 'None';

        // Try multiple delivery channels in order
        try {
            // 1. React Native WebView
            if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                window.ReactNativeWebView.postMessage(payloadString);
                deliveryChannel = 'ReactNativeWebView';
            }
            // 2. Parent Window
            else if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, '*');
                deliveryChannel = 'Parent Window';
            }
            // 3. Custom Analytics Bridge
            else if (window.AnalyticsBridge && typeof window.AnalyticsBridge.sendAnalytics === 'function') {
                window.AnalyticsBridge.sendAnalytics(payload);
                deliveryChannel = 'Custom Bridge';
            }
            // 4. LocalStorage Fallback
            else {
                const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]');
                queue.push(payload);
                localStorage.setItem('analytics_queue', JSON.stringify(queue));
                deliveryChannel = 'LocalStorage Queue';
            }

            console.log(`%c✅ Sent via: ${deliveryChannel}`, 'color: #4caf50; font-weight: bold;');
        } catch (error) {
            console.error('[Analytics] ❌ Error submitting report:', error);
        }
    }

    /**
     * Reset all analytics data (useful for new sessions)
     */
    reset() {
        this.levels = [];
        this.rawData = {};
        this.currentLevel = null;
        console.log('[Analytics] 🔄 Analytics data reset');
    }
}

// Make AnalyticsManager globally available
if (typeof window !== 'undefined') {
    window.AnalyticsManager = AnalyticsManager;
}
