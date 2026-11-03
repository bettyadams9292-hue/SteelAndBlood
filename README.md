# Steel & Blood: Knights of the Apocalypse

*The world has fallen. The knight remains.*

A side-scrolling, endless-survival action roguelike. A Templar knight fights east through a
zombie-overrun world, earning medieval weapons, modern firearms and legendary armour at the
end of every section. Built in HTML5 Canvas and JavaScript. It runs in any modern browser on
desktop and mobile, with no install or plugins.

## Playing

Open `dist/index.html` in a browser. It's a single self-contained file: art, code and styles
are all embedded. Progress saves automatically in the browser.

| Action | Keyboard / Mouse | Controller |
|---|---|---|
| Move / Sprint | A D or ← → / L-Shift | Left stick or D-pad / L3 |
| Jump / Crouch | Space or W / S | A / Stick down |
| Aim firearms | Mouse pointer (crosshair) | Right stick |
| Shoot / Reload / Switch | Left Click or K / R / Q or Wheel | RT / LB / RB |
| Melee (hold = heavy) | Right Click or J (swing/thrust aims at the pointer) | X |
| Block (tap = parry) / Dodge | U / L | LT / B |
| Special ability / Pause | E / Esc | Y / Start |

All bindings can be changed in Settings. Touch controls appear automatically on phones and tablets (landscape); on touch, firearms auto-aim at the nearest zombie ahead.

**Gore:** zombies take visible wounds and blood-soaked damage. Limbs can be severed (they keep crawling or fighting one-armed), heads come off, explosions gib, and blood pools spread under corpses. Change it under Settings > Gore (full / reduced / off).

**Customise Knight** (main menu, pause menu or Equipment) changes the knight's name, heraldry (presets such as Templar, Hospitaller and Teutonic, or your own surcoat, emblem, emblem colour and cape), plume, helmet style and armour finish. These are cosmetic only. Each helmet style unlocks once you collect any piece of that armour set.

## Project structure

```
src/
  core/      base.js (namespace, RNG, pools, events) · input.js · audio.js · save.js
  data/      items.js (rarities, 37 weapons, perks, 7 armour sets, affixes, accessories)
             world.js (10 zombies, 6 bosses, 12 biomes, 4 skill trees, abilities, 21 achievements, 5 modes)
  systems/   loot.js (items, reward generation, upgrades, ascension, forge, salvage)
             progression.js (XP/levels, skills, stat aggregation, set bonuses, achievements)
  render/    art.js (IK-rigged knight, armour tiers, weapons) · fx.js (particles, decals, shake, numbers) · gore.js (wounds, dismemberment, gibs)
  game/      player.js · combat.js · enemies.js (AI + bosses + zombie art) · world.js (generation + biomes) · game.js (run, camera, HUD)
  ui/        ui.js (all menus) · touch.js
  style.css · index.html · main.js
assets/      splash/logo/menu art (from the supplied key art)
tools/       QA harness: bot.js (autoplay bot), sim.js (fast simulation), run.py, mobile.py, shot.py
shots/       Screenshot gallery captured from the running game
build.js     Bundler
```

All balancing lives in `src/data/`, and systems read those tables. To add a weapon, enemy,
biome, skill or mode, add an entry there; the systems don't need changes.

## Building

Requires Node 18+.

```
node build.js          # -> dist/index.html (single file, about 1 MB)
node build.js --dev    # -> dist/dev.html (loads modules individually for debugging)
```

## Testing

Tests use Python 3 with Playwright (Chromium).

```
python3 tools/run.py <script.py>   # loads the build and runs an async `run(pg)` test script
python3 tools/mobile.py            # phone-landscape touch test
```

The autoplay bot (`tools/bot.js`) plays only through the same input layer as a real player.
`tools/sim.js` steps the real game loop at 60 Hz as fast as the CPU allows, for soak and
balance tests. The page exposes `window.SB.IF` for test hooks, and `run.jumpTo(n)` jumps to
any section.

## Technology decision

The brief preferred Godot 4, but no Godot toolchain was available in the build environment, and
the result had to be run, screenshotted and tested here. A Canvas 2D engine written from scratch
gives a zero-install build that runs on desktop, mobile and controller-equipped browsers. The
same modular, data-driven architecture would port to Godot later if desired.

## Known limitations

See `QA_REPORT.md`.
