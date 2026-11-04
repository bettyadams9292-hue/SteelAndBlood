"""Unreal-side: builds L_RuinedCastle_Showcase - a side-on 2.5D gameplay slice of the Ruined Castle biome.
Play axis = world X (screen right = +X). Camera sits at +Y looking toward -Y; background is at negative Y."""
import unreal, math, random

ES = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
LES = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
EAL = unreal.EditorAssetLibrary
ENV = '/Game/SteelAndBlood/Environments/RuinedCastle/'
WPN = '/Game/SteelAndBlood/Weapons/'
KN = '/Game/SteelAndBlood/Characters/Player/HeroKnight/SK_HeroKnight/SkeletalMeshes/'
LEVEL = '/Game/SteelAndBlood/Levels/L_RuinedCastle_Showcase'

WARN = []
def sp(o, k, v):
    try: o.set_editor_property(k, v)
    except Exception as e: WARN.append('%s.%s: %s' % (o.get_class().get_name(), k, str(e)[:80]))

def sm(name, root=ENV): return unreal.load_asset(root + name + '/StaticMeshes/' + name)

def put(asset, loc, yaw=0.0, scale=1.0, label=None, folder=None, pitch=0.0, roll=0.0):
    a = ES.spawn_actor_from_object(asset, unreal.Vector(*loc), unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw))
    s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    a.set_actor_scale3d(unreal.Vector(*s))
    if label: a.set_actor_label(label)
    if folder: a.set_folder_path(folder)
    return a

def spawn(cls, loc, rot=(0, 0, 0), label=None, folder=None):
    a = ES.spawn_actor_from_class(cls, unreal.Vector(*loc), unreal.Rotator(roll=rot[2], pitch=rot[0], yaw=rot[1]))
    if label: a.set_actor_label(label)
    if folder: a.set_folder_path(folder)
    return a

def ensure_weapon_socket():
    sk = unreal.load_asset(KN + 'SK_HeroKnight')
    if sk.find_socket('weapon_r'): return sk
    sock = unreal.SkeletalMeshSocket(sk)
    sock.set_editor_property('socket_name', 'weapon_r'); sock.set_editor_property('bone_name', 'hand_r')
    sock.set_editor_property('relative_location', unreal.Vector(-0.5, 1.5, -6.5))
    sock.set_editor_property('relative_rotation', unreal.Rotator(roll=-90.0, pitch=0.0, yaw=0.0))
    sk.add_socket(sock, False)
    EAL.save_asset(sk.get_path_name())
    return sk

def knight(loc, yaw=-90.0, anim='A_Knight_Idle', t=0.0, weapon='SM_Wpn_Longsword', label='HeroKnight'):
    sk = unreal.load_asset(KN + 'SK_HeroKnight')
    a = spawn(unreal.SkeletalMeshActor, loc, (0, yaw, 0), label, 'Characters')
    c = a.skeletal_mesh_component
    c.set_skeletal_mesh_asset(sk)
    seq = unreal.load_asset(KN + 'SK_HeroKnight' + anim)
    c.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    c.override_animation_data(seq, True, True, t, 1.0)
    c.set_update_animation_in_editor(True)
    c.set_position(t, False)
    if weapon:
        w = ES.spawn_actor_from_object(sm(weapon, WPN), unreal.Vector(*loc))
        w.set_actor_label(label + '_' + weapon); w.set_folder_path('Characters')
        sock = 'weapon_r' if sk.find_socket('weapon_r') else 'hand_r'
        w.attach_to_component(c, sock, unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.KEEP_RELATIVE, False)
        if sock == 'hand_r':
            w.set_actor_relative_location(unreal.Vector(-0.5, 1.5, -6.5), False, False)
            w.set_actor_relative_rotation(unreal.Rotator(roll=-90.0, pitch=0.0, yaw=0.0), False, False)
    return a

