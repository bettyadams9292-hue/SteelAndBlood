# QA Report: Steel & Blood v1.0.0

Testing was automated in headless Chromium (Playwright), driving the real build through
its real input layer. Screenshots of every milestone are in `shots/`.

## Implemented and tested

| Area | What was verified |
|---|---|
| Movement | Acceleration/deceleration, sprint, crouch, variable-height jump, coyote time, jump buffering, one-way platforms, dodge roll with i-frames |
| Melee | 3-hit combos with buffering, charged heavy attacks, trails, hit-stop, knockback and stagger. All 14 melee weapons tested for damage |
| Firearms | All 23 firearms and bows fired at targets for damage. Recoil, spread, magazines, reloads, reserve ammo, casings, muzzle flash, falloff, pierce, splash. Bows fire on release |
| Defence | Block (stamina), perfect parry (stagger), guard break, Royal Aegis, Ascension revive |
| Zombies | All 10 types spawned and fought, each with its own AI (Screamer summons, Exploder chain blasts, Military grenades, Mutant leaps, Crawlers dodge high shots) |
| Bosses | All 6 bosses killed by the bot with mid-tier gear (4 of 6) and with late-game gear (6 of 6). Phases, telegraphs, vulnerability windows, shockwaves and summons all work |
| Endless world | 12 biomes rendered. Sections generate on the fly, so memory stays constant |
| Rewards | 3-choice reward screen. Duplicates become upgrades; upgrades are only offered for gear worth upgrading; first firearm is guaranteed; boss loot gets a rarity boost |
| Progression | XP and levels, 4 skill trees (24 nodes), 4 specials, set bonuses at 2/4/6 pieces, upgrade, ascend, forge, salvage, 21 achievements, 5 game modes |
| Saving | Persists across reloads. A corrupt main save is restored from backup; if both copies are corrupt, the game starts fresh and tells the player. Invalid or tampered data is cleaned up |
| Controller | Simulated gamepad: menu navigation (D-pad, A, B), movement, jump, attack, pause |
| Touch | Phone landscape viewport (844×390): stick movement and multi-touch buttons |
| UI | Every menu screen rendered and screenshotted. Buttons work via mouse, keyboard and controller |

## Performance and stability

- Accelerated soak test: about 28 minutes of game time with no errors. JS heap flat at 12 MB, object pools at fixed size, no leaks.
- About 48 minutes of non-god-mode runs across 6 consecutive sessions: no errors.
- Frame cost is 1.5–5 ms of JavaScript per frame. Headless software rendering held real-time speed after the fixes below.

## Bugs found and fixed during QA

- **Severe slowdown under rapid fire.** The hit flash used `ctx.filter`. It was replaced with a shared offscreen tint, restoring real-time speed.
- **Bosses stun-locked by rapid fire.** Stagger now needs heavy blows, and repeat hits can't restart it.
- **Knight faced the wrong way while firing an automatic after a dodge.** A fresh tap of a direction now turns the knight.
- **Soft-lock: a zombie could hide behind the sealed gate.** Enemies are now kept inside the arena.
- **Run started with the sidearm instead of the primary.** Fixed.
- **Late bosses had inflated health** from an off-by-one in boss cycle scaling. Fixed.
- **Hold-to-draw longbow never fired.** It now fires on release.
- **Upgrade rewards offered for gear you'd outgrown.** Those offers are now filtered out.
- **Layout and art issues:** panel screens overlapped, the logo was duplicated on the menu, fog had hard bands, touch buttons were oversized, the hit flash drew a white rectangle, and corpses stood upright. All fixed.

## Known limitations (honest status)

- **Art.** All characters, weapons and environments are procedurally drawn vector art. It is consistent and atmospheric, with rarity glows and armour visuals per slot, but it is not hand-painted or 3D-rendered premium art. The supplied key art is used for the splash screen, logo and menu.
- **Audio.** All sound and music is synthesised in real time (no licensed samples). Every weapon class has its own voice, but it won't match studio-recorded foley.
- **Gameplay testing** was done by a scripted bot, not human playtesters. Difficulty feel, especially the first boss at section 5 and late-game scaling, needs human tuning.
- **Hardware.** Controller support was verified with a simulated gamepad, not physical hardware. Touch was verified in an emulated phone viewport, not on physical devices.
- **Font.** The Cinzel font loads from Google Fonts. Offline, it falls back to Georgia-style serif.
- **Not built:** cloud saves, a Godot version, online leaderboards (Daily Challenge bests are stored locally).
