const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(`${__dirname}/../script.js`, 'utf8');
const html = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');

function simulator() {
    const elements = new Map();
    const fills = [];
    let frames = 0;
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
        elements.set(id, {
            listeners: {}, classList: { add() {}, remove() {} },
            addEventListener(type, listener) { this.listeners[type] = listener; },
            dispatch(type, event = {}) { this.listeners[type].call(this, event); }
        });
    }
    const canvas = elements.get('gameCanvas');
    Object.assign(canvas, {
        width: 800, height: 600,
        offsetWidth: 804, offsetHeight: 604,
        clientWidth: 800, clientHeight: 600, clientLeft: 2, clientTop: 2,
        rect: { left: 100, top: 50, width: 804, height: 604 },
        getBoundingClientRect() { return this.rect; },
        getContext: () => ({
            clearRect() { fills.length = 0; },
            fillRect(...args) { fills.push(args); }
        })
    });
    const document = {
        listeners: {},
        activeElement: null,
        getElementById(id) {
            assert.ok(elements.has(id), `Missing HTML element: ${id}`);
            return elements.get(id);
        },
        querySelectorAll: () => [],
        addEventListener(type, listener) { this.listeners[type] = listener; }
    };
    const context = vm.createContext({
        document,
        requestAnimationFrame() { frames++; }
    });
    const run = code => vm.runInContext(code, context);
    vm.runInContext(source, context);
    const slider = elements.get('brushSizeSlider');
    return {
        run, canvas, fills, elements, frames: () => frames,
        size(value) { slider.value = String(value); slider.dispatch('input'); },
        keydown(code) {
            document.listeners.keydown({
                code,
                preventDefault() { this.prevented = true; }
            });
        },
        point(x, y) {
            const sx = canvas.rect.width / canvas.offsetWidth;
            const sy = canvas.rect.height / canvas.offsetHeight;
            return {
                button: 0,
                clientX: canvas.rect.left + (canvas.clientLeft + (x + 0.5) * 5 * canvas.clientWidth / 800) * sx,
                clientY: canvas.rect.top + (canvas.clientTop + (y + 0.5) * 5 * canvas.clientHeight / 600) * sy
            };
        }
    };
}

function assertBoundary(s) {
    assert.equal(s.run(`grid.every((row, y) => row.every((cell, x) =>
        (x !== 0 && x !== GRID_WIDTH - 1 && y !== 0 && y !== GRID_HEIGHT - 1)
        || cell === MATERIALS.BEDROCK))`), true);
}

test('startup renders a fixed 160 by 120 grid and schedules animation', () => {
    const s = simulator();
    assert.equal(s.frames(), 1);
    assert.equal(s.run('CELL_SIZE === 5 && GRID_WIDTH === 160 && GRID_HEIGHT === 120'), true);
    assert.ok(s.fills.some(rect => rect.join() === '795,595,5,5'));
    assertBoundary(s);
});

test('all material buttons paint visibly at the pointer', () => {
    const s = simulator();
    for (const name of ['sand', 'water', 'acid', 'lava', 'wall']) {
        s.run('resetGrid()');
        s.elements.get(`${name}Btn`).dispatch('click');
        s.canvas.dispatch('mousedown', s.point(30, 40));
        s.canvas.dispatch('mouseup');
        assert.equal(s.run(`grid[40][30] === MATERIALS.${name.toUpperCase()}`), true);
        assert.ok(s.fills.some(rect => rect.join() === '150,200,5,5'));
    }
});

test('slider extremes change only new brush footprints', () => {
    const s = simulator();
    for (const size of [1, 2, 5, 20]) {
        s.run('resetGrid()');
        s.size(size);
        s.canvas.dispatch('mousedown', s.point(30, 40));
        s.canvas.dispatch('mouseup');
        assert.equal(s.run('grid.flat().filter(cell => cell === MATERIALS.SAND).length'), size * size);
        const before = s.run('JSON.stringify(grid)');
        s.size(size === 20 ? 1 : 20);
        assert.equal(s.run('JSON.stringify(grid)'), before);
        assert.equal(s.run('CELL_SIZE === 5 && GRID_WIDTH === 160 && GRID_HEIGHT === 120'), true);
        assert.equal(s.canvas.width, 800);
        assert.equal(s.canvas.height, 600);
        assertBoundary(s);
    }
});

