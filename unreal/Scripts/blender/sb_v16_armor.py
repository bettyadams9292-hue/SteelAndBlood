"""Steel & Blood hero knight v16 - armour rebuild (character overhaul brief, Nov 2026).
Replaces the primitive-assembled plates of v13-v15 with lofted, thickness-bevelled plate armour:
anatomical breastplate with a medial ridge, backplate, layered gorget, articulated faulds, layered
pauldrons, gold-bordered edges with rolled piping, and crosses pattee as real geometry.
Everything is rigidly bound to the existing UE-named RIG_Knight bones, so animations still work.
All new objects are prefixed V16_ and the module is re-runnable (clear() then build)."""
import bpy, bmesh, math, re
from mathutils import Vector, Matrix

D = bpy.data
CY = -0.012  # torso centre line (y); front is -Y

def rig(): return D.objects['RIG_Knight']

def coll():
    c = D.collections.get('V16')
    if not c:
        c = D.collections.new('V16'); bpy.context.scene.collection.children.link(c)
    return c

def lerp_tab(tab, x):
    """piecewise-linear lookup in [(x, y), ...] sorted by x"""
    if x <= tab[0][0]: return tab[0][1]
    for (x0, y0), (x1, y1) in zip(tab, tab[1:]):
        if x <= x1:
            t = (x - x0) / (x1 - x0); t = t * t * (3 - 2 * t); return y0 + (y1 - y0) * t
    return tab[-1][1]

def sgnpow(v, p): return math.copysign(abs(v) ** p, v)

# ------------------------------------------------------------------ materials
def _n(t, kind, x, y, **kw):
    n = t.nodes.new(kind); n.location = (x, y)
    for k, v in kw.items():
        if k in n.inputs and not hasattr(n, k): n.inputs[k].default_value = v
        elif hasattr(n, k): setattr(n, k, v)
        else: n.inputs[k].default_value = v
    return n

def _L(t, a, ao, b, bi): t.links.new(a.outputs[ao], b.inputs[bi])

def _ramp(t, x, y, stops):
    r = _n(t, 'ShaderNodeValToRGB', x, y); e = r.color_ramp.elements
    while len(e) > 1: e.remove(e[-1])
    e[0].position, e[0].color = stops[0][0], stops[0][1]
    for p, c in stops[1:]:
        el = e.new(p); el.color = c
    return r

def _new_mat(name):
    m = D.materials.get(name) or D.materials.new(name)
    m.use_nodes = True; t = m.node_tree
    for n in list(t.nodes): t.nodes.remove(n)
    return m, t

def _edge_mask(t, x, y, radius=0.004, lo=0.015, hi=0.07):
    """Cycles bevel-normal vs true normal -> 0 on flats, 1 on sharp/rolled edges"""
    bev = _n(t, 'ShaderNodeBevel', x, y, Radius=radius); geo = _n(t, 'ShaderNodeNewGeometry', x, y - 200)
    dot = _n(t, 'ShaderNodeVectorMath', x + 200, y, operation='DOT_PRODUCT'); _L(t, bev, 'Normal', dot, 0); _L(t, geo, 'Normal', dot, 1)
    mr = _n(t, 'ShaderNodeMapRange', x + 400, y); mr.inputs['From Min'].default_value = 1.0 - lo; mr.inputs['From Max'].default_value = 1.0 - hi
    _L(t, dot, 'Value', mr, 'Value')
    return mr  # output 'Result'

def mat_ivory(name='V16_Ivory', base=(0.80, 0.755, 0.655)):
    """Polished ivory enamel on steel: clearcoat, faint orange-peel, worn edges showing bright steel,
    fine directional scratches, shallow dents and cavity grime. No blotchy chips."""
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 1500, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 1150, 0); _L(t, b, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -1600, 0)
    # edge wear, broken up by noise
    em = _edge_mask(t, -1300, 400)
    wn = _n(t, 'ShaderNodeTexNoise', -1300, 650, Scale=38.0, Detail=6.0, Roughness=0.6); _L(t, tc, 'Object', wn, 'Vector')
    wm = _n(t, 'ShaderNodeMath', -800, 500, operation='MULTIPLY'); _L(t, em, 'Result', wm, 0); _L(t, wn, 'Fac', wm, 1)
    wear = _ramp(t, -600, 500, [(0.22, (0, 0, 0, 1)), (0.34, (1, 1, 1, 1))]); _L(t, wm, 0, wear, 'Fac')
    # scratches: stretched noise -> thin lines
    mp = _n(t, 'ShaderNodeMapping', -1300, 150); mp.inputs['Scale'].default_value = (60.0, 60.0, 1.8); mp.inputs['Rotation'].default_value = (0.3, 0.8, 0.2)
    _L(t, tc, 'Object', mp, 'Vector')
    sc = _n(t, 'ShaderNodeTexNoise', -1100, 150, Scale=4.0, Detail=2.0); _L(t, mp, 'Vector', sc, 'Vector')
    scr = _ramp(t, -900, 150, [(0.495, (0, 0, 0, 1)), (0.5, (1, 1, 1, 1)), (0.505, (0, 0, 0, 1))]); _L(t, sc, 'Fac', scr, 'Fac')
    sm = _n(t, 'ShaderNodeTexNoise', -1100, -50, Scale=6.0, Detail=3.0); _L(t, tc, 'Object', sm, 'Vector')
    smr = _ramp(t, -900, -50, [(0.5, (0, 0, 0, 1)), (0.62, (1, 1, 1, 1))]); _L(t, sm, 'Fac', smr, 'Fac')
    scm = _n(t, 'ShaderNodeMath', -650, 100, operation='MULTIPLY'); _L(t, scr, 'Color', scm, 0); _L(t, smr, 'Color', scm, 1)
    # cavity grime (AO) + subtle tonal variation
    ao = _n(t, 'ShaderNodeAmbientOcclusion', -1300, -300, samples=12); ao.inputs['Distance'].default_value = 0.03
    gr = _ramp(t, -1050, -300, [(0.4, (0.36, 0.30, 0.22, 1)), (0.95, (1, 1, 1, 1))]); _L(t, ao, 'AO', gr, 'Fac')
    tn = _n(t, 'ShaderNodeTexNoise', -1300, -550, Scale=2.5, Detail=8.0, Roughness=0.55); _L(t, tc, 'Object', tn, 'Vector')
    tr = _ramp(t, -1050, -550, [(0.3, (base[0] * 0.9, base[1] * 0.87, base[2] * 0.8, 1)), (0.7, (*base, 1))]); _L(t, tn, 'Fac', tr, 'Fac')
    c1 = _n(t, 'ShaderNodeMix', -650, -350, data_type='RGBA', blend_type='MULTIPLY'); c1.inputs['Factor'].default_value = 1.0
    _L(t, tr, 'Color', c1, 'A'); _L(t, gr, 'Color', c1, 'B')
    c2 = _n(t, 'ShaderNodeMix', -400, -200, data_type='RGBA'); _L(t, scm, 0, c2, 'Factor'); _L(t, c1, 'Result', c2, 'A'); c2.inputs['B'].default_value = (0.5, 0.47, 0.42, 1)
    c3 = _n(t, 'ShaderNodeMix', -150, 0, data_type='RGBA'); _L(t, wear, 'Color', c3, 'Factor'); _L(t, c2, 'Result', c3, 'A'); c3.inputs['B'].default_value = (0.62, 0.62, 0.63, 1)
    _L(t, c3, 'Result', b, 'Base Color')
    mt = _n(t, 'ShaderNodeMath', 200, 300, operation='MULTIPLY'); _L(t, wear, 'Color', mt, 0); mt.inputs[1].default_value = 1.0; _L(t, mt, 0, b, 'Metallic')
    rr = _n(t, 'ShaderNodeMapRange', 200, 100); rr.inputs['To Min'].default_value = 0.26; rr.inputs['To Max'].default_value = 0.42; _L(t, scm, 0, rr, 'Value')
    _L(t, rr, 'Result', b, 'Roughness')
    for k, v in (('Coat Weight', 0.55), ('Coat Roughness', 0.12), ('Specular IOR Level', 0.55)):
        if k in b.inputs: b.inputs[k].default_value = v
    # dents + orange peel + scratch grooves
    dn = _n(t, 'ShaderNodeTexNoise', 300, -500, Scale=5.0, Detail=2.0); _L(t, tc, 'Object', dn, 'Vector')
    op = _n(t, 'ShaderNodeTexNoise', 300, -700, Scale=400.0, Detail=1.0); _L(t, tc, 'Object', op, 'Vector')
    h = _n(t, 'ShaderNodeMath', 550, -550, operation='MULTIPLY_ADD'); _L(t, op, 'Fac', h, 0); h.inputs[1].default_value = 0.03; _L(t, dn, 'Fac', h, 2)
    h2 = _n(t, 'ShaderNodeMath', 700, -550, operation='SUBTRACT'); _L(t, h, 0, h2, 0); _L(t, scm, 0, h2, 1)
    bump = _n(t, 'ShaderNodeBump', 900, -400, Strength=0.12, Distance=0.002); _L(t, h2, 0, bump, 'Height')
    _L(t, bump, 'Normal', b, 'Normal')
    if 'Coat Normal' in b.inputs: _L(t, bump, 'Normal', b, 'Coat Normal')
    return m

