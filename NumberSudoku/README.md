# Sudoku Game

A beautiful and responsive Sudoku game with light/dark mode support and analytics tracking.

## 🚀 Quick Start

Simply open `index.html` in your web browser to play!

Or serve it with any static web server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## 📁 Project Structure

```
📦 Sudoku Game
├── index.html              # Main HTML file
├── script.js               # Game logic and functionality
├── style.css               # All styles and themes
├── AnalyticsManager.js     # Analytics tracking
└── README.md               # This file
```

## ✨ Features

- **Three Difficulty Levels**: Easy, Medium, Hard
- **Dual Themes**: Beautiful light and dark modes
- **Timer**: Track how long it takes to solve
- **Undo Functionality**: Revert your moves
- **Analytics**: Game session tracking
- **Fully Responsive**: Works on all screen sizes
- **No Build Required**: Pure vanilla JavaScript

## 🎮 How to Play

1. Select a difficulty level (Easy, Medium, Hard)
2. Click on a cell to select it
3. Enter a number (1-9) using the on-screen keypad or keyboard
4. Use Undo/Erase tools as needed
5. Complete the grid so every row, column, and 3x3 box contains digits 1-9
6. Click Submit to check your solution

## 🛠️ Technologies

- Vanilla JavaScript (ES6 Modules)
- CSS3 with CSS Variables
- HTML5
- No framework dependencies
- No build process required

## 🌐 Deployment

Deploy to any static hosting service:
- **GitHub Pages**: Just push to your repository
- **Netlify**: Drag and drop the folder
- **Vercel**: Connect your repository
- **Firebase Hosting**: `firebase deploy`

All files are ready to deploy as-is - no build step needed!
