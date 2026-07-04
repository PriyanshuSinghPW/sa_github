# 🎮 Maze Escape - JavaScript Edition

A fully responsive, blocky puzzle maze game built with vanilla JavaScript, HTML5 Canvas, and CSS. Works seamlessly on both desktop and mobile devices!

## 🎨 Features

- **Beautiful Color Scheme:**
  - 🟩 Green walls (world environment)
  - 🔵 Whitish-blue walkable areas
  - 🔵 Blue player character
  - 🟨 Yellow collectibles
  - 🟪 Purple exit portal

- **Responsive Design:**
  - Automatically adapts to any screen size
  - Touch controls for mobile devices
  - Swipe gestures supported
  - D-pad buttons for touch screens
  - Keyboard controls (WASD/Arrow keys) for desktop

- **4 Challenging Levels:**
  - Progressive difficulty
  - Unique maze layouts
  - Strategic collectible placement

## 🚀 How to Play

### Objective
Navigate through the maze, collect all yellow stars/collectibles, then reach the purple exit to complete the level!

### Controls

**Desktop:**
- Use **WASD** or **Arrow Keys** to move
- Press **Reset** button to restart the level

**Mobile:**
- **Touch the D-pad buttons** to move in any direction
- **Swipe** on the game canvas to move
- Tap **Reset** to restart

### Game Rules
1. 🔵 **You** - The blue player
2. 🟨 **Collectibles** - Must collect ALL before exiting
3. 🟪 **Exit** - Only accessible after collecting all items
4. 🟩 **Walls** - Cannot pass through
5. 🔵 **Walkable Areas** - Safe to move through

## 📂 Installation

1. **Download/Clone** the `maze-escape-js` folder
2. **Open** `index.html` in any modern web browser
3. **Start Playing!**

No build process, no dependencies, no installation required!

## 🌐 Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & iOS)
- ✅ Opera
- ✅ Samsung Internet

## 📱 Mobile Optimization

The game is fully optimized for mobile devices:
- Responsive canvas scaling
- Touch-friendly controls
- Viewport optimization
- No zoom on touch
- Smooth 60 FPS rendering

## 🎯 Level Selection

Use the dropdown menu to select different levels (1-4). Each level increases in complexity with:
- Larger mazes
- More collectibles
- Complex pathways
- Strategic challenge

## 🏆 Scoring

- Track your **moves** for each level
- Try to complete levels in minimum moves
- Compare your performance across attempts

## 🛠️ Technical Details

- **Pure JavaScript** - No frameworks or libraries
- **HTML5 Canvas** - Hardware-accelerated rendering
- **CSS3** - Modern styling with gradients and animations
- **Touch Events API** - Native mobile support
- **Keyboard Events** - Desktop control support

## 📝 Files Structure

```
maze-escape-js/
├── index.html      # Main HTML file
├── styles.css      # All styling and responsive design
├── game.js         # Game logic and rendering
└── README.md       # This file
```

## 🎨 Customization

Want to modify the game? Here's what you can change:

### Colors (in `game.js`)
```javascript
const COLORS = {
    wall: '#2d6a4f',        // Change wall color
    walkable: '#caf0f8',    // Change floor color
    player: '#4361ee',      // Change player color
    collectible: '#ffd60a', // Change collectible color
    exit: '#9d4edd'         // Change exit color
};
```

### Add Your Own Levels
In `game.js`, add to the `LEVELS` object:
```javascript
const LEVELS = {
    5: [
        "111111111",
        "1P0000001",
        "10111C101",
        "100001E01",
        "111111111"
    ]
};
```

### Tile Size
Change `TILE_SIZE` constant in `game.js` to make tiles bigger/smaller.

## 🐛 Known Issues

- None currently! Report any bugs you find.

## 📄 License

Free to use and modify for personal and educational purposes.

## 🙏 Credits

JavaScript port of the original C maze-escape game.

---

**Enjoy the game!** 🎮✨