def mat_gold(name='V16_Gold'):
    """Engraved gilt: metallic gold, worn brighter on raised edges, filigree bump, dark cavities."""
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 1300, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 1000, 0); _L(t, b, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -1400, 0)
    # filigree: distorted wave rings + voronoi scrolls
    wv = _n(t, 'ShaderNodeTexWave', -1100, 300, wave_type='RINGS', Scale=55.0, Distortion=7.0, Detail=3.0, **{'Detail Scale': 2.0}); _L(t, tc, 'Object', wv, 'Vector')
    vo = _n(t, 'ShaderNodeTexVoronoi', -1100, 50, feature='DISTANCE_TO_EDGE', Scale=90.0); _L(t, tc, 'Object', vo, 'Vector')
    wr = _ramp(t, -850, 300, [(0.45, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1))]); _L(t, wv, 'Fac', wr, 'Fac')
    vr = _ramp(t, -850, 50, [(0.0, (0, 0, 0, 1)), (0.05, (1, 1, 1, 1))]); _L(t, vo, 'Distance', vr, 'Fac')
    eng = _n(t, 'ShaderNodeMath', -600, 200, operation='MULTIPLY'); _L(t, wr, 'Color', eng, 0); _L(t, vr, 'Color', eng, 1)
    ao = _n(t, 'ShaderNodeAmbientOcclusion', -1100, -250, samples=12); ao.inputs['Distance'].default_value = 0.02
    em = _edge_mask(t, -1100, -500, radius=0.003)
    col = _ramp(t, -600, -100, [(0.0, (0.28, 0.16, 0.05, 1)), (0.6, (0.86, 0.6, 0.24, 1)), (1.0, (1.0, 0.78, 0.4, 1))])
    f = _n(t, 'ShaderNodeMath', -800, -200, operation='MULTIPLY'); _L(t, ao, 'AO', f, 0); _L(t, eng, 0, f, 1)
    f2 = _n(t, 'ShaderNodeMath', -700, -350, operation='ADD'); _L(t, f, 0, f2, 0); _L(t, em, 'Result', f2, 1)
    f3 = _n(t, 'ShaderNodeMath', -650, -450, operation='MULTIPLY', use_clamp=True); _L(t, f2, 0, f3, 0); f3.inputs[1].default_value = 0.85
    _L(t, f3, 0, col, 'Fac'); _L(t, col, 'Color', b, 'Base Color')
    b.inputs['Metallic'].default_value = 1.0
    rn = _n(t, 'ShaderNodeTexNoise', -600, -650, Scale=30.0, Detail=6.0); _L(t, tc, 'Object', rn, 'Vector')
    rr = _n(t, 'ShaderNodeMapRange', -350, -650); rr.inputs['To Min'].default_value = 0.18; rr.inputs['To Max'].default_value = 0.38; _L(t, rn, 'Fac', rr, 'Value')
    _L(t, rr, 'Result', b, 'Roughness')
    bump = _n(t, 'ShaderNodeBump', 600, -400, Strength=0.55, Distance=0.0007); _L(t, eng, 0, bump, 'Height'); _L(t, bump, 'Normal', b, 'Normal')
    return m

def mat_crimson(name='V16_Crimson', col=(0.30, 0.012, 0.016)):
    """Hand-painted crimson enamel for crosses: deep red, slight brush variation, worn to steel at edges."""
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 1100, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 800, 0); _L(t, b, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -1200, 0)
    mp = _n(t, 'ShaderNodeMapping', -1000, 200); mp.inputs['Scale'].default_value = (1.0, 1.0, 30.0); _L(t, tc, 'Object', mp, 'Vector')
    br = _n(t, 'ShaderNodeTexNoise', -800, 200, Scale=25.0, Detail=4.0); _L(t, mp, 'Vector', br, 'Vector')
    cr = _ramp(t, -550, 200, [(0.35, (col[0] * 0.7, col[1] * 0.8, col[2], 1)), (0.65, (*col, 1))]); _L(t, br, 'Fac', cr, 'Fac')
    em = _edge_mask(t, -800, -200, radius=0.0025)
    wn = _n(t, 'ShaderNodeTexNoise', -800, -450, Scale=45.0, Detail=6.0); _L(t, tc, 'Object', wn, 'Vector')
    wm = _n(t, 'ShaderNodeMath', -400, -250, operation='MULTIPLY'); _L(t, em, 'Result', wm, 0); _L(t, wn, 'Fac', wm, 1)
    wear = _ramp(t, -200, -250, [(0.2, (0, 0, 0, 1)), (0.32, (1, 1, 1, 1))]); _L(t, wm, 0, wear, 'Fac')
    c = _n(t, 'ShaderNodeMix', 200, 100, data_type='RGBA'); _L(t, wear, 'Color', c, 'Factor'); _L(t, cr, 'Color', c, 'A'); c.inputs['B'].default_value = (0.6, 0.6, 0.6, 1)
    _L(t, c, 'Result', b, 'Base Color'); _L(t, wear, 'Color', b, 'Metallic')
    b.inputs['Roughness'].default_value = 0.34
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = 0.35
    return m

def mat_dark_steel(name='V16_DarkSteel'):
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 900, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 600, 0); _L(t, b, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -800, 0)
    n = _n(t, 'ShaderNodeTexNoise', -600, 0, Scale=60.0, Detail=8.0); _L(t, tc, 'Object', n, 'Vector')
    r = _n(t, 'ShaderNodeMapRange', -300, 0); r.inputs['To Min'].default_value = 0.3; r.inputs['To Max'].default_value = 0.55; _L(t, n, 'Fac', r, 'Value')
    b.inputs['Base Color'].default_value = (0.11, 0.105, 0.1, 1); b.inputs['Metallic'].default_value = 1.0; _L(t, r, 'Result', b, 'Roughness')
    return m

def materials():
    return {'ivory': mat_ivory(), 'gold': mat_gold(), 'red': mat_crimson(), 'dark': mat_dark_steel()}

# ------------------------------------------------------------------ geometry helpers
def clear(prefix='V16_'):
    for o in [o for o in D.objects if o.name.startswith(prefix)]:
        D.objects.remove(o, do_unlink=True)
    for me in [m for m in D.meshes if m.name.startswith(prefix) and m.users == 0]: D.meshes.remove(me)
    for cu in [c for c in D.curves if c.name.startswith(prefix) and c.users == 0]: D.curves.remove(cu)

