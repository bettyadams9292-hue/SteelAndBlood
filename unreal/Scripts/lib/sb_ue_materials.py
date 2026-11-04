"""Unreal-side: builds the Steel & Blood master surface material and the material-instance library,
and assigns instances to meshes by slot name. Run inside the Unreal Editor (Python plugin)."""
import unreal

AT = unreal.AssetToolsHelpers.get_asset_tools()
MEL = unreal.MaterialEditingLibrary
EAL = unreal.EditorAssetLibrary
MDIR = '/Game/SteelAndBlood/Materials'

# name: (base colour (linear), metallic, roughness, grime amount, grime tint, chainmail rings, emissive)
PALETTE = {
    'Steel':      ((0.55, 0.56, 0.58), 1.0, 0.30, 0.35, (0.45, 0.36, 0.28), False, None),
    'SteelDark':  ((0.10, 0.10, 0.11), 1.0, 0.42, 0.30, (0.6, 0.5, 0.4), False, None),
    'Chainmail':  ((0.38, 0.38, 0.40), 1.0, 0.45, 0.45, (0.40, 0.30, 0.22), True, None),
    'Leather':    ((0.13, 0.065, 0.03), 0.0, 0.62, 0.35, (0.6, 0.55, 0.5), False, None),
    'ClothWhite': ((0.62, 0.58, 0.50), 0.0, 0.88, 0.55, (0.55, 0.47, 0.38), False, None),
    'ClothRed':   ((0.30, 0.015, 0.012), 0.0, 0.82, 0.40, (0.5, 0.4, 0.35), False, None),
    'Gold':       ((0.85, 0.60, 0.25), 1.0, 0.30, 0.30, (0.5, 0.4, 0.3), False, None),
    'Visor':      ((0.01, 0.01, 0.01), 0.0, 0.7, 0.0, (1, 1, 1), False, None),
    'Wood':       ((0.16, 0.09, 0.045), 0.0, 0.72, 0.4, (0.6, 0.55, 0.5), False, None),
    'WoodDead':   ((0.10, 0.09, 0.08), 0.0, 0.85, 0.5, (0.7, 0.7, 0.65), False, None),
    'Stone':      ((0.26, 0.245, 0.22), 0.0, 0.86, 0.6, (0.45, 0.5, 0.35), False, None),
    'StoneDark':  ((0.12, 0.115, 0.11), 0.0, 0.9, 0.55, (0.5, 0.55, 0.4), False, None),
    'Iron':       ((0.07, 0.065, 0.06), 1.0, 0.62, 0.7, (1.6, 0.9, 0.5), False, None),
    'Ember':      ((0.2, 0.05, 0.01), 0.0, 0.6, 0.3, (0.2, 0.2, 0.2), False, (1.0, 0.35, 0.06, 18.0)),
    'Bone':       ((0.52, 0.47, 0.37), 0.0, 0.6, 0.5, (0.6, 0.5, 0.35), False, None),
    'Flesh':      ((0.20, 0.21, 0.15), 0.0, 0.55, 0.6, (0.35, 0.12, 0.08), False, None),
    'Gore':       ((0.16, 0.01, 0.008), 0.0, 0.35, 0.3, (0.4, 0.3, 0.2), False, None),
    'Rags':       ((0.14, 0.12, 0.09), 0.0, 0.92, 0.6, (0.5, 0.4, 0.3), False, None),
}

def _asset(cls, name, path, factory):
    full = path + '/' + name
    if EAL.does_asset_exist(full):
        return unreal.load_asset(full)
    return AT.create_asset(name, path, cls, factory)