test('pointer conversion handles borders, CSS resizing and scaled display', () => {
    const s = simulator();
    for (const factor of [0.5, 1, 2]) {
        s.canvas.rect.width = 804 * factor;
        s.canvas.rect.height = 604 * factor;
        for (const [x, y] of [[0, 0], [1, 1], [79, 59], [158, 118], [159, 119]]) {
            s.contextEvent = s.point(x, y);
            const result = s.run(`pointerToCell(${JSON.stringify(s.contextEvent)})`);
            assert.equal(result.x, x);
            assert.equal(result.y, y);
        }
    }
    Object.assign(s.canvas, { offsetWidth: 404, offsetHeight: 304, clientWidth: 400, clientHeight: 300 });
    s.canvas.rect.width = 404;
    s.canvas.rect.height = 304;
    s.canvas.dispatch('mousedown', s.point(158, 118));
    assert.equal(s.run('grid[118][158] === MATERIALS.SAND'), true);
});

test('fast painting and erasing drags have no gaps; eraser preserves walls', () => {
    const s = simulator();
    s.canvas.dispatch('mousedown', s.point(20, 30));
    s.canvas.dispatch('mousemove', s.point(40, 30));
    s.canvas.dispatch('mouseup');
    assert.equal(s.run('grid[30].slice(20, 41).every(cell => cell === MATERIALS.SAND)'), true);
    s.run('grid[30][25] = MATERIALS.WALL');
    s.elements.get('eraserBtn').dispatch('click');
    s.canvas.dispatch('mousedown', s.point(20, 30));
    s.canvas.dispatch('mousemove', s.point(40, 30));
    s.canvas.dispatch('mouseup');
    assert.equal(s.run('grid[30].slice(20, 41).every((cell, i) => cell === (i === 5 ? MATERIALS.WALL : MATERIALS.EMPTY))'), true);
});

test('large brushes, erasing and resetting preserve the entire rim', () => {
    const s = simulator();
    s.size(20);
    for (const material of ['sand', 'eraser']) {
        s.elements.get(`${material}Btn`).dispatch('click');
        for (const [x, y] of [[0, 0], [159, 119], [0, 60], [159, 60], [80, 0], [80, 119]]) {
            s.canvas.dispatch('mousedown', s.point(x, y));
            s.canvas.dispatch('mouseup');
            assertBoundary(s);
        }
    }
    s.run('grid[50][50] = MATERIALS.WALL');
    s.elements.get('resetBtn').dispatch('click');
    assert.equal(s.run('grid[50][50] === MATERIALS.EMPTY'), true);
    assertBoundary(s);
});

test('acid puddles on flat ground level off instead of piling into mountains', () => {
    const s = simulator();
    s.run(`resetGrid();
    for (let x = 75; x <= 79; x++) {
        for (let y = 110; y <= 118; y++) grid[y][x] = MATERIALS.ACID;
    }`);
    // The 45-cell mound starts 5 wide and 9 tall on the floor.
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.ACID).length'), 45);
    s.run('for (let tick = 0; tick < 1000; tick++) updateGrid();');
    const after = s.run(`(() => {
        let min = Infinity, max = -Infinity, maxH = 0, count = 0;
        for (let x = 1; x < GRID_WIDTH - 1; x++) {
            if (grid[118][x] === MATERIALS.ACID) { min = Math.min(min, x); max = Math.max(max, x); }
            let h = 0;
            for (let y = 1; y < GRID_HEIGHT - 1; y++)
                if (grid[y][x] === MATERIALS.ACID) { h++; count++; }
            maxH = Math.max(maxH, h);
        }
        return { min, max, maxH, count };
    })()`);
    // All acid survives, spreads well beyond its original footprint,
    // and flattens into a shallow pool instead of a 9-tall mountain.
    assert.equal(after.count, 45);
    assert.ok(after.max - after.min > 30, `expected spread, got ${after.max - after.min}`);
    assert.ok(after.maxH <= 2, `expected a shallow pool, got height ${after.maxH}`);
    assertBoundary(s);
});

