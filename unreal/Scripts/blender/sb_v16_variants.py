"""Steel & Blood v16 - members of the order (variation kit on the shared RIG_Knight skeleton).
Same faction language (ivory plate, gold borders, red crosses pattee), different silhouettes:
  helms: great helm (base, in sb_v16_armor), visored bascinet with mail aventail, sallet with bevor, hooded great helm
  shoulders: base layered pauldrons, or the same with raised haute-pieces (neck guards)
Each variant's objects are prefixed V16H_<variant>_ and toggled with show(); the base great helm is V16_Helm*.
Faces for helmet-off knights are planned via MetaHuman in Unreal, not built here."""
import bpy, bmesh, math, re
from mathutils import Vector, Matrix
import sb_v16_armor as A

D = bpy.data
HY = A.HY
VARIANTS = ('greathelm', 'bascinet', 'sallet', 'hooded')

def M():
    return {'ivory': D.materials['V16_Ivory'], 'gold': D.materials['V16_Gold'], 'red': D.materials['V16_Crimson'],
            'dark': D.materials['V16_DarkSteel'], 'mail': D.materials.get('Chainmail') or D.materials['V16_DarkSteel'],
            'wool': D.materials.get('V16_Wool') or A.mat_wool(), 'void': D.materials.get('Void') or D.materials['V16_DarkSteel']}

def _clear(prefix):
    for o in [o for o in D.objects if o.name.startswith(prefix)]: D.objects.remove(o, do_unlink=True)

def _shell(name, rows, mats, closed, mat_fn=None, skip=None, centre=Vector((0, HY, 1.72)), apex=None):
    """grid shell with optional face skipping (cut-outs) and an apex fan."""
    me = D.meshes.new(name); bm = bmesh.new()
    V = [[bm.verts.new(p) for p in r] for r in rows]; nr, nc = len(rows), len(rows[0])
    for i in range(nr - 1):
        for j in range(nc if closed else nc - 1):
            j2 = (j + 1) % nc; q = (V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j])
            cen = sum((v.co for v in q), Vector()) / 4
            if skip and skip(cen): continue
            f = bm.faces.new(q); f.smooth = True
            if mat_fn: f.material_index = mat_fn(i, j, nr, nc, cen)
    if apex is not None:
        t = bm.verts.new(apex)
        for j in range(nc): f = bm.faces.new((V[-1][j], V[-1][(j + 1) % nc], t)); f.smooth = True
    bm.normal_update()
    if sum(f.normal.dot(f.calc_center_median() - centre) for f in bm.faces) < 0: bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    o = D.objects.new(name, me); A.coll().objects.link(o)
    return o

def _ring(z, a, bf, bb, n=2.4, nc=96, yoff=0.0):
    out = []
    for j in range(nc):
        th = 2 * math.pi * j / nc; s, c = math.sin(th), math.cos(th)
        x = a * A.sgnpow(s, 2 / n); y = (bf if c > 0 else bb) * A.sgnpow(c, 2 / n)
        out.append(Vector((x, HY + yoff - y, z)))
    return out