def bind_rigid(o, bn):
    r = rig(); mw = o.matrix_world.copy()
    o.parent = r; o.parent_type = 'BONE'; o.parent_bone = bn
    pb = r.pose.bones[bn]
    o.matrix_parent_inverse = (r.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted()
    o.matrix_world = mw
    return o

def grid_obj(name, rows, mats, mat_fn=None, closed=False, outward=None):
    """Quad surface from rows of points. mat_fn(i, j, nr, nc) -> material index."""
    me = D.meshes.new(name); bm = bmesh.new()
    V = [[bm.verts.new(p) for p in r] for r in rows]
    nr, nc = len(rows), len(rows[0])
    for i in range(nr - 1):
        for j in range(nc if closed else nc - 1):
            j2 = (j + 1) % nc
            f = bm.faces.new((V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j])); f.smooth = True
            if mat_fn: f.material_index = mat_fn(i, j, nr, nc)
    if outward:
        bm.normal_update()
        s = sum(f.normal.dot(outward(f.calc_center_median())) for f in bm.faces)
        if s < 0: bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    o = D.objects.new(name, me); coll().objects.link(o)
    return o

def finish_plate(o, thick=0.0045, bevel=0.0016, segs=2):
    s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = thick; s.offset = -1.0; s.use_even_offset = True; s.use_rim = True
    b = o.modifiers.new('Edge', 'BEVEL'); b.width = bevel; b.segments = segs; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(50)
    b.harden_normals = True
    return o

def pipe(name, pts, radius, mat, closed=False):
    """Rolled-edge piping along a polyline."""
    cu = D.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 2; cu.resolution_u = 2
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts): p.co = (q.x, q.y, q.z, 1.0)
    sp.use_cyclic_u = closed
    cu.materials.append(mat)
    o = D.objects.new(name, cu); coll().objects.link(o)
    return o

def border_fn(rows_lo=0, rows_hi=0, cols=0, band=1):
    """material 1 on the outer `band` rows/cols of the listed edges"""
    def f(i, j, nr, nc):
        if rows_lo and i < band: return 1
        if rows_hi and i >= nr - 1 - band: return 1
        if cols and (j < band or j >= nc - 1 - band): return 1
        return 0
    return f

def edge_lines(rows, closed=False):
    top = rows[-1]; bot = rows[0]
    left = [r[0] for r in rows]; right = [r[-1] for r in rows]
    return bot, top, left, right

# ------------------------------------------------------------------ cross pattee decal
def cross_pattee_outline(half=1.0, waist=0.085, flare=0.30, notch=0.045):
    """2D outline (x, y) of a Templar cross pattee, arms flared, ends slightly concave"""
    pts = []
    for k in range(4):
        a = k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        def R(x, y): return (x * ca - y * sa, x * sa + y * ca)
        # one arm pointing +y: from inner corner right -> outer right -> notch -> outer left -> inner left
        for (x, y) in ((waist, waist), (flare, half), (0.0, half - notch), (-flare, half)):
            pts.append(R(x, y))
    return pts

def decal(name, outline, center, normal, up, size, mat, target, offset, thick, bone):
    """Flat outline mesh -> subdivided -> shrinkwrapped onto target -> thin solid. Real geometry."""
    n = normal.normalized(); u = (up - n * up.dot(n)).normalized(); r = u.cross(n)
    me = D.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new(center + r * (x * size) + u * (y * size)) for x, y in outline]
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    for _ in range(3):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
    for fc in bm.faces: fc.smooth = True
    bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = D.objects.new(name, me); coll().objects.link(o)
    sw = o.modifiers.new('Wrap', 'SHRINKWRAP'); sw.target = target; sw.wrap_method = 'NEAREST_SURFACEPOINT'; sw.wrap_mode = 'OUTSIDE_SURFACE'; sw.offset = offset
    s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = thick; s.offset = 1.0
    b = o.modifiers.new('Edge', 'BEVEL'); b.width = min(0.0008, thick * 0.4); b.segments = 1; b.limit_method = 'ANGLE'
    bind_rigid(o, bone)
    return o

# ------------------------------------------------------------------ pieces
def torso_ring(z, u, a, b, n, front=True, keel=0.0, theta_max=105.0):
    th = math.radians(theta_max) * u
    s, c = math.sin(th), math.cos(th)
    x = a * sgnpow(s, 2.0 / n)
    y = b * sgnpow(c, 2.0 / n)
    y += keel * math.exp(-(x / 0.05) ** 2)
    return Vector((x, CY - y if front else CY + y, z))

BP_A = [(1.06, 0.205), (1.12, 0.193), (1.22, 0.208), (1.32, 0.236), (1.40, 0.246), (1.47, 0.226), (1.53, 0.18)]
BP_B = [(1.06, 0.170), (1.12, 0.160), (1.22, 0.176), (1.32, 0.206), (1.40, 0.214), (1.47, 0.197), (1.53, 0.155)]
BP_T = [(1.06, 106.0), (1.28, 104.0), (1.36, 84.0), (1.44, 66.0), (1.53, 50.0)]

def breastplate(M):
    nr, nc = 28, 41; rows = []
    for i in range(nr):
        v = i / (nr - 1); row = []
        for j in range(nc):
            u = j / (nc - 1) * 2 - 1
            z_top = 1.53 - 0.055 * math.exp(-((u * 0.9) / 0.32) ** 2)   # neckline scoop
            z = 1.06 + v * (z_top - 1.06)
            keel = 0.016 * math.sin(math.pi * min(1.0, max(0.0, (z - 1.08) / 0.40)))
            row.append(torso_ring(z, u, lerp_tab(BP_A, z), lerp_tab(BP_B, z), 2.7, True, keel, lerp_tab(BP_T, z)))
        rows.append(row)
    o = grid_obj('V16_Breastplate', rows, [M['ivory'], M['gold']], border_fn(1, 1, 1, 1), outward=lambda p: Vector((p.x, p.y - CY, 0)))
    finish_plate(o, 0.005)
    bot, top, left, right = edge_lines(rows)
    for nm, pts in (('Bot', bot), ('Top', top), ('L', left), ('R', right)):
        bind_rigid(pipe('V16_BreastPipe' + nm, pts, 0.0048, M['gold']), 'spine_02')
    bind_rigid(o, 'spine_02')
    return o

def backplate(M):
    nr, nc = 22, 33; rows = []
    for i in range(nr):
        v = i / (nr - 1); row = []
        for j in range(nc):
            u = j / (nc - 1) * 2 - 1
            z_top = 1.50 - 0.02 * math.exp(-((u) / 0.35) ** 2)
            z = 1.07 + v * (z_top - 1.07)
            a = lerp_tab(BP_A, z) - 0.01; b = 0.122 + 0.02 * math.sin(math.pi * (z - 1.07) / 0.45)
            # shallow spine groove
            row.append(torso_ring(z, u, a, b, 3.0, False, -0.008, 76.0))
        rows.append(row)
    o = grid_obj('V16_Backplate', rows, [M['ivory'], M['gold']], border_fn(1, 1, 0, 1), outward=lambda p: Vector((p.x, p.y - CY, 0)))
    finish_plate(o, 0.0045)
    bot, top, _, _ = edge_lines(rows)
    for nm, pts in (('Bot', bot), ('Top', top)):
        bind_rigid(pipe('V16_BackPipe' + nm, pts, 0.0042, M['gold']), 'spine_02')
    bind_rigid(o, 'spine_02')
    return o

