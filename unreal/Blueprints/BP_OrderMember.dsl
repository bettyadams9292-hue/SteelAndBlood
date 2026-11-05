; BP_OrderMember (parent Character) - EventGraph, written with BlueprintTools.write_graph_dsl
; vars: IdleAnim, WalkAnim (AnimSequence, instance-editable), FormOffset (Vector, instance-editable), CurAnim (int)
; CDO: mesh rel loc (0,0,-96) yaw -90, AlwaysTickPoseAndRefreshBones; CharacterMovement orient-to-movement, 330 cm/s, yaw rate 540;
; AutoPossessAI PlacedInWorldOrSpawned. Pathfinding via SimpleMoveToLocation on NavBounds_Courtyard navmesh.
(event EventBeginPlay
  (Variables|Default|SetCurAnim -1))

(event EventTick (DeltaSeconds)
  (bind pawn (Game|GetPlayerPawn 0))
  (bind me (Transformation|GetActorLocation))
  (bind tgt (Transformation|GetActorLocation :self pawn))
  (bind goal (+ tgt (Variables|Default|GetFormOffset)))
  (bind d (- goal me))
  (bind flat (Math|Vector|MakeVector :X (.x d) :Y (.y d) :Z 0.0))
  (bind dist (Math|Vector|VectorLength flat))
  (bind want (select (> dist 70.0) 1 0))
  (bind speed (Math|Vector|VectorLength (Transformation|GetVelocity)))
  (bind ctrl (Pawn|GetController))
  ; fallback steering when path following isn't moving us (e.g. no nav data under the goal)
  (Pawn|Input|AddMovementInput :WorldDirection flat :ScaleValue (select (and (> dist 70.0) (< speed 30.0)) 1.0 0.0))
  (if (> dist 70.0)
    (AI|Navigation|SimpleMovetoLocation :Controller ctrl :Goal goal))
  (bind mesh (Variables|Character|GetMesh))
  (if (!= want (Variables|Default|GetCurAnim))
    (Variables|Default|SetCurAnim want)
    (if (== want 1)
      (Components|Animation|PlayAnimation :self mesh :NewAnimToPlay (Variables|Default|GetWalkAnim) :bLooping true)
      (else
        (Components|Animation|PlayAnimation :self mesh :NewAnimToPlay (Variables|Default|GetIdleAnim) :bLooping true)))))
