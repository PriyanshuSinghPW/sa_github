# Crossword Game — New Template Creation Guide

This guide documents exactly how to create a new themed crossword template for this game engine. Follow these steps in order every time.

---

## Part 1: Understand the Game Architecture

### Files You Will Always Edit
| File | What It Controls |
|---|---|
| `puzzle.json` | Level 1 puzzle data (words, grid positions, clues) |
| `puzzle-level2.json` | Level 2 puzzle data (same format, more words) |
| `game.html` | Main game page title and heading |
| `script.js` | Analytics ID, localStorage key, page title |
| `index.html` / `landing.html` | Landing page title, background animation words |

### Files You Do NOT Touch
- `style.css` — visual layout only
- `AnalyticsManager.js` — analytics logic
- `js-analytics-bridge/` — npm package, separate concern

---

## Part 2: How the Grid Engine Works (CRITICAL)

The game renders a 2D grid from the JSON clue coordinates. This is the key function in `script.js`:

```
function populateGridState(clueList) {
    for each clue in clueList:
        for i = 0 to answer.length:
            if direction === 'across':  r = clue.row,     c = clue.col + i
            if direction === 'down':    r = clue.row + i, c = clue.col
            grid[r][c].answer = answer[i]   ← OVERWRITES previous letter
```

### The Golden Rule
**When two words share a cell (intersect), they MUST have the exact same letter at that cell.** The engine overwrites silently — a mismatch causes wrong letters to display in the rendered puzzle.

Example of a VALID intersection:
```
MANSABDARI across, row=5, col=0
  → cell (r5, c2) = 'N'   (index 2 of MANSABDARI)

HUNDI down, row=3, col=2
  → cell (r3+2, c2) = (r5, c2) = 'N'   (index 2 of HUNDI)

Both agree: 'N' = 'N'  ✓ VALID
```

Example of an INVALID intersection:
```
TALIKOTA across, row=2, col=0
  → cell (r2, c4) = 'K'   (index 4 of TALIKOTA)

JIZYA down, row=1, col=4
  → cell (r1+1, c4) = (r2, c4) = 'I'   (index 1 of JIZYA)

'K' ≠ 'I'  ✗ CONFLICT — grid will show wrong letter
```

---

## Part 3: Step-by-Step — Designing a New Crossword Grid

### Step 1: Collect Your Word List

Gather all words for the theme. Categorize them as ACROSS or DOWN (you decide, but longer words usually work better as ACROSS anchors).

Example list for Medieval Minds:
```
ACROSS: MANSABDARI, TALIKOTA, AMUKTAMALYADA, DURGAVATI, SULHIKUL
DOWN:   HUNDI, JIZYA, TIMUR, HAMPI, ICONOCLASM
```

### Step 2: Find a Long ANCHOR Word

Pick the longest ACROSS word. Place it at a fixed row (e.g., row 5, col 0). This becomes your anchor around which all DOWN words are positioned.

```
Anchor: MANSABDARI  →  row=5, col=0
Letters: M(0) A(1) N(2) S(3) A(4) B(5) D(6) A(7) R(8) I(9)
         c0   c1   c2   c3   c4   c5   c6   c7   c8   c9
```

### Step 3: Find Valid DOWN Word Intersections

For each DOWN word, find where one of its letters matches one of the anchor's letters at the same column. Use this formula:

```
If DOWN_WORD[di] == ANCHOR[ai]:
    col = ai           (same column as anchor's letter index)
    row = anchor_row - di   (so that down[di] lands exactly on anchor row)
```

Run this as a Node.js script to brute-force all valid pairs:

```js
const across = 'MANSABDARI';   // your anchor
const anchorrow = 5;
const downs = ['HUNDI','JIZYA','TIMUR','HAMPI','ICONOCLASM'];

downs.forEach(down => {
  console.log('--- ' + down + ' ---');
  for (let ai = 0; ai < across.length; ai++) {
    for (let di = 0; di < down.length; di++) {
      if (across[ai] === down[di]) {
        const col = ai;
        const startRow = anchorrow - di;
        if (startRow >= 0) {
          console.log(`  col=${col}, startRow=${startRow}  [${down}[${di}]='${down[di]}' = ${across}[${ai}]='${across[ai]}']`);
        }
      }
    }
  }
});
```

**Medieval Minds results (verified):**
```
HUNDI[2]='N' = MANSABDARI[2]='N'  →  col=2, startRow=3
JIZYA[4]='A' = MANSABDARI[4]='A'  →  col=4, startRow=1
TIMUR[4]='R' = MANSABDARI[8]='R'  →  col=8, startRow=1
HAMPI[1]='A' = MANSABDARI[1]='A'  →  col=1, startRow=4
ICONOCLASM[0]='I' = MANSABDARI[9]='I'  →  col=9, startRow=5
```

