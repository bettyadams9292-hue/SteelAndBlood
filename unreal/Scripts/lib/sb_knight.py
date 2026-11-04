"""Hero Knight: crusader in mail with plate reinforcements, surcoat, great helm and cape.
Rigged to a UE-style humanoid skeleton with idle / walk / attack / block / hit / death clips."""
import math
from sbkit import *

MATS = {
    'M_Steel':      (0.62, 0.63, 0.65, 1.0, 0.30),
    'M_SteelDark':  (0.20, 0.20, 0.22, 1.0, 0.42),
    'M_Chainmail':  (0.42, 0.42, 0.44, 1.0, 0.55),
    'M_Leather':    (0.24, 0.14, 0.08, 0.0, 0.70),
    'M_ClothWhite': (0.74, 0.71, 0.63, 0.0, 0.90),
    'M_ClothRed':   (0.45, 0.04, 0.035, 0.0, 0.85),
    'M_Gold':       (0.83, 0.62, 0.28, 1.0, 0.32),
    'M_Visor':      (0.015, 0.015, 0.015, 0.0, 0.6),
}

def skeleton():
    s = Skeleton()
    s.add('root', None, (0, 0, 0))
    s.add('pelvis', 'root', (0, 1.00, 0))
    s.add('spine_01', 'pelvis', (0, 1.12, 0))
    s.add('spine_02', 'spine_01', (0, 1.30, 0))
    s.add('neck_01', 'spine_02', (0, 1.52, 0))
    s.add('head', 'neck_01', (0, 1.62, 0.01))
    for sd, x in (('l', 1), ('r', -1)):
        s.add('clavicle_'+sd, 'spine_02', (0.05*x, 1.47, 0))
        s.add('upperarm_'+sd, 'clavicle_'+sd, (0.20*x, 1.44, 0))
        s.add('lowerarm_'+sd, 'upperarm_'+sd, (0.24*x, 1.16, 0.0))
        s.add('hand_'+sd, 'lowerarm_'+sd, (0.26*x, 0.93, 0.03))
    for sd, x in (('l', 1), ('r', -1)):
        s.add('thigh_'+sd, 'pelvis', (0.10*x, 0.96, 0))
        s.add('calf_'+sd, 'thigh_'+sd, (0.11*x, 0.53, 0.01))
        s.add('foot_'+sd, 'calf_'+sd, (0.11*x, 0.10, 0.0))
        s.add('ball_'+sd, 'foot_'+sd, (0.11*x, 0.025, 0.13))
    return s

def sm(e0, e1, x):
    t = max(0.0, min(1.0, (x-e0)/(e1-e0))); return t*t*(3-2*t)

def torso_w(p):
    y = p[1]
    if y < 1.06: return [('pelvis', 1.0)]
    if y < 1.21: t = sm(1.06, 1.21, y); return [('pelvis', 1-t), ('spine_01', t)]
    if y < 1.36: t = sm(1.21, 1.36, y); return [('spine_01', 1-t), ('spine_02', t)]
    return [('spine_02', 1.0)]

def skirt_w(p):
    """Surcoat skirt: follows the thighs below the hip, torso above."""
    x, y, z = p
    if y > 0.95: return torso_w(p)
    leg = sm(0.95, 0.62, y)
    side = sm(-0.05, 0.08, x)  # 0 = right leg, 1 = left leg
    centre = 1 - abs(side-0.5)*2  # slit areas share both legs
    wl = leg*side*(1-0.5*centre); wr = leg*(1-side)*(1-0.5*centre)
    return [('pelvis', 1-leg+leg*0.5*centre*0.6), ('thigh_l', wl), ('thigh_r', wr)]

def cape_w(p):
    y = p[1]; t = sm(1.45, 0.75, y)
    return [('spine_02', 1-t), ('spine_01', t*0.4), ('pelvis', t*0.6)]

