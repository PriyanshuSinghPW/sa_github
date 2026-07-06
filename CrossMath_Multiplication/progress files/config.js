/**
 * Configuration - Game and bridge settings
 */

const CONFIG = {
  // API Configuration
  api: {
    // Set to null for local-only mode (no backend)
    progressUrl: null,
    timeout: 5000,
    retryAttempts: 2,
    cacheDuration: 60000, // 1 minute
    // No backend API - use local storage only
    useProvidedPayload: false,
  },

  // Level Configuration
  levels: {
    minLevel: 1,
    maxLevel: 100,
    defaultLevel: 1,
  },

  // Storage Configuration
  storage: {
    storageKey: 'crossMathMultiplicationPlayerProgress',
    useAsyncStorage: false, // Web mode (localStorage)
  },

  // Sync Configuration
  sync: {
    // How often to sync progress (in milliseconds)
    syncInterval: 300000, // 5 minutes
    
    // Auto-save after level completion
    autoSave: true,
    
    // Send analytics after level completion
    sendAnalytics: true,
  },

  // Feature Flags
  features: {
    // Enable offline play
    offlineMode: true,
    
    // Use local storage as source of truth (no API)
    preferApiData: false,
    
    // Validate all data before using
    strictValidation: true,
  },

  // Logging
  logging: {
    enabled: true,
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  },
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
