# PokeSearch — Build Summary

PokeSearch evolved from a pixel-art Pokémon search interface into a **React/TypeScript, Gen 3-inspired encounter interface** powered by PokéAPI.

## Core Interface

The original `pokesearch.html` included:

- Pixel-art search field/autocomplete.
- Pokémon names loaded from PokéAPI.
- Arrow-key, Enter, and Escape navigation.
- A scrolling pixel-art background with adjustable zoom, position, and speed.
- Trainer animation and reduced-motion support.

## Encounter System

Searching for a Pokémon now triggers a battle-style encounter with:

- Enemy HUD showing name, level, and HP.
- Pokémon sprite fetched from PokéAPI.
- Grass patches and battle background.
- `"Wild ___ appeared!"` dialogue and encounter effects.

The interface was visually adjusted toward classic Game Boy Pokémon styling, including larger grass/dialogue elements and redesigned HUD colors.

## React/TypeScript Architecture

The project was rebuilt as a React + TypeScript application using typed interfaces, hooks, functional components, and centralized keyboard handling.

Main components include:

`EnemyHud`, `BattleDialog`, `CommandMenu`, `MoveDetailsPanel`, `SearchPanel`, `ControlsWindow`, and `MovesGrid`.

Main flow:

`search → found → sendout → menu → info/species/moves`

## Player Pokémon & Menu

The send-out sequence features:

- Mightyena back sprite sliding in.
- `"Go, Mightyena!"` dialogue.
- Mightyena's cry.
- PokéAPI wild Pokémon cries, preferring legacy cries when available.
- ~2.2-second send-out dialogue.

The command menu contains:

**INFO / SPECIES / MOVES / BACK**

Navigation uses arrow keys and **Z**.

`BACK` uses a **0.2-second fade to black** and plays the escape sound.

A controls window documents:

| Key | Function |
|---|---|
| Arrow Keys | Move cursor |
| Z | Select |
| X | Return |

## INFO / SPECIES

**INFO** displays:

- Height and weight.
- Base stats.

**SPECIES** additionally displays:

- Type.
- Abilities.
- Evolution status.
- First-generation appearance.

Information uses a typewriter-style reveal.

## MOVES

The MOVES screen uses a **Gen 3-inspired 2×2 grid**:

- Four moves.
- Arrow-key navigation.
- Type-colored borders.
- PP and move type in a side panel.
- Data fetched from PokéAPI.
- View-only interface.

A bug causing the command menu to remain visible was fixed.

## Sprites & Audio

Wild Pokémon sprites prioritize:

1. Emerald
2. FireRed/LeafGreen
3. Ruby/Sapphire
4. Earliest available fallback

Audio includes:

- Battle intro and looping battle music.
- Battle music at 80% volume.
- Confirmation and escape sounds.
- PokéAPI Pokémon cries.
- Local Mightyena cry.

## Local Assets

| File | Purpose |
|---|---|
| `background.jpg` | Walking background |
| `battle-bg.jpg` | Battle background |
| `grass-top.png` / `grass-bottom.png` | Grass patches |
| `trainer.gif` | Animated trainer |
| `trainerstill.jpg` | Static trainer |
| `mightyenaback.png` | Mightyena sprite |
| `MightyenaCry.mp3` | Mightyena cry |
| `ConfirmSound.mp3` | Confirm/dialogue sound |
| `Escape.mp3` | BACK sound |
| `BattleMusic.mp3` | Battle intro |
| `BattleMusicLoop.mp3` | Battle loop |

Pokémon sprites, cries, names, stats, species data, and moves are fetched dynamically from PokéAPI.

## Overall Flow

**Search**  
→ PokéAPI search  
→ Encounter  
→ Wild Pokémon + HUD + dialogue  
→ Send out Mightyena  
→ Command menu  
→ **INFO / SPECIES / MOVES / BACK**  
→ BACK returns to Search.
