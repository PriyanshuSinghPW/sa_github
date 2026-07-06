# CrossMath Quest - Progress System

## Overview

The game now uses a robust progress management system that coordinates player progress across local storage and integrates with the analytics system.

## How It Works

### Components

1. **GameManager** - Main coordinator for progress tracking
2. **StorageManager** - Handles localStorage persistence
3. **ProgressBridge** - Designed for API integration (currently in local-only mode)
4. **Validator** - Ensures data integrity and type safety
5. **CONFIG** - Configuration settings

### Flow

```
Game Start
    ↓
Initialize GameManager
    ↓
Load Progress from localStorage
    ↓
Player plays and completes levels
    ↓
GameManager saves progress
    ↓
Analytics tracks events
```

## Features

✅ **Automatic Progress Saving** - Progress is saved after each level completion  
✅ **Data Validation** - All progress data is validated before saving  
✅ **Type Safety** - Ensures level numbers are always valid integers  
✅ **Analytics Integration** - Coordinates with the analytics system  
✅ **Offline Support** - Works completely offline with localStorage  
✅ **Fallback Support** - Gracefully handles missing components  

## Storage

Progress is stored in localStorage with the key: `crossMathGameProgress`

Format:
```json
{
  "highestLevelPlayed": 5,
  "lastUpdated": 1234567890,
  "version": 1
}
```

## Configuration

Edit `progress files/config.js` to customize:

- `storage.storageKey` - Change the localStorage key
- `levels.minLevel` / `levels.maxLevel` - Set level boundaries
- `features.strictValidation` - Enable/disable strict data validation
- `logging.enabled` - Enable/disable console logging

## API Integration (Future)

The system is designed to work with backend APIs. To enable API mode:

1. Set `api.progressUrl` in config.js to your API endpoint
2. Set `api.useProvidedPayload` to `false`
3. The system will automatically fetch progress from the API

## Debug Features

Use the debug panel (type "debug" anywhere) to:
- Jump to any level
- Reset progress
- Validate the grid

## Compatibility

The system includes fallbacks for:
- Missing GameManager → Uses old localStorage method
- Invalid data → Falls back to default level (1)
- Storage errors → Handled gracefully with console warnings

## Analytics Integration

Progress events automatically trigger analytics:
- Level completion → Records level data
- Progress reset → Logs reset event
- Level replays → Tracks replay metrics

The GameManager coordinates with the AnalyticsManager to ensure consistent data across both systems.
