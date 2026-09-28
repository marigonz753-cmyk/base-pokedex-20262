# PokeSearch — Condensed Build Summary

PokeSearch began as a pixel-art Pokémon search interface featuring a trainer riding a bike through a scrolling background, a **PokeSearch** wordmark, and a rounded search bar connected to PokéAPI.

## 1. Initial Search Interface

The first version was a single self-contained `pokesearch.html` file with:

- Pixel-art search field and autocomplete.
- Full Pokémon name list loaded from PokéAPI.
- Keyboard navigation using **Arrow Keys, Enter, and Escape**.
- Empty slots for the scrolling background and trainer GIF.
- Searching for a Pokémon fetched its full API record and emitted a `pokesearch:found` event, without initially displaying results.

## 2. Scrolling Scene

A supplied pixel-art background was added and duplicated side-by-side to create a seamless scrolling effect.

Adjustable CSS variables control:

- `--bg-zoom` — scene zoom.
- `--bg-lift` — vertical positioning.
- `--bg-speed` — scrolling speed.

The direction was later reversed, with the search bar moved to the left and trainer to the right. Reduced-motion preferences are supported.

## 3. Encounter Screen

Searching successfully was changed from simply logging the Pokémon to triggering a Pokémon-style encounter.

The original walking scene is replaced by a static battlefield containing:

- Enemy HUD with Pokémon name, level, and HP.
- Two grass-patch image slots.
- Pokémon sprite automatically obtained from PokéAPI.
- `"Wild ___ appeared!"` dialogue.
- A Pokémon-style speech bubble/encounter effect.

The battlefield background, trainer still frame, and grass patches remain user-supplied assets.

Visual adjustments made the interface closer to classic Game Boy Pokémon screens:

- Larger grass patches.
- Larger dialogue box.
- Teal-grey dialogue styling with white text.
- Light-yellow enemy HUD.
- HUD resized to fit narrow screens.

## 4. React/TypeScript Development

A later development session substantially expanded the project and converted it from a single HTML page into a **React + TypeScript application**.

The encounter now progresses through states such as:

`search → found → sendout → menu → info/species/moves`

The application was eventually rebuilt using strict TypeScript, typed interfaces, functional components, hooks, and reusable data-driven sub-components.

Main components include:

- `EnemyHud`
- `BattleDialog`
- `CommandMenu`
- `MoveDetailsPanel`
- `SearchPanel`
- `ControlsWindow`
- `MovesGrid`

Keyboard handling is centralized and changes behavior according to the current phase.

## 5. Player Pokémon / Send-Out Sequence

After the encounter, the player can send out their own Pokémon.

Current documented behavior includes:

- A **Mightyena back sprite** sliding in from the left.
- `"Go, Mightyena!"` dialogue.
- Mightyena's own cry.
- Wild Pokémon cries automatically retrieved from PokéAPI.
- Legacy cries are preferred, with modern cries as fallback.

The send-out dialogue was extended to approximately **2.2 seconds**.

## 6. Battle Menu

After the initial encounter dialogue, a command menu appears with:

- **INFO**
- **SPECIES**
- **MOVES**
- **BACK**

The menu is navigated with arrow keys and selected with **Z**.

`BACK` returns to the search screen using a **0.2-second fade to black** and plays the escape sound.

A **CONTROLS** button was also added, displaying:

| Key | Function |
|---|---|
| Arrow Keys | Move cursor |
| Z | Select |
| X | Return |

The controls window can be closed with X, Escape, or an outside click.

## 7. INFO and SPECIES Screens

The **INFO** section displays Pokémon information in multiple pages:

- Height and weight.
- Base stats.

Text uses a typewriter-style reveal, with the animation completing quickly and pausing when the browser tab is hidden.

The **SPECIES** section additionally displays:

- Type.
- Abilities.
- Evolution-chain status.
- Generation of first appearance.

Unevolved Pokémon display `"NONE"` where appropriate.

## 8. MOVES Screen

The MOVES option was rebuilt into a **Generation 3-inspired interface**.

It contains:

- Four moves arranged in a **2×2 grid**.
- Arrow-key navigation.
- Move-type-colored borders.
- A right-side information panel showing:
  - PP
  - Move type
- Move information fetched dynamically from PokéAPI.

The moves screen is view-only.

A bug where the command menu remained visible after entering MOVES was also fixed.

## 9. Sprites and Audio

Wild Pokémon sprites now prioritize **Generation 3 artwork**, in this order:

1. Emerald
2. FireRed/LeafGreen
3. Ruby/Sapphire
4. Earliest available generation as fallback

Audio was expanded substantially:

- Battle music intro when an encounter begins.
- Seamless battle-music loop afterward.
- Battle music remains at **80% volume**.
- Confirm sound when advancing dialogue/selecting options.
- Escape sound when selecting BACK.
- Pokémon cries from PokéAPI.
- Mightyena has a local cry asset.

## 10. Current Asset Structure

The documented local assets are:

| File | Purpose |
|---|---|
| `background.jpg` | Scrolling walking background |
| `battle-bg.jpg` | Encounter background |
| `grass-top.png` | Upper grass patch |
| `grass-bottom.png` | Lower grass patch |
| `trainer.gif` | Animated trainer |
| `trainerstill.jpg` | Trainer's static frame |
| `mightyenaback.png` | Player Pokémon sprite |
| `MightyenaCry.mp3` | Mightyena's cry |
| `ConfirmSound.mp3` | Confirmation/dialogue sound |
| `Escape.mp3` | BACK sound |
| `BattleMusic.mp3` | Battle intro |
| `BattleMusicLoop.mp3` | Battle music loop |

Wild Pokémon sprites, cries, names, stats, species information, and moves are obtained dynamically from **PokéAPI**, so those do not need local assets.

## Current Overall Flow

**Search screen**  
→ Search Pokémon through PokéAPI  
→ Encounter animation/background  
→ Wild Pokémon + HUD + dialogue  
→ Player sends out Mightyena  
→ Battle command menu  
→ **INFO / SPECIES / MOVES / BACK**  
→ BACK fades to the search screen.

The project has therefore evolved from a simple Pokémon search bar into a **fully interactive, Gen 3-inspired Pokémon encounter interface built in React/TypeScript**, with dynamic PokéAPI data, menus, animations, sprites, sound, and multiple information screens.