# ------------------------------------------------------------------ visored bascinet + aventail
def build_bascinet():
    P = 'V16H_bascinet_'; _clear(P); m = M(); r = A.rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    # skull: ogive rising to an apex pushed slightly back
    rows = []
    for i in range(40):
        v = i / 39; z = 1.600 + v * (1.915 - 1.600)
        k = math.cos(min(1.0, max(0.0, (z - 1.74) / 0.18)) * math.pi / 2)   # 1 below 1.74, ->0 at apex
        a = 0.128 * (0.08 + 0.92 * k); bf = 0.140 * (0.08 + 0.92 * k); bb = 0.140 * (0.08 + 0.92 * k)
        rows.append(_ring(z, a, bf, bb, 2.3, 96, yoff=0.035 * (1 - k)))
    sk = _shell(P + 'Skull', rows, [m['ivory'], m['gold']], True, lambda i, j, nr, nc, c: 1 if i < 2 else 0, apex=Vector((0, HY + 0.035, 1.925)))
    A.finish_plate(sk, 0.005); A.bind_rigid(sk, 'head')
    A.bind_rigid(A.pipe(P + 'SkullPipe', rows[0], 0.005, m['gold'], closed=True), 'head')
    # visor: pointed "hounskull" snout, front 160 deg, with eye slits and breaths
    vrows = []
    for i in range(34):
        v = i / 33; z = 1.605 + v * (1.815 - 1.605)
        snout = 0.075 * math.exp(-((z - 1.695) / 0.06) ** 2)
        row = []
        for j in range(49):
            u = j / 48 * 2 - 1; th = math.radians(84) * u
            s, c = math.sin(th), math.cos(th)
            a = 0.140; b = 0.152 + snout * math.exp(-(u / 0.45) ** 2)
            row.append(Vector((a * A.sgnpow(s, 2 / 2.3), HY - b * A.sgnpow(c, 2 / 2.3), z)))
        vrows.append(row)
    def cut(c):
        if c.y > HY - 0.08: return False
        if 1.752 < c.z < 1.768 and 0.012 < abs(c.x) < 0.085: return True
        if 1.64 < c.z < 1.72 and c.y < HY - 0.18:
            # breaths: small round-ish holes on the snout, both sides
            for cx in (-0.03, -0.015, 0.015, 0.03):
                for cz in (1.66, 1.68, 1.70):
                    if abs(c.x - cx) < 0.004 and abs(c.z - cz) < 0.004: return True
        return False
    vis = _shell(P + 'Visor', vrows, [m['ivory'], m['gold']], False,
                 lambda i, j, nr, nc, c: 1 if (i < 1 or i >= nr - 2 or j < 1 or j >= nc - 2 or (1.744 < c.z < 1.776 and abs(c.x) < 0.094)) else 0, skip=cut)
    A.finish_plate(vis, 0.0045); A.bind_rigid(vis, 'head')
    A.bind_rigid(A.pipe(P + 'VisorPipe', vrows[-1], 0.0045, m['gold']), 'head')
    for s in (-1, 1):  # pivot bosses
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.016, location=(s * 0.143, HY - 0.01, 1.765))
        b = bpy.context.active_object; b.name = P + 'Pivot%d' % s; b.scale = (0.5, 1, 1)
        for c in b.users_collection: c.objects.unlink(b)
        A.coll().objects.link(b); b.data.materials.append(m['gold']); A.bind_rigid(b, 'head')
    A.decal(P + 'Cross', {}, Vector((0, HY - 0.15, 1.85)), Vector((0, -1, 0.5)), Vector((0, 0.3, 1)), 0.03, m['red'], sk, 0.0025, 0.0012, 'head')
    # mail aventail: curtain from the rim down over the shoulders
    arows = [_ring(1.615 - 0.16 * v, 0.130 + 0.09 * v, 0.142 + 0.06 * v, 0.135 + 0.08 * v, 2.3, 72) for v in [i / 9 for i in range(10)]]
    av = _shell(P + 'Aventail', arows, [m['mail']], True)
    sv = av.modifiers.new('Thick', 'SOLIDIFY'); sv.thickness = 0.004; sv.offset = -1
    A.bind_rigid(av, 'neck_01')
    r.data.pose_position = 'POSE'
    return P

