"""Steel & Blood hero knight v15 - art-direction pass on top of v14 (user reference boards, Nov 2026).
Direction: ivory plate with gold trim, heavy battle damage exposing dark iron, large red Templar crosses,
cross-marked great helm, torn tabard/cape hems, bulkier shoulders. Operates on the user's model in place
(saved as a new version); every step is idempotent so it can be re-run."""
import bpy, bmesh, math, re
from mathutils import Vector, Matrix, noise
import sb_v14 as K

D = bpy.data

def wbb(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws))), Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))

# ------------------------------------------------------------------ materials
def battle_enamel(mat, ivory=(0.80, 0.74, 0.62), iron=(0.045, 0.042, 0.04)):
    """Ivory lacquer over dark iron. Two noise octaves make spotty chips (~18% coverage) concentrated
    where cavity AO is low/high, plus soot streaks and a clearcoat that only exists on the paint."""
    mat.use_nodes = True; t = mat.node_tree
    for n in list(t.nodes): t.nodes.remove(n)
    N = K._n; L = K._L; R = K._ramp
    out = N(t, 'ShaderNodeOutputMaterial', 1400, 0); paint = N(t, 'ShaderNodeBsdfPrincipled', 800, 300); metal = N(t, 'ShaderNodeBsdfPrincipled', 800, -300)
    mix = N(t, 'ShaderNodeMixShader', 1150, 0); L(t, mix, 0, out, 0)
    tc = N(t, 'ShaderNodeTexCoord', -1700, 0)
    # chips: large blotch mask x fine breakup
    big = N(t, 'ShaderNodeTexNoise', -1400, 500, Scale=7.0, Detail=4.0, Roughness=0.55); L(t, tc, 'Object', big, 'Vector')
    fine = N(t, 'ShaderNodeTexVoronoi', -1400, 250, feature='F1', Scale=70.0); L(t, tc, 'Object', fine, 'Vector')
    fn = N(t, 'ShaderNodeTexNoise', -1400, 0, Scale=90.0, Detail=10.0, Roughness=0.75); L(t, tc, 'Object', fn, 'Vector')
    m1 = N(t, 'ShaderNodeMath', -1150, 300, operation='MULTIPLY'); L(t, big, 'Fac', m1, 0); L(t, fn, 'Fac', m1, 1)
    m2 = N(t, 'ShaderNodeMath', -1000, 200, operation='SUBTRACT'); L(t, m1, 0, m2, 0); L(t, fine, 'Distance', m2, 1)
    # m2 = blotch - voronoi distance: positive only inside blotches near cell centres -> spotty chips
    chip = R(t, -700, 250, [(0.05, (0, 0, 0, 1)), (0.08, (1, 1, 1, 1))]); L(t, m2, 0, chip, 'Fac')
    inv = chip
    L(t, chip, 'Color', mix, 'Fac')
    # paint colour: ivory, cavity grime, soot gradient from the ground up
    ao = N(t, 'ShaderNodeAmbientOcclusion', -1400, -300, samples=16); ao.inputs['Distance'].default_value = 0.035
    grime = R(t, -1150, -300, [(0.35, (0.22, 0.17, 0.11, 1)), (0.9, (1, 1, 1, 1))]); L(t, ao, 'AO', grime, 'Fac')
    soilN = N(t, 'ShaderNodeTexNoise', -1400, -550, Scale=3.0, Detail=10.0, Roughness=0.6); L(t, tc, 'Object', soilN, 'Vector')
    soil = R(t, -1150, -550, [(0.3, (ivory[0] * 0.72, ivory[1] * 0.66, ivory[2] * 0.55, 1)), (0.65, (*ivory, 1))]); L(t, soilN, 'Fac', soil, 'Fac')
    sep = N(t, 'ShaderNodeSeparateXYZ', -1400, -800); L(t, tc, 'Object', sep, 'Vector')
    soot = N(t, 'ShaderNodeMapRange', -1150, -800); soot.inputs['From Min'].default_value = 0.5; soot.inputs['From Max'].default_value = 0.0; L(t, sep, 'Z', soot, 'Value')
    pc = N(t, 'ShaderNodeMix', -800, -400, data_type='RGBA', blend_type='MULTIPLY'); pc.inputs['Factor'].default_value = 1.0; L(t, soil, 'Color', pc, 'A'); L(t, grime, 'Color', pc, 'B')
    sc = N(t, 'ShaderNodeMix', -600, -500, data_type='RGBA'); L(t, soot, 'Result', sc, 'Factor'); L(t, pc, 'Result', sc, 'A'); sc.inputs['B'].default_value = (0.12, 0.1, 0.08, 1)
    L(t, sc, 'Result', paint, 'Base Color')
    paint.inputs['Roughness'].default_value = 0.38
    if 'Coat Weight' in paint.inputs: paint.inputs['Coat Weight'].default_value = 0.4; paint.inputs['Coat Roughness'].default_value = 0.2
    # scratched dark iron underneath
    metal.inputs['Base Color'].default_value = (*iron, 1); metal.inputs['Metallic'].default_value = 1.0
    sN = N(t, 'ShaderNodeTexNoise', -800, -900, Scale=120.0, Detail=8.0); L(t, tc, 'Object', sN, 'Vector')
    sr = R(t, -600, -900, [(0.4, (0.3, 0.3, 0.3, 1)), (0.65, (0.65, 0.65, 0.65, 1))]); L(t, sN, 'Fac', sr, 'Fac'); L(t, sr, 'Color', metal, 'Roughness')
    L(t, paint, 0, mix, 1); L(t, metal, 0, mix, 2)
    bump = N(t, 'ShaderNodeBump', 500, -650, Strength=0.45, Distance=0.0015); L(t, inv, 'Color', bump, 'Height')
    L(t, bump, 'Normal', paint, 'Normal'); L(t, bump, 'Normal', metal, 'Normal')

