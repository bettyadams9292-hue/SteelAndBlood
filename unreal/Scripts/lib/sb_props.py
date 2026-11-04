"""Weapons and Ruined-Castle environment kit (static meshes). Metres, Y up.
Weapons are modelled grip-at-origin, blade along +Y, so they attach straight to the hand socket."""
import math, random
from sbkit import *

MATS = {
    'M_Steel': (0.62, 0.63, 0.65, 1.0, 0.28), 'M_SteelDark': (0.20, 0.20, 0.22, 1.0, 0.45),
    'M_Leather': (0.24, 0.14, 0.08, 0.0, 0.7), 'M_Gold': (0.83, 0.62, 0.28, 1.0, 0.32),
    'M_Wood': (0.30, 0.19, 0.11, 0.0, 0.75), 'M_WoodDead': (0.22, 0.20, 0.18, 0.0, 0.85),
    'M_Stone': (0.42, 0.40, 0.37, 0.0, 0.85), 'M_StoneDark': (0.25, 0.24, 0.23, 0.0, 0.9),
    'M_Iron': (0.16, 0.15, 0.14, 1.0, 0.6), 'M_ClothRed': (0.45, 0.04, 0.035, 0.0, 0.85),
    'M_Ember': (1.0, 0.45, 0.1, 0.0, 0.5), 'M_Bone': (0.70, 0.66, 0.56, 0.0, 0.6),
}

# ---------------------------------------------------------------- weapons
def blade(m, mat, y0, y1, w0, w1, thick, tip=0.12, fuller=True):
    """Diamond-section tapering blade from y0 to y1 with a pointed tip."""
    L = y1-y0; rows = []
    prof = [(0, w0), (0.6, (w0+w1)/2), (1-tip, w1), (1, 0.002)]
    for t, w in prof:
        y = y0+L*t; th = thick*(w/w0)**0.5
        rows.append([(w/2, y, 0), (0.0, y, th/2), (-w/2, y, 0), (0.0, y, -th/2)])
    m.grid(mat, rows, None, closed_u=True, cap0=True, flip=True)

def longsword():
    m = Mesh()
    blade(m, 'M_Steel', 0.11, 1.00, 0.050, 0.034, 0.010)
    slab(m, 'M_Gold', (0, 0.10, 0), (0.22, 0.022, 0.03), None, bevel=0.35)        # cross-guard
    for x in (-0.115, 0.115): sphere(m, 'M_Gold', (x, 0.10, 0), 0.016, None, seg=10, rings=6)
    lathe(m, 'M_Leather', (0, -0.11, 0), (0, 0.09, 0), [(0, 0.016), (0.5, 0.018), (1, 0.016)], None, seg=10)
    sphere(m, 'M_Gold', (0, -0.135, 0), 0.03, None, seg=14, rings=8, sz=0.6)         # wheel pommel
    return m

def warhammer():
    m = Mesh()
    lathe(m, 'M_Wood', (0, -0.15, 0), (0, 0.75, 0), [(0, 0.02), (1, 0.018)], None, seg=10)
    lathe(m, 'M_Leather', (0, -0.12, 0), (0, 0.12, 0), [(0, 0.023), (1, 0.023)], None, seg=10)
    slab(m, 'M_SteelDark', (0, 0.72, 0), (0.09, 0.11, 0.08), None, bevel=0.2)
    lathe(m, 'M_Steel', (0.04, 0.72, 0), (0.17, 0.72, 0), [(0, 0.04), (0.8, 0.045), (1, 0.042)], None, seg=8)      # striking face
    lathe(m, 'M_Steel', (-0.04, 0.72, 0), (-0.22, 0.75, 0), [(0, 0.03), (0.6, 0.016), (1, 0.002)], None, seg=6)     # back spike
    lathe(m, 'M_Steel', (0, 0.77, 0), (0, 0.90, 0), [(0, 0.02), (1, 0.002)], None, seg=6)
    for y in (0.6, 0.66): slab(m, 'M_Iron', (0, y, 0), (0.05, 0.02, 0.05), None)
    return m

