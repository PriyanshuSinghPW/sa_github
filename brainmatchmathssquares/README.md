# BrainMatch - Memory Card Game

A memory card matching game with campaign and reflex modes, featuring comprehensive analytics tracking.

## 🎮 Game Modes

### Campaign Mode
Progress through 3 levels of increasing difficulty:
- **Level 1**: 6 pairs (12 cards) - 60 seconds
- **Level 2**: 7 pairs (14 cards) - 70 seconds  
- **Level 3**: 8 pairs (16 cards) - 80 seconds

### Reflex Mode
Fast-paced matching with a 2-second timer per card reveal.

## 🚀 Quick Start

### Play the Game
1. Open `index.html` in a web browser
2. Click "Start Campaign" or "Start Reflex Mode"
3. Match all pairs to complete the level

### Development
No build process required! Just open `index.html` in your browser.

## 📊 Analytics Integration

BrainMatch includes **non-invasive analytics** that tracks player performance without modifying the core game code.

### Files
- `js-analytics-bridge/analytics-bridge.js` - Analytics library
- `analytics-integration.js` - Game-specific integration hooks
- `ANALYTICS_IMPLEMENTATION.md` - Detailed implementation guide
- `PAYLOAD_FORMAT.md` - Complete payload documentation

### What's Tracked
- ✅ Session details (ID, timestamp, game ID)
- ✅ Level attempts (successes, failures, time taken)
- ✅ XP earned and progression
- ✅ Individual card matches (correct/incorrect)
- ✅ Detailed diagnostics (all level attempts with tasks)
- ✅ Highest level reached

### Integration
```html
<!-- Add to index.html -->
<script src="js-analytics-bridge/analytics-bridge.js"></script>
<script src="script.js"></script>
<script src="analytics-integration.js"></script>
```

Analytics automatically submits data to:
- React Native WebView (`window.ReactNativeWebView.postMessage`)
- Parent frames (`window.parent.postMessage`)
- Custom bridges (`window.myJsAnalytics.trackGameSession`)

### Accessing Analytics Data

```javascript
// Get current session data
const report = analytics.getReportData();

// View in console
console.log('Session:', report.sessionId);
console.log('Total XP:', report.xpEarnedTotal);
console.log('Highest Level:', report.highestLevelPlayed);
console.log('Level Attempts:', report.diagnostics.levels);
```

See [PAYLOAD_FORMAT.md](PAYLOAD_FORMAT.md) for complete payload structure.

## 📁 Project Structure

```
BrainMatch/
├── index.html                      # Main game page
├── script.js                       # Core game logic
├── style.css                       # Game styles
├── gameContent.json                # Level content (animals)
├── analytics-integration.js        # Analytics hooks
├── js-analytics-bridge/
│   ├── analytics-bridge.js         # Analytics library
│   ├── analytics-bridge.min.js     # Minified version
│   └── analytics-bridge.esm.js     # ES Module version
├── images/                         # Game assets
├── ANALYTICS_IMPLEMENTATION.md     # Implementation guide
├── PAYLOAD_FORMAT.md               # Payload documentation
└── README.md                       # This file
```

## 🎯 XP Scoring

### Campaign Mode
XP is awarded based on turns taken:

**Level 1**
- ≤12 turns: 40 XP
- ≤16 turns: 35 XP
- 17+ turns: 30 XP

**Level 2**
- ≤14 turns: 60 XP
- ≤18 turns: 50 XP
- 19+ turns: 40 XP

**Level 3**
- ≤16 turns: 100 XP
- ≤20 turns: 80 XP
- 21+ turns: 60 XP

### Reflex Mode
No XP awarded (focuses on speed and accuracy).

## 🛠️ Customization

### Adding New Levels
Edit `gameContent.json`:

```json
{
  "level": 4,
  "pairs": 9,
  "time": 90,
  "animals": ["lion", "tiger", "bear", ...]
}
```

### Changing Analytics
See [ANALYTICS_IMPLEMENTATION.md](ANALYTICS_IMPLEMENTATION.md) for:
- Adding custom metrics
- Tracking new events
- Modifying payload structure
- Adapting for other games

## 🎨 Features

- ✨ Smooth card flip animations
- 🔊 Sound effects for matches and errors
- 🎵 Background music
- ⏸️ Pause/resume functionality
- 📖 In-game tutorial
- 📊 Live turn counter and timer
- ⭐ Star rating system
- 🏆 Final score screen

## 🔧 Developer Mode

Set `DEV_MODE = true` in `script.js` to enable:
- Press **'C'** to instantly complete a level
- Useful for testing analytics without playing

## 📄 License

Open source - feel free to use and modify!

## 🤝 Contributing

Want to add features or improve analytics?
1. See `ANALYTICS_IMPLEMENTATION.md` for architecture
2. All analytics code uses **monkey-patching** (no game code changes)
3. Test with browser console open to verify events

## 📞 Support

For analytics integration questions, see:
- [ANALYTICS_IMPLEMENTATION.md](ANALYTICS_IMPLEMENTATION.md) - How it works
- [PAYLOAD_FORMAT.md](PAYLOAD_FORMAT.md) - Data structure reference

---

**Enjoy the game! 🎮**
