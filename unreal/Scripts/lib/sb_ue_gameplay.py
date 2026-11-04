"""Unreal-side: playable hero foundation.
Creates Enhanced Input actions + mapping context (registered as a project default context), BP_HeroKnight
(Character, constrained to the X/Z play plane, absolute-rotation side camera), BP_SBGameMode, collision on the
walkable meshes, and a PlayerStart in the showcase level. Graph logic is written separately via the Blueprint DSL."""
import unreal

AT = unreal.AssetToolsHelpers.get_asset_tools()
EAL = unreal.EditorAssetLibrary
ES = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
UES = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
LES = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
ROOT = '/Game/SteelAndBlood'
INP = ROOT + '/Input'
BPD = ROOT + '/Blueprints'
KN = ROOT + '/Characters/Player/HeroKnight/SK_HeroKnight/SkeletalMeshes/SK_HeroKnight'
LOG = []

def sp(o, k, v):
    try: o.set_editor_property(k, v); return True
    except Exception as e: LOG.append('%s.%s: %s' % (o.get_class().get_name(), k, str(e)[:90])); return False

def asset(name, path, cls, factory=None):
    full = path + '/' + name
    if EAL.does_asset_exist(full): return unreal.load_asset(full)
    return AT.create_asset(name, path, cls, factory)

def key(name):
    k = unreal.Key(); k.set_editor_property('key_name', name); return k

ACTIONS = {  # name: (value type, keys)
    'IA_Move':     ('AXIS1D', ['D', 'Right', 'Gamepad_LeftX']),
    'IA_MoveLeft': ('BOOLEAN', ['A', 'Left']),
    'IA_Jump':     ('BOOLEAN', ['SpaceBar', 'W', 'Gamepad_FaceButton_Bottom']),
    'IA_Attack':   ('BOOLEAN', ['LeftMouseButton', 'J', 'Gamepad_FaceButton_Left']),
    'IA_Block':    ('BOOLEAN', ['RightMouseButton', 'K', 'Gamepad_LeftTrigger']),
}

def build_input():
    fac_ia = getattr(unreal, 'InputAction_Factory', None) or getattr(unreal, 'InputActionFactory', None)
    fac_imc = getattr(unreal, 'InputMappingContext_Factory', None) or getattr(unreal, 'InputMappingContextFactory', None)
    imc = asset('IMC_SteelAndBlood', INP, unreal.InputMappingContext, fac_imc() if fac_imc else None)
    try: imc.unmap_all()
    except Exception: pass
    for name, (vt, keys) in ACTIONS.items():
        ia = asset(name, INP, unreal.InputAction, fac_ia() if fac_ia else None)
        sp(ia, 'value_type', getattr(unreal.InputActionValueType, vt))
        EAL.save_asset(ia.get_path_name())
        for k in keys: imc.map_key(ia, key(k))
    EAL.save_asset(imc.get_path_name())
    # mapping context is added at BeginPlay by BP_HeroKnight (settings class not exposed to Python in 5.8)
    return imc

def bp(name, parent):
    full = BPD + '/' + name
    if EAL.does_asset_exist(full): return unreal.load_asset(full)
    f = unreal.BlueprintFactory(); f.set_editor_property('parent_class', parent)
    return AT.create_asset(name, BPD, unreal.Blueprint, f)

def add_component(b, cls, name, parent_handle=None):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    handles = sds.k2_gather_subobject_data_for_blueprint(b)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    for h in handles:  # already added?
        o = lib.get_object(lib.get_data(h))
        if o and o.get_name().startswith(name): return o, h
    p = unreal.AddNewSubobjectParams(parent_handle=parent_handle or handles[0], new_class=cls, blueprint_context=b)
    h, fail = sds.add_new_subobject(p)
    sds.rename_subobject(h, unreal.Text(name))
    return lib.get_object(lib.get_data(h)), h

