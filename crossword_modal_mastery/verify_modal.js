const placements = [
  { "word": "SHALL", "r": 10, "c": 5, "dir": "across" },
  { "word": "MIGHT", "r": 7,  "c": 6, "dir": "down" },
  { "word": "CANNOT", "r": 9,  "c": 7, "dir": "down" },
  { "word": "MUST", "r": 8,  "c": 5, "dir": "down" },
  { "word": "WILL", "r": 7,  "c": 9, "dir": "down" },
  { "word": "COULD", "r": 13, "c": 6, "dir": "across" },
  { "word": "SHOULD", "r": 8,  "c": 10, "dir": "down" },
  { "word": "WOULD", "r": 7,  "c": 9, "dir": "across" },
  { "word": "MAY", "r": 7,  "c": 6, "dir": "across" },
  { "word": "CAN", "r": 6,  "c": 7, "dir": "down" }
];
const ROWS = 20, COLS = 20;
const grid = Array(ROWS).fill(null).map(()=>Array(COLS).fill(''));
const conflicts = [];
placements.forEach(p => {
  for (let i = 0; i < p.word.length; i++) {
    const r = p.dir==='across' ? p.r : p.r+i;
    const c = p.dir==='across' ? p.c+i : p.c;
    if (grid[r][c] && grid[r][c] !== p.word[i]) {
      conflicts.push(`${p.word} collision at (${r},${c}): word has ${p.word[i]}, grid has ${grid[r][c]}`);
    }
    grid[r][c] = p.word[i];
  }
});
console.log('Conflicts:', conflicts.length === 0 ? 'NONE' : conflicts);
grid.forEach((row, i) => {
  const line = row.map(c => c || '.').join(' ');
  if (line.replace(/\./g,'').length > 0) console.log(String(i).padStart(2), line);
});