# ------------------------------------------------------------------ sallet with bevor
def build_sallet():
    P = 'V16H_sallet_'; _clear(P); m = M(); r = A.rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    rows = []
    for i in range(44):
        v = i / 43; z = 1.655 + v * (1.905 - 1.655)
        k = math.cos(min(1.0, max(0.0, (z - 1.80) / 0.11)) * math.pi / 2)
        a = 0.130 * (0.1 + 0.9 * k); bf = 0.142 * (0.1 + 0.9 * k)
        row = []
        for j in range(96):
            th = 2 * math.pi * j / 96; s, c = math.sin(th), math.cos(th)
            back = max(0.0, -c)
            tail = back ** 2 * 0.10 * max(0.0, 1 - v * 3.0)       # flared tail at the lower back
            bb = 0.138 * (0.1 + 0.9 * k) + tail
            zz = z - back ** 2 * 0.06 * max(0.0, 1 - v * 2.5)        # tail sweeps down
            x = a * A.sgnpow(s, 2 / 2.3); y = (bf if c > 0 else bb) * A.sgnpow(c, 2 / 2.3)
            row.append(Vector((x, HY - y, zz)))
        rows.append(row)
    def cut(c): return c.y < HY - 0.07 and 1.752 < c.z < 1.770 and abs(c.x) < 0.095
    sk = _shell(P + 'Skull', rows, [m['ivory'], m['gold']], True,
                lambda i, j, nr, nc, c: 1 if (i < 2 or (c.y < HY - 0.07 and 1.744 < c.z < 1.778 and abs(c.x) < 0.103)) else 0,
                skip=cut, apex=Vector((0, HY, 1.912)))
    A.finish_plate(sk, 0.005); A.bind_rigid(sk, 'head')
    A.bind_rigid(A.pipe(P + 'Pipe', rows[0], 0.005, m['gold'], closed=True), 'head')
    # comb ridge
    A.bind_rigid(A.pipe(P + 'Comb', [Vector((0, HY - 0.10 + 0.20 * t, 1.905 - 0.25 * (t - 0.5) ** 2 + 0.008)) for t in [k / 20 for k in range(21)]], 0.006, m['gold']), 'head')
    # bevor: chin and throat plate, front 150 deg, two lames
    for k, (z0, z1, a0, a1) in enumerate(((1.640, 1.745, 0.128, 0.142), (1.545, 1.650, 0.150, 0.132))):
        brows = []
        for i in range(12):
            v = i / 11; z = z0 + (z1 - z0) * v; a = a0 + (a1 - a0) * (1 - v)
            brows.append([Vector((a * A.sgnpow(math.sin(t), 2 / 2.3), HY - (a + 0.02) * A.sgnpow(math.cos(t), 2 / 2.3), z))
                          for t in [math.radians(78) * (j / 39 * 2 - 1) for j in range(40)]])
        bv = _shell(P + 'Bevor%d' % k, brows, [m['ivory'], m['gold']], False, lambda i, j, nr, nc, c: 1 if i >= nr - 2 else 0)
        A.finish_plate(bv, 0.0045); A.bind_rigid(bv, 'head' if k == 0 else 'neck_01')
        A.bind_rigid(A.pipe(P + 'BevorPipe%d' % k, brows[-1], 0.0045, m['gold']), 'head' if k == 0 else 'neck_01')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=(0, HY, 1.74))
    ln = bpy.context.active_object; ln.name = P + 'Liner'; ln.scale = (0.112, 0.124, 0.15)
    for c in ln.users_collection: c.objects.unlink(ln)
    A.coll().objects.link(ln); ln.data.materials.append(m['void']); A.bind_rigid(ln, 'head')
    A.decal(P + 'Cross', {}, Vector((0, HY - 0.15, 1.83)), Vector((0, -1, 0.35)), Vector((0, 0, 1)), 0.032, m['red'], sk, 0.0025, 0.0012, 'head')
    r.data.pose_position = 'POSE'
    return P

