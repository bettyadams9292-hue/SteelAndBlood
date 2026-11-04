"""Unreal-side: generate glTF sources with the sbkit modules and import them into the Content Browser."""
import unreal, os, importlib
import sbkit, sb_knight, sb_props, sb_ue_materials as MATS

EAL = unreal.EditorAssetLibrary
ROOT = '/Game/SteelAndBlood'

def _import(path, dest):
    t = unreal.AssetImportTask()
    t.filename = path; t.destination_path = dest; t.automated = True; t.replace_existing = True; t.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    return [str(x) for x in t.imported_object_paths]

def _cleanup_imported_materials(paths):
    """Interchange creates one material per glTF material; the project uses the shared MI library instead."""
    n = 0
    for p in paths:
        a = p.split('.')[0]
        if '/Materials/' in a and EAL.does_asset_exist(a):
            if not EAL.find_package_referencers_for_asset(a):
                EAL.delete_asset(a); n += 1
    return n

def import_knight(out_dir):
    sb_knight.export(out_dir + '/SK_HeroKnight.gltf')
    paths = _import(out_dir + '/SK_HeroKnight.gltf', ROOT + '/Characters/Player/HeroKnight')
    sk = [p for p in paths if p.endswith('SkeletalMeshes/SK_HeroKnight.SK_HeroKnight')][0]
    skm = unreal.load_asset(sk)
    done = MATS.apply_skeletal(skm)
    return {'mesh': sk, 'mats': done, 'anims': [p for p in paths if '_Knight_' in p], 'deleted_auto_mats': _cleanup_imported_materials(paths)}

def import_props(out_dir):
    res = {}
    for name, fn in list(sb_props.WEAPONS.items()) + list(sb_props.ENV.items()):
        m = fn(); used = {k: sb_props.MATS.get(k, (0.5, 0.5, 0.5, 0, 0.8)) for k in m.parts}
        sbkit.write_gltf(out_dir + '/' + name + '.gltf', {name: m}, used, name=name)
        dest = ROOT + ('/Weapons' if name.startswith(('SM_Wpn', 'SM_Shield')) else '/Environments/RuinedCastle')
        paths = _import(out_dir + '/' + name + '.gltf', dest)
        sm_path = [p for p in paths if p.split('.')[-1] == name or p.endswith('/' + name + '.' + name)]
        if not sm_path:
            sm_path = [p for p in paths if '/StaticMeshes/' in p]
        sm = unreal.load_asset(sm_path[0])
        done = MATS.apply_static(sm)
        if name.startswith('SM_Env') and name not in ('SM_Env_Banner',):
            ns = sm.get_editor_property('nanite_settings'); ns.set_editor_property('enabled', True)
            sm.set_editor_property('nanite_settings', ns)
            EAL.save_asset(sm.get_path_name())
        res[name] = {'path': sm.get_path_name(), 'mats': done, 'deleted': _cleanup_imported_materials(paths)}
    return res
