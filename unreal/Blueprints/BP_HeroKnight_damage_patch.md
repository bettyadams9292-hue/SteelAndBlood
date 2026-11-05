# BP_HeroKnight EventGraph - combat patch (Nov 5)
Inside the attack branch, after `(Variables|Default|SetAttackT 0.9)` the sword now deals damage:

    (Game|Damage|ApplyRadialDamage :BaseDamage 45.0
        :Origin (+ (Transformation|GetActorLocation) (* (Transformation|GetActorForwardVector) 110.0))
        :DamageRadius 170.0 :DamageCauser self :bDoFullDamage true)

Rewriting the graph from read_graph_dsl output needed three fixes (kept here for the next edit):
1. literal binds like `(bind _returnvalue_3 0.0)` must be inlined (the writer rejects literal binds);
2. Enhanced Input value nodes are now `Input|EnhancedActionValues|IA_Move` (no `Get` prefix);
3. positional first args bind to the `self` pin - use keywords, e.g. AddMovementInput :WorldDirection ... :ScaleValue ...
A full copy of the working DSL is kept on the dev PC at Pictures/hero_dsl_new.txt (backup of the previous graph: hero_dsl_backup.txt).
