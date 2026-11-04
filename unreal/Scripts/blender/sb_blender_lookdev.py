"""Blender (5.x) source-art stage for Steel & Blood.
Imports the sbkit glTF exports, replaces the flat glTF materials with full procedural PBR node materials,
binds weapons to bones, builds a look-dev stage and saves the .blend source file."""
import bpy, math, os

SRC = r'C:/Users/decca/OneDrive/Documents/Unreal Projects/Steelandblood/Saved/SB/out/'
ART = r'C:/Users/decca/OneDrive/Documents/Unreal Projects/Steelandblood/SourceArt/Blender/'

# ------------------------------------------------------------------ material helpers
def nt(mat):
    mat.use_nodes = True; t = mat.node_tree
    for n in list(t.nodes): t.nodes.remove(n)
    out = t.nodes.new('ShaderNodeOutputMaterial'); out.location = (900, 0)
    b = t.nodes.new('ShaderNodeBsdfPrincipled'); b.location = (600, 0)
    t.links.new(b.outputs[0], out.inputs[0]); return t, b

def node(t, kind, x, y, **kw):
    n = t.nodes.new(kind); n.location = (x, y)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

def L(t, a, ao, b, bi): t.links.new(a.outputs[ao], b.inputs[bi])

def ramp(t, x, y, stops):
    r = node(t, 'ShaderNodeValToRGB', x, y); e = r.color_ramp.elements
    e[0].position, e[0].color = stops[0][0], stops[0][1]; e[1].position, e[1].color = stops[-1][0], stops[-1][1]
    for p, c in stops[1:-1]:
        el = e.new(p); el.color = c
    return r

