// Game Configuration
const TILE_SIZE = 50;
const COLORS = {
    wall: '#1a1a2e',        // Dark Navy
    walkable: '#16213e',    // Slightly lighter dark blue
    player: '#00f2ff',      // Cyan
    collectible: '#ff0055', // Pink
    exit: '#7000ff',        // Purple
    collected: '#16213e'    // Same as walkable
};

const ENABLE_DEV_COMPLETE_SHORTCUT = false;
const PUZZLEWORLD_MAX_TOTAL_XP = 200;
const PUZZLEWORLD_OPTIMAL_MOVES = {
    1: 52,
    2: 116,
    3: 85,
    4: 194
};

function getLevelXp() {
    return Math.floor(PUZZLEWORLD_MAX_TOTAL_XP / Object.keys(LEVELS).length);
}

function calculateLevelXp(levelNumber, moves) {
    const maxLevelXp = getLevelXp();
    const optimalMoves = PUZZLEWORLD_OPTIMAL_MOVES[levelNumber];
    if (!optimalMoves) {
        return maxLevelXp;
    }

    return Math.max(0, maxLevelXp - Math.max(0, moves - optimalMoves));
}

function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return `puzzleworld_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function postAnalyticsDebug(event, detail = {}) {
    try {
        window.parent.postMessage({
            __analyticsDebug: true,
            game: 'PuzzleWorld',
            event,
            detail,
            at: new Date().toISOString()
        }, '*');
    } catch (_error) {
        // Debug-only for local harness visibility.
    }
}

// Level Data
const LEVELS = {
    1: [
        "11111111111",
        "10000P1C001",
        "11111011101",
        "10001000001",
        "10101111101",
        "1C100000001",
        "11101110101",
        "10001C00101",
        "10111111101",
        "10000E10001",
        "11111111111"
    ],
    2: [
        "111111111111111",
        "1000001P0000001",
        "101110101011101",
        "10001C001010001",
        "111011101010111",
        "10000C10101C001",
        "101110101111101",
        "101000101000101",
        "101010111010101",
        "101010100C10101",
        "101011101110101",
        "101000001000101",
        "101111111011101",
        "1C00001E001C001",
        "111111111111111"
    ],
    3: [
        "1111111111111111111",
        "1P000000000000000C1",
        "1011111111111111101",
        "10C0000000000000101",
        "11101111111111101C1",
        "10001000000000101011",
        "101110111111101010C1",
        "101000100000101010101",
        "10111010111010101001",
        "100C0010100C101010E1",
        "11101110101110101011",
        "10001000100000001001",
        "101111101111111110C1",
        "10000000C00000000001",
        "1111111111111111111"
    ],
    4: [
        "11111111111111111111111",
        "1P00000000000C000000001",
        "101111111111111111110C1",
        "101000000000000000010C1",
        "10101111111111111101001",
        "10101C00000000000101011",
        "10101011111111110101001",
        "1010101C00000C010101011",
        "10101011111110110101001",
        "10101010000010010101011",
        "10101010111010010101001",
        "1010101010C0100101010C1",
        "10101010111110010101011",
        "10101000000000000101001",
        "10101011111111111101011",
        "1010C00000000000000C001",
        "10111111111111111111101",
        "10000000000000000000001",
        "1011111111111111111110E",
        "10C00000000000000000001",
        "11111111111111111111111"
    ]
};

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentLevel = 1;
        
        // Analytics tracking variables
        this.currentLevelId = null;
        this.levelStartTime = 0;
        this.taskCounter = 0;
        this.moveStartTime = 0;
        this.currentLevelSubmitted = false;
        
        this.reset();
        this.setupControls();
        this.loadLevel(this.currentLevel);
        
        // Initialize PathFinder
        this.pathfinder = new PathFinder(this);
    }

    reset() {
        this.map = [];
        this.player = { x: 0, y: 0 };
        this.exit = { x: 0, y: 0 };
        this.collectibles = [];
        this.collectedItems = new Set();
        this.moves = 0;
        this.gameWon = false;
        this.taskCounter = 0;
        this.moveStartTime = Date.now();
    }

    loadLevel(levelNum) {
        this.reset();
        this.currentLevel = levelNum;
        const levelData = LEVELS[levelNum];
        
        if (!levelData) {
            console.error('Level not found');
            return;
        }

        this.map = levelData.map(row => row.split(''));
        this.mapWidth = this.map[0].length;
        this.mapHeight = this.map.length;

        // Set canvas size
        this.canvas.width = this.mapWidth * TILE_SIZE;
        this.canvas.height = this.mapHeight * TILE_SIZE;

        // Find player, exit, and collectibles
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x];
                if (tile === 'P') {
                    this.player = { x, y };
                    this.map[y][x] = '0'; // Replace with walkable
                } else if (tile === 'E') {
                    this.exit = { x, y };
                } else if (tile === 'C') {
                    this.collectibles.push({ x, y, id: `${x}-${y}` });
                }
            }
        }

        // Analytics: Start level tracking
        if (window.gameAnalytics) {
            this.currentLevelId = levelNum;
            this.currentLevelSubmitted = false;
            window.gameAnalytics.startLevel(levelNum, { levelNumber: levelNum });
            this.levelStartTime = Date.now();
            this.taskCounter = 0;
            window.gameAnalytics.addRawMetric(`level_${levelNum}_map_size`, `${this.mapWidth}x${this.mapHeight}`);
            window.gameAnalytics.addRawMetric(`level_${levelNum}_collectibles_total`, String(this.collectibles.length));
            console.log('[Analytics] PuzzleWorld level started:', { runId: window.puzzleWorldRunId, levelNumber: levelNum });
            postAnalyticsDebug('level_started', {
                runId: window.puzzleWorldRunId,
                levelNumber: levelNum,
                collectiblesTotal: this.collectibles.length
            });
        }

        this.updateUI();
        this.render();
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.gameWon) return;
            
            const key = e.key.toLowerCase();
            let moved = false;

            if (key === 'w' || key === 'arrowup') {
                moved = this.movePlayer(0, -1);
            } else if (key === 's' || key === 'arrowdown') {
                moved = this.movePlayer(0, 1);
            } else if (key === 'a' || key === 'arrowleft') {
                moved = this.movePlayer(-1, 0);
            } else if (key === 'd' || key === 'arrowright') {
                moved = this.movePlayer(1, 0);
            }

            if (moved) {
                e.preventDefault();
            }
        });

        // Mobile touch controls
        const mobileControls = document.getElementById('mobile-controls');
        const buttons = mobileControls.querySelectorAll('.dpad-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const key = btn.dataset.key;
                this.handleMobileInput(key);
            });
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = btn.dataset.key;
                this.handleMobileInput(key);
            });
        });

        // Swipe gestures
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.gameWon) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const minSwipeDistance = 30;
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                // Horizontal swipe
                if (deltaX > 0) {
                    this.movePlayer(1, 0);
                } else {
                    this.movePlayer(-1, 0);
                }
            } else if (Math.abs(deltaY) > minSwipeDistance) {
                // Vertical swipe
                if (deltaY > 0) {
                    this.movePlayer(0, 1);
                } else {
                    this.movePlayer(0, -1);
                }
            }
        });

        // Canvas click for pathfinding
        this.canvas.addEventListener('click', (e) => {
            this.pathfinder.handleClick(e);
        });

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.loadLevel(this.currentLevel);
        });

        // Level selector
        document.getElementById('level-select').addEventListener('change', (e) => {
            this.loadLevel(parseInt(e.target.value));
        });

        // Win screen buttons
        document.getElementById('next-level-btn').addEventListener('click', () => {
            const nextLevel = this.currentLevel + 1;
            if (LEVELS[nextLevel]) {
                document.getElementById('level-select').value = nextLevel;
                this.loadLevel(nextLevel);
                this.hideWinScreen();
            } else {
                alert('Congratulations! You completed all levels!');
            }
        });

        document.getElementById('replay-btn').addEventListener('click', () => {
            this.loadLevel(this.currentLevel);
            this.hideWinScreen();
        });
    }

    handleMobileInput(key) {
        if (this.gameWon) return;
        
        switch(key) {
            case 'w':
                this.movePlayer(0, -1);
                break;
            case 's':
                this.movePlayer(0, 1);
                break;
            case 'a':
                this.movePlayer(-1, 0);
                break;
            case 'd':
                this.movePlayer(1, 0);
                break;
        }
    }

    movePlayer(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check boundaries
        if (newX < 0 || newX >= this.mapWidth || newY < 0 || newY >= this.mapHeight) {
            return false;
        }

        // Check collision with walls
        if (this.map[newY][newX] === '1') {
            return false;
        }

        // Check exit (only accessible if all collectibles collected)
        if (this.map[newY][newX] === 'E') {
            if (this.collectedItems.size === this.collectibles.length) {
                this.player.x = newX;
                this.player.y = newY;
                this.moves++;
                this.updateUI();
                this.render();
                this.scrollToPlayer();
                this.winGame();
                return true;
            } else {
                // Can't enter exit yet
                return false;
            }
        }

        // Valid move
        this.player.x = newX;
        this.player.y = newY;
        this.moves++;

        // Check for collectible
        const collectibleId = `${newX}-${newY}`;
        const foundCollectible = this.map[newY][newX] === 'C' && !this.collectedItems.has(collectibleId);
        
        if (foundCollectible) {
            this.collectedItems.add(collectibleId);
        }

        // Analytics: Record this move as a task
        if (window.gameAnalytics && this.currentLevelId) {
            const moveTime = Date.now() - this.moveStartTime;
            this.taskCounter++;
            
            const taskId = 'move_' + this.taskCounter;
            const question = foundCollectible ? 'collectible_found' : 'move_action';
            const position = `pos_${newX}_${newY}`;
            
            // Record the move task
            window.gameAnalytics.recordTask(
                this.currentLevelId,
                taskId,
                question,
                position,
                position,
                moveTime,
                foundCollectible ? 10 : 0
            );
            
            // Update metrics
            window.gameAnalytics.addRawMetric('moves', this.moves);
            window.gameAnalytics.addRawMetric('collectibles_collected', this.collectedItems.size);
            window.gameAnalytics.addRawMetric('collectibles_total', this.collectibles.length);
            const accuracy = this.collectibles.length > 0 ? 
                (this.collectedItems.size / this.collectibles.length * 100).toFixed(1) : 0;
            window.gameAnalytics.addRawMetric('collection_progress_percent', accuracy);
            
            // Reset move timer
            this.moveStartTime = Date.now();
        }

        this.updateUI();
        this.render();
        this.scrollToPlayer();
        return true;
    }

    scrollToPlayer() {
        const canvas = this.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const playerPixelX = this.player.x * TILE_SIZE + TILE_SIZE / 2;
        const playerPixelY = this.player.y * TILE_SIZE + TILE_SIZE / 2;
        
        // Calculate player position relative to viewport
        const playerScreenX = canvasRect.left + playerPixelX;
        const playerScreenY = canvasRect.top + playerPixelY;
        
        const margin = 150; // Increased margin for earlier scrolling
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Always keep player reasonably centered
        const shouldScrollX = playerScreenX < margin || playerScreenX > viewportWidth - margin;
        const shouldScrollY = playerScreenY < margin || playerScreenY > viewportHeight - margin;
        
        if (shouldScrollX || shouldScrollY) {
            // Calculate target scroll position to center player
            const targetScrollX = window.scrollX + playerScreenX - viewportWidth / 2;
            const targetScrollY = window.scrollY + playerScreenY - viewportHeight / 2;
            
            // Smooth scroll with CSS scroll-behavior
            window.scrollTo({
                left: targetScrollX,
                top: targetScrollY,
                behavior: 'smooth'
            });
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw map
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map[y][x];
                this.drawTile(x, y, tile);
            }
        }

        // Draw player
        this.drawPlayer(this.player.x, this.player.y);
    }

    drawTile(x, y, tile) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Draw base
        if (tile === '1') {
            // Wall - Dark Navy with Neon Border
            this.ctx.fillStyle = COLORS.wall;
            this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            
            // Neon Border
            this.ctx.strokeStyle = '#00f2ff'; // Cyan
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            
            // Inner glow
            this.ctx.fillStyle = 'rgba(0, 242, 255, 0.1)';
            this.ctx.fillRect(px + 5, py + 5, TILE_SIZE - 10, TILE_SIZE - 10);
        } else {
            // Walkable - Darker Blue
            this.ctx.fillStyle = COLORS.walkable;
            this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            
            // Faint Grid lines
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        // Draw exit
        if (tile === 'E') {
            const allCollected = this.collectedItems.size === this.collectibles.length;
            this.ctx.fillStyle = allCollected ? COLORS.exit : '#333';
            
            // Draw portal shape
            this.ctx.beginPath();
            this.ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/2 - 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Portal swirl
            if (allCollected) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }

        // Draw collectible
        if (tile === 'C') {
            const collectibleId = `${x}-${y}`;
            if (!this.collectedItems.has(collectibleId)) {
                // Glowing Orb
                const centerX = px + TILE_SIZE / 2;
                const centerY = py + TILE_SIZE / 2;
                
                // Glow
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = COLORS.collectible;
                
                this.ctx.fillStyle = COLORS.collectible;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Reset shadow
                this.ctx.shadowBlur = 0;
            }
        }
    }

    drawPlayer(x, y) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        
        // Glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = COLORS.player;

        // Draw player
        this.ctx.fillStyle = COLORS.player;
        this.ctx.beginPath();
        this.ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Inner detail
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 5, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    updateUI() {
        document.getElementById('move-count').textContent = this.moves;
        document.getElementById('collectible-count').textContent = 
            `${this.collectedItems.size}/${this.collectibles.length}`;
    }

    winGame() {
        if (this.currentLevelSubmitted) {
            return;
        }

        this.gameWon = true;
        const xpEarned = calculateLevelXp(this.currentLevel, this.moves);
        const optimalMoves = PUZZLEWORLD_OPTIMAL_MOVES[this.currentLevel] || 0;
        document.getElementById('final-moves').textContent = this.moves;
        document.getElementById('final-score').textContent = xpEarned;
        
        // Analytics: Track level completion
        if (window.gameAnalytics && this.currentLevelId) {
            const timeTaken = Date.now() - this.levelStartTime;
            
            console.log('[Analytics] Level completed!', {
                timeTaken: (timeTaken / 1000).toFixed(2) + 's',
                moves: this.moves,
                optimalMoves: optimalMoves,
                xpEarned: xpEarned
            });
            
            // Add final metrics
            window.gameAnalytics.addRawMetric('final_score', xpEarned);
            window.gameAnalytics.addRawMetric('level_number', this.currentLevel);
            window.gameAnalytics.addRawMetric('final_moves', this.moves);
            window.gameAnalytics.addRawMetric('optimal_moves', optimalMoves);
            window.gameAnalytics.addRawMetric('extra_moves', Math.max(0, this.moves - optimalMoves));
            window.gameAnalytics.addRawMetric('completion_time_ms', timeTaken);
            window.gameAnalytics.addRawMetric('collectibles_collected_final', this.collectedItems.size);
            
            window.gameAnalytics.recordTask(
                this.currentLevelId,
                'level_complete',
                'Collect all orbs and reach the exit',
                'completed',
                'completed',
                timeTaken,
                xpEarned
            );
            window.gameAnalytics.endLevel(this.currentLevelId, true, timeTaken, xpEarned);
            const payload = window.gameAnalytics.submitLevel(this.currentLevelId, { runId: window.puzzleWorldRunId });
            if (payload && payload.success === false) {
                console.error('[Analytics] PuzzleWorld level submit rejected:', payload.errors);
                postAnalyticsDebug('submit_rejected', {
                    runId: window.puzzleWorldRunId,
                    levelNumber: this.currentLevel,
                    errors: payload.errors
                });
            } else {
                this.currentLevelSubmitted = true;
                console.log('[Analytics] PuzzleWorld level submitted:', {
                    runId: window.puzzleWorldRunId,
                    levelNumber: this.currentLevel,
                    xpEarned: xpEarned,
                    moves: this.moves,
                    optimalMoves: optimalMoves
                });
                postAnalyticsDebug('submit_success', {
                    runId: window.puzzleWorldRunId,
                    levelNumber: this.currentLevel,
                    xpEarned: xpEarned,
                    moves: this.moves,
                    optimalMoves: optimalMoves
                });
            }
        }
        
        const winScreen = document.getElementById('win-screen');
        winScreen.style.display = 'flex';
        // Trigger reflow
        winScreen.offsetHeight;
        winScreen.classList.add('active');
    }

    hideWinScreen() {
        const winScreen = document.getElementById('win-screen');
        winScreen.classList.remove('active');
        setTimeout(() => {
            winScreen.style.display = 'none';
        }, 300);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // ANALYTICS SETUP
    // ============================================
    window.puzzleWorldRunId = createRunId();
    window.gameAnalytics = AnalyticsManager.getInstance();
    window.gameAnalytics.initialize('PuzzleWorld', window.puzzleWorldRunId);
    
    const game = new Game();
    window.__puzzleWorldGame = game;
    window.__completeLevelForTest = () => {
        if (!ENABLE_DEV_COMPLETE_SHORTCUT) {
            console.log('DEV: Auto-complete ignored because debug shortcut is disabled.');
            return;
        }

        game.collectedItems = new Set(game.collectibles.map(item => item.id));
        game.moves = Math.max(game.moves, game.collectibles.length);
        game.updateUI();
        game.winGame();
    };

    document.addEventListener('keydown', (event) => {
        if ((event.key && event.key.toLowerCase() === 'c') || event.code === 'KeyC') {
            if (event.__puzzleWorldDevCompleteHandled) {
                return;
            }
            event.__puzzleWorldDevCompleteHandled = true;
            event.preventDefault();
            window.__completeLevelForTest();
        }
    }, true);
    
    // Track abandoned sessions (when user leaves before completing)
    window.addEventListener('beforeunload', () => {
        if (game.currentLevelId && game.levelStartTime > 0 && !game.gameWon && !game.currentLevelSubmitted) {
            postAnalyticsDebug('session_left_incomplete', {
                runId: window.puzzleWorldRunId,
                levelNumber: game.currentLevel,
                moves: game.moves,
                collectiblesCollected: game.collectedItems.size
            });
            console.log('[Analytics] PuzzleWorld session ended before level completion.');
        }
    });
});