def battleaxe():
    m = Mesh()
    lathe(m, 'M_Wood', (0, -0.2, 0), (0, 0.85, 0), [(0, 0.021), (1, 0.019)], None, seg=10)
    lathe(m, 'M_Leather', (0, -0.15, 0), (0, 0.10, 0), [(0, 0.024), (1, 0.024)], None, seg=10)
    head = [(0.0, 0.66), (0.06, 0.64), (0.12, 0.58), (0.26, 0.52), (0.30, 0.66), (0.29, 0.80), (0.26, 0.95), (0.12, 0.88), (0.06, 0.82), (0.0, 0.80)]
    extrude(m, 'M_Steel', head, 0.018, None, bevel=0.15)
    extrude(m, 'M_SteelDark', [(-0.03, 0.68), (0.03, 0.68), (0.03, 0.80), (-0.03, 0.80)], 0.045, None)
    return m

def halberd():
    m = Mesh()
    lathe(m, 'M_Wood', (0, -0.6, 0), (0, 1.35, 0), [(0, 0.02), (1, 0.018)], None, seg=10)
    blade(m, 'M_Steel', 1.32, 1.70, 0.05, 0.03, 0.012, tip=0.3)
    extrude(m, 'M_Steel', [(0.0, 1.14), (0.22, 1.10), (0.25, 1.22), (0.20, 1.34), (0.0, 1.32)], 0.014, None, bevel=0.15)
    extrude(m, 'M_Steel', [(0.0, 1.20), (-0.16, 1.24), (-0.02, 1.28)], 0.012, None)
    for y in (1.10, 1.36): slab(m, 'M_Iron', (0, y, 0), (0.05, 0.03, 0.05), None)
    return m

def mace():
    m = Mesh()
    lathe(m, 'M_Steel', (0, -0.12, 0), (0, 0.55, 0), [(0, 0.018), (1, 0.016)], None, seg=10)
    lathe(m, 'M_Leather', (0, -0.1, 0), (0, 0.12, 0), [(0, 0.022), (1, 0.022)], None, seg=10)
    sphere(m, 'M_SteelDark', (0, 0.6, 0), 0.05, None, seg=14, rings=8, sy=1.3)
    for k in range(7):
        a = 2*math.pi*k/7
        extrude(m, 'M_Steel', [(0.0, 0.53), (0.06, 0.56), (0.07, 0.62), (0.0, 0.69)], 0.01, None, rot=quat_axis((0, 1, 0), math.degrees(a)))
    return m

def heater_shield():
    m = Mesh()
    out = []
    for k in range(25):
        t = k/24.0; ang = math.pi*t
        out.append((0.30*math.cos(ang)*-1 if False else 0.30 - 0.60*t, 0.0))
    # heater outline: flat top, curved sides converging to a point
    pts = [(-0.30, 0.30), (0.30, 0.30)]
    for k in range(1, 13):
        t = k/12.0; pts.append((0.30*(1-t**1.6), 0.30 - 0.78*t))
    for k in range(11, 0, -1):
        t = k/12.0; pts.append((-0.30*(1-t**1.6), 0.30 - 0.78*t))
    extrude(m, 'M_ClothWhite' if False else 'M_Wood', pts, 0.035, None, bevel=0.06)
    extrude(m, 'M_ClothRed', [(-0.03, 0.27), (0.03, 0.27), (0.03, -0.38), (-0.03, -0.38)], 0.012, None, c=(0, 0, 0.022))
    extrude(m, 'M_ClothRed', [(-0.22, 0.10), (0.22, 0.10), (0.22, 0.04), (-0.22, 0.04)], 0.012, None, c=(0, 0, 0.022))
    sphere(m, 'M_Steel', (0, 0.06, 0.02), 0.05, None, seg=14, rings=6, sz=0.5, lat0=0)
    return m

