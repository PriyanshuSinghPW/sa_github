// Initialize the game logic
var game = new Chess();
var board = null;
var $status = $('#status');
var $fen = $('#fen');
var $moveHistory = $('#move-history');
var $thinking = $('#thinking');
var capturedPieces = { w: [], b: [] };
var moveCount = 0;
var boardInitialized = false;

// Analytics
var analytics = null;
var gameSessionId = null;
var gameStartTime = null;
var currentRunId = null;
var currentMatchSubmitted = false;
var CHESS_LEVEL_NUMBER = 1;

// Set a random soothing background color on load
function setRandomTheme() {
    var hue = Math.floor(Math.random() * 360);
    // Low saturation and lightness for a soothing dark theme that fits the white text
    var color = 'hsl(' + hue + ', 30%, 30%)';
    document.body.style.backgroundColor = color;
}
setRandomTheme();

// Screen navigation
function showGameScreen() {
    $('#homeScreen').hide();
    $('#gameScreen').show();
    
    // Initialize board on first show
    if (!boardInitialized) {
        initializeBoard();
        boardInitialized = true;
    } else {
        board.resize();
    }
    
    // Start new game session
    startNewGameSession();
}

function showHomeScreen() {
    if (gameSessionId && !game.game_over()) {
        endGameSession('abandoned', null);
    }
    $('#gameScreen').hide();
    $('#homeScreen').show();
}

// Initialize analytics
function initializeAnalytics() {
    try {
        analytics = AnalyticsManager.getInstance();
        console.log('[Chess] Analytics manager ready');
    } catch (error) {
        console.warn('[Chess] Analytics not available:', error);
    }
}

function createRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return 'chess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function postAnalyticsDebug(event, detail) {
    try {
        window.parent.postMessage({
            __analyticsDebug: true,
            game: 'Chess',
            event: event,
            detail: detail || {},
            at: new Date().toISOString()
        }, '*');
    } catch (_error) {
        // Debug-only for local harness visibility.
    }
}

// Start a new game session
function startNewGameSession() {
    if (!analytics) return;
    
    currentRunId = createRunId();
    gameSessionId = 'level_' + CHESS_LEVEL_NUMBER;
    gameStartTime = Date.now();
    currentMatchSubmitted = false;
    
    analytics.initialize('Chess', currentRunId);
    analytics.startLevel(CHESS_LEVEL_NUMBER, { levelNumber: CHESS_LEVEL_NUMBER });
    analytics.addRawMetric('game_type', 'vs_ai');
    console.log('[Chess] Game session started:', { runId: currentRunId, levelNumber: CHESS_LEVEL_NUMBER });
    postAnalyticsDebug('match_started', { runId: currentRunId, levelNumber: CHESS_LEVEL_NUMBER });
}

// End current game session
function endGameSession(outcome, winner) {
    if (!analytics || !gameSessionId) return;
    if (currentMatchSubmitted) {
        postAnalyticsDebug('submit_skipped_duplicate', { outcome: outcome, winner: winner, runId: currentRunId });
        return;
    }
    
    var timeTaken = Date.now() - gameStartTime;
    var successful = (outcome === 'checkmate' && winner === 'white');
    var xpEarned = calculateXP(outcome, winner, moveCount, timeTaken);
    
    analytics.endLevel(CHESS_LEVEL_NUMBER, successful, timeTaken, xpEarned);
    analytics.addRawMetric('outcome', outcome);
    analytics.addRawMetric('winner', winner || 'none');
    analytics.addRawMetric('total_moves', String(moveCount));
    analytics.addRawMetric('white_captures', String(capturedPieces.w.length));
    analytics.addRawMetric('black_captures', String(capturedPieces.b.length));
    analytics.addRawMetric('time_seconds', String(Math.floor(timeTaken / 1000)));
    
    var payload = analytics.submitLevel(CHESS_LEVEL_NUMBER, { runId: currentRunId });
    if (payload && payload.success === false) {
        console.error('[Chess] Analytics submit rejected:', payload.errors);
        postAnalyticsDebug('submit_rejected', { outcome: outcome, winner: winner, runId: currentRunId, errors: payload.errors });
        return;
    }

    currentMatchSubmitted = true;
    try {
        window.parent.postMessage(payload, '*');
    } catch (_error) {
        // Bridge already attempted delivery; this supports the local harness.
    }
    console.log('[Chess] Game session ended:', { runId: currentRunId, outcome: outcome, winner: winner, xpEarned: xpEarned });
    postAnalyticsDebug('submit_success', { outcome: outcome, winner: winner, xpEarned: xpEarned, runId: currentRunId });
}