def build():
    S = skeleton(); m = Mesh(S.names)
    H = {n: S.head[i] for i, n in enumerate(S.names)}
    # --- torso: hauberk (mail) and surcoat over it
    lathe(m, 'M_Chainmail', (0, 0.90, 0), (0, 1.55, 0),
          [(0, 0.165), (0.12, 0.158), (0.28, 0.150), (0.5, 0.172), (0.7, 0.188), (0.86, 0.17), (0.95, 0.12), (1.0, 0.075)],
          torso_w, seg=24, ex=1.12, ez=0.72, caps=(False, True))
    surcoat = [(0, 0.20), (0.14, 0.195), (0.30, 0.182), (0.45, 0.17), (0.52, 0.176), (0.66, 0.192), (0.82, 0.198), (0.94, 0.178), (1.0, 0.13)]
    lathe(m, 'M_ClothWhite', (0, 0.48, 0), (0, 1.47, 0), surcoat, skirt_w, seg=28, ex=1.14, ez=0.78,
          caps=(False, False), squash=lambda t, a: 1.0 + (0.05*math.cos(2*a)*(1-t)))
    # red crusader cross, front and back
    for zs in (1, -1):
        zf = 0.198*0.78*zs + 0.010*zs
        slab(m, 'M_ClothRed', (0, 1.20, zf), (0.06, 0.40, 0.012), torso_w, bevel=0.1)
        slab(m, 'M_ClothRed', (0, 1.27, zf), (0.25, 0.06, 0.012), torso_w, bevel=0.1)
    # belt + buckle + scabbard
    lathe(m, 'M_Leather', (0, 0.955, 0), (0, 1.0, 0), [(0, 0.205), (1, 0.205)], 'pelvis', seg=28, ex=1.15, ez=0.80, caps=(False, False))
    slab(m, 'M_Gold', (0, 0.977, 0.168), (0.06, 0.05, 0.014), 'pelvis')
    lathe(m, 'M_Leather', (0.23, 0.98, 0.04), (0.30, 0.18, -0.05), [(0, 0.028), (0.95, 0.024), (1.0, 0.012)], 'pelvis', seg=10, ex=1.0, ez=0.45)
    lathe(m, 'M_Gold', (0.232, 0.995, 0.043), (0.23, 0.95, 0.04), [(0, 0.032), (1, 0.032)], 'pelvis', seg=10, ex=1.0, ez=0.5)
    # --- head: mail coif / aventail + great helm with gold cross and eye slit
    lathe(m, 'M_Chainmail', (0, 1.42, 0), (0, 1.62, 0), [(0, 0.17), (0.35, 0.12), (0.7, 0.09), (1.0, 0.085)],
          lambda p: [('spine_02', sm(1.56, 1.44, p[1])), ('neck_01', 1-sm(1.56, 1.44, p[1]))], seg=20, ex=1.15, ez=0.9, caps=(False, False))
    helm = [(0, 0.118), (0.08, 0.124), (0.5, 0.122), (0.85, 0.116), (0.95, 0.105), (1.0, 0.0)]
    lathe(m, 'M_Steel', (0, 1.535, 0.01), (0, 1.86, 0.01), helm, 'head', seg=28, ex=0.94, ez=1.06,
          squash=lambda t, a: 1.0 + 0.06*max(0.0, math.sin(a))*(0.5 - abs(t-0.45)))  # slight prow at the face
    hz = 0.124*1.06 + 0.012
    slab(m, 'M_Visor', (0, 1.715, hz-0.004), (0.20, 0.018, 0.02), 'head', bevel=0.3)
    slab(m, 'M_Gold', (0, 1.66, hz+0.004), (0.026, 0.20, 0.012), 'head')   # vertical brace
    slab(m, 'M_Gold', (0, 1.74, hz+0.002), (0.22, 0.022, 0.012), 'head')   # brow band
    for k in range(5):   # breaths (ventilation holes) right cheek
        slab(m, 'M_Visor', (-0.03-0.013*k, 1.60+0.012*(k % 2), hz-0.002), (0.007, 0.014, 0.012), 'head', bevel=0.4)
    lathe(m, 'M_Gold', (0, 1.845, 0.01), (0, 1.862, 0.01), [(0, 0.10), (1, 0.095)], 'head', seg=28, ex=0.94, ez=1.06, caps=(False, False))
    # --- arms
    for sd, x in (('l', 1), ('r', -1)):
        sh, el, wr = H['upperarm_'+sd], H['lowerarm_'+sd], H['hand_'+sd]
        lathe(m, 'M_Chainmail', add(sh, (0, 0.05, 0)), el, [(0, 0.068), (0.5, 0.058), (1.0, 0.052)], 'upperarm_'+sd, seg=14, caps=(False, False))
        # pauldron: three overlapping lames
        for k, (yy, rr) in enumerate(((0.03, 0.094), (-0.025, 0.086), (-0.072, 0.079))):
            sphere(m, 'M_Steel', add(sh, (0.012*x, yy, 0)), rr, 'upperarm_'+sd if k else 'clavicle_'+sd, seg=18, rings=6,
                   sx=1.0, sy=0.45 if k else 0.62, sz=1.05, lat0=-5 if k else 5, lat1=90)
        sphere(m, 'M_Gold', add(sh, (0.012*x, 0.03, 0)), 0.096, 'clavicle_'+sd, seg=18, rings=1, sy=0.62, sz=1.05, lat0=0, lat1=8)
        # couter (elbow) with fan
        sphere(m, 'M_Steel', el, 0.05, [('upperarm_'+sd, 0.5), ('lowerarm_'+sd, 0.5)], seg=14, rings=8, sz=1.1)
        slab(m, 'M_Steel', add(el, (0.045*x, 0, -0.01)), (0.012, 0.08, 0.07), 'lowerarm_'+sd, bevel=0.4)
        # vambrace
        lathe(m, 'M_Steel', lerp(el, wr, 0.08), lerp(el, wr, 0.92), [(0, 0.05), (0.6, 0.046), (1.0, 0.04)], 'lowerarm_'+sd, seg=16, caps=(False, False))
        lathe(m, 'M_Leather', lerp(el, wr, 0.5), lerp(el, wr, 0.56), [(0, 0.05), (1, 0.05)], 'lowerarm_'+sd, seg=16, caps=(False, False))
        # gauntlet: flared cuff, fist, knuckle plate
        lathe(m, 'M_Steel', lerp(el, wr, 0.88), add(wr, (0, -0.02, 0)), [(0, 0.044), (0.5, 0.054), (1.0, 0.062)], 'hand_'+sd, seg=16, caps=(False, False))
        slab(m, 'M_SteelDark', add(wr, (0.005*x, -0.065, 0.015)), (0.07, 0.085, 0.095), 'hand_'+sd, bevel=0.35)
        slab(m, 'M_Steel', add(wr, (0.03*x, -0.06, 0.02)), (0.02, 0.07, 0.085), 'hand_'+sd, bevel=0.4)
    # --- legs
    for sd, x in (('l', 1), ('r', -1)):
        hp, kn, an, ba = H['thigh_'+sd], H['calf_'+sd], H['foot_'+sd], H['ball_'+sd]
        lathe(m, 'M_Chainmail', add(hp, (0, 0.04, 0)), kn, [(0, 0.10), (0.5, 0.083), (1.0, 0.063)], 'thigh_'+sd, seg=16, ez=0.95, caps=(False, False))
        # cuisse (thigh plate, front half only)
        lathe(m, 'M_Steel', lerp(hp, kn, 0.35), lerp(hp, kn, 0.93), [(0, 0.09), (1, 0.07)], 'thigh_'+sd, seg=12, ez=1.0,
              a0=math.radians(200), a1=math.radians(340), up=(1, 0, 0))
        # poleyn (knee) with side wing
        sphere(m, 'M_Steel', add(kn, (0, 0.0, 0.025)), 0.062, [('thigh_'+sd, 0.35), ('calf_'+sd, 0.65)], seg=14, rings=8, sz=1.1)
        slab(m, 'M_Steel', add(kn, (0.055*x, 0.0, 0.0)), (0.012, 0.07, 0.07), 'calf_'+sd, bevel=0.45)
        # greave
        lathe(m, 'M_Steel', lerp(kn, an, 0.10), lerp(kn, an, 0.94), [(0, 0.06), (0.35, 0.064), (1.0, 0.044)], 'calf_'+sd, seg=18, ez=1.08, caps=(False, False))
        # sabaton: lamed steel shoe over a leather sole
        slab(m, 'M_Leather', (an[0], 0.018, 0.06), (0.105, 0.036, 0.30), [('foot_'+sd, 0.6), ('ball_'+sd, 0.4)], bevel=0.3)
        for k in range(4):
            zz = 0.0 + k*0.055
            slab(m, 'M_Steel', (an[0], 0.06-k*0.008, zz), (0.10-k*0.006, 0.05, 0.065), 'foot_'+sd if k < 2 else 'ball_'+sd, bevel=0.4)
        sphere(m, 'M_Steel', (an[0], 0.035, 0.205), 0.045, 'ball_'+sd, seg=12, rings=6, sx=1.0, sy=0.6, sz=1.2, lat0=0, lat1=90)
        sphere(m, 'M_Steel', add(an, (0, 0.03, -0.005)), 0.06, 'foot_'+sd, seg=14, rings=6, lat0=-10, lat1=60)
    # --- cape: double-sided curved cloth hanging from the shoulders
    rows = []
    for i in range(11):
        t = i/10.0; y = 1.47 - t*1.10; wdt = 0.20 + 0.13*t
        zb = -0.135 - 0.05*t - 0.02*math.sin(t*math.pi)
        row = []
        for k in range(13):
            s = -1 + 2*k/12.0
            row.append((s*wdt, y, zb + 0.06*(1-s*s)*(-1) + 0.015*math.sin(s*9+t*5)*t))
        rows.append(row)
    m.grid('M_ClothRed', rows, cape_w)
    back = [[(p[0], p[1], p[2]-0.006) for p in r] for r in rows]
    m.grid('M_ClothRed', back, cape_w, flip=True)
    return S, m

