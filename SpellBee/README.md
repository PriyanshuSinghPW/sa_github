# Spelling Bee Game - Audio Setup

## Adding Your Own Audio Files

To add custom sounds to the game, replace the placeholder audio in `app.js`:

### 1. Correct Sound Effect
- Create/download a short, pleasant "ding" or "success" sound
- Save as `correct.mp3` or `correct.wav` in the project folder
- Update line in app.js:
  ```javascript
  correctSound.src = 'correct.mp3';
  ```

### 2. Incorrect Sound Effect  
- Create/download a short, gentle "buzz" or "error" sound
- Save as `incorrect.mp3` or `incorrect.wav`
- Update line in app.js:
  ```javascript
  incorrectSound.src = 'incorrect.mp3';
  ```

### 3. Background Music
- Add a calm, looping background music track
- Save as `bgmusic.mp3` 
- Update line in app.js:
  ```javascript
  bgMusic.src = 'bgmusic.mp3';
  ```

## Free Sound Resources

- **Freesound.org** - Free sound effects
- **Incompetech.com** - Free background music
- **Zapsplat.com** - Free sound effects
- **Bensound.com** - Royalty-free music

## Current Setup

The game currently uses base64-encoded placeholder audio. For the best experience:
1. Download or create your audio files
2. Place them in the same folder as index.html
3. Update the src values in app.js as shown above