### Step 4: Check for DOWN-vs-DOWN Conflicts

Two DOWN words at **different columns** never conflict (they can't share cells). Two DOWN words at the **same column** would conflict — avoid placing two down words in the same column.

### Step 5: Place Remaining ACROSS Words

For additional ACROSS words (not the anchor), they must NOT land on a cell already occupied by a different letter from a DOWN word.

**Safe strategy:** Place extra ACROSS words in rows where no DOWN word passes through, OR carefully compute intersections.

**Check formula — For ACROSS word at (row, col):**
```
For each down word D at column C:
    If C >= col  AND  C < col + ACROSS_WORD.length:
        intersection cell is (row, C)
        ACROSS letter at that cell = ACROSS_WORD[C - col]
        DOWN letter at that cell   = D[row - D.startRow]
        These MUST be equal, or it's a conflict.
```

**Medieval Minds solution for remaining ACROSS words:**
- `AMUKTAMALYADA` → row=0, col=0 → No DOWN words start above row 1, so row 0 is completely safe. ✓
- `TALIKOTA` → row=2, col=5 → Only TIMUR passes through this row at col=8. TALIKOTA[8-5]=TALIKOTA[3]='I' and TIMUR[2-1]=TIMUR[1]='I'. Match ✓
- `DURGAVATI` → row=11, col=0 → All DOWN words end before row 11 (ICONOCLASM is longest, ends row 14 but col=9). DURGAVATI ends at col=8. No conflict at col=9. ✓
- `SULHIKUL` → row=14, col=0 → ICONOCLASM col=9. SULHIKUL ends at col=7. No overlap with col=9. ✓

### Step 6: Verify with a Script BEFORE Writing JSON

Always run this verification script. Zero errors = safe to write JSON.

```js
const ROWS = 18, COLS = 18;
const grid = Array(ROWS).fill(null).map(()=>Array(COLS).fill(''));
const conflicts = [];

function place(word, row, col, dir) {
  for (let i = 0; i < word.length; i++) {
    const r = dir==='across' ? row : row+i;
    const c = dir==='across' ? col+i : col;
    if (r >= ROWS || c >= COLS) { conflicts.push(word+' OUT OF BOUNDS at r'+r+',c'+c); continue; }
    if (grid[r][c] && grid[r][c] !== word[i]) {
      conflicts.push(word+' r'+r+',c'+c+' wants '+word[i]+' but has '+grid[r][c]);
    }
    grid[r][c] = word[i];
  }
}

// Place all words here:
place('MANSABDARI',   5,  0, 'across');
place('AMUKTAMALYADA',0,  0, 'across');
place('TALIKOTA',     2,  5, 'across');
place('DURGAVATI',    11, 0, 'across');
place('SULHIKUL',     14, 0, 'across');
place('HUNDI',        3,  2, 'down');
place('JIZYA',        1,  4, 'down');
place('TIMUR',        1,  8, 'down');
place('HAMPI',        4,  1, 'down');
place('ICONOCLASM',   5,  9, 'down');

if (conflicts.length === 0) {
  console.log('✓ NO CONFLICTS');
} else {
  console.log('✗ CONFLICTS:', conflicts.join('\n'));
}
grid.forEach((row,i) => console.log(String(i).padStart(2), row.map(c=>c||'.').join(' ')));
```

Run with: `node verify.js`

---

## Part 4: JSON Format Reference

### puzzle.json / puzzle-level2.json Structure

```json
{
  "metadata": {
    "title": "GAME NAME HERE",
    "author": "Physics Wallah",
    "level": 1,
    "difficulty": "Difficulty Label",
    "size": { "rows": 18, "cols": 18 },
    "bonusXP": 20
  },
  "clues": {
    "across": [
      {
        "number": 9,
        "clue": "The question shown to the player",
        "answer": "WORDHERE",
        "direction": "across",
        "row": 5,
        "col": 0,
        "hint": "A longer hint shown when player asks for help."
      }
    ],
    "down": [
      {
        "number": 10,
        "clue": "The question shown to the player",
        "answer": "WORDHERE",
        "direction": "down",
        "row": 3,
        "col": 2,
        "hint": "A longer hint shown when player asks for help."
      }
    ]
  }
}
```

### Rules for Each Field
| Field | Rule |
|---|---|
| `number` | Unique integer per clue. Shown in the grid cell at the word's start. |
| `answer` | ALL UPPERCASE. No spaces or hyphens. |
| `direction` | Exactly `"across"` or `"down"` (lowercase). |
| `row` | 0-indexed. `row=0` is the top row. |
| `col` | 0-indexed. `col=0` is the leftmost column. |
| `size.rows/cols` | Must be >= (max_row + max_word_length). Use 18×18 as default. |

### Level 1 vs Level 2 Differences
- Level 2 has one extra ACROSS word (e.g., `LACHITBORPHUKAN`)
- Level 2 `difficulty` label is harder (e.g., `"Sultan's Challenge"`)
- Level 2 `bonusXP` is higher (e.g., 30 vs 20)
- Level 2 `level` field is `2`
- All other words and positions are identical to Level 1

---

## Part 5: Branding Changes (Game Name, Theme)

### Files to Update When Renaming the Game

**1. `script.js`** — search and replace:
```
analyticsId: 'old_game_id'         →  analyticsId: 'new_game_id'
localStorage key 'oldGameProgress'  →  'newGameProgress'
document.title = 'Old Game Name'    →  document.title = 'New Game Name'
```

**2. `game.html`** — update:
```html
<title>New Game Name</title>
<h1>New Game Name</h1>
<!-- subtitle span if present -->
```

**3. `index.html` and `landing.html`** — update:
```html
<title>New Game Name</title>
<!-- background animation words (floating text) — change to theme-relevant terms -->
<!-- "How to Play" description text -->
```

---

## Part 6: The Verified Final Grid (Medieval Minds)

```
Row  0: A M U K T A M A L Y A D A . . . . .   ← AMUKTAMALYADA (across, col 0)
Row  1: . . . . J . . . T . . . . . . . . .   ← JIZYA↓ col4, TIMUR↓ col8
Row  2: . . . . I T A L I K O T A . . . . .   ← TALIKOTA (across, col 5)
Row  3: . . H . Z . . . M . . . . . . . . .   ← HUNDI↓ col2
Row  4: . H U . Y . . . U . . . . . . . . .   ← HAMPI↓ col1
Row  5: M A N S A B D A R I . . . . . . . .   ← MANSABDARI (across, col 0) ← ANCHOR
Row  6: . M D . . . . . . C . . . . . . . .
Row  7: . P I . . . . . . O . . . . . . . .
Row  8: . I . . . . . . . N . . . . . . . .
Row  9: . . . . . . . . . O . . . . . . . .
Row 10: . . . . . . . . . C . . . . . . . .
Row 11: D U R G A V A T I L . . . . . . . .   ← DURGAVATI (across, col 0)
Row 12: . . . . . . . . . A . . . . . . . .
Row 13: . . . . . . . . . S . . . . . . . .
Row 14: S U L H I K U L . M . . . . . . . .   ← SULHIKUL (across, col 0)
Row 15: L A C H I T B O R P H U K A N . . .   ← LACHITBORPHUKAN (Level 2 only)
Row 16: . . . . . . . . . . . . . . . . . .
Row 17: . . . . . . . . . . . . . . . . . .
```

### Verified Intersections
| DOWN word | Col | Start row | Intersection row | DOWN letter | ACROSS letter | Match |
|---|---|---|---|---|---|---|
| HUNDI | 2 | 3 | 5 | HUNDI[2] = 'N' | MANSABDARI[2] = 'N' | ✓ |
| JIZYA | 4 | 1 | 5 | JIZYA[4] = 'A' | MANSABDARI[4] = 'A' | ✓ |
| TIMUR | 8 | 1 | 5 | TIMUR[4] = 'R' | MANSABDARI[8] = 'R' | ✓ |
| HAMPI | 1 | 4 | 5 | HAMPI[1] = 'A' | MANSABDARI[1] = 'A' | ✓ |
| ICONOCLASM | 9 | 5 | 5 | ICONOCLASM[0] = 'I' | MANSABDARI[9] = 'I' | ✓ |
| TIMUR | 8 | 1 | 2 | TIMUR[1] = 'I' | TALIKOTA[3] = 'I' | ✓ |

---

## Part 7: Checklist Before Publishing

- [ ] Ran the verify script — output is `✓ NO CONFLICTS`
- [ ] `puzzle.json` and `puzzle-level2.json` are valid JSON (test: `node -e "require('./puzzle.json')"`)
- [ ] All `answer` values are uppercase
- [ ] Grid `size.rows` and `size.cols` are large enough for all words
- [ ] Every `number` field is unique within the file
- [ ] `direction` values are exactly `"across"` or `"down"` (lowercase)
- [ ] Level 2 has the extra word; Level 1 does not
- [ ] Game name updated in `game.html`, `script.js`, `index.html`, `landing.html`
- [ ] Tested in browser with hard refresh (`Ctrl+Shift+R`) on `http://127.0.0.1:8080/game.html`

---

## Part 8: Quick-Start for a New Theme

1. Copy this repo to a new folder
2. Replace all word lists in `puzzle.json` and `puzzle-level2.json` using the JSON format above
3. Design the grid using Steps 1–6 in Part 3
4. Run the verify script — fix any conflicts before touching the JSON
5. Update game name in the 4 files listed in Part 5
6. Run `npx http-server . -p 8080` and test in browser
