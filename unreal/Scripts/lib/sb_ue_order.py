"""Members of the order in Unreal: import helm variants exported from Blender (sb_v16_variants) as their own
skeletal meshes, give them the hero armour materials, and stand them in the showcase level playing idle."""
import unreal, importlib

ORDER_DIR = '/Game/SteelAndBlood/Characters/Order'
VARIANTS = ('Bascinet', 'Sallet')

def _lib_map():
    import sb_ue_hero as H, sb_ue_armor_mat as AM
    importlib.reload(H); importlib.reload(AM)
    return H.MAP, AM.HERO_MAP

def import_variant(name, src):
    t = unreal.AssetImportTask(); t.filename = src + 'SK_Knight_%s.gltf' % name; t.destination_path = ORDER_DIR + '/' + name
    t.automated = True; t.replace_existing = True; t.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    return [str(p) for p in t.imported_object_paths]

def find(name, kind):
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    for a in reg.get_assets_by_path(ORDER_DIR + '/' + name, recursive=True):
        if str(a.asset_class_path.asset_name) == kind: yield a.get_asset()

def assign(name):
    lib, hero = _lib_map()
    sk = next(find(name, 'SkeletalMesh')); new = []
    for s in sk.get_editor_property('materials'):
        n = str(s.material_slot_name).split('.')[0]
        if n in hero: mi = unreal.load_asset('/Game/SteelAndBlood/Materials/Instances/' + hero[n])
        elif n in lib: mi = unreal.load_asset('/Game/SteelAndBlood/Materials/Instances/MI_' + lib[n] + '_SK')
        else: mi = s.material_interface
        new.append(unreal.SkeletalMaterial(material_interface=mi, material_slot_name=s.material_slot_name, uv_channel_data=s.uv_channel_data))
    sk.set_editor_property('materials', new); unreal.EditorAssetLibrary.save_asset(sk.get_path_name())
    return sk.get_path_name()

def place(name, loc, yaw):
    sk = next(find(name, 'SkeletalMesh'))
    idle = next((a for a in find(name, 'AnimSequence') if a.get_name().endswith('Idle')), None)
    sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in sub.get_all_level_actors():
        if a.get_actor_label() == 'Order_' + name: sub.destroy_actor(a)
    act = sub.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(*loc), unreal.Rotator(0, 0, yaw))
    act.set_actor_label('Order_' + name)
    c = act.skeletal_mesh_component; c.set_skinned_asset_and_update(sk)
    if idle:
        c.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
        c.set_editor_property('animation_data', unreal.SingleAnimationPlayData(anim_to_play=idle, saved_looping=True, saved_playing=True))
    return act.get_actor_label(), bool(idle)