# ---------------------------------------------------------------- environment
def rnd(seed): r = random.Random(seed); return r

def stone_block(m, mat, c, size, r, jitter=0.012):
    sx, sy, sz = size
    rot = qeuler(r.uniform(-1.5, 1.5), r.uniform(-1.5, 1.5), r.uniform(-1.5, 1.5))
    s = (sx*(1-r.uniform(0, 0.05)), sy*(1-r.uniform(0, 0.08)), sz*(1-r.uniform(0, 0.05)))
    slab(m, mat, add(c, (r.uniform(-jitter, jitter), 0, r.uniform(-jitter, jitter))), s, None, rot=rot, bevel=0.12+r.uniform(0, 0.1))

def castle_wall(seed=1, length=4.0, height=3.2, thick=1.0, ruined=True):
    """Ashlar curtain wall section with crenellations; ruined variant has a broken top."""
    m = Mesh(); r = rnd(seed)
    course = 0.32; y = 0.0; row = 0
    while y < height - 0.01:
        x = -length/2 + (0.25 if row % 2 else 0.0); top_break = height
        if ruined:
            top_break = height - 1.4*max(0.0, math.sin((x+length/2)/length*math.pi*1.3+seed))
        while x < length/2 - 0.05:
            w = min(r.uniform(0.45, 0.8), length/2 - x)
            cx = x + w/2
            lim = height if not ruined else height - 1.3*max(0.0, math.sin((cx+length/2)/length*math.pi*1.3+seed))**2
            if y + course <= lim + 0.01 and w > 0.12:
                mat = 'M_Stone' if r.random() > 0.18 else 'M_StoneDark'
                stone_block(m, mat, (cx, y+course/2, thick/2-0.08), (w-0.02, course-0.02, 0.18), r)
                stone_block(m, mat, (cx, y+course/2, -thick/2+0.08), (w-0.02, course-0.02, 0.18), r)
            x += w
        y += course; row += 1
    slab(m, 'M_StoneDark', (0, height/2, 0), (length-0.04, height-0.1, thick-0.3), None, bevel=0.02)  # rubble core
    if not ruined:
        n = int(length/0.9)
        for k in range(n):
            if k % 2 == 0:
                cx = -length/2 + (k+0.5)*length/n
                slab(m, 'M_Stone', (cx, height+0.35, 0.25), (length/n-0.04, 0.7, 0.4), None, bevel=0.08)
    return m

def tower(seed=2, radius=2.2, height=9.0, ruined=True):
    m = Mesh(); r = rnd(seed)
    course = 0.36; n = int(height/course)
    for i in range(n):
        y = i*course; segs = 18; off = (i % 2)*0.5
        for k in range(segs):
            ang = 2*math.pi*(k+off)/segs
            if ruined and y > height*0.55 and math.sin(ang*1.0+seed) > 0.3 - (y-height*0.55)/height*2.0:
                continue
            c = (math.cos(ang)*radius, y+course/2, math.sin(ang)*radius)
            w = 2*math.pi*radius/segs
            mat = 'M_Stone' if r.random() > 0.2 else 'M_StoneDark'
            slab(m, mat, c, (w-0.03, course-0.025, 0.4), None, rot=quat_axis((0, 1, 0), -math.degrees(ang)+90), bevel=0.14)
    lathe(m, 'M_StoneDark', (0, 0, 0), (0, height*0.6, 0), [(0, radius-0.2), (1, radius-0.2)], None, seg=18, caps=(False, False))
    # arrow slits
    for y in (2.5, 5.0):
        slab(m, 'M_Iron', (0, y, radius+0.19), (0.12, 0.9, 0.04), None)
    return m