def metal(mat, base, rough=0.3, wear=True, scratches=0.5):
    t, b = nt(mat)
    tc = node(t, 'ShaderNodeTexCoord', -1400, 0)
    # cavity dirt + edge polish from ambient occlusion
    ao = node(t, 'ShaderNodeAmbientOcclusion', -1000, 300, samples=16, inside=False); ao.inputs['Distance'].default_value = 0.04
    dirt = ramp(t, -750, 300, [(0.3, (0.25, 0.25, 0.25, 1)), (0.8, (1, 1, 1, 1))])
    L(t, ao, 'AO', dirt, 'Fac')
    # large-scale tarnish
    n1 = node(t, 'ShaderNodeTexNoise', -1000, 0, Scale=6.0, Detail=8.0, Roughness=0.6); L(t, tc, 'Object', n1, 'Vector')
    tarn = ramp(t, -750, 0, [(0.35, (base[0]*0.7, base[1]*0.66, base[2]*0.6, 1)), (0.7, (*base, 1))])
    L(t, n1, 'Fac', tarn, 'Fac')
    mixc = node(t, 'ShaderNodeMix', -450, 150, data_type='RGBA', blend_type='MULTIPLY'); mixc.inputs['Factor'].default_value = 1.0
    L(t, tarn, 'Color', mixc, 'A'); L(t, dirt, 'Color', mixc, 'B')
    # rust/grime tint in deep cavities
    grime = node(t, 'ShaderNodeMix', -200, 150, data_type='RGBA', blend_type='MIX')
    L(t, mixc, 'Result', grime, 'A'); grime.inputs['B'].default_value = (0.09, 0.05, 0.03, 1)
    inv = node(t, 'ShaderNodeInvert', -450, 400); L(t, dirt, 'Color', inv, 'Color')
    gmul = node(t, 'ShaderNodeMath', -250, 420, operation='MULTIPLY'); gmul.inputs[1].default_value = 0.6
    L(t, inv, 'Color', gmul, 0); L(t, gmul, 'Value', grime, 'Factor')
    L(t, grime, 'Result', b, 'Base Color')
    b.inputs['Metallic'].default_value = 1.0
    # roughness: base + stretched scratch noise + rougher dirt
    sc = node(t, 'ShaderNodeMapping', -1200, -350); sc.inputs['Scale'].default_value = (40, 2, 40); L(t, tc, 'Object', sc, 'Vector')
    n2 = node(t, 'ShaderNodeTexNoise', -1000, -350, Scale=18.0, Detail=12.0, Roughness=0.7); L(t, sc, 'Vector', n2, 'Vector')
    rr = ramp(t, -750, -350, [(0.4, (rough*0.6,)*3 + (1,)), (0.62, (rough*1.6,)*3 + (1,))])
    L(t, n2, 'Fac', rr, 'Fac')
    radd = node(t, 'ShaderNodeMath', -450, -350, operation='ADD', use_clamp=True)
    L(t, rr, 'Color', radd, 0); L(t, gmul, 'Value', radd, 1)
    L(t, radd, 'Value', b, 'Roughness')
    # micro surface: hammered/pitted bump
    n3 = node(t, 'ShaderNodeTexNoise', -1000, -650, Scale=140.0, Detail=4.0); L(t, tc, 'Object', n3, 'Vector')
    bump = node(t, 'ShaderNodeBump', 300, -400, Strength=0.06*scratches+0.03, Distance=0.002)
    L(t, n3, 'Fac', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')
    return t, b

def chainmail(mat):
    t, b = metal(mat, (0.42, 0.42, 0.44), rough=0.42)
    uv = node(t, 'ShaderNodeTexCoord', -1700, -900)
    m = node(t, 'ShaderNodeMapping', -1500, -900); m.inputs['Scale'].default_value = (70, 70, 1); L(t, uv, 'UV', m, 'Vector')
    v = node(t, 'ShaderNodeTexVoronoi', -1300, -900, feature='F1'); v.inputs['Randomness'].default_value = 0.0
    L(t, m, 'Vector', v, 'Vector')
    ring = ramp(t, -1050, -900, [(0.22, (0, 0, 0, 1)), (0.33, (1, 1, 1, 1)), (0.44, (0, 0, 0, 1))])
    L(t, v, 'Distance', ring, 'Fac')
    bump = [n for n in t.nodes if n.bl_idname == 'ShaderNodeBump'][0]
    b2 = node(t, 'ShaderNodeBump', 450, -650, Strength=0.6, Distance=0.004)
    L(t, ring, 'Color', b2, 'Height'); L(t, bump, 'Normal', b2, 'Normal'); L(t, b2, 'Normal', b, 'Normal')
    # gaps between rings are dark
    gm = node(t, 'ShaderNodeMix', 350, 250, data_type='RGBA', blend_type='MULTIPLY'); gm.inputs['Factor'].default_value = 0.85
    src = b.inputs['Base Color'].links[0].from_socket
    t.links.new(src, gm.inputs['A']); L(t, ring, 'Color', gm, 'B'); L(t, gm, 'Result', b, 'Base Color')

def cloth(mat, col, hem_dirt=True, sheen=0.4):
    t, b = nt(mat)
    tc = node(t, 'ShaderNodeTexCoord', -1500, 0)
    w1 = node(t, 'ShaderNodeTexWave', -1100, -300, wave_type='BANDS', bands_direction='X', Scale=900.0, Distortion=0.4, Detail=1.0)
    w2 = node(t, 'ShaderNodeTexWave', -1100, -500, wave_type='BANDS', bands_direction='Y', Scale=900.0, Distortion=0.4, Detail=1.0)
    L(t, tc, 'UV', w1, 'Vector'); L(t, tc, 'UV', w2, 'Vector')
    weave = node(t, 'ShaderNodeMath', -850, -400, operation='MULTIPLY'); L(t, w1, 'Fac', weave, 0); L(t, w2, 'Fac', weave, 1)
    bump = node(t, 'ShaderNodeBump', 300, -400, Strength=0.25, Distance=0.002); L(t, weave, 'Value', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')
    n1 = node(t, 'ShaderNodeTexNoise', -1100, 200, Scale=4.0, Detail=10.0, Roughness=0.65); L(t, tc, 'Object', n1, 'Vector')
    stain = ramp(t, -850, 200, [(0.3, (col[0]*0.55, col[1]*0.5, col[2]*0.42, 1)), (0.65, (*col, 1))]); L(t, n1, 'Fac', stain, 'Fac')
    c = stain
    if hem_dirt:   # mud and old blood creeping up from the hem (object-space height)
        sep = node(t, 'ShaderNodeSeparateXYZ', -1100, 500); L(t, tc, 'Object', sep, 'Vector')
        hn = node(t, 'ShaderNodeTexNoise', -1100, 700, Scale=9.0, Detail=6.0); L(t, tc, 'Object', hn, 'Vector')
        hm = node(t, 'ShaderNodeMath', -850, 600, operation='ADD'); L(t, sep, 'Z', hm, 0)
        hs = node(t, 'ShaderNodeMath', -700, 700, operation='MULTIPLY'); hs.inputs[1].default_value = 0.35; L(t, hn, 'Fac', hs, 0); L(t, hs, 'Value', hm, 1)
        hr = node(t, 'ShaderNodeMapRange', -550, 600); hr.inputs['From Min'].default_value = 0.95; hr.inputs['From Max'].default_value = 0.6
        L(t, hm, 'Value', hr, 'Value')
        mix = node(t, 'ShaderNodeMix', -300, 300, data_type='RGBA'); L(t, hr, 'Result', mix, 'Factor')
        L(t, stain, 'Color', mix, 'A'); mix.inputs['B'].default_value = (0.07, 0.045, 0.025, 1)
        c = mix
        L(t, c, 'Result', b, 'Base Color')
    else:
        L(t, c, 'Color', b, 'Base Color')
    b.inputs['Roughness'].default_value = 0.85
    if 'Sheen Weight' in b.inputs:
        b.inputs['Sheen Weight'].default_value = sheen*0.5
        if 'Sheen Tint' in b.inputs: b.inputs['Sheen Tint'].default_value = (*[min(1.0, c*2.2) for c in col], 1)
    return t, b

def leather(mat, col):
    t, b = nt(mat)
    tc = node(t, 'ShaderNodeTexCoord', -1200, 0)
    n = node(t, 'ShaderNodeTexNoise', -900, 0, Scale=60.0, Detail=10.0, Roughness=0.7); L(t, tc, 'Object', n, 'Vector')
    r = ramp(t, -650, 100, [(0.35, (col[0]*0.6, col[1]*0.6, col[2]*0.6, 1)), (0.7, (*col, 1))]); L(t, n, 'Fac', r, 'Fac'); L(t, r, 'Color', b, 'Base Color')
    rr = ramp(t, -650, -150, [(0.3, (0.45, 0.45, 0.45, 1)), (0.7, (0.75, 0.75, 0.75, 1))]); L(t, n, 'Fac', rr, 'Fac'); L(t, rr, 'Color', b, 'Roughness')
    bump = node(t, 'ShaderNodeBump', 300, -300, Strength=0.3, Distance=0.002); L(t, n, 'Fac', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')

def simple(mat, col, metal_=0.0, rough=0.6, emit=None):
    t, b = nt(mat)
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal_; b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit[:3], 1); b.inputs['Emission Strength'].default_value = emit[3]

def stone(mat, col):
    t, b = nt(mat)
    tc = node(t, 'ShaderNodeTexCoord', -1200, 0)
    n = node(t, 'ShaderNodeTexNoise', -900, 100, Scale=3.0, Detail=12.0, Roughness=0.62); L(t, tc, 'Object', n, 'Vector')
    v = node(t, 'ShaderNodeTexVoronoi', -900, -200, Scale=18.0); L(t, tc, 'Object', v, 'Vector')
    r = ramp(t, -650, 100, [(0.3, (col[0]*0.55, col[1]*0.58, col[2]*0.5, 1)), (0.55, (*col, 1)), (0.8, (col[0]*1.25, col[1]*1.2, col[2]*1.1, 1))])
    L(t, n, 'Fac', r, 'Fac'); L(t, r, 'Color', b, 'Base Color'); b.inputs['Roughness'].default_value = 0.9
    h = node(t, 'ShaderNodeMath', -500, -200, operation='ADD'); L(t, n, 'Fac', h, 0); L(t, v, 'Distance', h, 1)
    bump = node(t, 'ShaderNodeBump', 300, -300, Strength=0.5, Distance=0.02); L(t, h, 'Value', bump, 'Height'); L(t, bump, 'Normal', b, 'Normal')

PALETTE = {
    'M_Steel': lambda m: metal(m, (0.62, 0.62, 0.64), 0.28), 'M_SteelDark': lambda m: metal(m, (0.13, 0.13, 0.14), 0.4),
    'M_Chainmail': chainmail, 'M_Gold': lambda m: metal(m, (0.86, 0.6, 0.24), 0.3, scratches=0.2),
    'M_ClothWhite': lambda m: cloth(m, (0.70, 0.66, 0.56)), 'M_ClothRed': lambda m: cloth(m, (0.36, 0.02, 0.015), hem_dirt=True, sheen=0.6),
    'M_Leather': lambda m: leather(m, (0.16, 0.08, 0.035)), 'M_Visor': lambda m: simple(m, (0.005, 0.005, 0.005), 0, 0.6),
    'M_Wood': lambda m: leather(m, (0.22, 0.13, 0.06)), 'M_WoodDead': lambda m: leather(m, (0.12, 0.11, 0.1)),
    'M_Stone': lambda m: stone(m, (0.3, 0.28, 0.25)), 'M_StoneDark': lambda m: stone(m, (0.15, 0.145, 0.14)),
    'M_Iron': lambda m: metal(m, (0.12, 0.1, 0.09), 0.6), 'M_Ember': lambda m: simple(m, (0.2, 0.05, 0.01), 0, 0.6, (1.0, 0.35, 0.06, 25.0)),
}

def upgrade_materials():
    done = []
    for m in bpy.data.materials:
        key = m.name.split('.')[0]
        if key in PALETTE and not m.get('sb_upgraded'):
            if key.startswith('M_Cloth') and '.' in m.name:   # cloth on props (shield heraldry): no hem mud
                cloth(m, (0.36, 0.02, 0.015) if 'Red' in key else (0.7, 0.66, 0.56), hem_dirt=False, sheen=0.3)
            else:
                PALETTE[key](m)
            m['sb_upgraded'] = 1; done.append(m.name)
    return done

# ------------------------------------------------------------------ scene building
def ctx():
    """A full UI context (window/area/region) so operators that rely on context.object work from timers/servers."""
    win = bpy.context.window_manager.windows[0]
    area = next((a for a in win.screen.areas if a.type == 'VIEW_3D'), win.screen.areas[0])
    region = next((r for r in area.regions if r.type == 'WINDOW'), area.regions[0])
    return bpy.context.temp_override(window=win, area=area, region=region, scene=win.scene, view_layer=win.view_layer)

def clean():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for d in list(coll):
            if d.users == 0: coll.remove(d)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)

def imp(name):
    before = set(bpy.data.objects)
    with ctx():
        bpy.ops.import_scene.gltf(filepath=SRC + name + '.gltf')
    return [o for o in bpy.data.objects if o not in before]

def bind_to_bone(objs, arm, bone, world_loc, world_rot):
    """Place objects in world space at the rest pose, then bone-parent them keeping the transform."""
    from mathutils import Euler, Matrix
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for o in objs:
        if o.type != 'MESH': continue
        o.matrix_world = Matrix.Translation(world_loc) @ Euler(world_rot).to_matrix().to_4x4()
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); arm.select_set(True)
        bpy.context.view_layer.objects.active = arm; arm.data.bones.active = arm.data.bones[bone]
        with ctx():
            bpy.ops.object.parent_set(type='BONE', keep_transform=True)
    arm.data.pose_position = 'POSE'
    return objs