test('pause button freezes physics and toggles its own label', () => {
    const s = simulator();
    const btn = s.elements.get('pauseBtn');
    assert.ok(/id="pauseBtn"[^>]*>Pause</.test(html), 'initial button label must be Pause');
    btn.textContent = 'Pause';
    assert.equal(s.run('paused'), false);

    // Drop sand in mid-air, pause, and verify a game frame leaves it be.
    s.run('resetGrid(); grid[40][30] = MATERIALS.SAND;');
    btn.dispatch('click');
    assert.equal(s.run('paused'), true);
    assert.equal(btn.textContent, 'Play');
    s.run('gameLoop()');
    assert.equal(s.run('grid[40][30] === MATERIALS.SAND && grid[41][30] === MATERIALS.EMPTY'), true);

    // Resume: the same frame now steps the physics again.
    btn.dispatch('click');
    assert.equal(s.run('paused'), false);
    assert.equal(btn.textContent, 'Pause');
    s.run('gameLoop()');
    assert.equal(s.run('grid[41][30] === MATERIALS.SAND'), true);
});

test('spacebar toggles pause and play like the toolbar button', () => {
    const s = simulator();
    s.run('resetGrid(); grid[40][30] = MATERIALS.SAND;');

    // Space pauses: physics freezes and the button flips to Play.
    s.keydown('Space');
    assert.equal(s.run('paused'), true);
    assert.equal(s.elements.get('pauseBtn').textContent, 'Play');
    s.run('gameLoop()');
    assert.equal(s.run('grid[40][30] === MATERIALS.SAND'), true);

    // Space resumes: physics runs again and the button flips to Pause.
    s.keydown('Space');
    assert.equal(s.run('paused'), false);
    assert.equal(s.elements.get('pauseBtn').textContent, 'Pause');
    s.run('gameLoop()');
    assert.equal(s.run('grid[41][30] === MATERIALS.SAND'), true);

    // Other keys are ignored and must not change the pause state.
    s.keydown('KeyP');
    assert.equal(s.run('paused'), false);
});

test('R key resets the grid like the toolbar button', () => {
    const s = simulator();
    s.run('resetGrid(); grid[40][30] = MATERIALS.SAND; grid[41][30] = MATERIALS.WALL;');

    // R clears the interior to empty (walls included) and keeps the rim.
    s.keydown('KeyR');
    assert.equal(s.run('grid[40][30] === MATERIALS.EMPTY && grid[41][30] === MATERIALS.EMPTY'), true);
    s.run(`grid[50][50] = MATERIALS.WALL`);
    s.keydown('KeyR');
    assert.equal(s.run('grid[50][50] === MATERIALS.EMPTY'), true);
    assertBoundary(s);

    // R must not touch the pause state.
    assert.equal(s.run('paused'), false);
});

test('lava slowly melts adjacent sand, one cell at a time', () => {
    const s = simulator();
    // Lava sits on the bedrock floor with sand to its left, right and above,
    // so the lava cell itself can never move.
    s.run(`resetGrid();
    grid[118][40] = MATERIALS.LAVA;
    grid[117][40] = MATERIALS.SAND;
    grid[118][39] = MATERIALS.SAND;
    grid[118][41] = MATERIALS.SAND;`);

    // Rollover chance 0.99 (> LAVA_MELT_SAND_CHANCE): no sand may vanish,
    // which is what makes the melt slow instead of instant.
    s.run('Math.random = () => 0.99');
    for (let tick = 0; tick < 50; tick++) s.run('updateGrid()');
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.SAND).length'), 3);
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.LAVA).length'), 1);

    // Rollover chance 0.01 (< LAVA_MELT_SAND_CHANCE): every touching sand
    // cell vanishes in a single tick, and the lava itself survives.
    s.run('Math.random = () => 0.01');
    s.run('updateGrid()');
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.SAND).length'), 0);
    assert.equal(s.run('grid[118][40] === MATERIALS.LAVA'), true);
});