def lighting():
    sun = spawn(unreal.DirectionalLight, (0, 2600, 900), (-7.0, 150.0, 0), 'Sun_Dusk', 'Lighting')
    lc = sun.light_component
    lc.set_intensity(9.0); lc.set_light_color(unreal.LinearColor(1.0, 0.62, 0.42, 1))
    sp(lc, 'atmosphere_sun_light', True); sp(lc, 'cast_shadows', True)
    sp(lc, 'light_source_angle', 1.2); sp(lc, 'forward_shading_priority', 1)
    moon = spawn(unreal.DirectionalLight, (200, 2600, 900), (-38.0, -60.0, 0), 'Moon_Rim', 'Lighting')
    ml = moon.light_component
    ml.set_intensity(1.6); ml.set_light_color(unreal.LinearColor(0.55, 0.65, 1.0, 1))
    sp(ml, 'atmosphere_sun_light', False); sp(ml, 'atmosphere_sun_light_index', 1)
    sp(ml, 'forward_shading_priority', 0)
    spawn(unreal.SkyAtmosphere, (400, 2600, 0), label='SkyAtmosphere', folder='Lighting')
    sky = spawn(unreal.SkyLight, (600, 2600, 900), label='SkyLight', folder='Lighting')
    sc = sky.light_component; sp(sc, 'real_time_capture', True); sc.set_intensity(1.2)
    sc.set_light_color(unreal.LinearColor(0.75, 0.8, 1.0, 1))
    fog = spawn(unreal.ExponentialHeightFog, (800, 2600, -50), label='HeightFog', folder='Lighting')
    fc = fog.component
    sp(fc, 'fog_density', 0.035); sp(fc, 'fog_height_falloff', 0.35)
    sp(fc, 'fog_inscattering_luminance', unreal.LinearColor(0.32, 0.30, 0.34, 1))
    sp(fc, 'enable_volumetric_fog', True)
    sp(fc, 'volumetric_fog_scattering_distribution', 0.55)
    sp(fc, 'volumetric_fog_extinction_scale', 1.6)
    sp(fc, 'start_distance', 300.0)
    try:
        spawn(unreal.VolumetricCloud, (1000, 2600, 0), label='Clouds', folder='Lighting')
    except Exception:
        pass
    ppv = spawn(unreal.PostProcessVolume, (1200, 2600, 0), label='PostProcess_Grade', folder='Lighting')
    sp(ppv, 'unbound', True)
    s = ppv.get_editor_property('settings')
    def ov(k, v):
        sp(s, 'override_' + k, True); sp(s, k, v)
    ov('bloom_intensity', 0.55); ov('vignette_intensity', 0.5); ov('film_grain_intensity', 0.12)
    ov('auto_exposure_bias', 0.4); ov('auto_exposure_min_brightness', 0.3); ov('auto_exposure_max_brightness', 2.5)
    ov('color_saturation', unreal.Vector4(0.88, 0.86, 0.86, 1.0)); ov('color_contrast', unreal.Vector4(1.12, 1.12, 1.12, 1.0))
    ov('color_gain_shadows', unreal.Vector4(0.92, 0.95, 1.08, 1.0))
    ov('ambient_occlusion_intensity', 0.7)
    sp(ppv, 'settings', s)

def fire_light(loc, label):
    p = spawn(unreal.PointLight, loc, label=label, folder='Lighting')
    c = p.light_component
    c.set_intensity(55.0); c.set_light_color(unreal.LinearColor(1.0, 0.45, 0.15, 1))
    sp(c, 'attenuation_radius', 1100.0); sp(c, 'source_radius', 18.0)
    sp(c, 'cast_shadows', True)
    return p