def stage():
    sc = bpy.context.scene
    w = bpy.data.worlds.new('W_Dusk'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[1].default_value = 0.35
    try:
        sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.location = (-300, 0)
        for k, v in (('sun_elevation', math.radians(4)), ('sun_rotation', math.radians(200)), ('air_density', 2.0), ('dust_density', 4.0)):
            if hasattr(sky, k): setattr(sky, k, v)
        w.node_tree.links.new(sky.outputs[0], bg.inputs[0])
    except Exception:
        bg.inputs[0].default_value = (0.05, 0.055, 0.07, 1)
    import bmesh
    me = bpy.data.meshes.new('Stage_Ground'); bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=4.0); bm.to_mesh(me); bm.free()
    g = bpy.data.objects.new('Stage_Ground', me); sc.collection.objects.link(g)
    gm = bpy.data.materials.new('M_StageStone'); stone(gm, (0.075, 0.07, 0.062)); g.data.materials.append(gm)
    def area(name, loc, rot, energy, col, size):
        ld = bpy.data.lights.new(name, 'AREA'); l = bpy.data.objects.new(name, ld); l.location = loc; sc.collection.objects.link(l)
        l.rotation_euler = rot; l.data.energy = energy; l.data.color = col; l.data.size = size; return l
    area('Key_Warm', (2.4, -2.6, 3.0), (math.radians(52), 0, math.radians(42)), 900, (1.0, 0.72, 0.5), 1.6)
    area('Rim_Cool', (-2.0, 2.6, 2.6), (math.radians(-55), 0, math.radians(-145)), 1100, (0.55, 0.68, 1.0), 1.0)
    area('Fill', (-3.0, -2.0, 1.2), (math.radians(80), 0, math.radians(-55)), 120, (0.8, 0.85, 1.0), 3.0)
    cam = bpy.data.objects.new('Cam_Hero', bpy.data.cameras.new('Cam_Hero')); cam.location = (2.2, -4.6, 1.25); sc.collection.objects.link(cam)
    cam.data.lens = 50
    tgt = bpy.data.objects.new('CamTarget', None); tgt.location = (0, 0, 0.98); sc.collection.objects.link(tgt)
    c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    sc.camera = cam
    eng = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    sc.render.engine = eng
    sc.render.resolution_x = 1920; sc.render.resolution_y = 1080
    try:
        sc.eevee.use_shadows = True; sc.eevee.use_raytracing = True; sc.eevee.taa_render_samples = 64
    except Exception: pass
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    return cam

