// Physics Simulator Implementation

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const CELL_SIZE = 5;

// Brush width in grid cells; changing it never resizes the world.
let brushSize = 1;
const BRUSH_SIZE_MAX = 15;

// Materials
const MATERIALS = {
    EMPTY: 0,
    SAND: 1,
    WATER: 2,
    ACID: 3,
    WALL: 4,
    DARK_SAND: 5,
    LAVA: 6,
    ERASER: 7,
    BEDROCK: 8,
    AQUA_WATER: 9
};

// Material colors
const COLORS = {
    [MATERIALS.EMPTY]: '#e0e0e0',
    [MATERIALS.SAND]: '#f4a460',
    [MATERIALS.WATER]: '#1e90ff',
    [MATERIALS.ACID]: '#32cd32',
    [MATERIALS.WALL]: '#808080',
    [MATERIALS.DARK_SAND]: '#a0522d',
    [MATERIALS.LAVA]: '#ff4500',
    [MATERIALS.ERASER]: '#ffffff', // White for eraser (invisible or just a placeholder)
    [MATERIALS.BEDROCK]: '#404040', // Dark gray for bedrock
    [MATERIALS.AQUA_WATER]: '#00ffff' // Aqua for acid-touched water
};

// Grid to store materials
let grid = [];
let GRID_WIDTH = 0;
let GRID_HEIGHT = 0;

// Current selected material
let currentMaterial = MATERIALS.SAND;

// Whether physics updates are frozen; drawing keeps going so the
// canvas always reflects the current grid state.
let paused = false;

// Mouse state
let isMouseDown = false;
let lastX = 0;
let lastY = 0;

// Initialize the game
function init() {
    // Set initial grid dimensions based on canvas size
    GRID_WIDTH = Math.floor(canvas.width / CELL_SIZE);
    GRID_HEIGHT = Math.floor(canvas.height / CELL_SIZE);
    
    // Initialize grid with empty cells
    grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(MATERIALS.EMPTY));
    
    setupEventListeners();
    resetGrid();
    draw();
    updateToolbar();
}

// Setup event listeners
function setupEventListeners() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    document.getElementById('sandBtn').addEventListener('click', () => selectMaterial(MATERIALS.SAND));
    document.getElementById('waterBtn').addEventListener('click', () => selectMaterial(MATERIALS.WATER));
    document.getElementById('acidBtn').addEventListener('click', () => selectMaterial(MATERIALS.ACID));
    document.getElementById('lavaBtn').addEventListener('click', () => selectMaterial(MATERIALS.LAVA));
    document.getElementById('wallBtn').addEventListener('click', () => selectMaterial(MATERIALS.WALL));
    document.getElementById('eraserBtn').addEventListener('click', () => selectMaterial(MATERIALS.ERASER));
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resetBtn').addEventListener('click', resetGrid);
    
    const brushSizeSlider = document.getElementById('brushSizeSlider');
    const brushSizeValue = document.getElementById('brushSizeValue');

    brushSizeSlider.addEventListener('input', function() {
        brushSize = Math.min(BRUSH_SIZE_MAX, Math.max(1, Number(this.value)));
        brushSizeValue.textContent = brushSize;
    });

    document.addEventListener('keydown', handleKeyDown);
}

// Spacebar toggles pause and R resets, same as the toolbar buttons.
function handleKeyDown(e) {
    if (e.code !== 'Space' && e.code !== 'KeyR') return;
    e.preventDefault();
    // A focused button would fire its own click on keyup and double-act;
    // drop focus first so the hotkey is the only thing that acts.
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
    if (e.code === 'Space') {
        togglePause();
    } else {
        resetGrid();
    }
}

// Map the canvas content box to the fixed simulation grid, including CSS scaling.
function pointerToCell(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.offsetWidth;
    const scaleY = rect.height / canvas.offsetHeight;
    const pixelX = (e.clientX - rect.left - canvas.clientLeft * scaleX)
        * canvas.width / (canvas.clientWidth * scaleX);
    const pixelY = (e.clientY - rect.top - canvas.clientTop * scaleY)
        * canvas.height / (canvas.clientHeight * scaleY);
    return { x: Math.floor(pixelX / CELL_SIZE), y: Math.floor(pixelY / CELL_SIZE) };
}

// Handle mouse down event
function handleMouseDown(e) {
    if (e.button !== 0) return;
    const { x, y } = pointerToCell(e);
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;
    isMouseDown = true;
    lastX = x;
    lastY = y;
    paint(x, y);
    draw();
}