// Calculate XP based on game performance
function calculateXP(outcome, winner, moves, timeMs) {
    var xp = 0;
    
    if (outcome === 'checkmate') {
        if (winner === 'white') {
            xp = 100; // Win bonus
            // Bonus for efficiency (fewer moves)
            if (moves < 30) xp += 50;
            else if (moves < 50) xp += 25;
        } else {
            xp = 25; // Participation points
        }
    } else if (outcome === 'draw') {
        xp = 50; // Draw points
    }
    
    return xp;
}

// Track individual moves
function trackMove(move, isPlayerMove) {
    if (!analytics || !gameSessionId) return;
    
    var taskId = 'move_' + moveCount;
    var moveDescription = move.san + ' (' + move.from + '->' + move.to + ')';
    var actor = isPlayerMove ? 'player' : 'ai';
    
    analytics.recordTask(
        CHESS_LEVEL_NUMBER,
        taskId,
        moveDescription,
        actor,
        actor,
        0,
        1 // 1 XP per move
    );
}

// Event listeners for navigation
$('#playNowBtn').on('click', showGameScreen);
$('#homeBtn').on('click', showHomeScreen);

// Initialize analytics on page load
initializeAnalytics();

// Piece Unicode symbols for captured pieces display
var pieceSymbols = {
    'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};

// Stockfish variables
var stockfish = null;
var stockfishReady = false;

function onDragStart (source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false;

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop (source, target) {
    removeGreySquares();
    
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    });

    // illegal move
    if (move === null) return 'snapback';

    addMoveToHistory(move);
    updateCapturedPieces(move);
    trackMove(move, true); // Track player move
    updateStatus();

    // If the game isn't over, let the AI make a move
    if (!game.game_over()) {
        window.setTimeout(makeAIMove, 250);
    }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
    board.position(game.fen());
}

function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
}

function greySquare (square) {
    var $square = $('#myBoard .square-' + square)

    var background = '#a9a9a9'
    if ($square.hasClass('black-3c85d')) {
        background = '#696969'
    }

    $square.css('background', background)
}

function onMouseoverSquare (square, piece) {
    // get list of possible moves for this square
    var moves = game.moves({
        square: square,
        verbose: true
    })

    // exit if there are no moves available for this square
    if (moves.length === 0) return

    // highlight the square they moused over
    greySquare(square)

    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to)
    }
}

function onMouseoutSquare (square, piece) {
    removeGreySquares()
}

function makeAIMove() {
    if (!stockfishReady) {
        window.setTimeout(makeAIMove, 100);
        return;
    }
    
    $thinking.show();
    var depth = 10; // Fixed depth since difficulty selector was removed
    
    // Send position to Stockfish
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth ' + depth);
}

function addMoveToHistory(move) {
    moveCount++;
    var moveNumber = Math.ceil(moveCount / 2);
    var moveText = move.san;
    
    if (moveCount % 2 === 1) {
        $moveHistory.append('<div class="move-entry">' + moveNumber + '. ' + moveText + '</div>');
    } else {
        var lastEntry = $moveHistory.find('.move-entry:last');
        lastEntry.html(lastEntry.html() + ' ' + moveText);
    }
    
    // Auto-scroll to bottom
    $moveHistory.scrollTop($moveHistory[0].scrollHeight);
}

function updateCapturedPieces(move) {
    if (move.captured) {
        var capturedPiece = move.captured;
        var capturingColor = move.color;
        
        // Add to the capturing player's collection
        capturedPieces[capturingColor].push(capturedPiece);
        
        // Display captured pieces
        displayCapturedPieces();
    }
}

function displayCapturedPieces() {
    var whiteCaptures = capturedPieces.w.map(function(p) {
        return pieceSymbols[p];
    }).join(' ');
    
    var blackCaptures = capturedPieces.b.map(function(p) {
        return pieceSymbols[p.toUpperCase()];
    }).join(' ');
    
    $('#captured-white').html('⚪ ' + whiteCaptures);
    $('#captured-black').html('⚫ ' + blackCaptures);
}