def build_character():
    b = bp('BP_HeroKnight', unreal.Character)
    arm, harm = add_component(b, unreal.SpringArmComponent, 'CameraBoom')
    for k, v in (('target_arm_length', 760.0), ('using_absolute_rotation', True), ('do_collision_test', False),
                 ('enable_camera_lag', True), ('camera_lag_speed', 7.0), ('use_pawn_control_rotation', False),
                 ('socket_offset', unreal.Vector(0, 0, 0)), ('target_offset', unreal.Vector(0, 0, 70))):
        sp(arm, k, v)
    arm.set_editor_property('relative_rotation', unreal.Rotator(roll=0.0, pitch=-4.0, yaw=-90.0))
    cam, _ = add_component(b, unreal.CameraComponent, 'SideCamera', harm)
    sp(cam, 'field_of_view', 62.0)
    unreal.BlueprintEditorLibrary.compile_blueprint(b)
    cdo = unreal.get_default_object(b.generated_class())
    mesh = cdo.get_editor_property('mesh')
    mesh.set_skeletal_mesh_asset(unreal.load_asset(KN))
    mesh.set_editor_property('relative_location', unreal.Vector(0, 0, -92))
    mesh.set_editor_property('relative_rotation', unreal.Rotator(roll=0.0, pitch=0.0, yaw=-90.0))
    sp(mesh, 'animation_mode', unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    cap = cdo.get_editor_property('capsule_component'); cap.set_capsule_size(34.0, 92.0)
    mv = cdo.get_editor_property('character_movement')
    for k, v in (('max_walk_speed', 360.0), ('jump_z_velocity', 560.0), ('gravity_scale', 1.6), ('air_control', 0.45),
                 ('braking_deceleration_walking', 1800.0), ('ground_friction', 8.0), ('orient_rotation_to_movement', True),
                 ('rotation_rate', unreal.Rotator(roll=0.0, pitch=0.0, yaw=900.0)), ('constrain_to_plane', True),
                 ('plane_constraint_normal', unreal.Vector(0, 1, 0)), ('snap_to_plane_at_start', True)):
        sp(mv, k, v)
    sp(cdo, 'use_controller_rotation_yaw', False)
    sp(cdo, 'auto_possess_player', unreal.AutoReceiveInput.DISABLED)
    unreal.BlueprintEditorLibrary.compile_blueprint(b)
    EAL.save_asset(b.get_path_name())
    return b

def build_gamemode(hero):
    g = bp('BP_SBGameMode', unreal.GameModeBase)
    cdo = unreal.get_default_object(g.generated_class())
    sp(cdo, 'default_pawn_class', hero.generated_class())
    unreal.BlueprintEditorLibrary.compile_blueprint(g); EAL.save_asset(g.get_path_name())
    return g

def collision():
    out = []
    for p in EAL.list_assets(ROOT + '/Environments', True):
        a = unreal.load_asset(p.split('.')[0])
        if isinstance(a, unreal.StaticMesh):
            bs = a.get_editor_property('body_setup')
            if bs:
                sp(bs, 'collision_trace_flag', unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
                a.set_editor_property('body_setup', bs); EAL.save_asset(a.get_path_name()); out.append(a.get_name())
    return out

def level_setup(gm):
    world = UES.get_editor_world()
    ws = world.get_world_settings(); sp(ws, 'default_game_mode', gm.generated_class())
    for a in ES.get_all_level_actors():
        if isinstance(a, unreal.PlayerStart) or a.get_actor_label().startswith('Bound_'): ES.destroy_actor(a)
    ps = ES.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(-700, 0, 110), unreal.Rotator(0, 0, 0))
    ps.set_actor_label('PlayerStart_Hero'); ps.set_folder_path('Gameplay')
    # invisible bounds so the player cannot walk off the authored strip
    for x in (-3600.0, 3600.0):
        bv = ES.spawn_actor_from_object(unreal.load_asset('/Engine/BasicShapes/Cube'), unreal.Vector(x, 0, 300), unreal.Rotator(0, 0, 0))
        bv.set_actor_scale3d(unreal.Vector(1.0, 20.0, 10.0)); bv.set_actor_label('Bound_%d' % int(x)); bv.set_folder_path('Gameplay')
        bv.set_actor_hidden_in_game(True)
    LES.save_current_level()
    return ps.get_actor_label()

def build_all():
    del LOG[:]
    imc = build_input(); hero = build_character(); gm = build_gamemode(hero)
    col = collision(); ps = level_setup(gm)
    return {'imc': imc.get_path_name(), 'hero': hero.get_path_name(), 'gm': gm.get_path_name(), 'collision': len(col), 'start': ps, 'log': LOG}
