"""Steel & Blood - hero knight v14 (built on the user's SteelAndBlood_Knight_v13.blend).

Adds to the existing hand-built model, without replacing it:
  * RIG_Knight armature fitted to the model's own joints (UE-style bone names, same hierarchy as the game skeleton)
  * rigid bone binding for plate parts, smooth weights for torso / tabard / cape
  * weapon-holding animation set authored for this rest pose (idle, walk, sword attack, SMG fire, block, hit, death)
  * enamel-over-steel armour shader, aged brass, wool cape with a red cross on the back
  * export of a single game-ready skinned mesh + actions to glTF for Unreal
Coordinates: Blender Z up, the knight faces -Y. "1" parts are on +X (his left), "-1" on -X (his right)."""
import bpy, math, re, os
from mathutils import Vector, Quaternion, Matrix

D = bpy.data
FPS = 30
EXCLUDE = re.compile(r'^(Cyc|PX_|Target|GripPoint|Camera|TmpCam|RIG_)')

def objc(n):
    o = D.objects.get(n)
    if not o: return None
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return sum(ws, Vector()) / 8, Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws))), Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))

# ------------------------------------------------------------------ skeleton
def joints():
    J = {'root': (0, 0, 0), 'pelvis': (0, 0, 0.96), 'spine_01': (0, 0, 1.10), 'spine_02': (0, 0, 1.30), 'neck_01': (0, 0, 1.53), 'head': (0, 0, 1.62)}
    for sd, s, H in (('l', '1', 'L'), ('r', '-1', 'R')):
        sh = D.objects['BodyShoulder' + s].matrix_world.translation
        el = D.objects['BodyElbow' + s].matrix_world.translation
        wr = objc('Hand%sCuff' % H)[0]; pa = objc('Hand%sPalm' % H)[0]
        J['clavicle_' + sd] = (0.05 * (1 if sd == 'l' else -1), 0.0, sh.z + 0.01)
        J['upperarm_' + sd] = tuple(sh); J['lowerarm_' + sd] = tuple(el); J['hand_' + sd] = tuple(wr); J['_palm_' + sd] = tuple(pa)
        kn = D.objects['BodyKnee' + s].matrix_world.translation
        _, bmn, bmx = objc('Boot' + s)
        heel, toe = bmx.y, bmn.y; bx = (bmn.x + bmx.x) / 2
        J['thigh_' + sd] = (0.10 * (1 if sd == 'l' else -1), 0.0, 0.94)
        J['calf_' + sd] = tuple(kn)
        J['foot_' + sd] = (bx, heel + (toe - heel) * 0.3, 0.11)
        J['ball_' + sd] = (bx, heel + (toe - heel) * 0.72, 0.035)
        J['_toe_' + sd] = (bx, toe, 0.03)
    return J

HIER = [('root', None, 'pelvis'), ('pelvis', 'root', 'spine_01'), ('spine_01', 'pelvis', 'spine_02'), ('spine_02', 'spine_01', 'neck_01'),
        ('neck_01', 'spine_02', 'head'), ('head', 'neck_01', None)]
for _sd in ('l', 'r'):
    HIER += [('clavicle_' + _sd, 'spine_02', 'upperarm_' + _sd), ('upperarm_' + _sd, 'clavicle_' + _sd, 'lowerarm_' + _sd),
             ('lowerarm_' + _sd, 'upperarm_' + _sd, 'hand_' + _sd), ('hand_' + _sd, 'lowerarm_' + _sd, '_palm_' + _sd),
             ('thigh_' + _sd, 'pelvis', 'calf_' + _sd), ('calf_' + _sd, 'thigh_' + _sd, 'foot_' + _sd),
             ('foot_' + _sd, 'calf_' + _sd, 'ball_' + _sd), ('ball_' + _sd, 'foot_' + _sd, '_toe_' + _sd)]