test('a sand wall above a lava floor fully melts away given enough ticks', () => {
    const s = simulator();
    s.run(`resetGrid();
    for (let y = 115; y < GRID_HEIGHT - 1; y++)
        for (let x = 1; x < GRID_WIDTH - 1; x++)
            grid[y][x] = MATERIALS.LAVA;
    for (let x = 30; x < 60; x++) {
        grid[114][x] = MATERIALS.SAND;
        grid[113][x] = MATERIALS.SAND;
    }
    for (let tick = 0; tick < 200; tick++) updateGrid();`);
    // The lava floor is completely full, so it can never move and the sand
    // stays glued to it; each sand cell faces a 5% melt chance per tick,
    // so all 60 cells are gone after 200 ticks while the floor remains.
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.SAND).length'), 0);
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.LAVA).length'), s.run('(GRID_WIDTH - 2) * 4'));
    assertBoundary(s);
});

test('acid touching water dyes it aqua and dissolves itself', () => {
    const s = simulator();
    // Water pools on the bedrock floor; acid lands on top of it.
    s.run(`resetGrid();
    for (let x = 40; x < 50; x++) grid[118][x] = MATERIALS.WATER;
    grid[117][45] = MATERIALS.ACID;`);
    s.run('Math.random = () => 0.99');
    s.run('updateGrid()');
    // The acid cell vanished (as it always does on water contact) and the
    // water cell directly below it is now aqua; diagonal water is not
    // "touching" and stays blue.
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.ACID).length'), 0);
    assert.equal(s.run('grid[118][45] === MATERIALS.AQUA_WATER'), true);
    assert.equal(s.run('grid[118][44] === MATERIALS.WATER && grid[118][46] === MATERIALS.WATER'), true);
});

test('aqua water flows like water and lava still boils it', () => {
    const s = simulator();
    // Pinned random below the 0.5 flow threshold so water never chooses a
    // sideways flow; it only falls.
    s.run(`resetGrid();
    grid[40][30] = MATERIALS.AQUA_WATER;
    Math.random = () => 0.49;`);
    s.run('for (let tick = 0; tick < 80; tick++) updateGrid()');
    // The single aqua cell fell to the floor keeping its aqua type.
    assert.equal(s.run('grid[118][30] === MATERIALS.AQUA_WATER'), true);
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.AQUA_WATER).length'), 1);

    // Lava on top of it boils it away like regular water.
    s.run('grid[117][30] = MATERIALS.LAVA; Math.random = () => 0.5; updateGrid()');
    assert.equal(s.run('grid.flat().filter(c => c === MATERIALS.AQUA_WATER).length'), 0);
    assert.equal(s.run('grid[117][30] === MATERIALS.LAVA'), true);
});

test('acid cannot dissolve bedrock below or on either side, but still dissolves walls', () => {
    const s = simulator();
    s.run(`for (let y = 1; y < GRID_HEIGHT - 1; y++) {
        for (let x = 1; x < GRID_WIDTH - 1; x++) grid[y][x] = MATERIALS.ACID;
    }
    for (let tick = 0; tick < 10; tick++) updateGrid();`);
    assertBoundary(s);
    assert.equal(s.run('grid[118][1] === MATERIALS.ACID && grid[118][158] === MATERIALS.ACID'), true);
    s.run('resetGrid(); grid[118][50] = MATERIALS.WALL; grid[117][50] = MATERIALS.ACID; updateGrid()');
    assert.equal(s.run('grid[118][50] === MATERIALS.EMPTY && grid[117][50] === MATERIALS.EMPTY'), true);
    assertBoundary(s);
});
