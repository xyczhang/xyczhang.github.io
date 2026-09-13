# Crossy Road Game

Crossy Road is a replica of the original Crossy Road game. Crossy Road is a single-player game where players can move a chicken through either arrow keys or WASD to cross the roads and rivers. Along the way, they will encounter different obstacles the chicken must avoid or jump over. 

## Crossy Road vs Crossy Road

My Crossy Road is a much simpler version of the real Crossy Road, with less animations and easter egg features. Also, my version is full screen. 

## Game Controls

- Players can use WASD or arrow keys to move the chicken
- The chicken will die if hit by a vehicle, touches water, or is eaten up by the frame (if the player doesn't move in too long of a period)
- The player earns one point for each row crossed and points reset once the chicken dies

## AI Usage

I used Claude Sonnet 4.5 that is built into Kiro for most of the project, and cleaned up the animations and lag with Gemini. Claude built most of the actual functions and logistics of the game, and Gemini was only used for minor edits. I moved the files from Kiro to VSCode to sync with Github once I was done.

My main strategy was to first make sure the game was working properly movement and score wise, and then focus on the aesthetics. Being specific with what I wanted design wise and how the game should work was most effective.

## Areas to Improve

Adding details like the flattening motion when the chicken dies and the coins in the mobile Crossy Road would make the game more complete. The animation still looks a little weird so cleaning that up would overall make the game more sophisticated.