# ------------------------------------------------------------------ hooded great helm (wool hood + short mantle)
def build_hooded():
    P = 'V16H_hooded_'; _clear(P); m = M(); r = A.rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    # hood hugs the great helm (sections derived from A.helm_section, pushed out ~2.4 cm), opening is a smooth
    # parametric edge (theta range per row) instead of cut faces, crown ends in a soft point toward the back
    cen = lambda z: Vector((0, HY, z))
    zs = [1.552 + (1.872 - 1.552) * (i / 36) for i in range(37)]
    nc = 64; rows = []
    for z in zs:
        op = math.radians(44) * min(1.0, max(0.0, (1.872 - z) / 0.06)) ** 0.7   # opening half-angle, closes at the crown
        row = []
        for j in range(nc):
            th = op + (2 * math.pi - 2 * op) * j / (nc - 1)
            p = A.helm_section(min(z, 1.86), th, keel=False); p.z = z
            d = p - cen(z); dl = d.length or 1.0
            fold = 0.006 * math.sin(th * 9 + z * 40) * max(0.0, (1.70 - z) / 0.15)
            row.append(cen(z) + d * ((dl + 0.024 + fold) / dl))
        rows.append(row)
    # crown: close over the top toward a point slightly back
    apex = Vector((0, HY + 0.05, 1.93))
    for k in range(1, 7):
        t = k / 6
        rows.append([rows[-1][j].lerp(apex, 0.0) * 0 + (rows[36][j] - cen(1.872)) * (1 - t) ** 0.8 + cen(1.872).lerp(apex, t) for j in range(nc)])
    hd = _shell(P + 'Hood', rows, [m['wool'], m['red']], False,
                lambda i, j, nr, nc_, c: 1 if (j < 2 or j >= nc_ - 3) and i < 37 else 0, centre=Vector((0, HY, 1.72)))
    s = hd.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.008; s.offset = 1.0
    sub = hd.modifiers.new('Sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    A.bind_rigid(hd, 'head')
    # rolled red hem along the face opening (both edges + across the brow where they meet)
    edge = [rows[i][0] for i in range(37)][::-1] + [rows[i][-1] for i in range(37)]
    A.bind_rigid(A.pipe(P + 'Hem', edge, 0.006, m['red']), 'head')
    # mantle: drapes from the neck over the shoulders, longer at the back, with soft folds
    mrows = []
    for i in range(16):
        v = i / 15; row = []
        for j in range(120):
            th = 2 * math.pi * j / 120; sn, cs = math.sin(th), math.cos(th)
            a = 0.165 + 0.17 * v; bf = 0.175 + 0.05 * v; bb = 0.17 + 0.07 * v
            x = a * A.sgnpow(sn, 2 / 2.1); y = (bf if cs > 0 else bb) * A.sgnpow(cs, 2 / 2.1)
            fold = 0.012 * v * math.sin(th * 14)
            rr = 1.0 + fold / max(0.05, math.hypot(x, y))
            z = 1.545 - 0.10 * v - 0.06 * v * (x / 0.33) ** 2 - (0.05 * v if cs < 0 else 0.0) * abs(cs)
            row.append(Vector((x * rr, HY - y * rr + 0.004, z)))
        mrows.append(row)
    mt = _shell(P + 'Mantle', mrows, [m['wool'], m['red']], True, lambda i, j, nr, nc, c: 1 if i >= nr - 2 else 0, centre=Vector((0, HY, 1.5)))
    s = mt.modifiers.new('Thick', 'SOLIDIFY'); s.thickness = 0.008; s.offset = 1.0
    sub = mt.modifiers.new('Sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    A.bind_rigid(mt, 'spine_02')
    A.decal(P + 'Cross', {}, Vector((0, HY + 0.40, 1.47)), Vector((0, 1, 0.6)), Vector((0, -0.4, 1)), 0.06, D.materials.get('V16_CrossCloth') or m['red'], mt, 0.003, 0.0012, 'spine_02')
    r.data.pose_position = 'POSE'
    return P

# ------------------------------------------------------------------ haute-pieces (raised pauldron neck guards)
def build_hautepieces():
    P = 'V16H_haute_'; _clear(P); m = M(); r = A.rig(); r.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for s, sd in ((1, 'l'), (-1, 'r')):
        Ax, E1, E2 = A._paul_frame(s); C = Vector((s * 0.232, A.CY + 0.004, 1.418))
        rows = []
        for i in range(8):
            v = i / 7; h = 0.06 * v
            rows.append([A.paul_pt(C, Ax, E1, E2, 0.162, 40 + 4 * (j / 23 * 2 - 1) ** 2 * 10, 180 + 70 * (j / 23 * 2 - 1)) + Vector((0, 0, h)) + Vector((-s * 0.01 * v, 0, 0)) for j in range(24)])
        hp = _shell(P + sd, rows, [m['ivory'], m['gold']], False, lambda i, j, nr, nc, c: 1 if i >= nr - 2 else 0, centre=C)
        A.finish_plate(hp, 0.0045); A.bind_rigid(hp, 'upperarm_' + sd)
        A.bind_rigid(A.pipe(P + 'Pipe' + sd, rows[-1], 0.0045, m['gold']), 'upperarm_' + sd)
    r.data.pose_position = 'POSE'
    return P

# ------------------------------------------------------------------ switching
def show(helm='greathelm', haute=False):
    def vis(o, on): o.hide_render = not on; o.hide_viewport = not on
    for o in D.objects:
        if o.name.startswith('V16_Helm'): vis(o, helm in ('greathelm', 'hooded'))
        m = re.match(r'^V16H_(\w+?)_', o.name)
        if m:
            k = m.group(1)
            if k == 'haute': vis(o, haute)
            else: vis(o, k == helm)
    return helm

def build_all():
    import traceback
    res = {}
    for nm, fn in (('bascinet', build_bascinet), ('sallet', build_sallet), ('hooded', build_hooded), ('haute', build_hautepieces)):
        try: res[nm] = fn()
        except Exception: res[nm] = 'ERROR ' + traceback.format_exc()[-700:]
    show('greathelm')
    return res
