; BP_SBHUD (parent HUD) - EventGraph. Set as the HUD class of the level's game mode.
; Draws the hero's health bar top-left: dark frame, crimson fill, ivory label; "FALLEN" while dead.
; NOTE (unverified): node ids for HUD drawing and the BP_HeroKnight getters must be confirmed with
; BlueprintTools.find_node_types on the BP_SBHUD graph before writing (expected: HUD|DrawRect, HUD|DrawText,
; Utilities|Casting|CastToBP_HeroKnight, Class|BP_HeroKnight|GetHealth / GetDead).
(event ReceiveDrawHUD (SizeX SizeY)
  (bind hero (Utilities|Casting|CastToBP_HeroKnight :Object (Game|GetPlayerPawn 0))
    (:then
      (bind hp (Class|BP_HeroKnight|GetHealth :self hero))
      (HUD|DrawRect :RectColor (Math|Color|MakeLinearColor :R 0.02 :G 0.02 :B 0.02 :A 0.75) :ScreenX 36.0 :ScreenY 32.0 :ScreenW 328.0 :ScreenH 30.0)
      (HUD|DrawRect :RectColor (Math|Color|MakeLinearColor :R 0.55 :G 0.04 :B 0.03 :A 1.0) :ScreenX 40.0 :ScreenY 36.0 :ScreenW (* 3.2 hp) :ScreenH 22.0)
      (HUD|DrawText :Text (select (Class|BP_HeroKnight|GetDead :self hero) "FALLEN - rising again..." "TEMPLAR") :TextColor (Math|Color|MakeLinearColor :R 0.95 :G 0.92 :B 0.82 :A 1.0) :ScreenX 40.0 :ScreenY 66.0 :Scale 1.2))
    (:CastFailed)))