def faulds(M):
    lames = [(1.085, 0.995, 0.206, 0.182, 0.008), (1.015, 0.925, 0.218, 0.194, 0.012), (0.945, 0.855, 0.230, 0.206, 0.016)]
    out = []
    for k, (zt, zb, a, b, fl) in enumerate(lames):
        nr, nc = 7, 37; rows = []
        for i in range(nr):
            v = i / (nr - 1); z = zb + (zt - zb) * v; flare = fl * (1 - v)
            rows.append([torso_ring(z, j / (nc - 1) * 2 - 1, a + flare, b + flare, 2.6, True, 0.008, 112.0) for j in range(nc)])
        o = grid_obj('V16_Fauld%d' % k, rows, [M['ivory'], M['gold']], border_fn(1, 0, 0, 1), outward=lambda p: Vector((p.x, p.y - CY, 0)))
        finish_plate(o, 0.004)
        bind_rigid(pipe('V16_FauldPipe%d' % k, rows[0], 0.0038, M['gold']), 'pelvis')
        # rivets at both ends
        for j in (2, nc - 3):
            p = rows[nr // 2][j]
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0065, location=p)
            rv = bpy.context.active_object; rv.name = 'V16_FauldRivet%d_%d' % (k, j); rv.scale = (1, 1, 0.6)
            for c in rv.users_collection: c.objects.unlink(rv)
            coll().objects.link(rv); rv.data.materials.append(M['gold']); bind_rigid(rv, 'pelvis')
        bind_rigid(o, 'pelvis'); out.append(o)
    return out

def gorget(M):
    lames = [(1.465, 1.512, (0.205, 0.180, 0.135), (0.165, 0.150, 0.118), 'spine_02'),
             (1.500, 1.548, (0.168, 0.152, 0.120), (0.135, 0.128, 0.104), 'spine_02'),
             (1.536, 1.590, (0.136, 0.130, 0.106), (0.112, 0.112, 0.094), 'neck_01')]
    out = []
    for k, (zb, zt, (a0, f0, k0), (a1, f1, k1), bone) in enumerate(lames):
        nr, nc = 6, 48; rows = []
        for i in range(nr):
            v = i / (nr - 1); z = zb + (zt - zb) * v
            a = a0 + (a1 - a0) * v; fr = f0 + (f1 - f0) * v; bk = k0 + (k1 - k0) * v
            row = []
            for j in range(nc):
                th = 2 * math.pi * j / nc; s, c = math.sin(th), math.cos(th)
                x = a * sgnpow(s, 2 / 2.4); y = (fr if c > 0 else bk) * sgnpow(c, 2 / 2.4)
                row.append(Vector((x, CY + 0.004 - y, z)))
            rows.append(row)
        o = grid_obj('V16_Gorget%d' % k, rows, [M['ivory'], M['gold']], border_fn(1, 0, 0, 1), closed=True,
                     outward=lambda p: Vector((p.x, p.y - CY, 0)))
        finish_plate(o, 0.004)
        bind_rigid(pipe('V16_GorgetPipe%d' % k, rows[0], 0.0036, M['gold'], closed=True), bone)
        bind_rigid(o, bone); out.append(o)
    return out

def _paul_frame(s):
    A = Vector((s * 0.52, 0.0, 0.855)).normalized()
    E1 = Vector((0.0, -1.0, 0.0))
    E2 = A.cross(E1) * s   # outward-down
    if E2.x * s < 0: E2 = -E2
    return A, E1, E2

def paul_pt(C, A, E1, E2, r, phi, lam, sq=(0.78, 1.06, 0.94)):
    ph, la = math.radians(phi), math.radians(lam)
    return C + r * (math.cos(ph) * A * sq[0] + math.sin(ph) * (math.cos(la) * E2 * sq[1] + math.sin(la) * E1 * sq[2]))

def pauldrons(M):
    out = []
    for s, sd in ((1, 'l'), (-1, 'r')):
        A, E1, E2 = _paul_frame(s)
        C = Vector((s * 0.232, CY + 0.004, 1.418))
        bone = 'upperarm_' + sd
        # dome: closed rings from near the pole to ~60deg
        rows = []; nc = 48
        for i in range(14):
            ph = 7 + (60 - 7) * i / 13
            rows.append([paul_pt(C, A, E1, E2, 0.158, ph, 360.0 * j / nc) for j in range(nc)])
        dome = grid_obj('V16_PauldronDome_' + sd, rows, [M['ivory'], M['gold']], border_fn(0, 1, 0, 1), closed=True,
                        outward=lambda p, C=C: p - C)
        finish_plate(dome, 0.0055)
        bind_rigid(pipe('V16_PaulDomePipe_' + sd, rows[-1], 0.0052, M['gold'], closed=True), bone)
        # finial boss at the pole
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.022, location=paul_pt(C, A, E1, E2, 0.158, 0, 0))
        bs = bpy.context.active_object; bs.name = 'V16_PaulBoss_' + sd; bs.scale = (1, 1, 0.45)
        bs.rotation_euler = A.to_track_quat('Z', 'Y').to_euler()
        for c in bs.users_collection: c.objects.unlink(bs)
        coll().objects.link(bs); bs.data.materials.append(M['gold']); bpy.ops.object.shade_smooth() if False else None
        for p in bs.data.polygons: p.use_smooth = True
        bind_rigid(bs, bone)
        out.append(dome); bind_rigid(dome, bone)
        # three lames, open on the inner (neck) side
        for k, (p0, p1, r) in enumerate(((55, 74, 0.166), (69, 88, 0.173), (83, 102, 0.180))):
            rows = []; nc = 40
            for i in range(6):
                ph = p0 + (p1 - p0) * i / 5
                rows.append([paul_pt(C, A, E1, E2, r + 0.004 * i / 5, ph, -138 + 276 * j / (nc - 1)) for j in range(nc)])
            lm = grid_obj('V16_PaulLame%d_%s' % (k, sd), rows, [M['ivory'], M['gold']], border_fn(0, 1, 1, 1),
                          outward=lambda p, C=C: p - C)
            finish_plate(lm, 0.0045)
            bind_rigid(pipe('V16_PaulLamePipe%d_%s' % (k, sd), rows[-1], 0.0042, M['gold']), bone)
            bind_rigid(lm, bone); out.append(lm)
        # red cross pattee on the outward face of the dome, with a gold outline under it
        cpos = paul_pt(C, A, E1, E2, 0.16, 34, 0); nrm = (cpos - C).normalized()
        up = A
        decal('V16_PaulCrossGold_' + sd, cross_pattee_outline(), cpos, nrm, up, 0.075, M['gold'], dome, 0.0012, 0.0012, bone)
        decal('V16_PaulCross_' + sd, cross_pattee_outline(), cpos, nrm, up, 0.066, M['red'], dome, 0.0026, 0.0012, bone)
    return out

def chest_cross(M, bp):
    c = Vector((0.0, CY - 0.24, 1.315)); n = Vector((0, -1, 0.12)); up = Vector((0, 0, 1))
    decal('V16_ChestCrossGold', cross_pattee_outline(waist=0.10, flare=0.33), c, n, up, 0.128, M['gold'], bp, 0.0012, 0.0012, 'spine_02')
    decal('V16_ChestCross', cross_pattee_outline(), c, n, up, 0.115, M['red'], bp, 0.0026, 0.0014, 'spine_02')

OLD_TORSO = re.compile(r'^(Breastplate|Backplate|Plackart|Gorget\d|Pauldron|PauldronLame|PCross|ChestCross|BPRivet|BPSideRivet|PLRivet|Fauld\d|SealPauldron|PendH|PendLink|PendV)')

def hide_old(rx=OLD_TORSO):
    n = 0
    for o in D.objects:
        if rx.match(o.name) and not o.name.startswith('V16_'):
            o.hide_render = True; o.hide_viewport = True; n += 1
    return n