// Interpolate both painting and erasing so fast drags don't leave gaps.
function handleMouseMove(e) {
    if (!isMouseDown) return;
    const { x, y } = pointerToCell(e);
    drawLine(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    draw();
}

// Handle mouse up event
function handleMouseUp() {
    isMouseDown = false;
}

// Draw a line between two points
function drawLine(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;
    
    let x = x1;
    let y = y1;
    
    while (true) {
        paint(x, y);
        
        if (x === x2 && y === y2) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}

// Apply a square brush, clipped to the interior. Even widths extend one extra
// cell to the right/bottom, keeping the footprint exactly brushSize cells wide.
function paint(x, y) {
    const start = -Math.floor((brushSize - 1) / 2);
    for (let dy = start; dy < start + brushSize; dy++) {
        for (let dx = start; dx < start + brushSize; dx++) {
            const targetX = x + dx;
            const targetY = y + dy;
            if (targetX <= 0 || targetX >= GRID_WIDTH - 1 ||
                targetY <= 0 || targetY >= GRID_HEIGHT - 1) continue;
            const material = grid[targetY][targetX];
            if (material === MATERIALS.BEDROCK) continue;
            if (currentMaterial === MATERIALS.ERASER) {
                // Preserve the existing rule that the eraser cannot remove walls.
                if (material !== MATERIALS.WALL) grid[targetY][targetX] = MATERIALS.EMPTY;
            } else {
                grid[targetY][targetX] = currentMaterial;
            }
        }
    }
}

// Reset the grid to initial state
function resetGrid() {
    // Initialize with a border of bedrock (immutable boundary)
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                grid[y][x] = MATERIALS.BEDROCK;
            } else {
                grid[y][x] = MATERIALS.EMPTY;
            }
        }
    }
    draw();
}

