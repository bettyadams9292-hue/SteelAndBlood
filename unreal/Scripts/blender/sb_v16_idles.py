"""Extra looping idles so members of the order read as individuals (same E()/key_pose conventions as sb_v14:
the knight faces -Y; negative x-rotation swings a limb forward/up). Rifle is held in hand_l, sword in hand_r."""
import bpy, math
import sb_v14 as K

E, full, FPS, D = K.E, K.full, K.FPS, bpy.data

def _breath(t, L):
    ph = 2 * math.pi * t / L; return math.sin(ph), math.sin(ph * 0.5)

def a_ready(t, L):
    """rifle at low ready: carried at the chest, muzzle angled down-forward (hand counter-rotates the forearm lift), sword arm relaxed"""
    b, s = _breath(t, L)
    p = {'upperarm_l': E(x=-22 + 1.5 * b, z=-6), 'lowerarm_l': E(x=-48), 'hand_l': E(x=78),
         'upperarm_r': E(x=-4 + b, z=4), 'lowerarm_r': E(x=-14),
         'spine_01': E(x=4 + 1.0 * b), 'spine_02': E(x=3 - 1.2 * b, z=6 * s), 'head': E(x=-2, z=-14 * s),
         'thigh_l': E(x=-10, y=-3), 'calf_l': E(x=-12), 'thigh_r': E(x=8, y=3), 'calf_r': E(x=-10), 'foot_l': E(x=6), 'foot_r': E(x=4)}
    return full(p), {'pelvis': (0, 0.01, -0.035 - 0.004 * (1 + b))}

def a_guard(t, L):
    """sword raised forward in guard (blade ~45 deg up), rifle hanging in the off hand, fencing stance"""
    b, s = _breath(t, L)
    p = {'upperarm_r': E(x=-34 + 2 * b), 'lowerarm_r': E(x=-46), 'hand_r': E(x=28),
         'upperarm_l': E(x=-6 + b, z=-4), 'lowerarm_l': E(x=-12),
         'spine_01': E(x=3 + b, z=-10), 'spine_02': E(x=2 - b, z=-8), 'head': E(x=-4, z=12),
         'thigh_l': E(x=-22, y=-6), 'calf_l': E(x=-24), 'foot_l': E(x=10), 'thigh_r': E(x=18, y=8), 'calf_r': E(x=-14), 'foot_r': E(x=-2)}
    return full(p), {'pelvis': (0, 0.015, -0.07 - 0.004 * (1 + b))}

def a_atease(t, L):
    """at ease: weight on the right leg, hip out, rifle hand resting, head turning slowly"""
    b, s = _breath(t, L)
    p = {'pelvis': E(y=5, z=4), 'spine_01': E(y=-4 + 0.6 * b, x=1.2 * b), 'spine_02': E(y=-3, x=-1.2 * b, z=-5), 'head': E(y=3, z=20 * s, x=3),
         'thigh_r': E(y=-4, x=1), 'calf_r': E(x=-1), 'thigh_l': E(x=-8, y=6, z=-12), 'calf_l': E(x=-16), 'foot_l': E(x=6, z=-10),
         'upperarm_r': E(x=-4 + b, z=6), 'lowerarm_r': E(x=-12), 'upperarm_l': E(x=-8 - b, z=-4), 'lowerarm_l': E(x=-20)}
    return full(p), {'pelvis': (0.025, 0, -0.012)}

def a_vigil(t, L):
    """kneeling vigil: right knee down, head bowed, sword hand resting on the raised knee"""
    b, s = _breath(t, L)
    p = {'thigh_l': E(x=-80), 'calf_l': E(x=84), 'foot_l': E(x=-2),
         'thigh_r': E(x=4, y=4), 'calf_r': E(x=96), 'foot_r': E(x=-40), 'ball_r': E(x=35),
         'spine_01': E(x=6 + 1.5 * b), 'spine_02': E(x=10 - 1.5 * b), 'neck_01': E(x=12), 'head': E(x=22 + 2 * b),
         'upperarm_r': E(x=-30, z=8), 'lowerarm_r': E(x=-40, z=20), 'hand_r': E(y=25),
         'upperarm_l': E(x=-20 + b, z=-10), 'lowerarm_l': E(x=-35)}
    return full(p), {'pelvis': (0, 0.06, -0.45 - 0.004 * (1 + b))}

IDLES = {'A_Knight_Idle_Ready': (a_ready, 3.0), 'A_Knight_Idle_Guard': (a_guard, 2.6), 'A_Knight_Idle_AtEase': (a_atease, 4.0), 'A_Knight_Idle_Vigil': (a_vigil, 3.6)}

def build(rig=None):
    rig = rig or D.objects['RIG_Knight']; rig.animation_data_create(); prev = rig.animation_data.action; made = []
    for name, (fn, L) in IDLES.items():
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

def preview(name, frame=10):
    rig = D.objects['RIG_Knight']; rig.animation_data.action = D.actions[name]; bpy.context.scene.frame_set(frame)