def weathered_red(mat, col=(0.38, 0.02, 0.015)):
    mat.use_nodes = True; t = mat.node_tree
    b = next((n for n in t.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if not b: return
    tc = K._n(t, 'ShaderNodeTexCoord', -900, 0); n = K._n(t, 'ShaderNodeTexNoise', -700, 0, Scale=40.0, Detail=8.0); K._L(t, tc, 'Object', n, 'Vector')
    r = K._ramp(t, -450, 0, [(0.35, (col[0] * 0.55, col[1], col[2], 1)), (0.6, (*col, 1)), (0.72, (0.75, 0.70, 0.6, 1))]); K._L(t, n, 'Fac', r, 'Fac')
    for l in list(b.inputs['Base Color'].links): t.links.remove(l)
    K._L(t, r, 'Color', b, 'Base Color'); b.inputs['Roughness'].default_value = 0.6; b.inputs['Metallic'].default_value = 0.0

# ------------------------------------------------------------------ geometry
def scale_about(objs, pivot, s):
    M = Matrix.Translation(pivot) @ Matrix.Scale(s, 4) @ Matrix.Translation(-pivot)
    for o in objs:
        o.matrix_world = M @ o.matrix_world

def bulk_pauldrons(scale=1.2):
    if D.objects.get('Pauldron1') and D.objects['Pauldron1'].get('sb_bulked'): return 'already'
    done = []
    for side, s in (('1', 1), ('-1', -1)):
        piv = D.objects['BodyShoulder' + side].matrix_world.translation.copy() + Vector((0.02 * s, 0, 0.03))
        group = [o for o in D.objects if re.match(r'^(Pauldron|PauldronLame|PCross|SealPauldron|PLRivet)', o.name) and o.parent and o.parent.name == 'RIG_Knight'
                 and (wbb(o)[0] + wbb(o)[1]).x * s > 0]
        scale_about(group, piv, scale); done += [o.name for o in group]
    D.objects['Pauldron1']['sb_bulked'] = 1
    return done

def plate(name, mat, center, size, rot=(0, 0, 0), parent=None, bone=None, bevel=0.002):
    if D.objects.get(name): D.objects.remove(D.objects[name], do_unlink=True)
    me = D.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    o = D.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for c in list(o.users_collection): c.objects.unlink(o)
    D.collections['Knight'].objects.link(o)
    o.scale = size; o.rotation_euler = rot; o.location = center
    me.materials.append(D.materials[mat])
    bv = o.modifiers.new('Bevel', 'BEVEL'); bv.width = bevel; bv.segments = 2
    if parent:
        bpy.context.view_layer.update(); mw = o.matrix_world.copy()
        rig = D.objects['RIG_Knight']; pb = rig.pose.bones[bone]
        o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = bone
        o.matrix_parent_inverse = (rig.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted(); o.matrix_world = mw
    return o

def helm_cross():
    """Red Templar cross on the great helm's faceplate (vertical bar down the face, horizontal across the brow)."""
    h = D.objects['Helm']; mn, mx = wbb(h); cx = (mn.x + mx.x) / 2; fy = mn.y - 0.004
    zt, zb = mx.z - 0.035, mn.z + 0.05; zc = zb + (zt - zb) * 0.62
    rig = D.objects['RIG_Knight']
    a = plate('HelmCrossV', 'RedPaint', (cx, fy + 0.006, (zt + zb) / 2), (0.026, 0.01, (zt - zb)), parent=rig, bone='head')
    b = plate('HelmCrossH', 'RedPaint', (cx, fy + 0.008, zc), ((mx.x - mn.x) * 0.62, 0.01, 0.024), parent=rig, bone='head')
    # shrinkwrap both onto the helm surface so they follow its curvature
    for o in (a, b):
        sw = o.modifiers.new('Wrap', 'SHRINKWRAP'); sw.target = h; sw.wrap_method = 'PROJECT'; sw.use_project_y = True
        sw.use_negative_direction = True; sw.use_positive_direction = True; sw.offset = 0.004
        o.modifiers.move(len(o.modifiers) - 1, 0)
        # subdivide so the wrap can bend it
        me = o.data; bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True); bm.to_mesh(me); bm.free()
    return [a.name, b.name]

def knee_crosses():
    out = []
    for side, bone in (('1', 'calf_l'), ('-1', 'calf_r')):
        p = D.objects.get('Poleyn' + side)
        if not p: continue
        mn, mx = wbb(p); c = Vector(((mn.x + mx.x) / 2, mn.y - 0.003, (mn.z + mx.z) / 2 + 0.005))
        v = plate('KneeCrossV' + side, 'Gold', c, (0.016, 0.008, 0.075), parent=True, bone=bone, bevel=0.003)
        h = plate('KneeCrossH' + side, 'Gold', c + Vector((0, 0, 0.01)), (0.06, 0.008, 0.016), parent=True, bone=bone, bevel=0.003)
        for o in (v, h):
            sw = o.modifiers.new('Wrap', 'SHRINKWRAP'); sw.target = p; sw.wrap_method = 'NEAREST_SURFACEPOINT'; sw.offset = 0.003
            me = o.data; bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=4, use_grid_fill=True); bm.to_mesh(me); bm.free()
        out += [v.name, h.name]
    return out

def tear_hem(name, depth=0.16, seed=3.0, density=11.0):
    """Cut a ragged, torn hem into a cloth mesh: delete faces in the bottom band where a noise field says 'torn'."""
    o = D.objects.get(name)
    if not o or o.get('sb_torn'): return 0
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    zs = [(o.matrix_world @ v.co).z for v in bm.verts]; zmin = min(zs); cut = []
    for f in bm.faces:
        c = o.matrix_world @ f.calc_center_median()
        h = (c.z - zmin) / depth
        if h > 1.0: continue
        n = noise.noise(Vector((c.x * density + seed, c.y * 3.0, seed))) * 0.5 + 0.5
        tooth = abs(math.sin(c.x * density * 1.7 + seed))  # jagged strips
        if h < (0.25 + 0.75 * n) * (0.4 + 0.6 * tooth): cut.append(f)
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    bm.to_mesh(me); bm.free(); o['sb_torn'] = 1
    return len(cut)

def apply_all():
    rep = {}
    for n in ('Armor', 'ArmorPlate'):
        if n in D.materials: battle_enamel(D.materials[n])
    if 'RedPaint' in D.materials: weathered_red(D.materials['RedPaint'])
    rep['pauldrons'] = bulk_pauldrons(1.2)
    rep['helm'] = helm_cross()
    rep['knees'] = knee_crosses()
    rep['torn'] = {n: tear_hem(n, d, s) for n, d, s in (('TabardFront', 0.14, 1.0), ('TabardBack', 0.16, 2.0), ('Cape', 0.22, 3.0))}
    return rep