# ---------------------------------------------------------------- animation
FPS = 30
def bake(length, fn, bones):
    """fn(t)-> {bone: quat}; sampled at FPS."""
    n = max(2, int(round(length*FPS))+1); tracks = {b: [] for b in bones}
    for i in range(n):
        t = length*i/(n-1); pose = fn(t)
        for b in bones: tracks[b].append((t, pose.get(b, (0, 0, 0, 1))))
    return tracks

def bake_loc(length, fn):
    n = max(2, int(round(length*FPS))+1); out = {}
    for i in range(n):
        t = length*i/(n-1)
        for b, v in fn(t).items(): out.setdefault(b, []).append((t, v))
    return out

ANIM_BONES = ['pelvis', 'spine_01', 'spine_02', 'neck_01', 'head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r',
              'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r']

def guard(p, k=1.0):
    """Sword-ready arm pose layered into p (right arm holds the blade, left arm relaxed)."""
    p['upperarm_r'] = qeuler(x=-18*k, z=8*k); p['lowerarm_r'] = qeuler(x=-62*k, y=-10*k); p['hand_r'] = qeuler(x=-15*k)
    p['upperarm_l'] = qeuler(x=-8*k, z=-10*k); p['lowerarm_l'] = qeuler(x=-35*k); return p

def anim_idle(t, L=2.4):
    ph = 2*math.pi*t/L; b = math.sin(ph)
    p = {'spine_01': qeuler(x=1.5*b), 'spine_02': qeuler(x=-2.0-1.5*b), 'neck_01': qeuler(x=1.0*b), 'head': qeuler(x=-1.5*b, y=2*math.sin(ph*0.5)),
         'thigh_l': qeuler(x=-4, z=-3), 'thigh_r': qeuler(x=6, z=3), 'calf_l': qeuler(x=8), 'calf_r': qeuler(x=4), 'foot_l': qeuler(x=-4), 'foot_r': qeuler(x=-10)}
    guard(p); p['upperarm_r'] = qmul(p['upperarm_r'], qeuler(x=-2*b)); p['upperarm_l'] = qmul(p['upperarm_l'], qeuler(x=2*b))
    p['clavicle_l'] = qeuler(z=1.2*b); p['clavicle_r'] = qeuler(z=-1.2*b)
    return p