def build_torso():
    r = rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    clear()
    M = materials()
    hidden = hide_old()
    bp = breastplate(M); backplate(M); faulds(M); gorget(M); pauldrons(M); chest_cross(M, bp)
    r.data.pose_position = 'POSE'
    return {'hidden_old': hidden, 'v16_objects': len([o for o in D.objects if o.name.startswith('V16_')])}

# ------------------------------------------------------------------ preview renders
def setup_cams():
    cams = {}
    tgt = Vector((0, 0, 1.0))
    for nm, ang, h, dist, lens, tz in (('front', 0, 1.25, 4.2, 55, 1.0), ('three', 35, 1.3, 4.2, 55, 1.0), ('left', 90, 1.25, 4.2, 55, 1.0),
                                       ('back', 180, 1.3, 4.2, 55, 1.0), ('torso', 22, 1.45, 2.1, 60, 1.33)):
        cd = D.cameras.get('V16Cam_' + nm) or D.cameras.new('V16Cam_' + nm); cd.lens = lens
        co = D.objects.get('V16Cam_' + nm) or D.objects.new('V16Cam_' + nm, cd)
        if co.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(co)
        a = math.radians(ang)
        co.location = Vector((math.sin(a) * dist, -math.cos(a) * dist, h))
        d = Vector((0, 0, tz)) - co.location
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cams[nm] = co
    return cams


# ------------------------------------------------------------------ global material upgrade for remaining legacy parts
SWAP = {'ArmorPlate': 'ivory', 'Armor': 'ivory', 'Gold': 'gold', 'RedPaint': 'red', 'DarkSteel': 'dark', 'DarkMetal': 'dark'}

def swap_materials(M=None):
    M = M or {'ivory': D.materials['V16_Ivory'], 'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson'], 'dark': D.materials['V16_DarkSteel']}
    n = 0
    for o in D.objects:
        if o.type not in ('MESH', 'CURVE') or o.name.startswith('V16_'): continue
        for sl in o.material_slots:
            if sl.material and sl.material.name in SWAP:
                if sl.link == 'OBJECT': sl.material = M[SWAP[sl.material.name]]
                else: o.data.materials[sl.slot_index] = M[SWAP[sl.material.name]]
                n += 1
    return n

def rebuild_crosses():
    M = {'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson']}
    for o in [o for o in D.objects if re.match(r'^V16_(Paul|Chest)Cross', o.name)]: D.objects.remove(o, do_unlink=True)
    r = rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    chest_cross(M, D.objects['V16_Breastplate'])
    for s, sd in ((1, 'l'), (-1, 'r')):
        A, E1, E2 = _paul_frame(s); C = Vector((s * 0.232, CY + 0.004, 1.418)); dome = D.objects['V16_PauldronDome_' + sd]
        cpos = paul_pt(C, A, E1, E2, 0.16, 34, 0); nrm = (cpos - C).normalized()
        decal('V16_PaulCrossGold_' + sd, cross_pattee_outline(), cpos, nrm, A, 0.078, M['gold'], dome, 0.0012, 0.0012, 'upperarm_' + sd)
        decal('V16_PaulCross_' + sd, cross_pattee_outline(), cpos, nrm, A, 0.068, M['red'], dome, 0.0026, 0.0012, 'upperarm_' + sd)
    r.data.pose_position = 'POSE'

# ------------------------------------------------------------------ limbs
def bone_pts(bn):
    r = rig(); b = r.data.bones[bn]
    return r.matrix_world @ b.head_local, r.matrix_world @ b.tail_local

def tube_pts(P0, P1, t, rx, ry, front, theta, n=2.3, keel=0.0):
    d = (P1 - P0).normalized(); f = (front - d * front.dot(d)).normalized(); sd = d.cross(f)
    c = P0 + (P1 - P0) * t; s, co = math.sin(theta), math.cos(theta)
    x = rx * sgnpow(s, 2.0 / n); y = ry * sgnpow(co, 2.0 / n)
    y += keel * math.exp(-(x / 0.02) ** 2)
    return c + sd * x + f * y

def limb(name, bone, P0, P1, t0, t1, rad, front, M, theta_max=180.0, nr=14, nc=36, keel=0.0, thick=0.004, pipes=(True, True), n=2.3):
    closed = theta_max >= 180.0
    rows = []
    for i in range(nr):
        v = i / (nr - 1); t = t0 + (t1 - t0) * v; rx, ry = rad(v)
        if closed: ths = [2 * math.pi * j / nc for j in range(nc)]
        else: ths = [math.radians(theta_max) * (j / (nc - 1) * 2 - 1) for j in range(nc)]
        rows.append([tube_pts(P0, P1, t, rx, ry, front, th, n, keel) for th in ths])
    axisP0, axisP1 = P0, P1
    def outward(p):
        d = (axisP1 - axisP0).normalized(); q = p - axisP0; return q - d * q.dot(d)
    o = grid_obj(name, rows, [M['ivory'], M['gold']], border_fn(1, 1, 0 if closed else 1, 1), closed=closed, outward=outward)
    finish_plate(o, thick)
    if pipes[0]: bind_rigid(pipe(name + 'PipeA', rows[0], thick * 0.95, M['gold'], closed=closed), bone)
    if pipes[1]: bind_rigid(pipe(name + 'PipeB', rows[-1], thick * 0.95, M['gold'], closed=closed), bone)
    bind_rigid(o, bone)
    return o, rows

def strap(name, bone, P0, P1, t, rx, ry, front, M, width=0.022):
    rows = [[tube_pts(P0, P1, t + dt, rx, ry, front, 2 * math.pi * j / 40) for j in range(40)] for dt in (-width / (P1 - P0).length / 2, width / (P1 - P0).length / 2)]
    leather = D.materials.get('Leather') or M['dark']
    o = grid_obj(name, rows, [leather], closed=True, outward=lambda p: p - (P0 + (P1 - P0) * t))
    s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.003; s.offset = 1.0
    bind_rigid(o, bone)
    # buckle on the outer side
    side = (P1 - P0).normalized().cross((front - (P1 - P0).normalized() * front.dot((P1 - P0).normalized())).normalized())
    pos = tube_pts(P0, P1, t, rx + 0.004, ry + 0.004, front, math.pi / 2)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
    bk = bpy.context.active_object; bk.name = name + 'Buckle'
    bk.scale = (0.006, 0.024, 0.026)
    bk.rotation_euler = side.to_track_quat('X', 'Z').to_euler()
    for c in bk.users_collection: c.objects.unlink(bk)
    coll().objects.link(bk); bk.data.materials.append(M['gold'])
    bv = bk.modifiers.new('B', 'BEVEL'); bv.width = 0.002; bv.segments = 2
    bind_rigid(bk, bone)
    return o

def cap(name, bone, C, axis, r, phi_max, M, sq=(0.75, 1.0, 1.0), up=Vector((0, 0, 1)), thick=0.0045, boss=True, ncol=40):
    A = axis.normalized(); E1 = (up - A * up.dot(A)).normalized(); E2 = A.cross(E1)
    rows = []
    for i in range(12):
        ph = math.radians(6 + (phi_max - 6) * i / 11)
        rows.append([C + r * (math.cos(ph) * A * sq[0] + math.sin(ph) * (math.cos(2 * math.pi * j / ncol) * E2 * sq[1] + math.sin(2 * math.pi * j / ncol) * E1 * sq[2])) for j in range(ncol)])
    o = grid_obj(name, rows, [M['ivory'], M['gold']], border_fn(0, 1, 0, 1), closed=True, outward=lambda p: p - C)
    finish_plate(o, thick)
    bind_rigid(pipe(name + 'Pipe', rows[-1], thick * 0.95, M['gold'], closed=True), bone)
    if boss:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=r * 0.16, location=C + A * r * sq[0])
        bs = bpy.context.active_object; bs.name = name + 'Boss'; bs.scale = (1, 1, 0.5); bs.rotation_euler = A.to_track_quat('Z', 'Y').to_euler()
        for c in bs.users_collection: c.objects.unlink(bs)
        coll().objects.link(bs); bs.data.materials.append(M['gold'])
        for p in bs.data.polygons: p.use_smooth = True
        bind_rigid(bs, bone)
    bind_rigid(o, bone)
    return o

