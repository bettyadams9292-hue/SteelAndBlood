"""Unreal-side: import the Blender hero knight (v14/v15 pipeline) and make it the playable character.
Re-importing to the same folder replaces the assets in place, so BP_HeroKnight's animation references stay valid."""
import unreal, sys, importlib

KN_DIR = '/Game/SteelAndBlood/Characters/Player/HeroKnight_v14'
SK = KN_DIR + '/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14'
MAP = {'Armor': 'Enamel', 'ArmorPlate': 'Enamel', 'Gold': 'Brass', 'Leather': 'Leather', 'BootLeather': 'Leather', 'SoleLeather': 'Leather',
       'Chainmail': 'Chainmail', 'DarkSteel': 'SteelDark', 'DarkMetal': 'SteelDark', 'GunMetal': 'SteelDark', 'Walnut': 'Walnut',
       'TabardCloth': 'ClothWhite', 'TabardClothBack': 'ClothWhite', 'CapeWool': 'ClothWhite', 'CapeLining': 'ClothRed', 'RedPaint': 'ClothRed',
       'Bone': 'Bone', 'Wax': 'Bone', 'Parchment': 'ClothWhite', 'Void': 'Visor', 'EyeGlow': 'Ember', 'Blade': 'Steel', 'Stitch': 'Leather'}

def ensure_instances(P):
    if P + 'lib' not in sys.path: sys.path.insert(0, P + 'lib')
    import sb_ue_materials as M; importlib.reload(M)
    M.PALETTE['Enamel'] = ((0.62, 0.57, 0.47), 0.0, 0.40, 0.55, (0.30, 0.25, 0.18), False, None)
    M.PALETTE['Brass'] = ((0.80, 0.58, 0.26), 1.0, 0.36, 0.5, (0.35, 0.25, 0.15), False, None)
    M.PALETTE['Walnut'] = ((0.20, 0.10, 0.045), 0.0, 0.55, 0.3, (0.6, 0.55, 0.5), False, None)
    for k in ('Enamel', 'Brass', 'Walnut'): M.instance(k, True)

def import_hero(gltf_path, P):
    ensure_instances(P)
    t = unreal.AssetImportTask(); t.filename = gltf_path; t.destination_path = KN_DIR
    t.automated = True; t.replace_existing = True; t.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    paths = [str(x) for x in t.imported_object_paths]
    m = unreal.load_asset(SK); mats = m.get_editor_property('materials'); slots = []
    for s in mats:
        n = str(s.get_editor_property('material_slot_name')).split('.')[0]; key = MAP.get(n)
        if key: s.set_editor_property('material_interface', unreal.load_asset('/Game/SteelAndBlood/Materials/Instances/MI_' + key + '_SK'))
        slots.append((n, key))
    m.set_editor_property('materials', mats); unreal.EditorAssetLibrary.save_asset(m.get_path_name())
    return {'assets': [p for p in paths if '/Materials/' not in p], 'slots': slots}

def make_playable():
    """BP_HeroKnight uses the Blender knight; the old separate sword component is emptied (v14+ hold their own weapons)."""
    b = unreal.load_asset('/Game/SteelAndBlood/Blueprints/BP_HeroKnight')
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem); lib = unreal.SubobjectDataBlueprintFunctionLibrary
    for h in sds.k2_gather_subobject_data_for_blueprint(b):
        o = lib.get_object(lib.get_data(h))
        if o and o.get_name().startswith('Weapon'): o.set_static_mesh(None)
    cdo = unreal.get_default_object(b.generated_class())
    cdo.get_editor_property('mesh').set_skeletal_mesh_asset(unreal.load_asset(SK))
    unreal.BlueprintEditorLibrary.compile_blueprint(b); unreal.EditorAssetLibrary.save_asset(b.get_path_name())
    return 'ok'
