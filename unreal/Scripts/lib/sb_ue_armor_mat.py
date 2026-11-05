"""M_SB_Armor - hard-surface armour master for skinned characters (Unreal side).
Adds the fine detail the Blender look-dev has (scratches, dents, cavity grime, micro roughness, engraved
filigree on gilt) without a per-character bake: tileable detail textures sampled tri-planar in PRE-SKINNED
local space, so the pattern sticks to the armour while it animates. One material serves every member of the order.
Instances: MIH_Ivory, MIH_Gold, MIH_Crimson, MIH_DarkSteel."""
import unreal

ML = unreal.MaterialEditingLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
TEX_DIR = '/Game/SteelAndBlood/Textures/Detail'
MAT_DIR = '/Game/SteelAndBlood/Materials'
INST_DIR = '/Game/SteelAndBlood/Materials/Instances'

def import_textures(src_dir):
    tasks = []
    for nm in ('T_SB_ArmorDetail_N', 'T_SB_ArmorDetail_M', 'T_SB_Filigree_N'):
        t = unreal.AssetImportTask(); t.filename = src_dir + nm + '.png'; t.destination_path = TEX_DIR
        t.automated = True; t.replace_existing = True; t.save = True; tasks.append(t)
    AT.import_asset_tasks(tasks)
    for nm in ('T_SB_ArmorDetail_N', 'T_SB_Filigree_N'):
        tx = unreal.load_asset(TEX_DIR + '/' + nm)
        tx.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_NORMALMAP)
        tx.set_editor_property('srgb', False); unreal.EditorAssetLibrary.save_asset(tx.get_path_name())
    tx = unreal.load_asset(TEX_DIR + '/T_SB_ArmorDetail_M')
    tx.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_MASKS)
    tx.set_editor_property('srgb', False); unreal.EditorAssetLibrary.save_asset(tx.get_path_name())
    return 'ok'

class G:
    """tiny graph builder"""
    def __init__(self, mat): self.m = mat; self.x = -2400; self.y = 0
    def n(self, cls, x=None, y=None, **props):
        e = ML.create_material_expression(self.m, cls, x if x is not None else self.x, y if y is not None else self.y)
        for k, v in props.items(): e.set_editor_property(k, v)
        self.y += 120
        return e
    def c(self, a, ao, b, bi): ML.connect_material_expressions(a, ao, b, bi)
    def scalar(self, name, v, grp='Armor'): return self.n(unreal.MaterialExpressionScalarParameter, parameter_name=name, default_value=v, group=grp)
    def vec(self, name, v, grp='Armor'): return self.n(unreal.MaterialExpressionVectorParameter, parameter_name=name, default_value=unreal.LinearColor(*v), group=grp)
    def const3(self, v): return self.n(unreal.MaterialExpressionConstant3Vector, constant=unreal.LinearColor(*v, 1.0))
    def op(self, cls, a, b, ao='', bo=''):
        e = self.n(cls); self.c(a, ao, e, 'A'); self.c(b, bo, e, 'B'); return e
    def mul(self, a, b, ao='', bo=''): return self.op(unreal.MaterialExpressionMultiply, a, b, ao, bo)
    def add(self, a, b, ao='', bo=''): return self.op(unreal.MaterialExpressionAdd, a, b, ao, bo)
    def lerp(self, a, b, t, ao='', bo='', to=''):
        e = self.n(unreal.MaterialExpressionLinearInterpolate); self.c(a, ao, e, 'A'); self.c(b, bo, e, 'B'); self.c(t, to, e, 'Alpha'); return e
    def mask(self, a, r=False, g=False, b=False, ao=''):
        e = self.n(unreal.MaterialExpressionComponentMask, r=r, g=g, b=b, a=False); self.c(a, ao, e, ''); return e

def _triplanar(g, tex, uvx, uvy, uvz, wx, wy, wz, sampler):
    acc = None
    for uv, w in ((uvx, wx), (uvy, wy), (uvz, wz)):
        s = g.n(unreal.MaterialExpressionTextureSample, texture=tex, sampler_type=sampler)
        g.c(uv, '', s, 'UVs')
        term = g.mul(s, w, 'RGB', '')
        acc = term if acc is None else g.add(acc, term)
    return acc