def build_master():
    m = _asset(unreal.Material, 'M_SB_Surface', MDIR + '/Master', unreal.MaterialFactoryNew())
    MEL.delete_all_material_expressions(m)
    C = MEL.connect_material_expressions
    def E(cls, x, y): return MEL.create_material_expression(m, cls, x, y)
    def sp(name, v, x, y):
        n = E(unreal.MaterialExpressionScalarParameter, x, y); n.set_editor_property('parameter_name', name); n.set_editor_property('default_value', v); return n
    def vp(name, v, x, y):
        n = E(unreal.MaterialExpressionVectorParameter, x, y); n.set_editor_property('parameter_name', name); n.set_editor_property('default_value', unreal.LinearColor(*v)); return n
    def sw(name, t, f, x, y):
        n = E(unreal.MaterialExpressionStaticSwitchParameter, x, y); n.set_editor_property('parameter_name', name)
        C(t, '', n, 'True'); C(f, '', n, 'False'); return n
    def bin_(cls, a, b, x, y, cb=None):
        n = E(cls, x, y); C(a, '', n, 'A')
        if b is not None: C(b, '', n, 'B')
        else: n.set_editor_property('const_b', cb)
        return n
    def one(cls, a, x, y):
        n = E(cls, x, y); C(a, '', n, ''); return n
    def lerp(a, b, al, x, y, ca=None, cb=None):
        n = E(unreal.MaterialExpressionLinearInterpolate, x, y)
        if a is not None: C(a, '', n, 'A')
        else: n.set_editor_property('const_a', ca)
        if b is not None: C(b, '', n, 'B')
        else: n.set_editor_property('const_b', cb)
        C(al, '', n, 'Alpha'); return n
    def noise(pos, scale, levels, x, y):
        n = E(unreal.MaterialExpressionNoise, x, y)
        for k, v in (('scale', scale), ('levels', levels), ('output_min', 0.0), ('output_max', 1.0), ('quality', 1)):
            n.set_editor_property(k, v)
        C(pos, '', n, 'Position'); return n
    X = -1800
    base = vp('BaseColor', (0.5, 0.5, 0.5, 1), X, -400); metal = sp('Metallic', 0.0, X, -200); rough = sp('Roughness', 0.6, X, -100)
    gamt = sp('GrimeAmount', 0.4, X, 0); gtint = vp('GrimeTint', (0.5, 0.45, 0.4, 1), X, 100); gscale = sp('GrimeScale', 0.012, X, 250)
    rvar = sp('RoughnessVariation', 0.25, X, 350); ringscale = sp('RingScale', 70.0, X, 450)
    emc = vp('EmissiveColor', (0, 0, 0, 1), X, 600); ems = sp('EmissiveStrength', 0.0, X, 750)
    # position source: world space for static props, pre-skinned local space for characters (no swimming)
    wp = E(unreal.MaterialExpressionWorldPosition, X, 900); lp = E(unreal.MaterialExpressionPreSkinnedPosition, X, 1000)
    pos = sw('Skinned', lp, wp, X+250, 950)
    ps = bin_(unreal.MaterialExpressionMultiply, pos, gscale, X+450, 950)
    n1 = noise(ps, 1.0, 5, X+650, 900)
    ps8 = bin_(unreal.MaterialExpressionMultiply, ps, None, X+650, 1100, cb=9.0)
    n2 = noise(ps8, 1.0, 3, X+850, 1100)
    g2 = bin_(unreal.MaterialExpressionMultiply, n1, n1, X+900, 900)
    gm = bin_(unreal.MaterialExpressionMultiply, g2, gamt, X+1050, 900)
    gmask = one(unreal.MaterialExpressionSaturate, bin_(unreal.MaterialExpressionMultiply, gm, None, X+1200, 900, cb=2.2), X+1350, 900)
    # chainmail: procedural ring cells from UVs
    tc = E(unreal.MaterialExpressionTextureCoordinate, X, 1300)
    tcs = bin_(unreal.MaterialExpressionMultiply, tc, ringscale, X+200, 1300)
    fr = one(unreal.MaterialExpressionFrac, tcs, X+350, 1300)
    c05 = bin_(unreal.MaterialExpressionSubtract, fr, None, X+500, 1300, cb=0.5)
    ln = E(unreal.MaterialExpressionLength, X+650, 1300); C(c05, '', ln, '')
    d = bin_(unreal.MaterialExpressionSubtract, ln, None, X+800, 1300, cb=0.33)
    ab = one(unreal.MaterialExpressionAbs, d, X+950, 1300)
    rm = one(unreal.MaterialExpressionOneMinus, bin_(unreal.MaterialExpressionMultiply, ab, None, X+1100, 1300, cb=6.0), X+1250, 1300)
    rmask = one(unreal.MaterialExpressionSaturate, rm, X+1400, 1300)
    ringshade = lerp(None, None, rmask, X+1550, 1300, ca=0.25, cb=1.0)
    c1 = E(unreal.MaterialExpressionConstant, X+1550, 1450); c1.set_editor_property('r', 1.0)
    ring = sw('Chainmail', ringshade, c1, X+1750, 1350)
    # colour
    col = bin_(unreal.MaterialExpressionMultiply, base, ring, X+1900, -400)
    gcol = bin_(unreal.MaterialExpressionMultiply, col, gtint, X+2050, -300)
    fcol = lerp(col, gcol, gmask, X+2250, -350)
    MEL.connect_material_property(fcol, '', unreal.MaterialProperty.MP_BASE_COLOR)
    # metallic: grime dulls metal
    mm = bin_(unreal.MaterialExpressionMultiply, metal, one(unreal.MaterialExpressionOneMinus, bin_(unreal.MaterialExpressionMultiply, gmask, None, X+1900, -150, cb=0.6), X+2050, -150), X+2250, -180)
    MEL.connect_material_property(mm, '', unreal.MaterialProperty.MP_METALLIC)
    # roughness: micro variation + grime + ring gaps
    nv = bin_(unreal.MaterialExpressionSubtract, n2, None, X+1050, 1100, cb=0.5)
    rv = bin_(unreal.MaterialExpressionMultiply, nv, rvar, X+1200, 1100)
    ra = bin_(unreal.MaterialExpressionAdd, rough, rv, X+1900, -60)
    rg = lerp(ra, None, gmask, X+2050, -60, cb=0.92)
    gap = bin_(unreal.MaterialExpressionMultiply, one(unreal.MaterialExpressionOneMinus, ring, X+1900, 60), None, X+2050, 60, cb=0.5)
    rf = one(unreal.MaterialExpressionSaturate, bin_(unreal.MaterialExpressionAdd, rg, gap, X+2200, 0), X+2350, 0)
    MEL.connect_material_property(rf, '', unreal.MaterialProperty.MP_ROUGHNESS)
    em = bin_(unreal.MaterialExpressionMultiply, emc, ems, X+2050, 600)
    emf = bin_(unreal.MaterialExpressionMultiply, em, lerp(None, None, n2, X+2050, 750, ca=0.55, cb=1.25), X+2250, 650)
    MEL.connect_material_property(emf, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    m.set_editor_property('used_with_skeletal_mesh', True)
    MEL.recompile_material(m)
    EAL.save_asset(m.get_path_name())
    return m

def instance(name, skinned=False):
    """Returns (creating if needed) MI_<name>[_SK]."""
    p = PALETTE[name]
    mi_name = 'MI_' + name + ('_SK' if skinned else '')
    mi = _asset(unreal.MaterialInstanceConstant, mi_name, MDIR + '/Instances', unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, unreal.load_asset(MDIR + '/Master/M_SB_Surface'))
    col, met, rou, gam, gt, rings, emi = p
    MEL.set_material_instance_vector_parameter_value(mi, 'BaseColor', unreal.LinearColor(col[0], col[1], col[2], 1))
    MEL.set_material_instance_scalar_parameter_value(mi, 'Metallic', met)
    MEL.set_material_instance_scalar_parameter_value(mi, 'Roughness', rou)
    MEL.set_material_instance_scalar_parameter_value(mi, 'GrimeAmount', gam)
    MEL.set_material_instance_vector_parameter_value(mi, 'GrimeTint', unreal.LinearColor(gt[0], gt[1], gt[2], 1))
    MEL.set_material_instance_static_switch_parameter_value(mi, 'Chainmail', rings)
    MEL.set_material_instance_static_switch_parameter_value(mi, 'Skinned', skinned)
    if emi:
        MEL.set_material_instance_vector_parameter_value(mi, 'EmissiveColor', unreal.LinearColor(emi[0], emi[1], emi[2], 1))
        MEL.set_material_instance_scalar_parameter_value(mi, 'EmissiveStrength', emi[3])
    MEL.update_material_instance(mi)
    EAL.save_asset(mi.get_path_name())
    return mi

def build_library():
    build_master()
    out = []
    for k in PALETTE:
        instance(k, False); instance(k, True); out.append(k)
    return out

def _key(slot):
    s = str(slot)
    for pre in ('M_', 'MI_'):
        if s.startswith(pre): s = s[len(pre):]
    return s if s in PALETTE else None

def apply_static(sm):
    mats = sm.get_editor_property('static_materials'); done = []
    for i, smat in enumerate(mats):
        k = _key(smat.get_editor_property('material_slot_name'))
        if k:
            sm.set_material(i, unreal.load_asset(MDIR + '/Instances/MI_' + k)); done.append(k)
    EAL.save_asset(sm.get_path_name())
    return done

def apply_skeletal(sk):
    mats = sk.get_editor_property('materials'); done = []
    for smat in mats:
        k = _key(smat.get_editor_property('material_slot_name'))
        if k:
            smat.set_editor_property('material_interface', unreal.load_asset(MDIR + '/Instances/MI_' + k + '_SK')); done.append(k)
    sk.set_editor_property('materials', mats)
    EAL.save_asset(sk.get_path_name())
    return done