def dress():
    r = random.Random(7)
    g = sm('SM_Env_Ground')
    for ix in range(-5, 6):
        for iy in range(-4, 2):
            put(g, (ix*790, iy*790 + 200, 0), yaw=r.choice((0, 90, 180, 270)), folder='Environment/Ground')
    # background curtain wall, gate and towers
    B = -2300.0
    seq = [('SM_Env_CastleWall', -3650, 1.8), ('SM_Env_CastleWall', -2930, 1.8), ('SM_Env_GateArch', -2160, 1.8), ('SM_Env_CastleWall_Ruined', -1420, 1.8),
           ('SM_Env_CastleWall_Ruined', -700, 1.8), ('SM_Env_Tower_Ruined', 0, 1.6), ('SM_Env_CastleWall', 720, 1.8),
           ('SM_Env_CastleWall_Ruined', 1440, 1.8), ('SM_Env_Tower_Ruined', 2250, 1.3), ('SM_Env_CastleWall_Ruined', 2950, 1.8), ('SM_Env_CastleWall', 3670, 1.8)]
    for name, x, s in seq:
        put(sm(name), (x, B - (150 if 'Tower' in name else 0), -10), yaw=(r.uniform(-30, 30) if 'Tower' in name else 0), scale=s, label=name, folder='Environment/Castle')
    # second, deeper silhouette layer for parallax depth
    for x in (-3000, -1000, 1200, 3200):
        put(sm('SM_Env_Tower_Ruined'), (x, -4200, -20), yaw=r.uniform(0, 360), scale=2.0, folder='Environment/Castle_Far')
    # graveyard midground
    tombs = ['SM_Env_Tomb_A', 'SM_Env_Tomb_B', 'SM_Env_Tomb_C']
    for k in range(16):
        x = r.uniform(-1700, 1700); y = r.uniform(-1350, -380)
        if abs(x) < 260 and y > -600: continue
        put(sm(r.choice(tombs)), (x, y, -4), yaw=r.uniform(-25, 25), scale=r.uniform(0.95, 1.25), folder='Environment/Graveyard')
    put(sm('SM_Env_DeadTree_A'), (-1550, -750, -10), yaw=30, scale=1.35, folder='Environment/Trees')
    put(sm('SM_Env_DeadTree_B'), (1350, -1050, -10), yaw=200, scale=1.5, folder='Environment/Trees')
    put(sm('SM_Env_DeadTree_A'), (2600, -1500, -10), yaw=95, scale=1.7, folder='Environment/Trees')
    put(sm('SM_Env_DeadTree_B'), (-2700, -1300, -10), yaw=10, scale=1.6, folder='Environment/Trees')
    for k in range(12):
        put(sm(r.choice(['SM_Env_Rock_A', 'SM_Env_Rock_B'])), (r.uniform(-3200, 3200), r.uniform(-1900, -250), -15), yaw=r.uniform(0, 360), scale=r.uniform(0.5, 1.2), folder='Environment/Rocks')
    put(sm('SM_Env_Banner'), (-520, -260, 0), yaw=8, folder='Environment/Props')
    put(sm('SM_Env_Banner'), (760, -420, 0), yaw=-12, scale=1.1, folder='Environment/Props')
    put(sm('SM_Env_Barricade'), (1150, -120, 0), yaw=-5, folder='Environment/Props')
    put(sm('SM_Env_Barricade'), (-1250, -200, 0), yaw=170, scale=0.9, folder='Environment/Props')
    for i, (x, y) in enumerate(((-360, -150), (430, -170))):
        put(sm('SM_Env_Brazier'), (x, y, 0), folder='Environment/Props', label='Brazier_%d' % i)
        fire_light((x, y, 135), 'BrazierLight_%d' % i)
    # foreground framing (low, at screen edges only)
    put(sm('SM_Env_Rock_B'), (-1050, 420, -25), yaw=40, scale=0.9, folder='Environment/Foreground')
    put(sm('SM_Env_Rock_A'), (1120, 380, -20), yaw=140, scale=0.8, folder='Environment/Foreground')
    # battlefield litter: a halberd stuck in the earth, a fallen shield
    put(sm('SM_Wpn_Halberd', WPN), (-230, -90, -40), pitch=0, roll=12, yaw=20, scale=1.0, folder='Environment/Props')
    put(sm('SM_Shield_Heater', WPN), (240, -60, 28), yaw=35, pitch=0, roll=-70, folder='Environment/Props')

def camera(x=0.0, y=760.0, z=165.0, fl=30.0, label='GameplayCamera_2_5D'):
    cam = spawn(unreal.CineCameraActor, (x, y, z), (-3.0, -90.0, 0), label, 'Cameras')
    cc = cam.get_cine_camera_component()
    cc.set_editor_property('current_focal_length', fl)
    fs = cc.get_editor_property('focus_settings'); fs.set_editor_property('focus_method', unreal.CameraFocusMethod.DISABLE)
    cc.set_editor_property('focus_settings', fs)
    return cam

def build():
    if EAL.does_asset_exist(LEVEL):
        LES.load_level(LEVEL)
        for a in ES.get_all_level_actors():
            ES.destroy_actor(a)
    else:
        LES.new_level(LEVEL)
    lighting(); dress()
    k = knight((0, 0, 0), -90.0, 'A_Knight_Attack_Overhead', 0.30)
    cam = camera()
    detail = camera(60, 330, 105, 30.0, 'DetailCamera_Knight')
    LES.save_current_level()
    return {'actors': len(ES.get_all_level_actors()), 'camera': cam.get_actor_label(), 'warn': WARN}

def lineup():
    """Second shot: knight animation poses side by side for review."""
    poses = [('A_Knight_Idle', 0.6), ('A_Knight_Walk', 0.3), ('A_Knight_Attack_Overhead', 0.3), ('A_Knight_Attack_Overhead', 0.48), ('A_Knight_Block', 0.3), ('A_Knight_HitReact', 0.1)]
    out = []
    for i, (an, t) in enumerate(poses):
        out.append(knight((-2400 - i*170, 150, 0), -90.0, an, t, label='Pose_%d' % i).get_actor_label())
    camera(-2825, 820, 110, 35.0, 'LineupCamera')
    LES.save_current_level()
    return out