def build_armature():
    J = joints()
    old = D.objects.get('RIG_Knight')
    if old: D.objects.remove(old, do_unlink=True)
    arm = D.armatures.new('RIG_Knight'); ob = D.objects.new('RIG_Knight', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for name, parent, tail in HIER:
        b = arm.edit_bones.new(name); h = Vector(J[name])
        if name == 'root': t = h + Vector((0, 0.25, 0))
        elif name == 'head': t = h + Vector((0, 0, 0.22))
        else: t = Vector(J[tail])
        if (t - h).length < 0.02: t = h + Vector((0, 0, 0.05))
        b.head, b.tail = h, t; b.roll = 0
        if parent: b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.show_in_front = True; arm.display_type = 'STICK'
    return ob

# ------------------------------------------------------------------ binding
RULES = [  # (regex, bone or 'side:<bone>' or special)
    (r'^(Helm|Breath|Eye|SlitH|SlitV|FrH|FrV)', 'head'),
    (r'^Gorget', 'neck_01'),
    (r'^(Breastplate|Plackart|Backplate|BPRivet|BPSideRivet|ChestCross|PendH|PendV|PendLink|CapeCollar|CapeClasp|SealPauldronStrip)', 'spine_02'),
    (r'^(Belt|BucklePlate|Fauld|Pouch|Skull|Tooth|Cartouche|CartX)', 'pelvis'),
    (r'^(Pauldron\d|Pauldron-|PCross|SealPauldron)', 'side:clavicle'),
    (r'^(PauldronLame|PLRivet|BodyShoulder|BodyUpper|Rerebrace|RereStrap)', 'side:upperarm'),
    (r'^(BodyElbow|Couter|BodyFore|Vambrace|VambStrap)', 'side:lowerarm'),
    (r'^HandL', 'hand_l'), (r'^HandR', 'hand_r'), (r'^SMG$', 'hand_l'), (r'^Sword$', 'hand_r'),
    (r'^(BodyThigh|Cuisse)', 'side:thigh'),
    (r'^(BodyKnee|Poleyn|BodyCalf|Greave)', 'side:calf'),
    (r'^Boot.*ToeCap', 'side:ball'), (r'^Boot', 'side:foot'),
    (r'^BodyTorso', 'grad:torso'), (r'^Tabard', 'grad:skirt'), (r'^Cape', 'grad:cape'),
]

def bone_for(o):
    c = objc(o.name)[0]; side = 'l' if c.x > 0 else 'r'
    for rx, b in RULES:
        if re.match(rx, o.name):
            return b.replace('side:', '') + '_' + side if b.startswith('side:') else b
    return None

def sm(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)

def w_torso(p):
    z = p.z
    if z < 1.03: return [('pelvis', 1.0)]
    if z < 1.20: t = sm(1.03, 1.20, z); return [('pelvis', 1 - t), ('spine_01', t)]
    if z < 1.38: t = sm(1.20, 1.38, z); return [('spine_01', 1 - t), ('spine_02', t)]
    return [('spine_02', 1.0)]

def w_skirt(p):
    if p.z > 0.93: return [('pelvis', 1.0)]
    leg = sm(0.93, 0.55, p.z); side = sm(-0.06, 0.06, p.x); ctr = 1 - abs(side - 0.5) * 2
    return [('pelvis', 1 - leg + leg * 0.3 * ctr), ('thigh_l', leg * side * (1 - 0.5 * ctr)), ('thigh_r', leg * (1 - side) * (1 - 0.5 * ctr))]

def w_cape(p):
    t = sm(1.45, 0.7, p.z); return [('spine_02', 1 - t), ('spine_01', t * 0.35), ('pelvis', t * 0.65)]

GRAD = {'torso': w_torso, 'skirt': w_skirt, 'cape': w_cape}

def bind(rig):
    """Rigid parts: bone-parent (keeps transform). Gradient parts: armature modifier + generated vertex groups."""
    report = {'rigid': 0, 'grad': 0, 'unassigned': []}
    for o in [o for o in D.objects if o.parent is None and o.type in ('MESH', 'CURVE', 'EMPTY') and not EXCLUDE.match(o.name)]:
        b = bone_for(o)
        if b is None:
            report['unassigned'].append(o.name); continue
        if b.startswith('grad:') and o.type == 'MESH':
            fn = GRAD[b[5:]]
            for vg in list(o.vertex_groups):
                if vg.name in rig.data.bones: o.vertex_groups.remove(vg)
            groups = {}
            mw = o.matrix_world
            for v in o.data.vertices:
                for bn, w in fn(mw @ v.co):
                    if w <= 1e-4: continue
                    g = groups.get(bn) or o.vertex_groups.new(name=bn); groups[bn] = g
                    g.add([v.index], w, 'REPLACE')
            m = o.modifiers.get('RigArm') or o.modifiers.new('RigArm', 'ARMATURE')
            m.object = rig
            o['sb_grad'] = b[5:]
            o.parent = rig; o.matrix_parent_inverse = rig.matrix_world.inverted()
            report['grad'] += 1
        else:
            bn = b if not b.startswith('grad:') else 'spine_02'
            mw = o.matrix_world.copy()
            o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = bn
            pb = rig.pose.bones[bn]
            o.matrix_parent_inverse = (rig.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted()
            o.matrix_world = mw
            report['rigid'] += 1
    return report

# ------------------------------------------------------------------ animation (authored in "rest-relative world axes")
def Q(axis, deg):
    return Quaternion(Vector(axis).normalized(), math.radians(deg))
def E(x=0.0, y=0.0, z=0.0):
    """Rotation about world axes at the joint. x: +X (pitch; negative swings a limb forward/up), y: Y, z: Z (twist/yaw)."""
    return Q((0, 0, 1), z) @ Q((0, 1, 0), y) @ Q((1, 0, 0), x)

def key_pose(rig, frame, pose, loc=None):
    for name, q in pose.items():
        pb = rig.pose.bones[name]; r = pb.bone.matrix_local.to_quaternion()
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = r.inverted() @ q @ r
        pb.keyframe_insert('rotation_quaternion', frame=frame, group=name)
    for name, v in (loc or {}).items():
        pb = rig.pose.bones[name]; r = pb.bone.matrix_local.to_quaternion()
        pb.location = r.inverted() @ Vector(v); pb.keyframe_insert('location', frame=frame, group=name)

BONES = ['pelvis', 'spine_01', 'spine_02', 'neck_01', 'head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r',
         'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r']

def full(p):
    for b in BONES: p.setdefault(b, Quaternion())
    return p

def smv(a, b, x): return sm(a, b, x)
# Note: the knight faces -Y, so a forward limb swing is a rotation about +X with NEGATIVE angle moving the foot toward -Y.
def a_idle(t, L):
    ph = 2 * math.pi * t / L; b = math.sin(ph)
    return full({'spine_01': E(x=1.2 * b), 'spine_02': E(x=-1.5 * b, z=0.8 * b), 'head': E(x=1.5 * b, z=2.5 * math.sin(ph * 0.5)),
                 'upperarm_r': E(x=-2 * b), 'upperarm_l': E(x=1.5 * b), 'lowerarm_r': E(x=-1.5 * b),
                 'thigh_l': E(x=1.0 * b), 'thigh_r': E(x=-1.0 * b)}), {'pelvis': (0, 0, -0.006 * (1 + b))}

def a_walk(t, L):
    ph = 2 * math.pi * t / L; s = math.sin(ph); c = math.cos(ph)
    def leg(sd, p):
        sw = math.sin(p); lift = max(0.0, -math.cos(p))
        return {'thigh_' + sd: E(x=24 * sw + 3), 'calf_' + sd: E(x=-(6 + 50 * lift * max(0.0, math.sin(p + math.pi / 2)) + 8 * max(0.0, -sw))),
                'foot_' + sd: E(x=-10 * sw * 0.6 - 5 * max(0.0, sw))}
    p = {}; p.update(leg('l', ph)); p.update(leg('r', ph + math.pi))
    p.update({'pelvis': E(z=5 * s, y=2.5 * c), 'spine_01': E(x=-3, z=-4 * s), 'spine_02': E(x=-2, z=-4 * s), 'head': E(z=5 * s),
              'upperarm_l': E(x=-5 * s), 'upperarm_r': E(x=6 * s)})
    return full(p), {'pelvis': (0, 0, -0.03 + 0.028 * abs(c))}

def a_attack(t, L):
    up = smv(0.0, 0.30, t) * (1 - smv(0.34, 0.47, t)); dn = smv(0.34, 0.47, t) * (1 - smv(0.6, 0.9, t))
    p = {'spine_01': E(z=-14 * up + 20 * dn, x=4 * up - 10 * dn), 'spine_02': E(z=-12 * up + 16 * dn, x=6 * up - 14 * dn), 'head': E(x=-5 * up + 8 * dn),
         'pelvis': E(z=-6 * up + 8 * dn),
         'upperarm_r': E(x=-125 * up - 10 * dn, y=-20 * up + 10 * dn), 'lowerarm_r': E(x=-35 * up + 25 * dn), 'hand_r': E(x=35 * up - 40 * dn),
         'upperarm_l': E(x=10 * up - 8 * dn, z=-6 * up), 'thigh_r': E(x=-26 * dn - 8 * up), 'calf_r': E(x=-24 * dn - 8 * up), 'foot_r': E(x=-4 * dn),
         'thigh_l': E(x=18 * dn + 6), 'calf_l': E(x=-16 * dn - 4), 'foot_l': E(x=12 * dn)}
    return full(p), {'pelvis': (0, -0.05 * dn, -0.07 * dn)}

def a_fire(t, L):
    """Short SMG burst from the hip: rhythmic recoil in the left arm and shoulders, braced stance."""
    brace = smv(0.0, 0.12, t) * (1 - smv(0.85, 1.0, t))
    kick = max(0.0, math.sin(2 * math.pi * t * 11)) * brace if 0.12 < t < 0.8 else 0.0
    p = {'spine_01': E(x=3 * brace + 1.5 * kick), 'spine_02': E(x=4 * brace + 2.5 * kick, z=8 * brace), 'head': E(x=-3 * brace),
         'upperarm_l': E(x=-18 * brace + 4 * kick, z=4 * brace), 'lowerarm_l': E(x=-6 * brace + 5 * kick), 'hand_l': E(x=4 * kick),
         'clavicle_l': E(y=2 * kick), 'upperarm_r': E(x=6 * brace),
         'thigh_l': E(x=-14 * brace), 'calf_l': E(x=-14 * brace), 'thigh_r': E(x=12 * brace), 'calf_r': E(x=-8 * brace)}
    return full(p), {'pelvis': (0, 0.012 * kick, -0.04 * brace)}

def a_block(t, L):
    k = smv(0.0, 0.16, t) * (1 - smv(0.5, 0.65, t))
    p = {'upperarm_r': E(x=-55 * k, y=-25 * k), 'lowerarm_r': E(x=-20 * k, z=-50 * k), 'hand_r': E(y=70 * k),
         'spine_02': E(x=6 * k, z=-10 * k), 'head': E(x=-6 * k), 'upperarm_l': E(x=8 * k),
         'thigh_l': E(x=-16 * k), 'calf_l': E(x=-18 * k), 'thigh_r': E(x=12 * k), 'calf_r': E(x=-12 * k)}
    return full(p), {'pelvis': (0, 0.02 * k, -0.05 * k)}

def a_hit(t, L):
    k = smv(0.0, 0.07, t) * (1 - smv(0.12, 0.5, t))
    return full({'spine_01': E(x=10 * k), 'spine_02': E(x=14 * k, z=6 * k), 'head': E(x=18 * k, y=6 * k),
                 'upperarm_l': E(x=12 * k), 'upperarm_r': E(x=14 * k), 'thigh_l': E(x=-8 * k), 'calf_l': E(x=-10 * k)}), {'pelvis': (0, 0.04 * k, 0)}

def a_death(t, L):
    k = smv(0.0, 0.9, t); kn = smv(0.12, 0.55, t); fall = smv(0.5, 1.1, t)
    return full({'thigh_l': E(x=-85 * kn), 'thigh_r': E(x=-75 * kn, y=-6 * kn), 'calf_l': E(x=-120 * kn), 'calf_r': E(x=-110 * kn),
                 'foot_l': E(x=30 * kn), 'foot_r': E(x=30 * kn), 'spine_01': E(x=-15 * k - 30 * fall), 'spine_02': E(x=-20 * k), 'head': E(x=-25 * k, y=10 * k),
                 'upperarm_l': E(x=30 * k, z=10 * k), 'upperarm_r': E(x=35 * k, z=-10 * k), 'lowerarm_l': E(x=25 * k), 'lowerarm_r': E(x=30 * k)}), \
        {'pelvis': (0, 0.06 * kn - 0.25 * fall, -0.52 * kn - 0.25 * fall)}

CLIPS = {'A_Knight_Idle': (a_idle, 2.4, True), 'A_Knight_Walk': (a_walk, 1.1, True), 'A_Knight_Attack_Overhead': (a_attack, 0.9, False),
         'A_Knight_Fire_SMG': (a_fire, 1.0, False), 'A_Knight_Block': (a_block, 0.65, False), 'A_Knight_HitReact': (a_hit, 0.5, False),
         'A_Knight_Death': (a_death, 1.6, False)}

def build_actions(rig):
    rig.animation_data_create(); made = []
    for name, (fn, L, loop) in CLIPS.items():
        old = D.actions.get(name)
        if old: D.actions.remove(old)
        act = D.actions.new(name); act.use_fake_user = True; rig.animation_data.action = act
        n = int(round(L * FPS))
        for f in range(n + 1):
            pose, loc = fn(L * f / n, L); key_pose(rig, f, pose, loc)
        act.frame_range = (0, n); made.append((name, n))
        tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = D.actions['A_Knight_Idle']
    return made

# ------------------------------------------------------------------ materials
def _n(t, kind, x, y, **kw):
    n = t.nodes.new(kind); n.location = (x, y)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n
def _L(t, a, ao, b, bi): t.links.new(a.outputs[ao], b.inputs[bi])
def _ramp(t, x, y, stops):
    r = _n(t, 'ShaderNodeValToRGB', x, y); e = r.color_ramp.elements
    e[0].position, e[0].color = stops[0]; e[1].position, e[1].color = stops[-1]
    for p, c in stops[1:-1]: el = e.new(p); el.color = c
    return r

def enamel(mat, paint=(0.80, 0.77, 0.70), steel=(0.55, 0.56, 0.58)):
    """White lacquer over steel: AO + noise edge chipping reveals bare metal; cavity grime; scratches; clearcoat."""
    mat.use_nodes = True; t = mat.node_tree
    for n in list(t.nodes): t.nodes.remove(n)
    out = _n(t, 'ShaderNodeOutputMaterial', 1300, 0); paintB = _n(t, 'ShaderNodeBsdfPrincipled', 700, 250); metal = _n(t, 'ShaderNodeBsdfPrincipled', 700, -250)
    mix = _n(t, 'ShaderNodeMixShader', 1050, 0); _L(t, mix, 0, out, 0)
    tc = _n(t, 'ShaderNodeTexCoord', -1500, 0)
    ao = _n(t, 'ShaderNodeAmbientOcclusion', -1200, 300, samples=16, inside=False); ao.inputs['Distance'].default_value = 0.03
    aoi = _n(t, 'ShaderNodeAmbientOcclusion', -1200, 550, samples=16, inside=True); aoi.inputs['Distance'].default_value = 0.015
    # edges = convex areas -> high "inside" AO; chips where edge * noise
    n1 = _n(t, 'ShaderNodeTexNoise', -1200, 0, Scale=55.0, Detail=12.0, Roughness=0.7); _L(t, tc, 'Object', n1, 'Vector')
    edge = _ramp(t, -950, 550, [(0.70, (0, 0, 0, 1)), (0.95, (1, 1, 1, 1))]); _L(t, aoi, 'AO', edge, 'Fac')
    ch = _n(t, 'ShaderNodeMath', -700, 350, operation='MULTIPLY'); _L(t, edge, 'Color', ch, 0); _L(t, n1, 'Fac', ch, 1)
    chip = _ramp(t, -500, 350, [(0.30, (0, 0, 0, 1)), (0.40, (1, 1, 1, 1))]); _L(t, ch, 'Value', chip, 'Fac')
    _L(t, chip, 'Color', mix, 'Fac')
    # paint layer: off-white with grime in cavities and large-scale soiling
    dirt = _ramp(t, -950, 250, [(0.4, (0.32, 0.27, 0.2, 1)), (0.9, (1, 1, 1, 1))]); _L(t, ao, 'AO', dirt, 'Fac')
    n2 = _n(t, 'ShaderNodeTexNoise', -1200, -250, Scale=4.0, Detail=10.0, Roughness=0.6); _L(t, tc, 'Object', n2, 'Vector')
    soil = _ramp(t, -950, -250, [(0.35, (paint[0] * 0.78, paint[1] * 0.74, paint[2] * 0.66, 1)), (0.65, (*paint, 1))]); _L(t, n2, 'Fac', soil, 'Fac')
    pc = _n(t, 'ShaderNodeMix', -500, 150, data_type='RGBA', blend_type='MULTIPLY'); pc.inputs['Factor'].default_value = 1.0
    _L(t, soil, 'Color', pc, 'A'); _L(t, dirt, 'Color', pc, 'B'); _L(t, pc, 'Result', paintB, 'Base Color')
    paintB.inputs['Roughness'].default_value = 0.42
    if 'Coat Weight' in paintB.inputs: paintB.inputs['Coat Weight'].default_value = 0.35; paintB.inputs['Coat Roughness'].default_value = 0.25
    # scratches in the lacquer (stretched noise) roughen it
    mp = _n(t, 'ShaderNodeMapping', -1200, -500); mp.inputs['Scale'].default_value = (60, 3, 60); _L(t, tc, 'Object', mp, 'Vector')
    n3 = _n(t, 'ShaderNodeTexNoise', -1000, -500, Scale=14.0, Detail=12.0); _L(t, mp, 'Vector', n3, 'Vector')
    sr = _ramp(t, -750, -500, [(0.55, (0.38, 0.38, 0.38, 1)), (0.66, (0.75, 0.75, 0.75, 1))]); _L(t, n3, 'Fac', sr, 'Fac'); _L(t, sr, 'Color', paintB, 'Roughness')
    # bare steel in the chips
    metal.inputs['Base Color'].default_value = (*steel, 1); metal.inputs['Metallic'].default_value = 1.0; metal.inputs['Roughness'].default_value = 0.35
    _L(t, paintB, 0, mix, 1); _L(t, metal, 0, mix, 2)
    # chip edges are slightly recessed
    bump = _n(t, 'ShaderNodeBump', 400, -550, Strength=0.25, Distance=0.002); _L(t, chip, 'Color', bump, 'Height')
    _L(t, bump, 'Normal', paintB, 'Normal'); _L(t, bump, 'Normal', metal, 'Normal')

def aged_brass(mat):
    mat.use_nodes = True; t = mat.node_tree
    b = next((n for n in t.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if not b: return
    ao = _n(t, 'ShaderNodeAmbientOcclusion', -700, 200, samples=12); ao.inputs['Distance'].default_value = 0.02
    r = _ramp(t, -450, 200, [(0.35, (0.16, 0.10, 0.04, 1)), (0.85, (0.88, 0.64, 0.30, 1))]); _L(t, ao, 'AO', r, 'Fac')
    for l in list(b.inputs['Base Color'].links): t.links.remove(l)
    _L(t, r, 'Color', b, 'Base Color'); b.inputs['Metallic'].default_value = 1.0
    rr = _ramp(t, -450, -50, [(0.35, (0.65, 0.65, 0.65, 1)), (0.85, (0.28, 0.28, 0.28, 1))]); _L(t, ao, 'AO', rr, 'Fac')
    for l in list(b.inputs['Roughness'].links): t.links.remove(l)
    _L(t, rr, 'Color', b, 'Roughness')

def cape_cross(mat):
    """Wool weave + soiled hem + a large red cross on the back panel (object-space mask; the cape hangs behind at +Y)."""
    mat.use_nodes = True; t = mat.node_tree
    b = next((n for n in t.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if not b: return
    base = tuple(b.inputs['Base Color'].default_value)
    tc = _n(t, 'ShaderNodeTexCoord', -1600, 0); sep = _n(t, 'ShaderNodeSeparateXYZ', -1400, 0); _L(t, tc, 'Object', sep, 'Vector')
    def band(axis_out, lo, hi, x, y):
        a = _n(t, 'ShaderNodeMath', x, y, operation='GREATER_THAN'); a.inputs[1].default_value = lo; _L(t, sep, axis_out, a, 0)
        c = _n(t, 'ShaderNodeMath', x, y - 120, operation='LESS_THAN'); c.inputs[1].default_value = hi; _L(t, sep, axis_out, c, 0)
        m = _n(t, 'ShaderNodeMath', x + 180, y - 60, operation='MULTIPLY'); _L(t, a, 0, m, 0); _L(t, c, 0, m, 1); return m
    vx = band('X', -0.045, 0.045, -1150, 400); vz = band('Z', 0.62, 1.32, -1150, 150)
    hx = band('X', -0.19, 0.19, -1150, -100); hz = band('Z', 1.05, 1.14, -1150, -350)
    v = _n(t, 'ShaderNodeMath', -800, 300, operation='MULTIPLY'); _L(t, vx, 0, v, 0); _L(t, vz, 0, v, 1)
    h = _n(t, 'ShaderNodeMath', -800, -200, operation='MULTIPLY'); _L(t, hx, 0, h, 0); _L(t, hz, 0, h, 1)
    back = _n(t, 'ShaderNodeMath', -800, -450, operation='GREATER_THAN'); back.inputs[1].default_value = 0.25; _L(t, sep, 'Y', back, 0)
    cr = _n(t, 'ShaderNodeMath', -620, 0, operation='MAXIMUM'); _L(t, v, 0, cr, 0); _L(t, h, 0, cr, 1)
    crb = _n(t, 'ShaderNodeMath', -450, 0, operation='MULTIPLY'); _L(t, cr, 0, crb, 0); _L(t, back, 0, crb, 1)
    n = _n(t, 'ShaderNodeTexNoise', -800, 600, Scale=5.0, Detail=10.0); _L(t, tc, 'Object', n, 'Vector')
    soil = _ramp(t, -600, 600, [(0.3, (base[0] * 0.7, base[1] * 0.66, base[2] * 0.58, 1)), (0.65, base)]); _L(t, n, 'Fac', soil, 'Fac')
    hem = _n(t, 'ShaderNodeMapRange', -600, 850); hem.inputs['From Min'].default_value = 0.55; hem.inputs['From Max'].default_value = 0.25; _L(t, sep, 'Z', hem, 'Value')
    hm = _n(t, 'ShaderNodeMix', -300, 700, data_type='RGBA'); _L(t, hem, 'Result', hm, 'Factor'); _L(t, soil, 'Color', hm, 'A'); hm.inputs['B'].default_value = (0.08, 0.055, 0.035, 1)
    cm = _n(t, 'ShaderNodeMix', -100, 300, data_type='RGBA'); _L(t, crb, 0, cm, 'Factor'); _L(t, hm, 'Result', cm, 'A'); cm.inputs['B'].default_value = (0.42, 0.025, 0.02, 1)
    for l in list(b.inputs['Base Color'].links): t.links.remove(l)
    _L(t, cm, 'Result', b, 'Base Color')
    w1 = _n(t, 'ShaderNodeTexWave', -800, -700, wave_type='BANDS', bands_direction='X', Scale=500.0); w2 = _n(t, 'ShaderNodeTexWave', -800, -900, wave_type='BANDS', bands_direction='Z', Scale=500.0)
    _L(t, tc, 'Object', w1, 'Vector'); _L(t, tc, 'Object', w2, 'Vector')
    wv = _n(t, 'ShaderNodeMath', -600, -800, operation='MULTIPLY'); _L(t, w1, 'Fac', wv, 0); _L(t, w2, 'Fac', wv, 1)
    bump = _n(t, 'ShaderNodeBump', -300, -800, Strength=0.2, Distance=0.002); _L(t, wv, 0, bump, 'Height')
    if not b.inputs['Normal'].links: _L(t, bump, 'Normal', b, 'Normal')

def upgrade_materials():
    done = []
    for n in ('Armor', 'ArmorPlate'):
        if n in D.materials: enamel(D.materials[n]); done.append(n)
    if 'Gold' in D.materials: aged_brass(D.materials['Gold']); done.append('Gold')
    if 'CapeWool' in D.materials: cape_cross(D.materials['CapeWool']); done.append('CapeWool')
    return done

# ------------------------------------------------------------------ export
def export_game_mesh(rig, path, sub_levels=1):
    """Bake every bound part (modifiers evaluated) into one skinned mesh with per-bone vertex groups and export glTF."""
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pieces = []
    for o in D.objects:
        if o.type not in ('MESH', 'CURVE') or EXCLUDE.match(o.name) or o.hide_render: continue
        # find owning bone: walk parents
        p = o; bn = None; grad = False
        while p:
            if p.parent == rig:
                bn = p.parent_bone if p.parent_type == 'BONE' else None; grad = p.parent_type != 'BONE'; break
            p = p.parent
        if p is None: continue
        for m in o.modifiers:
            if m.type == 'SUBSURF': m.levels = min(m.levels, sub_levels)
        ev = o.evaluated_get(dg)
        try: me = D.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        except Exception: continue
        if not me.polygons: D.meshes.remove(me); continue
        me.transform(o.matrix_world)  # world space; armature modifier on gradient parts is in rest pose
        po = D.objects.new('X_' + o.name, me); bpy.context.scene.collection.objects.link(po)
        if grad:  # recompute smooth weights on the evaluated (subdivided) vertices
            fn = GRAD.get(o.get('sb_grad', 'torso'), w_torso); gs = {}
            for v in me.vertices:
                for b2, w in fn(v.co):
                    if w <= 1e-4: continue
                    g = gs.get(b2) or po.vertex_groups.new(name=b2); gs[b2] = g; g.add([v.index], w, 'REPLACE')
        else:
            g = po.vertex_groups.new(name=bn); g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
        pieces.append(po)
    bpy.ops.object.select_all(action='DESELECT')
    for po in pieces: po.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    gm = bpy.context.view_layer.objects.active; gm.name = 'SK_HeroKnight_v14'
    gm.parent = rig; m = gm.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    tris = sum(len(p.vertices) - 2 for p in gm.data.polygons)
    bpy.ops.object.select_all(action='DESELECT'); gm.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    # make every action exportable
    for tr in rig.animation_data.nla_tracks: tr.mute = False
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLTF_SEPARATE', export_animations=True,
                              export_animation_mode='ACTIONS', export_skins=True, export_apply=False, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT')
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    D.objects.remove(gm, do_unlink=True)
    rig.data.pose_position = 'POSE'
    return {'tris': tris, 'path': path, 'parts': len(pieces)}