def anim_walk(t, L=1.1):
    ph = 2*math.pi*t/L; s = math.sin(ph); c = math.cos(ph)
    def leg(sd, ph2):
        sw = math.sin(ph2); lift = max(0.0, math.sin(ph2 + math.pi*0.5))
        return {'thigh_'+sd: qeuler(x=-26*sw - 4), 'calf_'+sd: qeuler(x=8 + 48*lift*max(0.0, -math.cos(ph2)) + 10*max(0.0, sw)),
                'foot_'+sd: qeuler(x=-12*sw*0.6 + 6*max(0.0, -sw))}
    p = {}; p.update(leg('l', ph)); p.update(leg('r', ph+math.pi))
    p['pelvis'] = qeuler(y=5*s, z=2.5*c); p['spine_01'] = qeuler(x=4, y=-4*s); p['spine_02'] = qeuler(x=3, y=-5*s)
    p['head'] = qeuler(y=6*s, x=-3)
    guard(p, 0.85)
    p['upperarm_l'] = qmul(p['upperarm_l'], qeuler(x=22*s)); p['upperarm_r'] = qmul(p['upperarm_r'], qeuler(x=-8*s))
    return p

def walk_loc(t, L=1.1):
    ph = 2*math.pi*t/L
    return {'pelvis': (0, -0.035 + 0.03*abs(math.cos(ph)), 0)}