// Update the toolbar to show active material
function updateToolbar() {
    // Remove active class from all buttons
    document.querySelectorAll('.material-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to current material button
    const btnId = Object.keys(MATERIALS).find(key => MATERIALS[key] === currentMaterial);
    if (btnId) {
        document.getElementById(`${btnId.toLowerCase()}Btn`).classList.add('active');
    }
}

// Select a material
function selectMaterial(material) {
    currentMaterial = material;
    updateToolbar();
}

// Acid spreads much slower than water (which uses a flat 50% chance per tick).
// Its chance scales with the acid piled directly above this cell, so a thin
// line barely creeps while a deep pool pours out and levels off.
function acidFlowChance(y, x) {
    let depth = 0;
    for (let yy = y - 1; yy > 0 && grid[yy][x] === MATERIALS.ACID; yy--) depth++;
    return Math.min(0.4, 0.1 + 0.1 * depth);
}

// Lava slowly melts sand it touches: each sand cell adjacent to this lava
// cell has a small independent chance to disappear per tick, so piles erode
// cell by cell instead of vanishing all at once.
const LAVA_MELT_SAND_CHANCE = 0.05;
function lavaMeltAdjacentSand(y, x) {
    for (const [ny, nx] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) {
        if (grid[ny][nx] === MATERIALS.SAND && Math.random() < LAVA_MELT_SAND_CHANCE) {
            grid[ny][nx] = MATERIALS.EMPTY;
        }
    }
}

// Toggle the pause state; the button always labels the action it performs.
function togglePause() {
    paused = !paused;
    document.getElementById('pauseBtn').textContent = paused ? 'Play' : 'Pause';
}

// Update the grid based on physics rules
function updateGrid() {
    // Process from bottom to top for sand and water to fall properly
    for (let y = GRID_HEIGHT - 2; y > 0; y--) {
        for (let x = 1; x < GRID_WIDTH - 1; x++) {
            const cell = grid[y][x];
            
            // Sand physics
            if (cell === MATERIALS.SAND) {
                // Try to fall down
                if (grid[y + 1][x] === MATERIALS.EMPTY) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x] = MATERIALS.SAND;
                }
                // Try to fall diagonally left or right
                else if (grid[y + 1][x - 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x - 1] = MATERIALS.SAND;
                }
                else if (grid[y + 1][x + 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x + 1] = MATERIALS.SAND;
                }
                // If blocked by a wall or bedrock, try to slide down
                else if (grid[y + 1][x] === MATERIALS.WALL || 
                         grid[y + 1][x] === MATERIALS.BEDROCK ||
                         grid[y + 1][x - 1] === MATERIALS.WALL || 
                         grid[y + 1][x - 1] === MATERIALS.BEDROCK ||
                         grid[y + 1][x + 1] === MATERIALS.WALL || 
                         grid[y + 1][x + 1] === MATERIALS.BEDROCK) {
                    // Slide left or right depending on which side is free
                    if (grid[y][x - 1] === MATERIALS.EMPTY && grid[y + 1][x - 1] !== MATERIALS.WALL && grid[y + 1][x - 1] !== MATERIALS.BEDROCK) {
                        grid[y][x] = MATERIALS.EMPTY;
                        grid[y][x - 1] = MATERIALS.SAND;
                    }
                    else if (grid[y][x + 1] === MATERIALS.EMPTY && grid[y + 1][x + 1] !== MATERIALS.WALL && grid[y + 1][x + 1] !== MATERIALS.BEDROCK) {
                        grid[y][x] = MATERIALS.EMPTY;
                        grid[y][x + 1] = MATERIALS.SAND;
                    }
                }
            }
            
            // Water physics
            else if (cell === MATERIALS.WATER || cell === MATERIALS.AQUA_WATER) {
                // Moving water keeps its own type, so acid-touched (aqua)
                // water stays aqua as it flows.
                const waterType = cell;
                // Try to fall down
                if (grid[y + 1][x] === MATERIALS.EMPTY) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x] = waterType;
                }
                // Try to flow left or right
                else if (grid[y][x - 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x - 1] = waterType;
                }
                else if (grid[y][x + 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x + 1] = waterType;
                }
                // Check if water touches sand and turns it dark
                else if (grid[y - 1][x] === MATERIALS.SAND || 
                         grid[y + 1][x] === MATERIALS.SAND || 
                         grid[y][x - 1] === MATERIALS.SAND || 
                         grid[y][x + 1] === MATERIALS.SAND) {
                    // Turn adjacent sand to dark sand
                    if (grid[y - 1][x] === MATERIALS.SAND) grid[y - 1][x] = MATERIALS.DARK_SAND;
                    if (grid[y + 1][x] === MATERIALS.SAND) grid[y + 1][x] = MATERIALS.DARK_SAND;
                    if (grid[y][x - 1] === MATERIALS.SAND) grid[y][x - 1] = MATERIALS.DARK_SAND;
                    if (grid[y][x + 1] === MATERIALS.SAND) grid[y][x + 1] = MATERIALS.DARK_SAND;
                }
            }
            
            // Acid physics
            else if (cell === MATERIALS.ACID) {
                // Try to fall down
                if (grid[y + 1][x] === MATERIALS.EMPTY) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x] = MATERIALS.ACID;
                }
                // Dissolve sand or walls
                else if (grid[y + 1][x] === MATERIALS.SAND || grid[y + 1][x] === MATERIALS.WALL) {
                    grid[y + 1][x] = MATERIALS.EMPTY;
                    grid[y][x] = MATERIALS.EMPTY;
                }
                // Dissolve dark sand or walls
                else if (grid[y + 1][x] === MATERIALS.DARK_SAND || grid[y + 1][x] === MATERIALS.WALL) {
                    grid[y + 1][x] = MATERIALS.EMPTY;
                    grid[y][x] = MATERIALS.EMPTY;
                }
                // Try to flow left or right
                else if (grid[y][x - 1] === MATERIALS.SAND || grid[y][x - 1] === MATERIALS.WALL) {
                    grid[y][x - 1] = MATERIALS.EMPTY;
                    grid[y][x] = MATERIALS.EMPTY;
                }
                else if (grid[y][x + 1] === MATERIALS.SAND || grid[y][x + 1] === MATERIALS.WALL) {
                    grid[y][x + 1] = MATERIALS.EMPTY;
                    grid[y][x] = MATERIALS.EMPTY;
                }
                // Spread sideways into empty space, slower than water and
                // scaled by pile depth, so mounds drain out and level off
                // instead of freezing in place.
                else if (grid[y][x - 1] === MATERIALS.EMPTY && Math.random() < acidFlowChance(y, x)) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x - 1] = MATERIALS.ACID;
                }
                else if (grid[y][x + 1] === MATERIALS.EMPTY && Math.random() < acidFlowChance(y, x)) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x + 1] = MATERIALS.ACID;
                }
                // Dissolve when touching water, leaving aqua-coloured water
                // behind. Already-aqua water still consumes the acid.
                else if (grid[y][x - 1] === MATERIALS.WATER || grid[y][x - 1] === MATERIALS.AQUA_WATER ||
                         grid[y][x + 1] === MATERIALS.WATER || grid[y][x + 1] === MATERIALS.AQUA_WATER ||
                         grid[y + 1][x] === MATERIALS.WATER || grid[y + 1][x] === MATERIALS.AQUA_WATER) {
                    if (grid[y][x - 1] === MATERIALS.WATER) grid[y][x - 1] = MATERIALS.AQUA_WATER;
                    if (grid[y][x + 1] === MATERIALS.WATER) grid[y][x + 1] = MATERIALS.AQUA_WATER;
                    if (grid[y + 1][x] === MATERIALS.WATER) grid[y + 1][x] = MATERIALS.AQUA_WATER;
                    grid[y][x] = MATERIALS.EMPTY;
                }
                // Annihilate when touching lava
                else if (grid[y - 1][x] === MATERIALS.LAVA || 
                         grid[y + 1][x] === MATERIALS.LAVA || 
                         grid[y][x - 1] === MATERIALS.LAVA || 
                         grid[y][x + 1] === MATERIALS.LAVA) {
                    grid[y][x] = MATERIALS.EMPTY;
                    if (grid[y - 1][x] === MATERIALS.LAVA) grid[y - 1][x] = MATERIALS.EMPTY;
                    if (grid[y + 1][x] === MATERIALS.LAVA) grid[y + 1][x] = MATERIALS.EMPTY;
                    if (grid[y][x - 1] === MATERIALS.LAVA) grid[y][x - 1] = MATERIALS.EMPTY;
                    if (grid[y][x + 1] === MATERIALS.LAVA) grid[y][x + 1] = MATERIALS.EMPTY;
                }
            }
            
            // Lava physics
            else if (cell === MATERIALS.LAVA) {
                // Contact melting happens regardless of whether this lava
                // cell moves this tick.
                lavaMeltAdjacentSand(y, x);
                // Try to fall down
                if (grid[y + 1][x] === MATERIALS.EMPTY) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x] = MATERIALS.LAVA;
                }
                // Try to flow left or right
                else if (grid[y][x - 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x - 1] = MATERIALS.LAVA;
                }
                else if (grid[y][x + 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x + 1] = MATERIALS.LAVA;
                }
                // Melt wet sand into regular sand
                else if (grid[y - 1][x] === MATERIALS.DARK_SAND) {
                    grid[y - 1][x] = MATERIALS.SAND;
                }
                else if (grid[y + 1][x] === MATERIALS.DARK_SAND) {
                    grid[y + 1][x] = MATERIALS.SAND;
                }
                else if (grid[y][x - 1] === MATERIALS.DARK_SAND) {
                    grid[y][x - 1] = MATERIALS.SAND;
                }
                else if (grid[y][x + 1] === MATERIALS.DARK_SAND) {
                    grid[y][x + 1] = MATERIALS.SAND;
                }
                // Melt water into steam (remove it)
                else if (grid[y - 1][x] === MATERIALS.WATER || grid[y - 1][x] === MATERIALS.AQUA_WATER) {
                    grid[y - 1][x] = MATERIALS.EMPTY;
                }
                else if (grid[y + 1][x] === MATERIALS.WATER || grid[y + 1][x] === MATERIALS.AQUA_WATER) {
                    grid[y + 1][x] = MATERIALS.EMPTY;
                }
                else if (grid[y][x - 1] === MATERIALS.WATER || grid[y][x - 1] === MATERIALS.AQUA_WATER) {
                    grid[y][x - 1] = MATERIALS.EMPTY;
                }
                else if (grid[y][x + 1] === MATERIALS.WATER || grid[y][x + 1] === MATERIALS.AQUA_WATER) {
                    grid[y][x + 1] = MATERIALS.EMPTY;
                }
                // Annihilate when touching acid
                else if (grid[y - 1][x] === MATERIALS.ACID || 
                         grid[y + 1][x] === MATERIALS.ACID || 
                         grid[y][x - 1] === MATERIALS.ACID || 
                         grid[y][x + 1] === MATERIALS.ACID) {
                    grid[y][x] = MATERIALS.EMPTY;
                    if (grid[y - 1][x] === MATERIALS.ACID) grid[y - 1][x] = MATERIALS.EMPTY;
                    if (grid[y + 1][x] === MATERIALS.ACID) grid[y + 1][x] = MATERIALS.EMPTY;
                    if (grid[y][x - 1] === MATERIALS.ACID) grid[y][x - 1] = MATERIALS.EMPTY;
                    if (grid[y][x + 1] === MATERIALS.ACID) grid[y][x + 1] = MATERIALS.EMPTY;
                }
            }
        }
    }
}

// Draw the grid
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const material = grid[y][x];
            if (material !== MATERIALS.EMPTY) {
                ctx.fillStyle = COLORS[material];
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
}

// Game loop
function gameLoop() {
    if (!paused) updateGrid();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
init();
gameLoop();