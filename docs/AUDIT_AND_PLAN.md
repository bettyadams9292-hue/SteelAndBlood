# Steel & Blood: 3D Transformation — Audit & Migration Plan (Phase 1)

Scope, as decided with the owner: transform the Steel & Blood build (v1.3) into 3D. The game
stays 2.5D side-on: a real 3D world, with the camera following from the side at an angle.
Delivery is a published page plus a source zip. Nothing is pushed to GitHub. The separate
Iron Knight repo (Falklands–Helmand theatres, outpost defence) is out of scope.

## 1. Architecture map (v1.3)

| Layer | Modules | Notes |
|---|---|---|
| Core | `core/base.js` (namespace, RNG, pools, events), `input.js`, `audio.js` (synthesised), `save.js` (checksum and backup) | Renderer-independent. Kept unchanged |
| Data | `data/items.js` (37 weapons, perks, 7 armour sets, heraldry), `data/world.js` (10 zombies, 6 bosses, 12 biomes, skills, achievements, modes) | Data-driven. Extended, not rewritten |
| Systems | `systems/loot.js`, `systems/progression.js` | Renderer-independent. Kept |
| Gameplay | `game/player.js`, `combat.js`, `enemies.js` (AI and 2D drawing), `world.js` (generation and 2D drawing), `game.js` (run, camera, 2D render, HUD) | Logic is kept. The 2D drawing parts are replaced by the 3D renderer |
| Render 2D | `render/art.js` (IK rig and vector art), `fx.js` (particles), `gore.js` | The IK pose solver is reused to drive 3D rigs. Vector drawing stays only for UI previews |
| UI | `ui/ui.js` (DOM menus), `touch.js` | Kept and restyled. New screens added |

## 2. Working mechanics (verified in v1.0–v1.3 QA)

Movement (coyote time, buffering, variable jump), melee combos, heavy attacks, pointer-aimed
melee and firearms, headshots, block/parry, dodge, 4 specials, 37 weapons, 10 zombie types,
6 phased bosses, endless sections across 12 biomes, a 3-choice reward screen, XP and skills,
upgrade/ascend/forge/salvage, sets, achievements, 5 modes, gore and dismemberment, knight
customisation, save backup and recovery, controller and touch input.

## 3. Broken or incomplete

- No throwables, deployables or companions. These were never built, and the directive requires them.
- The arsenal uses invented archetypes, not WWII-to-modern real-world weapon families.
- The gate is a static 2D arch, and the reward screen interrupts abruptly (the directive's own criticism).
- Environments are painted 2D parallax with no real geometry.

## 4. Rendering limitations

- Canvas 2D only: no depth, lighting, shadows or materials.
- Characters are flat vector rigs. Biomes are 2D silhouettes.
- No day/night lighting.

## 5. Performance notes

- JavaScript cost is 1.5–5 ms per frame. Memory is flat (soak tested); pools are in place.
- Risk for 3D: draw calls and shadow cost. Mitigation: instanced vegetation, debris and rocks,
  merged static geometry per section, a single shadow-casting light with a tight frustum
  following the camera, distance culling, particles on GPU points, quality presets.

## 6. Migration plan

1. **Lane-following terrain.** Gameplay keeps its lane coordinates (x along the path, y up),
   which protects every tested mechanic. The renderer maps lane (x, y) to 3D world
   (x/100, ground(x) + height, z ≈ 0). Terrain has real elevation under and around the lane
   (hills, valleys, cliffs, trenches). Pointer aim uses a ray–plane intersection back into lane space.
2. **3D renderer modules.** Engine, materials (procedural PBR textures), terrain, environment
   kits per biome, characters (3D rigs driven by the existing IK pose solver, so the tested
   weapon-holding poses carry over exactly), weapons (3D models attached to the hand bone with
   per-weapon grip and muzzle data), FX (GPU particles, gibs, decals, lights).
3. **HUD and UI.** The canvas HUD becomes a transparent overlay, with damage numbers projected
   from 3D. DOM menus are restyled in gunmetal, aged silver, crimson, bone and gold, with new
   screens for companions and the field kit.
4. **New systems.** Throwables (frag, stun, Molotov), deployables (bear trap, sentry gun),
   companions (dogs and six humans with AI, abilities and upgrades), the WWII-to-modern
   arsenal, a cinematic gate and transition, and day/night lighting.
5. **Regression.** The bot and simulation suites, every weapon's orientation, every boss,
   save/load, a soak test, and the mobile and controller paths.

## 7. How every existing feature keeps working

All gameplay modules keep their interfaces. Only draw functions are replaced. The QA harness
(`tools/bot.js`, `tools/sim.js`) drives the same input layer, so the v1.3 regression tests
remain valid after migration.
