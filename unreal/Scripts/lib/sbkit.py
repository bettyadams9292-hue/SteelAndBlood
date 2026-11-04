"""Steel & Blood procedural modelling + rigging kit.

Pure Python (no numpy) so it runs both offline and inside Unreal's embedded Python.
Builds multi-material meshes with smooth normals, UVs and 4-bone skin weights, and
writes them as self-contained glTF 2.0 (.gltf with embedded buffer) including a
skeleton and keyframed animations. Units are metres, Y up, character faces +Z.
"""
import math, json, base64, struct

# ---------------------------------------------------------------- vector helpers
def add(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def mul(a, s): return (a[0]*s, a[1]*s, a[2]*s)
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def length(a): return math.sqrt(dot(a, a))
def norm(a):
    l = length(a)
    return (a[0]/l, a[1]/l, a[2]/l) if l > 1e-12 else (0.0, 1.0, 0.0)
def lerp(a, b, t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t)

def frame(axis, up_hint=(0, 0, 1)):
    """Orthonormal frame (u, v, w) with w along axis."""
    w = norm(axis)
    h = up_hint if abs(dot(w, norm(up_hint))) < 0.95 else (1, 0, 0)
    u = norm(cross(h, w)); v = cross(w, u)
    return u, v, w

def quat_axis(axis, deg):
    a = math.radians(deg) * 0.5; ax = norm(axis); s = math.sin(a)
    return (ax[0]*s, ax[1]*s, ax[2]*s, math.cos(a))
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz)
def qeuler(x=0, y=0, z=0):
    """Degrees, applied X then Y then Z (intrinsic)."""
    return qmul(qmul(quat_axis((0, 0, 1), z), quat_axis((0, 1, 0), y)), quat_axis((1, 0, 0), x))
def qrot(q, v):
    x, y, z, w = q
    ix = w*v[0]+y*v[2]-z*v[1]; iy = w*v[1]+z*v[0]-x*v[2]; iz = w*v[2]+x*v[1]-y*v[0]; iw = -x*v[0]-y*v[1]-z*v[2]
    return (ix*w+iw*-x+iy*-z-iz*-y, iy*w+iw*-y+iz*-x-ix*-z, iz*w+iw*-z+ix*-y-iy*-x)

# ---------------------------------------------------------------- mesh container
class Part:
    def __init__(self):
        self.p = []; self.n = []; self.uv = []; self.j = []; self.w = []; self.i = []