OLD_LIMBS = re.compile(r'^(Rerebrace|RereStrap|Couter|CouterWing|Vambrace|VambStrap|Cuisse|CuisseLame|CuisseStrap|Greave|GreaveLame|GreaveStrap|Poleyn|PoleynWing|KneeCross|HandLCuff|HandRCuff)')

def build_limbs():
    r = rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for o in [o for o in D.objects if re.match(r'^V16_(Rere|Couter|Vamb|Cuff|Cuisse|Poleyn|Greave|Strap)', o.name)]: D.objects.remove(o, do_unlink=True)
    M = {'ivory': D.materials['V16_Ivory'], 'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson'], 'dark': D.materials['V16_DarkSteel']}
    hide_old(OLD_LIMBS)
    F = Vector((0, -1, 0))
    for s, sd in ((1, 'l'), (-1, 'r')):
        # ---- arm
        U0, U1 = bone_pts('upperarm_' + sd); L0, L1 = bone_pts('lowerarm_' + sd); H0, H1 = bone_pts('hand_' + sd)
        limb('V16_Rere_' + sd, 'upperarm_' + sd, U0, U1, 0.36, 0.86, lambda v: (0.083 - 0.008 * v + 0.004 * math.sin(math.pi * v), 0.080 - 0.008 * v), F, M, nr=12, nc=40)
        strap('V16_StrapRere_' + sd, 'upperarm_' + sd, U0, U1, 0.62, 0.0845, 0.0815, F, M)
        du = (U1 - U0).normalized(); dl = (L1 - L0).normalized()
        ax = (du - dl).normalized() + Vector((0, 0.9, 0)) + Vector((s * 0.5, 0, 0))
        cap('V16_Couter_' + sd, 'lowerarm_' + sd, L0 + ax.normalized() * 0.012, ax, 0.078, 72, M, sq=(0.75, 1.0, 1.08), up=du)
        limb('V16_Vamb_' + sd, 'lowerarm_' + sd, L0, L1, 0.22, 0.95, lambda v: (0.072 - 0.014 * v + 0.006 * math.exp(-((v - 0.25) / 0.2) ** 2), 0.068 - 0.014 * v), F, M, nr=12, nc=40)
        strap('V16_StrapVamb_' + sd, 'lowerarm_' + sd, L0, L1, 0.55, 0.0655, 0.0615, F, M)
        # gauntlet cuff (flared bell over the wrist)
        limb('V16_Cuff_' + sd, 'hand_' + sd, L1 - dl * 0.045, L1 + dl * 0.035, 0.0, 1.0, lambda v: (0.060 + 0.022 * v * v, 0.058 + 0.020 * v * v), F, M, nr=8, nc=40, thick=0.0035)
        # ---- leg
        T0, T1 = bone_pts('thigh_' + sd); C0, C1 = bone_pts('calf_' + sd)
        limb('V16_Cuisse_' + sd, 'thigh_' + sd, T0, T1, 0.16, 0.86, lambda v: (0.118 - 0.026 * v, 0.112 - 0.022 * v), F, M, theta_max=128, nr=16, nc=34, keel=0.006)
        strap('V16_StrapCuisse_' + sd, 'thigh_' + sd, T0, T1, 0.45, 0.112, 0.106, F, M, width=0.026)
        kc = C0 + Vector((0, -0.035, 0.0))
        cap('V16_Poleyn_' + sd, 'calf_' + sd, kc, Vector((s * 0.25, -1.0, 0.05)), 0.080, 74, M, sq=(0.72, 1.0, 1.18), up=Vector((0, 0, 1)))
        limb('V16_Greave_' + sd, 'calf_' + sd, C0, C1, 0.13, 0.93, lambda v: (0.072 + 0.012 * math.sin(math.pi * min(1, v * 1.6)) - 0.02 * v, 0.078 + 0.012 * math.sin(math.pi * min(1, v * 1.6)) - 0.024 * v), F, M, nr=18, nc=40, keel=0.007)
        strap('V16_StrapGreave_' + sd, 'calf_' + sd, C0, C1, 0.72, 0.0705, 0.0745, F, M)
        # small red cross on each poleyn
        pol = D.objects['V16_Poleyn_' + sd]; pc = kc + Vector((s * 0.25, -1.0, 0.05)).normalized() * 0.06
        decal('V16_PoleynCross_' + sd, cross_pattee_outline(), pc, Vector((s * 0.25, -1.0, 0.05)), Vector((0, 0, 1)), 0.028, M['red'], pol, 0.0022, 0.001, 'calf_' + sd)
    r.data.pose_position = 'POSE'
    return len([o for o in D.objects if o.name.startswith('V16_')])

# ------------------------------------------------------------------ great helm
HY = -0.016  # helm centre line y

def helm_section(z, th, keel=True):
    """closed superellipse section; th=0 is front"""
    zz = z
    a = lerp_tab([(1.552, 0.132), (1.60, 0.127), (1.70, 0.124), (1.80, 0.120), (1.845, 0.110), (1.865, 0.080), (1.878, 0.030)], zz)
    bf = lerp_tab([(1.552, 0.150), (1.60, 0.143), (1.70, 0.141), (1.80, 0.134), (1.845, 0.120), (1.865, 0.085), (1.878, 0.032)], zz)
    bb = lerp_tab([(1.552, 0.140), (1.60, 0.130), (1.70, 0.128), (1.80, 0.124), (1.845, 0.112), (1.865, 0.080), (1.878, 0.030)], zz)
    s, c = math.sin(th), math.cos(th)
    n = 2.5
    x = a * sgnpow(s, 2.0 / n); b = bf if c > 0 else bb; y = b * sgnpow(c, 2.0 / n)
    if keel and c > 0: y += 0.010 * math.exp(-(x / 0.018) ** 2) * min(1.0, max(0.0, (1.86 - zz) / 0.05))
    return Vector((x, HY - y, zz))

# slit layout (front, in x/z)
EYE_Z = (1.722, 1.744); EYE_X = 0.096
SLOT_X = 0.0115; SLOT_Z = (1.615, 1.722)

def _in_slit(p):
    if p.y > HY - 0.05: return False
    if EYE_Z[0] < p.z < EYE_Z[1] and abs(p.x) < EYE_X: return True
    if SLOT_Z[0] < p.z < SLOT_Z[1] and abs(p.x) < SLOT_X: return True
    # breaths: two columns of small slots on the right cheek
    for cx in (-0.058, -0.074):
        for k in range(5):
            cz = 1.632 + k * 0.016
            if abs(p.x - cx) < 0.0042 and abs(p.z - cz) < 0.0055: return True
    return False