def gate_arch(seed=3):
    m = Mesh(); r = rnd(seed)
    for sx in (-1.6, 1.6):
        for i in range(10):
            stone_block(m, 'M_Stone', (sx, 0.18+i*0.36, 0), (0.9, 0.34, 1.0), r)
    n = 13
    for k in range(n+1):
        a = math.pi*k/n; c = (math.cos(a)*1.6, 3.6+math.sin(a)*1.6, 0)
        mat = 'M_Gold' if False else ('M_StoneDark' if k == n//2 else 'M_Stone')
        slab(m, mat, c, (0.42, 0.30, 1.05), None, rot=quat_axis((0, 0, 1), math.degrees(a)-90), bevel=0.1)
    for i in range(6):
        stone_block(m, 'M_Stone', (0, 5.5+i*0.0, 0) if False else (-2.4+i*0.96, 5.55, 0), (0.94, 0.4, 1.0), r)
    # rusted portcullis, half raised
    for x in range(-6, 7):
        lathe(m, 'M_Iron', (x*0.22, 2.0, 0.2), (x*0.22, 4.8, 0.2), [(0, 0.022), (1, 0.022)], None, seg=6)
        lathe(m, 'M_Iron', (x*0.22, 2.0, 0.2), (x*0.22, 1.82, 0.2), [(0, 0.022), (1, 0.002)], None, seg=6, caps=(True, False))
    for y in (2.3, 2.9, 3.5, 4.1, 4.6):
        hw = 1.42 if y < 3.6 else 1.42*math.sqrt(max(0.0, 1-((y-3.6)/1.6)**2))
        lathe(m, 'M_Iron', (-hw, y, 0.2), (hw, y, 0.2), [(0, 0.024), (1, 0.024)], None, seg=6)
    return m

def tombstone(seed=4):
    m = Mesh(); r = rnd(seed); kind = seed % 3
    tilt = qeuler(r.uniform(-8, 8), r.uniform(-15, 15), r.uniform(-6, 6))
    if kind == 0:   # rounded headstone
        pts = [(-0.28, 0), (0.28, 0)] + [(0.28*math.cos(a), 0.62+0.28*math.sin(a)) for a in [math.pi*k/10 for k in range(11)]][::-1][::-1]
        pts = [(-0.28, 0.0), (0.28, 0.0)] + [(0.28*math.cos(math.pi*k/10), 0.62+0.28*math.sin(math.pi*k/10)) for k in range(11)]
        extrude(m, 'M_Stone', pts, 0.11, None, rot=tilt, bevel=0.05)
    elif kind == 1:  # celtic cross
        extrude(m, 'M_Stone', [(-0.07, 0), (0.07, 0), (0.07, 1.1), (-0.07, 1.1)], 0.12, None, rot=tilt, bevel=0.08)
        extrude(m, 'M_Stone', [(-0.3, 0.72), (0.3, 0.72), (0.3, 0.86), (-0.3, 0.86)], 0.12, None, rot=tilt, bevel=0.08)
        lathe(m, 'M_StoneDark', qrot(tilt, (0, 0.79, -0.05)), qrot(tilt, (0, 0.79, 0.05)), [(0, 0.2), (1, 0.2)], None, seg=20, caps=(False, False))
    else:            # broken slab
        extrude(m, 'M_StoneDark', [(-0.3, 0), (0.3, 0), (0.3, 0.55), (0.1, 0.72), (-0.05, 0.6), (-0.3, 0.8)], 0.13, None, rot=tilt, bevel=0.05)
    slab(m, 'M_StoneDark', (0, 0.0, 0.25), (0.7, 0.08, 1.4), None, bevel=0.1)  # grave plinth / mound edge
    return m

def dead_tree(seed=5, h=5.5):
    m = Mesh(); r = rnd(seed)
    def branch(a, d, L, rad, depth):
        b = add(a, mul(norm(d), L))
        lathe(m, 'M_WoodDead', a, b, [(0, rad), (1, rad*0.62)], None, seg=max(5, int(10*rad/0.2)+5), caps=(depth == 0, True))
        if depth >= 4 or rad < 0.02: return
        for _ in range(2 if depth else 3):
            nd = norm(add(norm(d), (r.uniform(-0.9, 0.9), r.uniform(-0.05, 0.6), r.uniform(-0.9, 0.9))))
            branch(lerp(a, b, r.uniform(0.75, 1.0)), nd, L*r.uniform(0.55, 0.75), rad*0.6, depth+1)
    branch((0, -0.2, 0), (r.uniform(-0.1, 0.1), 1, r.uniform(-0.1, 0.1)), h*0.45, 0.22, 0)
    for k in range(5):  # roots
        a = 2*math.pi*k/5 + r.uniform(0, 0.5)
        lathe(m, 'M_WoodDead', (0, 0.35, 0), (math.cos(a)*0.9, -0.15, math.sin(a)*0.9), [(0, 0.12), (1, 0.03)], None, seg=7)
    return m

def rock(seed=6, size=1.0):
    m = Mesh(); r = rnd(seed)
    sphere(m, 'M_StoneDark', (0, size*0.3, 0), size*0.6, None, seg=12, rings=8, sx=r.uniform(1.0, 1.5), sy=r.uniform(0.6, 0.9), sz=r.uniform(0.8, 1.2),
           rot=qeuler(r.uniform(-10, 10), r.uniform(0, 180), r.uniform(-10, 10)))
    P = m.parts['M_StoneDark']
    cache = {}
    for i, p in enumerate(P.p):   # coherent displacement (deterministic per position)
        k = (round(p[0], 3), round(p[1], 3), round(p[2], 3))
        if k not in cache:
            n = math.sin(p[0]*7.1+seed)*math.cos(p[2]*6.3)*0.5 + math.sin(p[1]*11.0+p[0]*3)*0.3
            f = 1 + 0.12*n + r.uniform(-0.04, 0.04)
            cache[k] = (p[0]*f, max(-0.05, (p[1]-size*0.3)*f+size*0.3), p[2]*f)
        P.p[i] = cache[k]
    return m

def brazier():
    m = Mesh()
    for k in range(3):
        a = 2*math.pi*k/3
        lathe(m, 'M_Iron', (math.cos(a)*0.25, 0, math.sin(a)*0.25), (math.cos(a)*0.08, 0.9, math.sin(a)*0.08), [(0, 0.02), (1, 0.025)], None, seg=6)
    lathe(m, 'M_Iron', (0, 0.85, 0), (0, 1.15, 0), [(0, 0.12), (0.4, 0.26), (1, 0.32)], None, seg=16, caps=(True, False))
    sphere(m, 'M_Ember', (0, 1.08, 0), 0.25, None, seg=14, rings=5, sy=0.35, lat0=0)
    for k in range(6):
        a = 2*math.pi*k/6
        lathe(m, 'M_WoodDead', (math.cos(a)*0.18, 1.08, math.sin(a)*0.18), (math.cos(a+2.4)*0.12, 1.2, math.sin(a+2.4)*0.12), [(0, 0.03), (1, 0.025)], None, seg=6)
    return m

def barricade(seed=7):
    m = Mesh(); r = rnd(seed)
    for x in (-1.0, 1.0):
        lathe(m, 'M_Wood', (x, 0, -0.6), (x*0.9, 1.4, 0.6), [(0, 0.06), (1, 0.05)], None, seg=7)
        lathe(m, 'M_Wood', (x, 0, 0.6), (x*0.9, 1.4, -0.6), [(0, 0.06), (1, 0.05)], None, seg=7)
    lathe(m, 'M_Wood', (-1.3, 0.75, 0), (1.3, 0.75, 0), [(0, 0.07), (1, 0.07)], None, seg=8)
    for k in range(9):
        y = 0.25 + k*0.13
        a = (r.uniform(-1.4, -1.1), y, 0.65 - (y/1.4)*0.6); b = (r.uniform(1.1, 1.4), y+r.uniform(-0.05, 0.05), a[2])
        lathe(m, 'M_Wood', a, b, [(0, 0.05), (1, 0.045)], None, seg=6)
    for k in range(5):   # sharpened stakes
        x = -1.0 + k*0.5
        lathe(m, 'M_WoodDead', (x, 0.3, -0.1), (x+0.05, 1.7, 0.7), [(0, 0.05), (0.85, 0.045), (1, 0.003)], None, seg=6)
    return m

def banner():
    m = Mesh()
    lathe(m, 'M_Wood', (0, 0, 0), (0, 4.2, 0), [(0, 0.05), (1, 0.04)], None, seg=8)
    lathe(m, 'M_Wood', (-0.6, 3.95, 0), (0.6, 3.95, 0), [(0, 0.03), (1, 0.03)], None, seg=6)
    sphere(m, 'M_Gold', (0, 4.25, 0), 0.06, None, seg=10, rings=6)
    rows = []
    for i in range(9):
        t = i/8.0; y = 3.9 - t*1.9; row = []
        for k in range(9):
            s = -0.55 + 1.1*k/8
            tear = 0.0 if t < 0.85 else (0.25 if k % 3 == 1 else 0.0)
            row.append((s, y+tear, 0.03*math.sin(s*6+t*4) + 0.05*t))
        rows.append(row)
    m.grid('M_ClothRed', rows, None)
    m.grid('M_ClothRed', [[(p[0], p[1], p[2]-0.008) for p in rw] for rw in rows], None, flip=True)
    return m

def ground_tile(seed=8, size=8.0, n=24):
    """Uneven earth/rubble ground patch."""
    m = Mesh(); r = rnd(seed); rows = []
    for i in range(n+1):
        row = []
        for k in range(n+1):
            x = -size/2 + size*k/n; z = -size/2 + size*i/n
            edge = min(1.0, (size/2-abs(x))/0.6, (size/2-abs(z))/0.6)
            y = (0.06*math.sin(x*1.3+seed)*math.cos(z*1.7) + 0.03*math.sin(x*4.1+z*3.3) + r.uniform(-0.012, 0.012))*max(0.0, edge)
            row.append((x, y, z))
        rows.append(row)
    m.grid('M_Stone', rows, None, flip=True)
    return m

WEAPONS = {'SM_Wpn_Longsword': longsword, 'SM_Wpn_WarHammer': warhammer, 'SM_Wpn_BattleAxe': battleaxe,
           'SM_Wpn_Halberd': halberd, 'SM_Wpn_FlangedMace': mace, 'SM_Shield_Heater': heater_shield}
ENV = {'SM_Env_CastleWall_Ruined': lambda: castle_wall(1, ruined=True), 'SM_Env_CastleWall': lambda: castle_wall(2, ruined=False),
       'SM_Env_Tower_Ruined': tower, 'SM_Env_GateArch': gate_arch,
       'SM_Env_Tomb_A': lambda: tombstone(3), 'SM_Env_Tomb_B': lambda: tombstone(4), 'SM_Env_Tomb_C': lambda: tombstone(5),
       'SM_Env_DeadTree_A': lambda: dead_tree(5), 'SM_Env_DeadTree_B': lambda: dead_tree(11, 4.5),
       'SM_Env_Rock_A': lambda: rock(6, 1.0), 'SM_Env_Rock_B': lambda: rock(9, 1.6),
       'SM_Env_Brazier': brazier, 'SM_Env_Barricade': barricade, 'SM_Env_Banner': banner, 'SM_Env_Ground': ground_tile}

def export_all(folder):
    out = {}
    for name, fn in list(WEAPONS.items()) + list(ENV.items()):
        m = fn(); used = {k: MATS.get(k, (0.5, 0.5, 0.5, 0, 0.8)) for k in m.parts}
        out[name] = write_gltf(folder + '/' + name + '.gltf', {name: m}, used, name=name)['tris']
    return out
