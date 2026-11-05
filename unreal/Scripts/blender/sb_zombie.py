"""Steel & Blood - infected modern soldier (zombie v1) on the shared RIG_Knight skeleton.
Gaunt rotting body, torn multicam fatigues, plate carrier with pouches, combat helmet, boots.
All objects are prefixed ZMB_ and live in collection 'ZMB'; show(True/False) swaps between the zombie and the
knights for rendering/export (export_game_mesh skips hide_render objects).
Animations: A_Zombie_Idle / _Walk / _Attack / _Hit / _Death authored with the sb_v14 E()/key_pose conventions."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
import sb_v14 as K
import sb_v16_armor as A

D = bpy.data
E, full, FPS = K.E, K.full, K.FPS

def coll():
    c = D.collections.get('ZMB')
    if not c:
        c = D.collections.new('ZMB'); bpy.context.scene.collection.children.link(c)
    return c

def _link(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    coll().objects.link(o); return o

# ------------------------------------------------------------------ materials
def mat_skin(name='ZMB_Skin'):
    m, t = A._new_mat(name); n, L = A._n, A._L
    out = n(t, 'ShaderNodeOutputMaterial', 1200, 0); b = n(t, 'ShaderNodeBsdfPrincipled', 900, 0); L(t, b, 0, out, 0)
    tc = n(t, 'ShaderNodeTexCoord', -1200, 0)
    base = n(t, 'ShaderNodeTexNoise', -900, 300, Scale=6.0, Detail=8.0, Roughness=0.6); L(t, tc, 'Object', base, 'Vector')
    col = A._ramp(t, -650, 300, [(0.3, (0.20, 0.22, 0.17, 1)), (0.55, (0.33, 0.34, 0.27, 1)), (0.8, (0.40, 0.33, 0.30, 1))]); L(t, base, 'Fac', col, 'Fac')
    vein = n(t, 'ShaderNodeTexVoronoi', -900, 0, feature='DISTANCE_TO_EDGE', Scale=14.0); L(t, tc, 'Object', vein, 'Vector')
    vr = A._ramp(t, -650, 0, [(0.0, (1, 1, 1, 1)), (0.04, (0, 0, 0, 1))]); L(t, vein, 'Distance', vr, 'Fac')
    c1 = n(t, 'ShaderNodeMix', -400, 200, data_type='RGBA'); L(t, vr, 'Color', c1, 'Factor'); L(t, col, 'Color', c1, 'A'); c1.inputs['B'].default_value = (0.12, 0.08, 0.14, 1)
    bl = n(t, 'ShaderNodeTexNoise', -900, -300, Scale=3.0, Detail=6.0); L(t, tc, 'Object', bl, 'Vector')
    br = A._ramp(t, -650, -300, [(0.6, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))]); L(t, bl, 'Fac', br, 'Fac')
    c2 = n(t, 'ShaderNodeMix', -150, 100, data_type='RGBA'); L(t, br, 'Color', c2, 'Factor'); L(t, c1, 'Result', c2, 'A'); c2.inputs['B'].default_value = (0.16, 0.012, 0.01, 1)
    L(t, c2, 'Result', b, 'Base Color')
    rr = n(t, 'ShaderNodeMapRange', 300, -200); rr.inputs['To Min'].default_value = 0.55; rr.inputs['To Max'].default_value = 0.25; L(t, br, 'Color', rr, 'Value'); L(t, rr, 'Result', b, 'Roughness')
    if 'Subsurface Weight' in b.inputs: b.inputs['Subsurface Weight'].default_value = 0.08
    bump = n(t, 'ShaderNodeBump', 500, -400, Strength=0.35, Distance=0.002); L(t, base, 'Fac', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')
    return m

def mat_camo(name='ZMB_Camo'):
    m, t = A._new_mat(name); n, L = A._n, A._L
    out = n(t, 'ShaderNodeOutputMaterial', 1000, 0); b = n(t, 'ShaderNodeBsdfPrincipled', 700, 0); L(t, b, 0, out, 0)
    tc = n(t, 'ShaderNodeTexCoord', -1100, 0)
    n1 = n(t, 'ShaderNodeTexNoise', -800, 200, Scale=9.0, Detail=2.0, Distortion=1.5); L(t, tc, 'Object', n1, 'Vector')
    camo = A._ramp(t, -550, 200, [(0.38, (0.05, 0.045, 0.03, 1)), (0.46, (0.14, 0.12, 0.08, 1)), (0.56, (0.08, 0.09, 0.05, 1)), (0.66, (0.19, 0.16, 0.11, 1))])
    camo.color_ramp.interpolation = 'CONSTANT'; L(t, n1, 'Fac', camo, 'Fac')
    dirt = n(t, 'ShaderNodeTexNoise', -800, -150, Scale=4.0, Detail=8.0); L(t, tc, 'Object', dirt, 'Vector')
    dr = A._ramp(t, -550, -150, [(0.66, (0, 0, 0, 1)), (0.8, (0.7, 0.7, 0.7, 1))]); L(t, dirt, 'Fac', dr, 'Fac')
    c = n(t, 'ShaderNodeMix', -250, 100, data_type='RGBA'); L(t, dr, 'Color', c, 'Factor'); L(t, camo, 'Color', c, 'A'); c.inputs['B'].default_value = (0.07, 0.035, 0.02, 1)
    L(t, c, 'Result', b, 'Base Color'); b.inputs['Roughness'].default_value = 0.9
    wv = n(t, 'ShaderNodeTexWave', -550, -450, Scale=500.0); L(t, tc, 'Object', wv, 'Vector')
    bump = n(t, 'ShaderNodeBump', 400, -400, Strength=0.15, Distance=0.0005); L(t, wv, 'Fac', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')
    return m

def mat_flat(name, col, rough=0.6, metal=0.0):
    m, t = A._new_mat(name); n, L = A._n, A._L
    out = n(t, 'ShaderNodeOutputMaterial', 600, 0); b = n(t, 'ShaderNodeBsdfPrincipled', 300, 0); L(t, b, 0, out, 0)
    tc = n(t, 'ShaderNodeTexCoord', -600, 0); nz = n(t, 'ShaderNodeTexNoise', -400, 0, Scale=30.0, Detail=6.0); L(t, tc, 'Object', nz, 'Vector')
    rr = n(t, 'ShaderNodeMapRange', -150, 0); rr.inputs['To Min'].default_value = rough - 0.12; rr.inputs['To Max'].default_value = rough + 0.12; L(t, nz, 'Fac', rr, 'Value')
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; L(t, rr, 'Result', b, 'Roughness')
    return m

def materials():
    return {'skin': mat_skin(), 'camo': mat_camo(), 'olive': mat_flat('ZMB_Olive', (0.12, 0.13, 0.08), 0.55),
            'boot': mat_flat('ZMB_Boot', (0.05, 0.04, 0.035), 0.5), 'teeth': mat_flat('ZMB_Teeth', (0.45, 0.38, 0.22), 0.4),
            'eye': mat_flat('ZMB_Eye', (0.01, 0.01, 0.01), 0.2), 'webbing': mat_flat('ZMB_Webbing', (0.09, 0.085, 0.06), 0.8)}

# ------------------------------------------------------------------ geometry
def bone_pts(bn): return A.bone_pts(bn)

def tube(name, bone, P0, P1, t0, t1, rad, mat, nr=10, nc=20, front=Vector((0, -1, 0)), tear=0.0, seed=0):
    rows = []
    for i in range(nr):
        v = i / (nr - 1); t = t0 + (t1 - t0) * v; rx, ry = rad(v)
        rows.append([A.tube_pts(P0, P1, t, rx, ry, front, 2 * math.pi * j / nc, 2.0) for j in range(nc)])
    rnd = random.Random(seed)
    def mf(i, j, nr_, nc_): return 0
    o = A.grid_obj(name, rows, [mat], mf, closed=True, outward=lambda p: (p - P0) - (P1 - P0).normalized() * (p - P0).dot((P1 - P0).normalized()))
    if tear > 0:  # ragged end: delete random faces in the last rows
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
        kill = [f for k, f in enumerate(bm.faces) if (k // nc) >= nr - 3 and rnd.random() < tear * ((k // nc) - (nr - 4)) / 3]
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free()
    s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.004; s.offset = 1.0
    _link(o); A.bind_rigid(o, bone)
    return o

def ellipsoid(name, bone, c, r, mat, rot=(0, 0, 0), seg=24, ring=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1.0, location=c)
    o = bpy.context.active_object; o.name = name; o.scale = r; o.rotation_euler = rot
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(mat); _link(o); A.bind_rigid(o, bone)
    return o

def box(name, bone, c, s, mat, rot=(0, 0, 0), bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=c)
    o = bpy.context.active_object; o.name = name; o.scale = s; o.rotation_euler = rot
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('B', 'BEVEL'); b.width = bevel; b.segments = 2
    _link(o); A.bind_rigid(o, bone)
    return o

def torso(M):
    """lofted gaunt torso in a torn fatigue shirt (rigid per segment: lower on spine_01, upper on spine_02)"""
    out = []
    for nm, bone, z0, z1, a0, a1, b0, b1 in (('Belly', 'spine_01', 0.90, 1.32, 0.178, 0.182, 0.128, 0.122),
                                              ('Chest', 'spine_02', 1.28, 1.56, 0.190, 0.135, 0.130, 0.095)):
        rows = []
        for i in range(12):
            v = i / 11; z = z0 + (z1 - z0) * v; a = a0 + (a1 - a0) * v; b = b0 + (b1 - b0) * v
            if nm == 'Chest' and v > 0.6: a *= 1.0 - 0.8 * (v - 0.6)  # shoulders round into the neck
            rows.append([Vector((a * math.sin(th), -0.005 - b * math.cos(th) - 0.02 * math.exp(-((th - 0) / 0.6) ** 2) * (nm == 'Belly'), z))
                         for th in [2 * math.pi * j / 28 for j in range(28)]])
        o = A.grid_obj('ZMB_' + nm, rows, [M['camo']], None, closed=True, outward=lambda p: Vector((p.x, p.y, 0)))
        s = o.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.005; s.offset = 1.0
        _link(o); A.bind_rigid(o, bone); out.append(o)
    # ribs/skin showing through a rip on the belly
    ellipsoid('ZMB_BellyWound', 'spine_01', Vector((0.05, -0.115, 1.12)), (0.06, 0.012, 0.07), M['skin'])
    return out

def head(M):
    out = []
    H0, H1 = bone_pts('head'); c = Vector((0, -0.012, 1.715))
    out.append(ellipsoid('ZMB_Skull', 'head', c, (0.09, 0.104, 0.116), M['skin']))
    out.append(ellipsoid('ZMB_Jaw', 'head', c + Vector((0, -0.045, -0.085)), (0.062, 0.06, 0.035), M['skin']))
    for s in (-1, 1):
        out.append(ellipsoid('ZMB_Socket%d' % s, 'head', c + Vector((s * 0.035, -0.083, 0.012)), (0.024, 0.014, 0.018), M['eye']))
        out.append(ellipsoid('ZMB_Cheek%d' % s, 'head', c + Vector((s * 0.05, -0.07, -0.035)), (0.022, 0.02, 0.03), M['skin']))
    out.append(box('ZMB_Teeth', 'head', c + Vector((0, -0.092, -0.06)), (0.06, 0.012, 0.022), M['teeth'], bevel=0.003))
    out.append(ellipsoid('ZMB_NoseHole', 'head', c + Vector((0, -0.097, -0.018)), (0.012, 0.008, 0.016), M['eye']))
    out.append(tube('ZMB_Neck', 'neck_01', Vector((0, -0.005, 1.50)), Vector((0, -0.005, 1.66)), 0.0, 1.0, lambda v: (0.056, 0.054), M['skin'], 6, 16))
    # combat helmet: dome + rim + chin strap
    rows = []
    for i in range(12):
        ph = math.radians(4 + 88 * i / 11)
        rows.append([c + Vector((0, 0.005, 0.03)) + Vector((0.108 * math.sin(ph) * math.sin(th), -0.122 * math.sin(ph) * math.cos(th), 0.105 * math.cos(ph)))
                     for th in [2 * math.pi * j / 32 for j in range(32)]])
    hm = A.grid_obj('ZMB_Helmet', rows, [M['olive']], None, closed=True, outward=lambda p, c=c: p - c)
    s = hm.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.008; s.offset = 1.0
    bv = hm.modifiers.new('B', 'BEVEL'); bv.width = 0.002; bv.segments = 2; bv.limit_method = 'ANGLE'
    _link(hm); A.bind_rigid(hm, 'head'); out.append(hm)
    A.bind_rigid(_link(A.pipe('ZMB_HelmetRim', rows[-1], 0.006, M['olive'], closed=True)), 'head')
    strap = [c + Vector((s * 0.085, -0.02, -0.02 - 0.06 * (1 - abs(s)))) for s in [k / 10 * 2 - 1 for k in range(11)]]
    A.bind_rigid(_link(A.pipe('ZMB_ChinStrap', strap, 0.004, M['webbing'])), 'head')
    box('ZMB_NVGMount', 'head', c + Vector((0, -0.12, 0.07)), (0.03, 0.012, 0.03), M['olive'])
    return out

def arms(M):
    for s, sd in ((1, 'l'), (-1, 'r')):
        U0, U1 = bone_pts('upperarm_' + sd); L0, L1 = bone_pts('lowerarm_' + sd); H0, H1 = bone_pts('hand_' + sd)
        tube('ZMB_Sleeve_' + sd, 'upperarm_' + sd, U0, U1, -0.05, 1.0, lambda v: (0.072 - 0.01 * v, 0.068 - 0.01 * v), M['camo'], 8, 20, tear=0.6, seed=3 + s)
        tube('ZMB_Forearm_' + sd, 'lowerarm_' + sd, L0, L1, 0.0, 1.02, lambda v: (0.042 - 0.012 * v, 0.038 - 0.01 * v), M['skin'], 8, 16)
        ellipsoid('ZMB_Elbow_' + sd, 'lowerarm_' + sd, L0, (0.036, 0.036, 0.036), M['skin'])
        d = (H1 - H0).normalized()
        box('ZMB_Palm_' + sd, 'hand_' + sd, H0 + d * 0.035, (0.022, 0.06, 0.07), M['skin'], rot=d.to_track_quat('Z', 'Y').to_euler(), bevel=0.008)
        side = d.cross(Vector((0, 0, 1))).normalized() if abs(d.z) < 0.95 else Vector((1, 0, 0))
        for k in range(4):
            base = H0 + d * 0.07 + side * (0.024 - 0.016 * k)
            tip = base + d * 0.075 + Vector((0, -0.02, -0.02))
            tube('ZMB_Finger%d_%s' % (k, sd), 'hand_' + sd, base, tip, 0.0, 1.0, lambda v: (0.009 - 0.004 * v, 0.009 - 0.004 * v), M['skin'], 4, 8)

def legs(M):
    for s, sd in ((1, 'l'), (-1, 'r')):
        T0, T1 = bone_pts('thigh_' + sd); C0, C1 = bone_pts('calf_' + sd); F0, F1 = bone_pts('foot_' + sd); B0, B1 = bone_pts('ball_' + sd)
        tube('ZMB_Thigh_' + sd, 'thigh_' + sd, T0 + Vector((0, 0, 0.04)), T1, 0.0, 1.05, lambda v: (0.105 - 0.025 * v, 0.1 - 0.022 * v), M['camo'], 10, 22)
        tube('ZMB_Shin_' + sd, 'calf_' + sd, C0, C1, -0.03, 0.75, lambda v: (0.074 - 0.012 * v, 0.078 - 0.016 * v), M['camo'], 8, 22, tear=0.5, seed=7 + s)
        box('ZMB_KneePad_' + sd, 'calf_' + sd, C0 + Vector((0, -0.065, -0.02)), (0.07, 0.025, 0.09), M['webbing'], bevel=0.01)
        tube('ZMB_BootShaft_' + sd, 'calf_' + sd, C0, C1, 0.68, 1.05, lambda v: (0.058, 0.062), M['boot'], 6, 18)
        ft = (B1 - F0); box('ZMB_Boot_' + sd, 'foot_' + sd, F0 + ft * 0.5 + Vector((0, 0, -0.02)), (0.09, ft.length + 0.06, 0.07), M['boot'],
                            rot=Vector((ft.x, ft.y, 0)).normalized().to_track_quat('Y', 'Z').to_euler(), bevel=0.02)

def gear(M):
    # plate carrier + magazine pouches + belt
    rows = []
    for i in range(8):
        v = i / 7; z = 1.17 + 0.32 * v; a = 0.175; b = 0.13
        rows.append([Vector((a * A.sgnpow(math.sin(th), 0.7), -0.005 - b * A.sgnpow(math.cos(th), 0.7), z)) for th in [2 * math.pi * j / 32 for j in range(32)]])
    pc = A.grid_obj('ZMB_Carrier', rows, [M['olive']], None, closed=True, outward=lambda p: Vector((p.x, p.y, 0)))
    s = pc.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.02; s.offset = 1.0
    _link(pc); A.bind_rigid(pc, 'spine_02')
    for k in range(3):
        box('ZMB_Pouch%d' % k, 'spine_02', Vector((-0.07 + 0.07 * k, -0.165, 1.25)), (0.055, 0.035, 0.1), M['olive'], bevel=0.006)
    tube('ZMB_Belt', 'pelvis', Vector((0, -0.005, 0.92)), Vector((0, -0.005, 0.97)), 0.0, 1.0, lambda v: (0.165, 0.122), M['webbing'], 3, 30)
    box('ZMB_Radio', 'spine_02', Vector((0.14, -0.11, 1.42)), (0.04, 0.03, 0.09), M['olive'], bevel=0.006)

def build():
    r = A.rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for o in [o for o in D.objects if o.name.startswith('ZMB_')]: D.objects.remove(o, do_unlink=True)
    M = materials()
    torso(M); head(M); arms(M); legs(M); gear(M)
    r.data.pose_position = 'POSE'
    show(False)
    return len([o for o in D.objects if o.name.startswith('ZMB_')])

_KNIGHT_STATE = '_zmb_hidden_knight'

def show(zombie=True):
    """zombie=True: hide every visible knight mesh/curve under the rig (remembered), show ZMB_*. False: restore."""
    r = A.rig()
    def under_rig(o):
        p = o
        while p:
            if p == r: return True
            p = p.parent
        return False
    for o in D.objects:
        if o.type not in ('MESH', 'CURVE') or not under_rig(o): continue
        if o.name.startswith('ZMB_'):
            o.hide_render = not zombie; o.hide_viewport = not zombie
        elif zombie:
            if not o.hide_render: o[_KNIGHT_STATE] = 1; o.hide_render = True; o.hide_viewport = True
        elif o.get(_KNIGHT_STATE):
            o.hide_render = False; o.hide_viewport = False; del o[_KNIGHT_STATE]
    return zombie

# ------------------------------------------------------------------ animations
def _b(t, L, f=1.0): return math.sin(2 * math.pi * f * t / L)

def z_idle(t, L):
    b = _b(t, L); tw = max(0.0, _b(t, L, 3.0)) ** 8
    p = {'spine_01': E(x=8 + 2 * b), 'spine_02': E(x=10 - 2 * b, z=4 * b), 'neck_01': E(x=-6), 'head': E(x=10 + 4 * b, y=14 * tw, z=10 * b),
         'upperarm_l': E(x=-20 + 4 * b, z=6), 'lowerarm_l': E(x=-25), 'upperarm_r': E(x=-28 - 4 * b, z=-8), 'lowerarm_r': E(x=-15),
         'thigh_l': E(x=-6), 'calf_l': E(x=-10), 'thigh_r': E(x=4, y=4), 'calf_r': E(x=-4)}
    return full(p), {'pelvis': (0, 0, -0.03 - 0.01 * b)}

def z_walk(t, L):
    """dragging shamble: right leg lurches, left drags, arms reaching forward"""
    ph = 2 * math.pi * t / L; s = math.sin(ph); c = math.cos(ph)
    p = {'thigh_r': E(x=-16 * max(0.0, s) + 10 * max(0.0, -s)), 'calf_r': E(x=-(8 + 26 * max(0.0, math.sin(ph + 0.6)))),
         'thigh_l': E(x=-8 * max(0.0, -s) + 12 * max(0.0, s), z=-6), 'calf_l': E(x=-6), 'foot_l': E(x=10),
         'pelvis': E(z=8 * s, y=6 * c), 'spine_01': E(x=12, z=-6 * s), 'spine_02': E(x=10, y=-5 * c), 'head': E(x=12, z=8 * s, y=6 * c),
         'upperarm_l': E(x=-62 + 6 * s, z=-6), 'lowerarm_l': E(x=-18), 'upperarm_r': E(x=-70 - 6 * s, z=8), 'lowerarm_r': E(x=-10)}
    return full(p), {'pelvis': (0, 0, -0.06 + 0.03 * abs(c))}

def z_attack(t, L):
    """lunge and double claw swipe"""
    lean = A.lerp_tab([(0, 0), (0.25, 1), (0.6, 1), (1.0, 0)], t / L)
    sw = A.lerp_tab([(0, 0), (0.3, 0), (0.45, 1), (0.6, 0.2), (0.75, 1), (1.0, 0)], t / L)
    p = {'spine_01': E(x=18 * lean), 'spine_02': E(x=16 * lean, z=20 * (sw - 0.5)), 'head': E(x=-10 * lean),
         'upperarm_r': E(x=-110 * lean + 60 * sw, z=-10), 'lowerarm_r': E(x=-30 + 20 * sw), 'upperarm_l': E(x=-100 * lean + 50 * (1 - sw), z=10), 'lowerarm_l': E(x=-35),
         'thigh_r': E(x=-35 * lean), 'calf_r': E(x=-30 * lean), 'thigh_l': E(x=20 * lean), 'calf_l': E(x=-10 * lean)}
    return full(p), {'pelvis': (0, -0.15 * lean, -0.08 * lean)}

def z_hit(t, L):
    k = A.lerp_tab([(0, 0), (0.15, 1), (1.0, 0)], t / L)
    return full({'spine_01': E(x=-14 * k), 'spine_02': E(x=-18 * k, z=10 * k), 'head': E(x=-25 * k, y=12 * k),
                 'upperarm_l': E(x=20 * k, z=20 * k), 'upperarm_r': E(x=25 * k, z=-20 * k)}), {'pelvis': (0, 0.06 * k, 0)}

def z_death(t, L):
    k = A.lerp_tab([(0, 0), (0.35, 0.6), (0.7, 1), (1, 1)], t / L); fall = A.lerp_tab([(0, 0), (0.4, 0), (0.85, 1), (1, 1)], t / L)
    return full({'thigh_l': E(x=-70 * k), 'thigh_r': E(x=-60 * k), 'calf_l': E(x=-110 * k), 'calf_r': E(x=-100 * k),
                 'spine_01': E(x=-20 * fall), 'spine_02': E(x=-25 * fall), 'head': E(x=-35 * fall, y=20 * k),
                 'upperarm_l': E(x=-40 * k, z=30 * fall), 'upperarm_r': E(x=-30 * k, z=-30 * fall)}), \
        {'pelvis': (0, 0.25 * fall, -0.5 * k - 0.28 * fall)}

CLIPS = {'A_Zombie_Idle': (z_idle, 3.0), 'A_Zombie_Walk': (z_walk, 1.4), 'A_Zombie_Attack': (z_attack, 1.1),
         'A_Zombie_Hit': (z_hit, 0.5), 'A_Zombie_Death': (z_death, 1.8)}

def build_anims():
    rig = A.rig(); rig.animation_data_create(); prev = rig.animation_data.action; made = []
    for name, (fn, L) in CLIPS.items():
        old = D.actions.get(name)
        if old: D.actions.remove(old)
        for tr in [t for t in rig.animation_data.nla_tracks if t.name == name]: rig.animation_data.nla_tracks.remove(tr)
        act = D.actions.new(name); act.use_fake_user = True; rig.animation_data.action = act
        n = int(round(L * FPS))
        for f in range(n + 1):
            pose, loc = fn(L * f / n, L); K.key_pose(rig, f, pose, loc)
        act.frame_range = (0, n); made.append((name, n))
        tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = prev
    return made