def build_helm():
    r = rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for o in [o for o in D.objects if o.name.startswith('V16_Helm')]: D.objects.remove(o, do_unlink=True)
    M = {'ivory': D.materials['V16_Ivory'], 'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson'], 'dark': D.materials['V16_DarkSteel']}
    void = D.materials.get('Void') or M['dark']
    hidden = 0
    for o in D.objects:
        if o.parent_type == 'BONE' and o.parent_bone == 'head' and not o.name.startswith(('V16_', 'Eye')):
            o.hide_render = True; o.hide_viewport = True; hidden += 1
    # shell: dense grid so the slits have clean edges
    zs = [1.552 + (1.878 - 1.552) * (i / 90) ** 1.0 for i in range(91)]
    nc = 160
    rows = [[helm_section(z, 2 * math.pi * j / nc) for j in range(nc)] for z in zs]
    me = D.meshes.new('V16_Helm'); bm = bmesh.new()
    V = [[bm.verts.new(p) for p in row] for row in rows]
    for i in range(len(rows) - 1):
        for j in range(nc):
            j2 = (j + 1) % nc
            q = (V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j])
            cen = sum((v.co for v in q), Vector()) / 4
            if _in_slit(cen): continue
            f = bm.faces.new(q); f.smooth = True
            # gold: bottom band, brow band, ring around slits, crown band
            gold = cen.z < 1.565 or 1.787 < cen.z < 1.799 or 1.838 < cen.z < 1.846
            if not gold and cen.y < HY - 0.05:
                if (EYE_Z[0] - 0.009 < cen.z < EYE_Z[1] + 0.009 and abs(cen.x) < EYE_X + 0.009) or (SLOT_Z[0] - 0.009 < cen.z < SLOT_Z[1] and abs(cen.x) < SLOT_X + 0.009):
                    gold = True
            f.material_index = 1 if gold else 0
    # crown cap
    top = bm.verts.new(Vector((0, HY, 1.880)))
    for j in range(nc):
        f = bm.faces.new((V[-1][j], V[-1][(j + 1) % nc], top)); f.smooth = True
    bm.normal_update()
    s = sum(f.normal.dot(f.calc_center_median() - Vector((0, HY, 1.70))) for f in bm.faces)
    if s < 0: bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    me.materials.append(M['ivory']); me.materials.append(M['gold'])
    o = D.objects.new('V16_Helm', me); coll().objects.link(o)
    finish_plate(o, 0.005, 0.0012)
    bind_rigid(o, 'head')
    # dark liner so the slits read as deep openings
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=(0, HY, 1.71))
    ln = bpy.context.active_object; ln.name = 'V16_HelmLiner'; ln.scale = (0.112, 0.125, 0.15)
    for c in ln.users_collection: c.objects.unlink(ln)
    coll().objects.link(ln); ln.data.materials.append(void); bind_rigid(ln, 'head')
    # piping: bottom rim, brow band, around the eye slit and breath slot (cross outline)
    bind_rigid(pipe('V16_HelmPipeRim', rows[0], 0.0055, M['gold'], closed=True), 'head')
    def front_pt(x, z, out=0.002):
        # project onto the shell surface along -y
        th = math.asin(max(-1, min(1, sgnpow(x / lerp_tab([(1.552, 0.132), (1.70, 0.124), (1.80, 0.120)], z), 2.5 / 2))))
        p = helm_section(z, th); return p + Vector((0, -out, 0))
    ex, ez0, ez1 = EYE_X + 0.003, EYE_Z[0] - 0.003, EYE_Z[1] + 0.003
    sx, sz0 = SLOT_X + 0.003, SLOT_Z[0] - 0.003
    outline = []
    def seg(x0, z0, x1, z1, n=10):
        for k in range(n): outline.append(front_pt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n))
    seg(-ex, ez1, ex, ez1, 24); seg(ex, ez1, ex, ez0, 3); seg(ex, ez0, sx, ez0, 10); seg(sx, ez0, sx, sz0, 12); seg(sx, sz0, -sx, sz0, 3)
    seg(-sx, sz0, -sx, ez0, 12); seg(-sx, ez0, -ex, ez0, 10); seg(-ex, ez0, -ex, ez1, 3)
    bind_rigid(pipe('V16_HelmPipeSlit', outline, 0.0042, M['gold'], closed=True), 'head')
    # red cross pattee on the brow
    decal('V16_HelmCrossGold', cross_pattee_outline(waist=0.10, flare=0.33), front_pt(0, 1.815, 0.0), Vector((0, -1, 0.15)), Vector((0, 0, 1)), 0.034, M['gold'], o, 0.0012, 0.0012, 'head')
    decal('V16_HelmCross', cross_pattee_outline(), front_pt(0, 1.815, 0.0), Vector((0, -1, 0.15)), Vector((0, 0, 1)), 0.030, M['red'], o, 0.0025, 0.0012, 'head')
    # gold finial
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.016, radius2=0.0, depth=0.05, location=(0, HY, 1.902))
    fi = bpy.context.active_object; fi.name = 'V16_HelmFinial'
    for c in fi.users_collection: c.objects.unlink(fi)
    coll().objects.link(fi); fi.data.materials.append(M['gold'])
    for p in fi.data.polygons: p.use_smooth = True
    bind_rigid(fi, 'head')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.021, location=(0, HY, 1.878))
    fb = bpy.context.active_object; fb.name = 'V16_HelmFinialBall'; fb.scale = (1, 1, 0.6)
    for c in fb.users_collection: c.objects.unlink(fb)
    coll().objects.link(fb); fb.data.materials.append(M['gold'])
    for p in fb.data.polygons: p.use_smooth = True
    bind_rigid(fb, 'head')
    r.data.pose_position = 'POSE'
    return {'hidden': hidden}

# ------------------------------------------------------------------ modern assault rifle (Templar armoury pattern)
def mat_polymer(name='V16_Polymer'):
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 700, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 400, 0); _L(t, b, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -700, 0); n = _n(t, 'ShaderNodeTexNoise', -500, 0, Scale=900.0, Detail=2.0); _L(t, tc, 'Object', n, 'Vector')
    bump = _n(t, 'ShaderNodeBump', 100, -200, Strength=0.08, Distance=0.0005); _L(t, n, 'Fac', bump, 'Height'); _L(t, bump, 'Normal', b, 'Normal')
    b.inputs['Base Color'].default_value = (0.032, 0.032, 0.03, 1); b.inputs['Roughness'].default_value = 0.62
    return m

def mat_glass(name='V16_Glass'):
    m, t = _new_mat(name)
    out = _n(t, 'ShaderNodeOutputMaterial', 500, 0); b = _n(t, 'ShaderNodeBsdfPrincipled', 200, 0); _L(t, b, 0, out, 0)
    b.inputs['Base Color'].default_value = (0.55, 0.75, 0.7, 1); b.inputs['Roughness'].default_value = 0.02
    if 'Transmission Weight' in b.inputs: b.inputs['Transmission Weight'].default_value = 0.9
    b.inputs['Metallic'].default_value = 0.3
    return m

def _obj_from_bm(name, bm, mat, root, bevel=0.0015, segs=2):
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    o = D.objects.new(name, me); coll().objects.link(o)
    if bevel:
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = segs; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40); b.harden_normals = True
    if root is not None: o.parent = root
    return o

def rbox(name, size, loc, mat, root, rot=(0, 0, 0), bevel=0.0015):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    M4 = Matrix.Translation(loc) @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=M4, verts=bm.verts)
    return _obj_from_bm(name, bm, mat, root, bevel)

