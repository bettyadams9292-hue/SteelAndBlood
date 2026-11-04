"""Unreal-side: renders review screenshots from named CineCameraActors via SceneCapture2D and writes JPGs
(plus base64 .txt chunks so remote tooling that can only read text files can retrieve them).
Tick-driven so Lumen / volumetric fog / auto-exposure have frames to settle before the capture."""
import unreal, math, base64, os, json

ES = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
UES = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)

def find(label):
    for a in ES.get_all_level_actors():
        if a.get_actor_label() == label: return a
    return None

class Shooter:
    def __init__(self, shots, out_dir, w=1920, h=1080, warm=90, status=None):
        self.shots = list(shots); self.out = out_dir; self.w = w; self.h = h; self.warm = warm
        self.status = status or (out_dir + '/shots_status.json'); self.done = []; self.i = 0; self.tick = 0
        self.cap = None; self.rt = None; self.h_cb = None; self.phase = 'setup'
        os.makedirs(out_dir, exist_ok=True)

    def _write(self, extra=None):
        d = {'done': self.done, 'phase': self.phase, 'index': self.i}
        if extra: d.update(extra)
        open(self.status, 'w').write(json.dumps(d))

    def start(self):
        self._write(); self.h_cb = unreal.register_slate_post_tick_callback(self._on_tick)

    def _setup(self, label):
        cam = find(label)
        world = UES.get_editor_world()
        self.rt = unreal.RenderingLibrary.create_render_target2d(world, self.w, self.h, unreal.TextureRenderTargetFormat.RTF_RGBA8)
        self.cap = ES.spawn_actor_from_class(unreal.SceneCapture2D, cam.get_actor_location(), cam.get_actor_rotation())
        cc = self.cap.capture_component2d
        cc.set_editor_property('texture_target', self.rt)
        cc.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        fl = cam.get_cine_camera_component().get_editor_property('current_focal_length')
        cc.set_editor_property('fov_angle', math.degrees(2*math.atan(36.0/(2*fl))))
        cc.set_editor_property('capture_every_frame', True)
        cc.set_editor_property('always_persist_rendering_state', True)

    def _export(self, name):
        path = self.out + '/' + name + '.jpg'
        opts = unreal.ImageWriteOptions()
        opts.set_editor_property('format', unreal.DesiredImageFormat.JPG)
        opts.set_editor_property('compression_quality', 88)
        opts.set_editor_property('overwrite_file', True)
        opts.set_editor_property('async_', False)
        unreal.ImageWriteBlueprintLibrary.export_to_disk(self.rt, path, opts)
        return path

    def _chunk(self, path):
        if not os.path.exists(path): return 0
        b = base64.b64encode(open(path, 'rb').read()).decode()
        n = 0; size = 600000
        for k in range(0, len(b), size):
            open('%s.b64.%02d.txt' % (path, n), 'w').write(b[k:k+size]); n += 1
        return n

    def _on_tick(self, dt):
        try:
            if self.i >= len(self.shots):
                self.phase = 'finished'; self._write(); unreal.unregister_slate_post_tick_callback(self.h_cb); return
            label, name = self.shots[self.i]
            if self.tick == 0:
                self.phase = 'warming ' + name; self._setup(label)
            self.tick += 1
            if self.tick == self.warm:
                self.cap.capture_component2d.capture_scene()
                path = self._export(name)
                self.pending = path
            if self.tick == self.warm + 10:
                n = self._chunk(self.pending)
                self.done.append({'name': name, 'path': self.pending, 'chunks': n, 'bytes': os.path.getsize(self.pending) if os.path.exists(self.pending) else 0})
                ES.destroy_actor(self.cap); self.cap = None
                self.i += 1; self.tick = 0; self._write()
        except Exception as e:
            import traceback
            self.phase = 'error'; self._write({'error': traceback.format_exc()})
            unreal.unregister_slate_post_tick_callback(self.h_cb)
            if self.cap: ES.destroy_actor(self.cap)

SHOOTER = None
def run(shots, out_dir, **kw):
    global SHOOTER
    SHOOTER = Shooter(shots, out_dir, **kw); SHOOTER.start()
    return 'started'
