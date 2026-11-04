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

class Tester:
    PLAN = [(0, 5, None, None), (5, 70, 'IA_Move', 1.0), (70, 75, None, None), (75, 77, 'IA_Attack', True), (77, 110, None, None),
            (110, 150, 'IA_MoveLeft', True), (150, 152, 'IA_Jump', True), (152, 185, None, None)]
    def __init__(self, out):
        self.out = out; self.n = 0; self.log = []; self.h = None; self.rt = None; self.cap = None
    def world(self):
        return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    def sub(self, pc):
        return unreal.SubsystemBlueprintLibrary.get_local_player_subsystem(pc, unreal.EnhancedInputLocalPlayerSubsystem)
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
            self.n += 1
            pc = unreal.GameplayStatics.get_player_controller(w, 0); pawn = pc.get_controlled_pawn() if pc else None
            if not pawn:
                if self.n > 300: self.finish({'error': 'no pawn'})
                return
            for a, b, act, val in self.PLAN:
                if a <= self.n < b and act:
                    ia = unreal.load_asset(INP + act)
                    try:
                        self.sub(pc).inject_input_for_action(ia, self._val(val), [], [])
                    except Exception as e:
                        self.log.append('inject ' + str(e)[:120])
            if self.n % 15 == 0 or self.n in (76, 90):
                p = pawn.get_actor_location(); r = pawn.get_actor_rotation()
                try: cur = pawn.get_editor_property('CurAnim')
                except Exception: cur = '?'
                cm = pc.player_camera_manager
                self.log.append({'f': self.n, 'x': round(p.x), 'y': round(p.y), 'z': round(p.z), 'yaw': round(r.yaw), 'anim': cur,
                                 'cam': [round(cm.get_camera_location().x), round(cm.get_camera_location().y), round(cm.get_camera_location().z)]})
            if self.n == 90: self.capture(w, pc)
            if self.n >= 185: self.finish({'pawn': pawn.get_class().get_name()})
        except Exception:
            import traceback; self.finish({'error': traceback.format_exc()})
    def _val(self, v):
        x = unreal.InputActionValue()
        try:
            return unreal.EnhancedInputLibrary.make_input_action_value_of_type(float(v) if not isinstance(v, bool) else (1.0 if v else 0.0), 0.0, 0.0, unreal.InputActionValueType.AXIS1D if not isinstance(v, bool) else unreal.InputActionValueType.BOOLEAN)
        except Exception:
            return x
    def capture(self, w, pc):
        cm = pc.player_camera_manager
        self.rt = unreal.RenderingLibrary.create_render_target2d(w, 1920, 1080, unreal.TextureRenderTargetFormat.RTF_RGBA8)
        cap = w.spawn_actor(unreal.SceneCapture2D, cm.get_camera_location(), cm.get_camera_rotation()) if hasattr(w, 'spawn_actor') else \
            unreal.GameplayStatics.begin_deferred_actor_spawn_from_class(w, unreal.SceneCapture2D, unreal.Transform(cm.get_camera_location(), cm.get_camera_rotation()))
        if not hasattr(w, 'spawn_actor'):
            cap = unreal.GameplayStatics.finish_spawning_actor(cap, unreal.Transform(cm.get_camera_location(), cm.get_camera_rotation()))
        cc = cap.capture_component2d
        cc.set_editor_property('texture_target', self.rt); cc.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        cc.set_editor_property('fov_angle', cm.get_fov_angle())
        cc.capture_scene()
        o = unreal.ImageWriteOptions(); o.set_editor_property('format', unreal.DesiredImageFormat.JPG); o.set_editor_property('compression_quality', 88)
        o.set_editor_property('overwrite_file', True); o.set_editor_property('async_', False)
        unreal.ImageWriteBlueprintLibrary.export_to_disk(self.rt, self.out + '/04_pie_gameplay.jpg', o)
        self.log.append('captured')

T = None
def run(out):
    global T
    os.makedirs(out, exist_ok=True); T = Tester(out); T.start(); return 'started'