def rcyl(name, r, length, loc, mat, root, axis='Y', seg=24, bevel=0.0012, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=length)
    rot = {'Y': Matrix.Rotation(math.pi / 2, 4, 'X'), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Z': Matrix.Identity(4)}[axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ rot, verts=bm.verts)
    return _obj_from_bm(name, bm, mat, root, bevel)

def cross_plate(name, size, loc, normal_axis, mat, root, depth=0.0012):
    bm = bmesh.new(); pts = cross_pattee_outline()
    vs = [bm.verts.new((x * size, y * size, 0)) for x, y in pts]
    f = bm.faces.new(vs); bmesh.ops.triangulate(bm, faces=[f])
    ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.z += depth
    R = {'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), '-X': Matrix.Rotation(-math.pi / 2, 4, 'Y'), 'Z': Matrix.Identity(4)}[normal_axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ R, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _obj_from_bm(name, bm, mat, root, 0.0)

def build_rifle_v16():
    for o in [o for o in D.objects if o.name.startswith('V16_Rifle')]: D.objects.remove(o, do_unlink=True)
    M = {'dark': D.materials['V16_DarkSteel'], 'ivory': D.materials['V16_Ivory'], 'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson'],
         'poly': mat_polymer(), 'glass': mat_glass()}
    X = math.radians
    root = rbox('V16_Rifle', (0.034, 0.20, 0.052), (0, -0.065, 0.032), M['dark'], None)       # lower receiver
    rbox('V16_RifleMagwell', (0.038, 0.062, 0.05), (0, -0.088, -0.006), M['dark'], root)
    rbox('V16_RifleUpper', (0.031, 0.27, 0.04), (0, -0.09, 0.077), M['dark'], root)
    rbox('V16_RifleRail', (0.022, 0.42, 0.007), (0, -0.175, 0.1005), M['dark'], root, bevel=0.0008)
    for k in range(30):
        rbox('V16_RifleRailT%02d' % k, (0.025, 0.0055, 0.0045), (0, 0.025 - k * 0.0135, 0.1055), M['dark'], root, bevel=0.0006)
    rbox('V16_RifleEject', (0.003, 0.05, 0.016), (0.0165, -0.06, 0.074), M['poly'], root, bevel=0.0005)
    rbox('V16_RifleCharging', (0.048, 0.012, 0.008), (0, 0.055, 0.092), M['dark'], root, bevel=0.001)
    rcyl('V16_RifleFwdAssist', 0.006, 0.02, (0.02, -0.005, 0.08), M['dark'], root, axis='X', seg=12)
    # ivory handguard: octagonal tube with gold rings and dark M-LOK slots
    hg = rcyl('V16_RifleHandguard', 0.027, 0.27, (0, -0.345, 0.071), M['ivory'], root, seg=8, bevel=0.0018)
    for yy in (-0.215, -0.475): rcyl('V16_RifleHGRing%d' % int(-yy * 1000), 0.0285, 0.008, (0, yy, 0.071), M['gold'], root, seg=8)
    for s in (-1, 1):
        for k in range(4):
            rbox('V16_RifleSlot%d_%d' % (s, k), (0.002, 0.030, 0.008), (s * 0.0258, -0.27 - k * 0.048, 0.071), M['poly'], root, bevel=0.0)
        cross_plate('V16_RifleHGCross%d' % s, 0.017, (s * 0.0262, -0.43, 0.071), 'X' if s > 0 else '-X', M['gold'], root)
    # barrel, gas block, muzzle brake
    rcyl('V16_RifleBarrel', 0.0095, 0.13, (0, -0.535, 0.071), M['dark'], root, seg=20)
    rbox('V16_RifleGasBlock', (0.022, 0.02, 0.022), (0, -0.49, 0.071), M['dark'], root)
    br = rcyl('V16_RifleBrake', 0.0145, 0.06, (0, -0.628, 0.071), M['dark'], root, seg=24)
    for k in range(3): rcyl('V16_RifleBrakePort%d' % k, 0.0148, 0.005, (0, -0.612 - k * 0.014, 0.071), M['poly'], root, seg=24, bevel=0)
    # magazine: curved stack of segments with ribs
    for k in range(6):
        a = X(-4 - k * 3.2); z = -0.034 - k * 0.026; y = -0.090 - k * 0.0045 * k
        rbox('V16_RifleMag%d' % k, (0.030, 0.064, 0.028), (0, y, z), M['poly'], root, rot=(a, 0, 0), bevel=0.0012)
    rbox('V16_RifleMagBase', (0.034, 0.072, 0.012), (0, -0.090 - 5 * 0.0045 * 5 - 0.004, -0.034 - 6 * 0.026 + 0.006), M['dark'], root, rot=(X(-21), 0, 0))
    # pistol grip, trigger, guard
    rbox('V16_RifleGrip', (0.028, 0.042, 0.105), (0, 0.032, -0.036), M['poly'], root, rot=(X(-20), 0, 0), bevel=0.004)
    rbox('V16_RifleTrigger', (0.006, 0.006, 0.022), (0, -0.02, -0.005), M['gold'], root, rot=(X(-12), 0, 0), bevel=0.001)
    rbox('V16_RifleGuardB', (0.012, 0.075, 0.004), (0, -0.025, -0.022), M['dark'], root, bevel=0.001)
    rbox('V16_RifleGuardF', (0.012, 0.004, 0.026), (0, -0.062, -0.009), M['dark'], root, bevel=0.001)
    # buffer tube + adjustable stock in ivory with gold strip and red cross
    rcyl('V16_RifleBuffer', 0.0155, 0.17, (0, 0.18, 0.069), M['dark'], root, seg=20)
    rbox('V16_RifleStock', (0.044, 0.16, 0.06), (0, 0.24, 0.062), M['ivory'], root, bevel=0.004)
    rbox('V16_RifleStockLow', (0.04, 0.11, 0.05), (0, 0.27, 0.02), M['ivory'], root, rot=(X(14), 0, 0), bevel=0.004)
    rbox('V16_RifleButt', (0.048, 0.018, 0.118), (0, 0.327, 0.045), M['poly'], root, bevel=0.003)
    for s in (-1, 1):
        rbox('V16_RifleStockStrip%d' % s, (0.002, 0.13, 0.006), (s * 0.0225, 0.24, 0.083), M['gold'], root, bevel=0)
        cross_plate('V16_RifleStockCross%d' % s, 0.016, (s * 0.0225, 0.245, 0.055), 'X' if s > 0 else '-X', M['red'], root)
    # vertical foregrip
    rcyl('V16_RifleForegrip', 0.0135, 0.07, (0, -0.39, 0.012), M['poly'], root, axis='Z', seg=16, bevel=0.002)
    rcyl('V16_RifleForegripCap', 0.015, 0.008, (0, -0.39, -0.024), M['dark'], root, axis='Z', seg=16)
    # optic: low mount + tube red-dot with gold rings and glass
    rbox('V16_RifleOpticMount', (0.028, 0.07, 0.012), (0, -0.07, 0.113), M['dark'], root, bevel=0.001)
    rcyl('V16_RifleOptic', 0.019, 0.085, (0, -0.07, 0.139), M['dark'], root, seg=28)
    for yy in (-0.105, -0.035): rcyl('V16_RifleOpticRing%d' % int(-yy * 1000), 0.0205, 0.009, (0, yy, 0.139), M['gold'], root, seg=28)
    rcyl('V16_RifleOpticLensF', 0.0165, 0.002, (0, -0.1135, 0.139), M['glass'], root, seg=28, bevel=0)
    rcyl('V16_RifleOpticLensB', 0.0165, 0.002, (0, -0.0265, 0.139), M['glass'], root, seg=28, bevel=0)
    rcyl('V16_RifleOpticTurret', 0.007, 0.012, (0.0, -0.07, 0.162), M['dark'], root, axis='Z', seg=16)
    rcyl('V16_RifleOpticTurretS', 0.007, 0.012, (0.024, -0.07, 0.139), M['dark'], root, axis='X', seg=16)
    rcyl('V16_RifleRearSight', 0.006, 0.02, (0, 0.02, 0.115), M['dark'], root, axis='Z', seg=10)
    return root

def install_rifle():
    r = rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    old = D.objects.get('TemplarRifle')
    mw = old.matrix_world.copy() if old else Matrix.Identity(4)
    root = build_rifle_v16()
    bpy.context.view_layer.update()
    root.matrix_world = mw
    bind_rigid(root, 'hand_l')
    if old:
        old.hide_render = True; old.hide_viewport = True
    r.data.pose_position = 'POSE'
    return len([o for o in D.objects if o.name.startswith('V16_Rifle')])
