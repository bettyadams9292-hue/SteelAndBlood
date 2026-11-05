; BP_HeroKnight (parent Character) - EventGraph (BlueprintTools.write_graph_dsl)
; v2 (Nov 5): health, block, hit-react, death + respawn, sword damage timed to the swing.
; vars (existing): CurAnim (int), AttackT (float), DbgBlock/DbgJump/DbgAttack (bool), DbgMove (float)
; vars (new):      Health, HurtT, RespawnT, HitDelay (float), Dead (bool), StartLoc (Vector)
; CurAnim: 0 idle, 1 walk, 2 attack, 3 block, 4 hit-react, 5 death
; Rules: blocking takes 20% damage; a hit flinches for 0.35 s; at 0 HP the knight dies, waits 4 s,
;        then respawns at the level start with full health. Sword damage lands 0.35 s into the swing.
(event EventBeginPlay
  (Input|AddMappingContext (PlayerController|LocalPlayerSubsystems|GetEnhancedInputLocalPlayerSubsystem (Game|GetPlayerController 0)) "/Game/SteelAndBlood/Input/IMC_SteelAndBlood.IMC_SteelAndBlood" 0 "(bIgnoreAllPressedKeysUntilRelease=True,bForceImmediately=False,bNotifyUserSettings=False)")
  (Variables|Default|SetCurAnim -1)
  (Variables|Default|SetAttackT 0.0)
  (Variables|Default|SetHealth 100.0)
  (Variables|Default|SetDead false)
  (Variables|Default|SetStartLoc (Transformation|GetActorLocation)))

(event Collision|EventActorBeginOverlap (OtherActor))

(event Game|Damage|EventAnyDamage (Damage DamageType InstigatedBy DamageCauser)
  (if (not (Variables|Default|GetDead))
    (bind blocking (or (Input|EnhancedActionValues|IA_Block) (Variables|Default|GetDbgBlock)))
    (bind hp (- (Variables|Default|GetHealth) (* Damage (select blocking 0.2 1.0))))
    (Variables|Default|SetHealth hp)
    (if (<= hp 0.0)
      (Variables|Default|SetHealth 0.0)
      (Variables|Default|SetDead true)
      (Variables|Default|SetRespawnT 4.0)
      (else
        (if (not blocking)
          (Variables|Default|SetHurtT 0.35))))))

(event EventTick (DeltaSeconds)
  (bind dead (Variables|Default|GetDead))
  (Variables|Default|SetHurtT (- (Variables|Default|GetHurtT) DeltaSeconds))
  (if dead
    (Variables|Default|SetRespawnT (- (Variables|Default|GetRespawnT) DeltaSeconds))
    (if (<= (Variables|Default|GetRespawnT) 0.0)
      (Transformation|SetActorLocation :NewLocation (Variables|Default|GetStartLoc) :bSweep false :bTeleport true)
      (Variables|Default|SetHealth 100.0)
      (Variables|Default|SetDead false)))
  (if (> (Variables|Default|GetHitDelay) 0.0)
    (Variables|Default|SetHitDelay (- (Variables|Default|GetHitDelay) DeltaSeconds))
    (if (<= (Variables|Default|GetHitDelay) 0.0)
      (Game|Damage|ApplyRadialDamage :BaseDamage 45.0 :Origin (+ (Transformation|GetActorLocation) (* (Transformation|GetActorForwardVector) 110.0)) :DamageRadius 170.0 :DamageCauser self :bDoFullDamage true)))
  (bind falling (Movement|IsFalling (Variables|Character|GetCharacterMovement)))
  (bind speed (Math|Vector|VectorLength (Transformation|GetVelocity)))
  (bind blocking (or (Input|EnhancedActionValues|IA_Block) (Variables|Default|GetDbgBlock)))
  (bind hurt (> (Variables|Default|GetHurtT) 0.0))
  (bind attacking (> (Variables|Default|GetAttackT) 0.0))
  (bind curanim (Variables|Default|GetCurAnim))
  (bind locomotion (select falling curanim (select (> speed 20.0) 1 0)))
  (bind want (select dead 5 (select hurt 4 (select attacking 2 (select blocking 3 locomotion)))))
  (bind mesh (Variables|Character|GetMesh))
  (bind locked (or dead (or hurt (or blocking (> (Variables|Default|GetAttackT) 0.25)))))
  (Pawn|Input|AddMovementInput :WorldDirection (Math|Vector|MakeVector :X 1.0) :ScaleValue (select locked 0.0 (+ (- (Input|EnhancedActionValues|IA_Move) (select (Input|EnhancedActionValues|IA_MoveLeft) 1.0 0.0)) (Variables|Default|GetDbgMove))))
  (Variables|Default|SetAttackT (- (Variables|Default|GetAttackT) DeltaSeconds))
  (if (and (or (Input|EnhancedActionValues|IA_Jump) (Variables|Default|GetDbgJump)) (and (not falling) (not locked)))
    (Character|Jump))
  (if (and (or (Input|EnhancedActionValues|IA_Attack) (Variables|Default|GetDbgAttack)) (and (<= (Variables|Default|GetAttackT) 0.0) (and (not dead) (not hurt))))
    (Variables|Default|SetAttackT 0.9)
    (Variables|Default|SetHitDelay 0.35))
  (if (!= want curanim)
    (Variables|Default|SetCurAnim want)
    (switch Utilities|FlowControl|Switch|SwitchonInt want
      (:0
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_Idle.SK_HeroKnight_v14A_Knight_Idle" true))
      (:1
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_Walk.SK_HeroKnight_v14A_Knight_Walk" true))
      (:2
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_Attack_Overhead.SK_HeroKnight_v14A_Knight_Attack_Overhead"))
      (:3
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_Block.SK_HeroKnight_v14A_Knight_Block"))
      (:4
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_HitReact.SK_HeroKnight_v14A_Knight_HitReact"))
      (:5
        (Components|Animation|PlayAnimation mesh "/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14A_Knight_Death.SK_HeroKnight_v14A_Knight_Death")))))