def build_hero(pose_action='A_Knight_Idle', frame=12):
    clean()
    objs = imp('SK_HeroKnight')
    arm = [o for o in objs if o.type == 'ARMATURE'][0]; arm.name = 'RIG_HeroKnight'
    body = [o for o in objs if o.type == 'MESH']
    for o in body:
        o.name = 'SK_HeroKnight_Body'
        bpy.context.view_layer.objects.active = o
        try:
            with ctx(): bpy.ops.object.shade_auto_smooth(angle=math.radians(50))
        except Exception: pass
    sword = imp('SM_Wpn_Longsword'); shield = imp('SM_Shield_Heater')
    # glTF importer converts Y-up to Z-up; weapon grip at origin, blade along +Z after import.
    # glTF (x,y,z) -> Blender (x,-z,y). Hand_r head (-0.26,0.93,0.03) gltf; grip sits in the fist.
    bind_to_bone(sword, arm, 'hand_r', (-0.265, -0.045, 0.865), (math.radians(90), 0, 0))
    bind_to_bone(shield, arm, 'lowerarm_l', (0.34, 0.0, 1.10), (0, 0, math.radians(90)))
    for o in sword + shield:
        if o.type == 'MESH': o.name = 'SM_' + ('Sword' if o in sword else 'Shield')
    # choose pose
    act = [a for a in bpy.data.actions if pose_action in a.name]
    if act:
        arm.animation_data_create(); arm.animation_data.action = act[0]
        bpy.context.scene.frame_set(frame)
    mats = upgrade_materials()
    cam = stage()
    os.makedirs(ART, exist_ok=True)
    with ctx(): bpy.ops.wm.save_as_mainfile(filepath=ART + 'HeroKnight_Lookdev.blend')
    return {'mats': mats, 'actions': [a.name for a in bpy.data.actions], 'objects': [o.name for o in bpy.data.objects]}

def render(path):
    bpy.context.scene.render.filepath = path
    with ctx(): bpy.ops.render.render(write_still=True)
    return path

def shot(name, action, frame, cam_loc, lens=50, target=(0, 0, 0.98), pct=60):
    """Pose the rig, frame the camera and render a JPG into SourceArt/Blender/renders."""
    sc = bpy.context.scene; arm = bpy.data.objects['RIG_HeroKnight']
    act = [a for a in bpy.data.actions if action in a.name][0]
    arm.animation_data.action = act; sc.frame_set(frame)
    cam = bpy.data.objects['Cam_Hero']; cam.location = cam_loc; cam.data.lens = lens
    bpy.data.objects['CamTarget'].location = target
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90; sc.render.resolution_percentage = pct
    os.makedirs(ART + 'renders', exist_ok=True)
    return render(ART + 'renders/' + name + '.jpg')