def anim_attack(t, L=0.9):
    """Heavy overhead cut: wind-up 0-0.35, strike 0.35-0.5, follow-through and recover."""
    def env(a, b, x): return sm(a, b, x)
    up = env(0.0, 0.32, t) * (1 - env(0.36, 0.50, t))
    down = env(0.36, 0.50, t) * (1 - env(0.62, 0.90, t))
    p = {'spine_01': qeuler(y=-14*up + 18*down, x=-6*up + 10*down), 'spine_02': qeuler(y=-12*up + 16*down, x=-8*up + 14*down),
         'head': qeuler(x=6*up - 8*down), 'pelvis': qeuler(y=-6*up + 8*down),
         'thigh_l': qeuler(x=-28*down - 10*up, z=-4), 'calf_l': qeuler(x=26*down + 10*up), 'foot_l': qeuler(x=6*down),
         'thigh_r': qeuler(x=20*down + 8, z=4), 'calf_r': qeuler(x=18*down + 6), 'foot_r': qeuler(x=-14*down)}
    rest = 1 - up - down
    p['upperarm_r'] = qeuler(x=-18*rest - 165*up - 40*down, z=8*rest + 15*up - 10*down)
    p['lowerarm_r'] = qeuler(x=-62*rest - 70*up - 10*down, y=-10)
    p['hand_r'] = qeuler(x=-15*rest + 30*up - 35*down)
    p['upperarm_l'] = qeuler(x=-8*rest - 150*up - 45*down, z=-10*rest - 20*up + 5*down)
    p['lowerarm_l'] = qeuler(x=-35*rest - 80*up - 15*down)
    return p

def attack_loc(t, L=0.9):
    down = sm(0.36, 0.5, t) * (1 - sm(0.62, 0.9, t))
    return {'pelvis': (0, -0.07*down, 0.04*down)}

def anim_block(t, L=0.6):
    k = sm(0.0, 0.18, t) * (1 - sm(0.45, 0.6, t)) if L > 0 else 1
    p = {'spine_01': qeuler(x=6*k), 'spine_02': qeuler(x=6*k, y=-8*k), 'head': qeuler(x=-6*k),
         'thigh_l': qeuler(x=-18*k), 'calf_l': qeuler(x=22*k), 'thigh_r': qeuler(x=14*k), 'calf_r': qeuler(x=14*k)}
    guard(p)
    p['upperarm_r'] = qeuler(x=-18 - 55*k, z=8 + 25*k); p['lowerarm_r'] = qeuler(x=-62 - 30*k, y=-10 - 40*k); p['hand_r'] = qeuler(x=-15 + 25*k, z=60*k)
    return p

def anim_hit(t, L=0.5):
    k = sm(0.0, 0.08, t) * (1 - sm(0.12, 0.5, t))
    p = {'spine_01': qeuler(x=-10*k), 'spine_02': qeuler(x=-14*k, y=6*k), 'head': qeuler(x=-18*k, z=6*k),
         'thigh_l': qeuler(x=8*k), 'calf_l': qeuler(x=10*k)}
    guard(p); p['upperarm_l'] = qeuler(x=-8 + 20*k, z=-10 - 25*k)
    return p

def anim_death(t, L=1.6):
    k = sm(0.0, 0.9, t); kn = sm(0.15, 0.6, t)
    p = {'thigh_l': qeuler(x=-85*kn), 'thigh_r': qeuler(x=-70*kn, z=6*kn), 'calf_l': qeuler(x=120*kn), 'calf_r': qeuler(x=110*kn),
         'foot_l': qeuler(x=30*kn), 'foot_r': qeuler(x=30*kn),
         'spine_01': qeuler(x=18*k), 'spine_02': qeuler(x=25*k), 'head': qeuler(x=30*k, z=8*k),
         'upperarm_l': qeuler(x=-10 + 20*k, z=-10 - 10*k), 'upperarm_r': qeuler(x=-18 + 30*k, z=8 + 10*k),
         'lowerarm_l': qeuler(x=-35 + 20*k), 'lowerarm_r': qeuler(x=-62 + 40*k)}
    return p

def death_loc(t, L=1.6):
    kn = sm(0.15, 0.6, t)
    return {'pelvis': (0, -0.52*kn, -0.08*kn)}

def anims():
    out = {}
    out['A_Knight_Idle'] = {'tracks': bake(2.4, anim_idle, ANIM_BONES)}
    out['A_Knight_Walk'] = {'tracks': bake(1.1, anim_walk, ANIM_BONES), 'loc': bake_loc(1.1, walk_loc)}
    out['A_Knight_Attack_Overhead'] = {'tracks': bake(0.9, anim_attack, ANIM_BONES), 'loc': bake_loc(0.9, attack_loc)}
    out['A_Knight_Block'] = {'tracks': bake(0.6, anim_block, ANIM_BONES)}
    out['A_Knight_HitReact'] = {'tracks': bake(0.5, anim_hit, ANIM_BONES)}
    out['A_Knight_Death'] = {'tracks': bake(1.6, anim_death, ANIM_BONES), 'loc': bake_loc(1.6, death_loc)}
    return out

def export(path):
    S, m = build()
    return write_gltf(path, {'SK_HeroKnight': m}, MATS, S, anims(), name='HeroKnight')
