const WORDS = ['SHALL','MIGHT','CANNOT','MUST','WILL','COULD','SHOULD','WOULD','MAY','CAN'];
const ROWS = 20, COLS = 20;

function solve(index, grid, placements) {
  if (index === WORDS.length) return placements;
  const word = WORDS[index];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (let dir of ['across', 'down']) {
        if (canPlace(word, r, c, dir, grid)) {
          const nextGrid = place(word, r, c, dir, grid);
          const result = solve(index + 1, nextGrid, [...placements, {word, r, c, dir}]);
          if (result) return result;
        }
      }
    }
  }
  return null;
}

function canPlace(word, row, col, dir, grid) {
  if (dir === 'across') {
    if (col + word.length > COLS) return false;
    let connected = false;
    for (let i = 0; i < word.length; i++) {
      const existing = grid[row][col + i];
      if (existing && existing !== word[i]) return false;
      if (existing) connected = true;
    }
    return connected;
  } else {
    if (row + word.length > ROWS) return false;
    let connected = false;
    for (let i = 0; i < word.length; i++) {
      const existing = grid[row + i][col];
      if (existing && existing !== word[i]) return false;
      if (existing) connected = true;
    }
    return connected;
  }
}

function place(word, row, col, dir, grid) {
  const newGrid = grid.map(r => [...r]);
  for (let i = 0; i < word.length; i++) {
    const r = dir === 'across' ? row : row + i;
    const c = dir === 'across' ? col + i : col;
    newGrid[r][c] = word[i];
  }
  return newGrid;
}

const startWord = WORDS[0];
let initialGrid = Array(ROWS).fill(null).map(() => Array(COLS).fill(''));
const initialPlacement = {word: startWord, r: 10, c: 5, dir: 'across'};
initialGrid = place(startWord, 10, 5, 'across', initialGrid);

const result = solve(1, initialGrid, [initialPlacement]);
if (result) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("No solution");
}
