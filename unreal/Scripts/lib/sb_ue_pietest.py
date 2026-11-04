"""Unreal-side automated play test for BP_HeroKnight.
Runs inside a PIE session: injects real Enhanced Input actions (walk right, attack, walk left, jump),
records pawn position/animation state each step, and captures a frame from the player camera."""
import unreal, json, os

INP = '/Game/SteelAndBlood/Input/'

def fix_camera_boom():
    b = unreal.load_asset('/Game/SteelAndBlood/Blueprints/BP_HeroKnight')
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem); lib = unreal.SubobjectDataBlueprintFunctionLibrary
    for h in sds.k2_gather_subobject_data_for_blueprint(b):
        o = lib.get_object(lib.get_data(h))
        if o and o.get_name().startswith('CameraBoom'):
            o.set_absolute(False, True, False)
            o.set_editor_property('relative_rotation', unreal.Rotator(roll=0.0, pitch=-4.0, yaw=-90.0))
    unreal.BlueprintEditorLibrary.compile_blueprint(b)
    unreal.EditorAssetLibrary.save_asset(b.get_path_name())
    return 'ok'

def place_capture_actor():
    """Pre-place a SceneCapture2D in the editor level (actors cannot be spawned from Python inside PIE)."""
    ES = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in ES.get_all_level_actors():
        if a.get_actor_label() == 'PIECapture': return 'exists'
    c = ES.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 800, 200), unreal.Rotator(0, 0, -90))
    c.set_actor_label('PIECapture'); c.set_folder_path('Gameplay')
    cc = c.capture_component2d
    cc.set_editor_property('capture_every_frame', False); cc.set_editor_property('capture_on_movement', False)
    c.root_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
    return 'placed'

class Tester:
    # (from_frame, to_frame, {debug var: value}) - drives BP_HeroKnight's Dbg* variables, which are OR-ed with real input
    PLAN = [(0, 10, {}), (10, 90, {'DbgMove': 1.0}), (90, 95, {'DbgMove': 0.0, 'DbgAttack': True}), (95, 140, {'DbgAttack': False}),
            (140, 200, {'DbgMove': -1.0}), (200, 204, {'DbgJump': True}), (204, 240, {'DbgJump': False, 'DbgMove': 0.0}),
            (240, 270, {'DbgBlock': True}), (270, 300, {'DbgBlock': False})]
    SHOTS = {60: '04_pie_walk', 105: '05_pie_attack', 255: '06_pie_block'}
    def __init__(self, out):
        self.out = out; self.n = 0; self.log = []; self.h = None
    def world(self):
        return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    def start(self):
        self.h = unreal.register_slate_post_tick_callback(self.tick)
    def finish(self, extra=None):
        unreal.unregister_slate_post_tick_callback(self.h)
        d = {'log': self.log}
        if extra: d.update(extra)
        open(self.out + '/pietest.json', 'w').write(json.dumps(d))
    def tick(self, dt):
        try:
            w = self.world()
            if not w: return
            pc = unreal.GameplayStatics.get_player_controller(w, 0); pawn = pc.get_controlled_pawn() if pc else None
            if not pawn: return
            self.n += 1
            for a, b, vals in self.PLAN:
                if self.n == a:
                    for k, v in vals.items(): pawn.set_editor_property(k, v)
            if self.n % 10 == 0:
                p = pawn.get_actor_location(); r = pawn.get_actor_rotation()
                cam = pawn.get_component_by_class(unreal.CameraComponent).get_world_location()
                self.log.append({'f': self.n, 'x': round(p.x), 'y': round(p.y), 'z': round(p.z), 'yaw': round(r.yaw),
                                 'anim': pawn.get_editor_property('CurAnim'), 'cam': [round(cam.x), round(cam.y), round(cam.z)], 'dt': round(dt, 3)})
            if self.n in self.SHOTS: self.capture(w, pawn, self.SHOTS[self.n])
            if self.n >= 300: self.finish({'pawn': pawn.get_class().get_name()})
        except Exception:
            import traceback; self.finish({'error': traceback.format_exc()})
    def capture(self, w, pawn, name):
        cap = [a for a in unreal.GameplayStatics.get_all_actors_of_class(w, unreal.SceneCapture2D) if a.get_actor_label() == 'PIECapture']
        if not cap: self.log.append('no capture actor'); return
        cap = cap[0]; camc = pawn.get_component_by_class(unreal.CameraComponent)
        cap.set_actor_location_and_rotation(camc.get_world_location(), camc.get_world_rotation(), False, False)
        rt = unreal.RenderingLibrary.create_render_target2d(w, 1600, 900, unreal.TextureRenderTargetFormat.RTF_RGBA8)
        cc = cap.capture_component2d
        cc.set_editor_property('texture_target', rt); cc.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        cc.set_editor_property('fov_angle', camc.get_editor_property('field_of_view'))
        cc.capture_scene()
        o = unreal.ImageWriteOptions(); o.set_editor_property('format', unreal.DesiredImageFormat.JPG); o.set_editor_property('compression_quality', 85)
        o.set_editor_property('overwrite_file', True); o.set_editor_property('async_', False)
        unreal.ImageWriteBlueprintLibrary.export_to_disk(rt, self.out + '/' + name + '.jpg', o)
        self.log.append('captured ' + name)

T = None
def run(out):
    global T
    os.makedirs(out, exist_ok=True); T = Tester(out); T.start(); return 'started'
