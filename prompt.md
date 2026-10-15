# Physics Simulator Game Prompt

Create a 2D physics simulator game with HTML and JavaScript that includes:

## Requirements:
- Physics simulator with a square boundary as the physics border
- Four materials: Sand, Water, Acid, and Stone Wall
- Each material behaves as expected in physics within the boundary:
  - Gravity works from top to bottom
  - Walls may be suspended vertically or horizontally in the boundary
  - Water, acid, sand fall due to gravity
  - Water pools at the bottom of the boundary, on walls and sand
  - Acid eats through sand and stone walls, but dissolves in water
- Game is 2D vertical with simple graphics
- Include ability to select materials with a menu using buttons
- Menu to the right on the boundary
- Mouse may be used to paint the materials inside the boundary

## Implementation Details:
- Use HTML, CSS, and JavaScript
- Create a grid-based system for material placement
- Implement physics rules for each material type
- Add visual representation of materials with distinct colors
- Include toolbar with material selection buttons
- Enable mouse painting functionality
- Ensure proper interaction between materials based on physics principles

## Technical Specifications:
- Canvas-based rendering
- Grid system with configurable cell size
- Material types with unique behaviors
- Physics simulation loop
- Responsive UI with clear visual feedback