function updateStatus () {
    var status = '';

    var moveColor = 'White';
    if (game.turn() === 'b') {
        moveColor = 'Black';
    }

    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.';
        var winner = (moveColor === 'White') ? 'black' : 'white';
        endGameSession('checkmate', winner);
    }

    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position';
        endGameSession('draw', null);
    }

    // game still on
    else {
        status = moveColor + ' to move';

        // check?
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check';
        }
    }

    $status.html(status);
    $fen.html(game.fen());
}

function completeCurrentChessGameForTest() {
    if ($('#gameScreen').is(':hidden')) {
        console.log('[Chess] DEV complete ignored because game screen is not active.');
        return;
    }

    if (!gameSessionId) {
        startNewGameSession();
    }

    console.log('[Chess] DEV completing match as white checkmate win.');
    $status.html('Game over, black is in checkmate.');
    endGameSession('checkmate', 'white');
}

window.__completeLevelForTest = completeCurrentChessGameForTest;

function handleDevCompleteKey(event) {
    if ((event.key && event.key.toLowerCase() === 'c') || event.code === 'KeyC') {
        if (event.__chessDevCompleteHandled) {
            return;
        }
        event.__chessDevCompleteHandled = true;
        event.preventDefault();
        completeCurrentChessGameForTest();
    }
}

window.addEventListener('keydown', handleDevCompleteKey, true);
document.addEventListener('keydown', handleDevCompleteKey, true);

window.addEventListener('message', function(event) {
    var data = event.data || {};
    if (data.type === 'DEV_COMPLETE_LEVEL') {
        completeCurrentChessGameForTest();
    }
});

function initializeBoard() {
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoutSquare: onMouseoutSquare,
        onMouseoverSquare: onMouseoverSquare
    };

    board = Chessboard('myBoard', config);

    // Ensure board is resized correctly on load
    setTimeout(function() {
        board.resize();
    }, 100);

    updateStatus();

    // Make board responsive
    $(window).resize(function() {
        board.resize();
    });
}

// Check if running locally via file:// protocol
if (window.location.protocol === 'file:') {
    alert('Warning: Stockfish AI may not work when opening the file directly due to browser security restrictions. Please run this on a local server (e.g., using VS Code Live Server or python -m http.server).');
}

// Initialize Stockfish when page loads
initializeStockfish();

function initializeStockfish() {
    // We use a web worker to run Stockfish in a separate thread so it doesn't freeze the UI
    stockfish = new Worker('stockfish.js');
    stockfishReady = false;

    stockfish.postMessage('uci');
    stockfish.postMessage('isready');

    stockfish.onmessage = function(event) {
        // console.log(event.data); // Debugging Stockfish output

        if (event.data === 'readyok') {
            stockfishReady = true;
        }

        // Detect the best move found by Stockfish
        if (event.data.startsWith('bestmove')) {
            $thinking.hide();
            var bestMove = event.data.split(' ')[1];
            
            if (bestMove === '(none)' || !bestMove) {
                updateStatus();
                return;
            }
            
            // Make the move on the board
            var moveObj = game.move({
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4),
                promotion: bestMove.length > 4 ? bestMove.substring(4, 5) : 'q'
            });

            if (moveObj) {
                addMoveToHistory(moveObj);
                updateCapturedPieces(moveObj);
                trackMove(moveObj, false); // Track AI move
            }

            // Update the board position
            board.position(game.fen());
            updateStatus();
        }
    };
}

// Event Listeners
$('#resetBtn').on('click', function() {
    // End current session if active
    if (gameSessionId && !game.game_over()) {
        endGameSession('reset', null);
    }
    
    game.reset();
    board.start();
    capturedPieces = { w: [], b: [] };
    moveCount = 0;
    $moveHistory.empty();
    displayCapturedPieces();
    $thinking.hide();
    updateStatus();
    
    // Start new session
    startNewGameSession();
});

$('#flipBtn').on('click', function() {
    board.flip();
});

$('#undoBtn').on('click', function() {
    // Undo last 2 moves (player + AI)
    if (moveCount >= 2) {
        game.undo();
        game.undo();
        board.position(game.fen());
        
        // Remove last 2 moves from history
        $moveHistory.find('.move-entry:last').remove();
        moveCount -= 2;
        
        // Recalculate captured pieces
        recalculateCapturedPieces();
        updateStatus();
    }
});

function recalculateCapturedPieces() {
    capturedPieces = { w: [], b: [] };
    var moves = game.history({ verbose: true });
    moves.forEach(function(move) {
        if (move.captured) {
            capturedPieces[move.color].push(move.captured);
        }
    });
    displayCapturedPieces();
}