def build_master():
    path = MAT_DIR + '/M_SB_Armor'
    if unreal.EditorAssetLibrary.does_asset_exist(path): unreal.EditorAssetLibrary.delete_asset(path)
    m = AT.create_asset('M_SB_Armor', MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property('used_with_skeletal_mesh', True)
    g = G(m)
    texN = unreal.load_asset(TEX_DIR + '/T_SB_ArmorDetail_N'); texM = unreal.load_asset(TEX_DIR + '/T_SB_ArmorDetail_M'); texF = unreal.load_asset(TEX_DIR + '/T_SB_Filigree_N')
    base = g.vec('BaseColor', (0.74, 0.69, 0.57, 1)); metal = g.scalar('Metallic', 0.0); rough = g.scalar('Roughness', 0.3)
    scale = g.scalar('DetailScale', 4.0, 'Detail'); dstr = g.scalar('DetailNormalStrength', 0.8, 'Detail')
    scr = g.scalar('ScratchAmount', 0.6, 'Detail'); dent = g.scalar('DentGrime', 0.5, 'Detail'); fil = g.scalar('FiligreeAmount', 0.0, 'Detail')
    filscale = g.scalar('FiligreeScale', 10.0, 'Detail')
    scol = g.vec('ScratchColor', (0.55, 0.55, 0.56, 1), 'Detail'); gcol = g.vec('GrimeColor', (0.30, 0.25, 0.18, 1), 'Detail')
    # pre-skinned position (cm) -> metres * scale
    # pre-skinned inputs are vertex-shader only: pass them to the pixel shader through vertex interpolators
    psp0 = g.n(unreal.MaterialExpressionPreSkinnedPosition); psn0 = g.n(unreal.MaterialExpressionPreSkinnedNormal)
    psp = g.n(unreal.MaterialExpressionVertexInterpolator); g.c(psp0, '', psp, '')
    psn = g.n(unreal.MaterialExpressionVertexInterpolator); g.c(psn0, '', psn, '')
    k = g.n(unreal.MaterialExpressionConstant, r=0.01)
    pm = g.mul(g.mul(psp, k), scale)
    pf = g.mul(g.mul(psp, k), filscale)
    uv = {nm: g.mask(pm, **f) for nm, f in (('x', dict(g=True, b=True)), ('y', dict(r=True, b=True)), ('z', dict(r=True, g=True)))}
    uvf = {nm: g.mask(pf, **f) for nm, f in (('x', dict(g=True, b=True)), ('y', dict(r=True, b=True)), ('z', dict(r=True, g=True)))}
    # blend weights = |n|^4 normalised
    an = g.n(unreal.MaterialExpressionAbs); g.c(psn, '', an, '')
    a2 = g.mul(an, an); a4 = g.mul(a2, a2)
    one3 = g.const3((1, 1, 1)); dot = g.n(unreal.MaterialExpressionDotProduct); g.c(a4, '', dot, 'A'); g.c(one3, '', dot, 'B')
    wn = g.n(unreal.MaterialExpressionDivide); g.c(a4, '', wn, 'A'); g.c(dot, '', wn, 'B')
    wx, wy, wz = g.mask(wn, r=True), g.mask(wn, g=True), g.mask(wn, b=True)
    S = unreal.MaterialSamplerType
    N = _triplanar(g, texN, uv['x'], uv['y'], uv['z'], wx, wy, wz, S.SAMPLERTYPE_NORMAL)
    Mk = _triplanar(g, texM, uv['x'], uv['y'], uv['z'], wx, wy, wz, S.SAMPLERTYPE_MASKS)
    F = _triplanar(g, texF, uvf['x'], uvf['y'], uvf['z'], wx, wy, wz, S.SAMPLERTYPE_NORMAL)
    mr, mg, mb = g.mask(Mk, r=True), g.mask(Mk, g=True), g.mask(Mk, b=True)
    # base colour: grime in dents, bright steel in scratches
    sr = g.mul(mr, scr); dg = g.mul(mg, dent)
    c1 = g.lerp(base, gcol, dg, '', '', ''); c2 = g.lerp(c1, scol, sr)
    ML.connect_material_property(c2, '', unreal.MaterialProperty.MP_BASE_COLOR)
    one = g.n(unreal.MaterialExpressionConstant, r=1.0)
    ML.connect_material_property(g.lerp(metal, one, sr), '', unreal.MaterialProperty.MP_METALLIC)
    half = g.n(unreal.MaterialExpressionConstant, r=0.5); k15 = g.n(unreal.MaterialExpressionConstant, r=0.15); k2 = g.n(unreal.MaterialExpressionConstant, r=0.25)
    rv = g.mul(g.op(unreal.MaterialExpressionSubtract, mb, half), k15)
    r1 = g.add(g.add(rough, rv), g.mul(dg, k2)); r2 = g.lerp(r1, g.n(unreal.MaterialExpressionConstant, r=0.22), sr)
    ML.connect_material_property(r2, '', unreal.MaterialProperty.MP_ROUGHNESS)
    flat = g.const3((0, 0, 1))
    n1 = g.lerp(flat, N, dstr); n2 = g.lerp(n1, F, fil)
    nn = g.n(unreal.MaterialExpressionNormalize); g.c(n2, '', nn, '')
    ML.connect_material_property(nn, '', unreal.MaterialProperty.MP_NORMAL)
    ML.recompile_material(m); unreal.EditorAssetLibrary.save_asset(m.get_path_name())
    return m

INSTANCES = {
    'MIH_Ivory':     {'BaseColor': (0.74, 0.69, 0.57, 1), 'Metallic': 0.0, 'Roughness': 0.30, 'ScratchAmount': 0.55, 'DentGrime': 0.45, 'FiligreeAmount': 0.0},
    'MIH_Gold':      {'BaseColor': (0.85, 0.60, 0.26, 1), 'Metallic': 1.0, 'Roughness': 0.26, 'ScratchAmount': 0.25, 'DentGrime': 0.7, 'FiligreeAmount': 0.9, 'GrimeColor': (0.22, 0.13, 0.05, 1), 'ScratchColor': (1.0, 0.8, 0.45, 1)},
    'MIH_Crimson':   {'BaseColor': (0.62, 0.025, 0.03, 1), 'Metallic': 0.0, 'Roughness': 0.42, 'ScratchAmount': 0.2, 'DentGrime': 0.12, 'FiligreeAmount': 0.0, 'GrimeColor': (0.35, 0.02, 0.02, 1)},
    'MIH_Wool':      {'BaseColor': (0.70, 0.66, 0.56, 1), 'Metallic': 0.0, 'Roughness': 0.92, 'ScratchAmount': 0.0, 'DentGrime': 0.55, 'FiligreeAmount': 0.0, 'DetailNormalStrength': 0.35, 'DetailScale': 9.0, 'GrimeColor': (0.36, 0.30, 0.22, 1)},
    'MIH_WoolBlack': {'BaseColor': (0.035, 0.032, 0.03, 1), 'Metallic': 0.0, 'Roughness': 0.9, 'ScratchAmount': 0.0, 'DentGrime': 0.4, 'FiligreeAmount': 0.0, 'DetailNormalStrength': 0.35, 'DetailScale': 9.0, 'GrimeColor': (0.10, 0.08, 0.06, 1)},
    'MIH_ClothRed':  {'BaseColor': (0.48, 0.018, 0.022, 1), 'Metallic': 0.0, 'Roughness': 0.88, 'ScratchAmount': 0.0, 'DentGrime': 0.35, 'FiligreeAmount': 0.0, 'DetailNormalStrength': 0.35, 'DetailScale': 9.0, 'GrimeColor': (0.22, 0.02, 0.02, 1)},
    'MIH_DarkSteel': {'BaseColor': (0.09, 0.09, 0.09, 1), 'Metallic': 1.0, 'Roughness': 0.42, 'ScratchAmount': 0.5, 'DentGrime': 0.3, 'FiligreeAmount': 0.0, 'ScratchColor': (0.5, 0.5, 0.5, 1)},
}

def build_instances():
    parent = unreal.load_asset(MAT_DIR + '/M_SB_Armor'); out = []
    for nm, params in INSTANCES.items():
        p = INST_DIR + '/' + nm
        mi = unreal.load_asset(p) if unreal.EditorAssetLibrary.does_asset_exist(p) else AT.create_asset(nm, INST_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        ML.set_material_instance_parent(mi, parent)
        for k, v in params.items():
            if isinstance(v, tuple): ML.set_material_instance_vector_parameter_value(mi, k, unreal.LinearColor(*v))
            else: ML.set_material_instance_scalar_parameter_value(mi, k, v)
        ML.update_material_instance(mi); unreal.EditorAssetLibrary.save_asset(mi.get_path_name()); out.append(nm)
    return out

# hero slot -> MIH instance (others keep the MI_*_SK library)
HERO_MAP = {'V16_Ivory': 'MIH_Ivory', 'ArmorPlate': 'MIH_Ivory', 'Armor': 'MIH_Ivory', 'V16_Gold': 'MIH_Gold', 'Gold': 'MIH_Gold',
            'V16_Crimson': 'MIH_Crimson', 'RedPaint': 'MIH_Crimson', 'V16_DarkSteel': 'MIH_DarkSteel', 'GunMetal': 'MIH_DarkSteel',
            'V16_Wool': 'MIH_Wool', 'CapeWool': 'MIH_Wool', 'TabardCloth': 'MIH_Wool', 'TabardClothBack': 'MIH_Wool',
            'CapeLining': 'MIH_ClothRed', 'V16_CrossCloth': 'MIH_ClothRed', 'V16_WoolBlack': 'MIH_WoolBlack'}

def assign_hero(sk_path):
    m = unreal.load_asset(sk_path); new = []; log = []
    for s in m.get_editor_property('materials'):
        n = str(s.material_slot_name).split('.')[0]; k = HERO_MAP.get(n)
        mi = unreal.load_asset(INST_DIR + '/' + k) if k else s.material_interface
        new.append(unreal.SkeletalMaterial(material_interface=mi, material_slot_name=s.material_slot_name, uv_channel_data=s.uv_channel_data))
        log.append((n, mi.get_name() if mi else None))
    m.set_editor_property('materials', new); unreal.EditorAssetLibrary.save_asset(m.get_path_name())
    return log


def assign_all():
    """hero + every order variant"""
    out = {'hero': len(assign_hero('/Game/SteelAndBlood/Characters/Player/HeroKnight_v14/SK_HeroKnight_v14/SkeletalMeshes/SK_HeroKnight_v14'))}
    for v in ('Bascinet', 'Sallet', 'Hooded'):
        out[v] = len(assign_hero('/Game/SteelAndBlood/Characters/Order/%s/SK_Knight_%s/SkeletalMeshes/SK_Knight_%s' % (v, v, v)))
    return out
