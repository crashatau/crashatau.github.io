// Physics Simulator Implementation

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const CELL_SIZE = 5;

// Brush width in grid cells; changing it never resizes the world.
let brushSize = 1;

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
    BEDROCK: 8
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
    [MATERIALS.BEDROCK]: '#404040' // Dark gray for bedrock
};

// Grid to store materials
let grid = [];
let GRID_WIDTH = 0;
let GRID_HEIGHT = 0;

// Current selected material
let currentMaterial = MATERIALS.SAND;

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
    document.getElementById('clearBtn').addEventListener('click', clearGrid);
    document.getElementById('resetBtn').addEventListener('click', resetGrid);
    
    const brushSizeSlider = document.getElementById('brushSizeSlider');
    const brushSizeValue = document.getElementById('brushSizeValue');

    brushSizeSlider.addEventListener('input', function() {
        brushSize = Number(this.value);
        brushSizeValue.textContent = brushSize;
    });
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

// Clearing and resetting both restore the empty interior and fixed bedrock rim.
function clearGrid() {
    resetGrid();
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
            else if (cell === MATERIALS.WATER) {
                // Try to fall down
                if (grid[y + 1][x] === MATERIALS.EMPTY) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y + 1][x] = MATERIALS.WATER;
                }
                // Try to flow left or right
                else if (grid[y][x - 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x - 1] = MATERIALS.WATER;
                }
                else if (grid[y][x + 1] === MATERIALS.EMPTY && Math.random() > 0.5) {
                    grid[y][x] = MATERIALS.EMPTY;
                    grid[y][x + 1] = MATERIALS.WATER;
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
                // Dissolve when touching water
                else if (grid[y][x - 1] === MATERIALS.WATER || 
                         grid[y][x + 1] === MATERIALS.WATER || 
                         grid[y + 1][x] === MATERIALS.WATER) {
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
                else if (grid[y - 1][x] === MATERIALS.WATER) {
                    grid[y - 1][x] = MATERIALS.EMPTY;
                }
                else if (grid[y + 1][x] === MATERIALS.WATER) {
                    grid[y + 1][x] = MATERIALS.EMPTY;
                }
                else if (grid[y][x - 1] === MATERIALS.WATER) {
                    grid[y][x - 1] = MATERIALS.EMPTY;
                }
                else if (grid[y][x + 1] === MATERIALS.WATER) {
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
    updateGrid();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
init();
gameLoop();