class Mesh:
    """Geometry grouped by material name; every vertex carries up to 4 bone weights."""
    def __init__(self, bones=None):
        self.parts = {}
        self.bones = bones  # list of bone names (index order) or None for static
        self.flat_ranges = []

    def part(self, mat):
        if mat not in self.parts: self.parts[mat] = Part()
        return self.parts[mat]

    def _bw(self, bw, pos):
        """bw: bone name | [(bone, w)...] | callable(pos)->list."""
        if self.bones is None: return (0, 0, 0, 0), (1, 0, 0, 0)
        if callable(bw): bw = bw(pos)
        if isinstance(bw, str): bw = [(bw, 1.0)]
        bw = [(self.bones.index(b), w) for b, w in bw if w > 1e-4][:4]
        tot = sum(w for _, w in bw) or 1.0
        js = [b for b, _ in bw] + [0]*(4-len(bw)); ws = [w/tot for _, w in bw] + [0.0]*(4-len(bw))
        return tuple(js), tuple(ws)

    def grid(self, mat, rows, bw, closed_u=False, cap0=None, cap1=None, uv_scale=(1, 1), flip=False):
        """rows: list of rings (list of points). Builds a quad strip surface with smooth normals."""
        P = self.part(mat); base = len(P.p); nr = len(rows); nc = len(rows[0])
        # arc-length UVs along u and v
        vlen = [0.0]
        for r in range(1, nr):
            vlen.append(vlen[-1] + sum(length(sub(rows[r][c], rows[r-1][c])) for c in range(nc)) / nc)
        for r in range(nr):
            ulen = [0.0]
            for c in range(1, nc): ulen.append(ulen[-1] + length(sub(rows[r][c], rows[r][c-1])))
            for c in range(nc):
                pt = rows[r][c]; P.p.append(pt); P.n.append((0.0, 0.0, 0.0))
                P.uv.append((ulen[c]*uv_scale[0], vlen[r]*uv_scale[1]))
                j, w = self._bw(bw, pt); P.j.append(j); P.w.append(w)
        cu = nc if closed_u else nc-1
        for r in range(nr-1):
            for c in range(cu):
                a = base+r*nc+c; b = base+r*nc+(c+1) % nc; d = base+(r+1)*nc+c; e = base+(r+1)*nc+(c+1) % nc
                tri = [(a, d, b), (b, d, e)] if not flip else [(a, b, d), (b, e, d)]
                for t in tri: P.i.extend(t)
        for cap, r in ((cap0, 0), (cap1, nr-1)):
            if cap:
                ring = rows[r]; ctr = mul(ring[0], 0)
                for q in ring: ctr = add(ctr, q)
                ctr = mul(ctr, 1.0/len(ring)); ci = len(P.p)
                P.p.append(ctr); P.n.append((0.0, 0.0, 0.0)); P.uv.append((0.5, 0.5))
                j, w = self._bw(bw, ctr); P.j.append(j); P.w.append(w)
                for c in range(cu):
                    a = base+r*nc+c; b = base+r*nc+(c+1) % nc
                    if (r == 0) != flip: P.i.extend((ci, a, b))
                    else: P.i.extend((ci, b, a))
        return base

    def finish(self):
        """Compute smooth area-weighted normals, welding by position within each part."""
        for P in self.parts.values():
            acc = [[0.0, 0.0, 0.0] for _ in P.p]
            for k in range(0, len(P.i), 3):
                a, b, c = P.i[k:k+3]
                fn = cross(sub(P.p[b], P.p[a]), sub(P.p[c], P.p[a]))
                for v in (a, b, c):
                    acc[v][0] += fn[0]; acc[v][1] += fn[1]; acc[v][2] += fn[2]
            # weld coincident vertices (seams) so lathes stay smooth
            key = {}
            for v, pt in enumerate(P.p):
                k = (round(pt[0], 5), round(pt[1], 5), round(pt[2], 5))
                key.setdefault(k, []).append(v)
            for vs in key.values():
                if len(vs) > 1:
                    s = [sum(acc[v][d] for v in vs) for d in range(3)]
                    for v in vs: acc[v] = list(s)
            P.n = [norm(tuple(a)) for a in acc]
        return self

    def tri_count(self): return sum(len(P.i)//3 for P in self.parts.values())

# ---------------------------------------------------------------- primitives
def ring(c, u, v, rx, ry, seg, a0=0.0, a1=2*math.pi, closed=True):
    n = seg if closed else seg+1
    out = []
    for k in range(n):
        t = a0 + (a1-a0)*k/(seg if closed else seg)
        out.append(add(c, add(mul(u, math.cos(t)*rx), mul(v, math.sin(t)*ry))))
    return out

def lathe(m, mat, a, b, profile, bw, seg=20, ex=1.0, ez=1.0, up=(0, 0, 1), caps=(True, True),
          a0=0.0, a1=2*math.pi, uvs=(1, 1), squash=None):
    """Surface of revolution between points a->b. profile=[(t, r)] with t in [0,1].
    ex/ez scale the ring into an ellipse. squash(t, angle)->radius multiplier for shaping."""
    u, v, w = frame(sub(b, a), up); L = length(sub(b, a))
    closed = (a1-a0) >= 2*math.pi-1e-6
    rows = []
    for t, r in profile:
        c = add(a, mul(w, t*L)); n = seg if closed else seg+1; ring_pts = []
        for k in range(n):
            ang = a0 + (a1-a0)*k/seg
            rr = r*(squash(t, ang) if squash else 1.0)
            ring_pts.append(add(c, add(mul(u, math.cos(ang)*rr*ex), mul(v, math.sin(ang)*rr*ez))))
        rows.append(ring_pts)
    m.grid(mat, rows, bw, closed_u=closed, cap0=caps[0] and closed and profile[0][1] > 1e-4,
           cap1=caps[1] and closed and profile[-1][1] > 1e-4, uv_scale=uvs, flip=True)

def slab(m, mat, c, size, bw, rot=None, bevel=0.15, seg_round=2):
    """Bevelled box centred at c, size=(sx,sy,sz). Built as rounded-rect lathe along Y."""
    sx, sy, sz = size; bvl = min(sx, sz)*bevel
    # rounded rectangle cross-section
    pts = []
    for qx, qz, a in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        cx = qx*(sx/2-bvl); cz = qz*(sz/2-bvl)
        for k in range(seg_round+1):
            ang = math.radians(a + 90*k/seg_round)
            pts.append((cx+math.cos(ang)*bvl, cz+math.sin(ang)*bvl))
    by = min(bvl, sy*0.25)
    levels = [(-sy/2, 1-by*2/max(sx, 1e-6)), (-sy/2+by, 1.0), (sy/2-by, 1.0), (sy/2, 1-by*2/max(sx, 1e-6))]
    rows = []
    for y, s in levels:
        row = []
        for px, pz in pts:
            q = (px*s if s > 0 else 0, y, pz*s if s > 0 else 0)
            if rot: q = qrot(rot, q)
            row.append(add(c, q))
        rows.append(row)
    m.grid(mat, rows, bw, closed_u=True, cap0=True, cap1=True)

def sphere(m, mat, c, r, bw, seg=16, rings=10, sx=1, sy=1, sz=1, lat0=-90, lat1=90, rot=None):
    rows = []
    for i in range(rings+1):
        lat = math.radians(lat0+(lat1-lat0)*i/rings); row = []
        for k in range(seg):
            lon = 2*math.pi*k/seg
            q = (math.cos(lat)*math.cos(lon)*r*sx, math.sin(lat)*r*sy, math.cos(lat)*math.sin(lon)*r*sz)
            if rot: q = qrot(rot, q)
            row.append(add(c, q))
        rows.append(row)
    m.grid(mat, rows, bw, closed_u=True, cap0=lat0 > -89, cap1=lat1 < 89, flip=False)

def extrude(m, mat, outline, depth, bw, rot=None, c=(0, 0, 0), bevel=0.0):
    """Extrude a 2D outline (x,y) along local z by depth, centred. Optional bevel inset."""
    def tf(x, y, z):
        q = (x, y, z)
        if rot: q = qrot(rot, q)
        return add(c, q)
    cx = sum(p[0] for p in outline)/len(outline); cy = sum(p[1] for p in outline)/len(outline)
    def inset(s): return [(cx+(x-cx)*s, cy+(y-cy)*s) for x, y in outline]
    lv = [(-depth/2, 1-bevel), (-depth/2+depth*0.25*(1 if bevel else 0), 1.0), (depth/2-depth*0.25*(1 if bevel else 0), 1.0), (depth/2, 1-bevel)] if bevel else [(-depth/2, 1.0), (depth/2, 1.0)]
    rows = [[tf(x, y, z) for x, y in inset(s)] for z, s in lv]
    m.grid(mat, rows, bw, closed_u=True, cap0=True, cap1=True, flip=True)

# ---------------------------------------------------------------- glTF writer
class Skeleton:
    def __init__(self):
        self.names = []; self.parent = []; self.head = []  # world-space rest positions
    def add(self, name, parent, pos):
        self.names.append(name); self.parent.append(-1 if parent is None else self.names.index(parent)); self.head.append(pos)
    def local(self, i):
        p = self.parent[i]
        return self.head[i] if p < 0 else sub(self.head[i], self.head[p])

def write_gltf(path, meshes, materials, skeleton=None, anims=None, name='Asset'):
    """meshes: {node_name: Mesh}. materials: {mat: (r,g,b,metal,rough)}. anims: {clip: {'len':s,'tracks':{bone:[(t,quat)]},'root':[(t,(x,y,z))]}}"""
    buf = bytearray(); views = []; accs = []
    def blob(data, target=None):
        while len(buf) % 4: buf.append(0)
        off = len(buf); buf.extend(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)} | ({'target': target} if target else {}))
        return len(views)-1
    def acc(vals, ctype, typ, target=None, minmax=False, normalized=False):
        fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[ctype]
        comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[typ]
        flat = [x for v in vals for x in (v if comps > 1 else (v,))]
        data = struct.pack('<%d%s' % (len(flat), fmt), *flat)
        a = {'bufferView': blob(data, target), 'componentType': ctype, 'count': len(vals), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax:
            a['min'] = [min(v[k] for v in vals) for k in range(comps)] if comps > 1 else [min(vals)]
            a['max'] = [max(v[k] for v in vals) for k in range(comps)] if comps > 1 else [max(vals)]
        accs.append(a); return len(accs)-1
    mat_names = list(materials.keys())
    g = {'asset': {'version': '2.0', 'generator': 'SteelAndBlood sbkit'}, 'scene': 0, 'scenes': [{'name': name, 'nodes': []}],
         'nodes': [], 'meshes': [], 'materials': [], 'accessors': accs, 'bufferViews': views, 'buffers': []}
    for mn in mat_names:
        r, gg, b, met, rough = materials[mn]
        g['materials'].append({'name': mn, 'pbrMetallicRoughness': {'baseColorFactor': [r, gg, b, 1.0], 'metallicFactor': met, 'roughnessFactor': rough}})
    joint_nodes = []
    if skeleton:
        for i, bn in enumerate(skeleton.names):
            g['nodes'].append({'name': bn, 'translation': list(skeleton.local(i))}); joint_nodes.append(i)
        for i, p in enumerate(skeleton.parent):
            if p >= 0: g['nodes'][p].setdefault('children', []).append(i)
        ibm = []
        for hd in skeleton.head:
            ibm.append((1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -hd[0], -hd[1], -hd[2], 1))
        skin = {'joints': joint_nodes, 'inverseBindMatrices': acc(ibm, 5126, 'MAT4'), 'skeleton': 0}
        g['skins'] = [skin]
        g['scenes'][0]['nodes'].append(0)
    for node_name, m in meshes.items():
        m.finish(); prims = []
        for mat, P in m.parts.items():
            if not P.i: continue
            attrs = {'POSITION': acc(P.p, 5126, 'VEC3', 34962, True), 'NORMAL': acc(P.n, 5126, 'VEC3', 34962),
                     'TEXCOORD_0': acc(P.uv, 5126, 'VEC2', 34962)}
            if skeleton:
                attrs['JOINTS_0'] = acc(P.j, 5123, 'VEC4', 34962)
                attrs['WEIGHTS_0'] = acc(P.w, 5126, 'VEC4', 34962)
            prims.append({'attributes': attrs, 'indices': acc(P.i, 5125, 'SCALAR', 34963), 'material': mat_names.index(mat)})
        g['meshes'].append({'name': node_name, 'primitives': prims})
        nd = {'name': node_name, 'mesh': len(g['meshes'])-1}
        if skeleton: nd['skin'] = 0
        g['nodes'].append(nd); g['scenes'][0]['nodes'].append(len(g['nodes'])-1)
    if anims and skeleton:
        g['animations'] = []
        for clip, A in anims.items():
            ch = []; sm = []
            for bone, keys in A['tracks'].items():
                ti = acc([k[0] for k in keys], 5126, 'SCALAR', None, True)
                vi = acc([norm4(k[1]) for k in keys], 5126, 'VEC4')
                sm.append({'input': ti, 'output': vi, 'interpolation': 'LINEAR'})
                ch.append({'sampler': len(sm)-1, 'target': {'node': skeleton.names.index(bone), 'path': 'rotation'}})
            for bone, keys in A.get('loc', {}).items():
                bi = skeleton.names.index(bone); base = skeleton.local(bi)
                ti = acc([k[0] for k in keys], 5126, 'SCALAR', None, True)
                vi = acc([add(base, k[1]) for k in keys], 5126, 'VEC3')
                sm.append({'input': ti, 'output': vi, 'interpolation': 'LINEAR'})
                ch.append({'sampler': len(sm)-1, 'target': {'node': bi, 'path': 'translation'}})
            g['animations'].append({'name': clip, 'channels': ch, 'samplers': sm})
    while len(buf) % 4: buf.append(0)
    g['buffers'].append({'byteLength': len(buf), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(buf)).decode()})
    with open(path, 'w') as f: json.dump(g, f, separators=(',', ':'))
    return {'bytes': len(buf), 'tris': sum(m.tri_count() for m in meshes.values())}

def norm4(q):
    l = math.sqrt(sum(x*x for x in q)) or 1.0
    return tuple(x/l for x in q)
