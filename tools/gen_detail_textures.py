"""Tileable armour detail textures for the Unreal M_SB_Armor material (sampled tri-planar in pre-skinned local space).
T_SB_ArmorDetail_N : tangent normal - fine scratches, shallow dents, orange-peel
T_SB_ArmorDetail_M : masks - R scratches, G dents/cavity, B micro roughness variation
T_SB_Filigree_N    : engraved scrollwork for gold trim
All seamless (built with periodic functions / wrapped convolution)."""
import numpy as np
from PIL import Image
rng = np.random.default_rng(7)
N = 1024
OUT = '/home/claude/steelblood/unreal/Textures/'

def blur_wrap(a, sigma):
    f = np.fft.fft2(a); ky = np.fft.fftfreq(a.shape[0])[:, None]; kx = np.fft.fftfreq(a.shape[1])[None, :]
    return np.real(np.fft.ifft2(f * np.exp(-2 * (np.pi * sigma) ** 2 * (kx ** 2 + ky ** 2))))

def norm01(a): a = a - a.min(); return a / max(a.max(), 1e-9)

def fbm(octaves, base, persist=0.5):
    out = np.zeros((N, N))
    for o in range(octaves):
        w = rng.standard_normal((N, N)); out += blur_wrap(w, base / 2 ** o) * persist ** o * (base / 2 ** o)
    return norm01(out)

def scratches(count, length, width, angle_spread, main_angle):
    img = np.zeros((N, N))
    for _ in range(count):
        x0, y0 = rng.uniform(0, N, 2); L = rng.uniform(0.3, 1.0) * length
        a = main_angle + rng.normal(0, angle_spread); steps = int(L * 2)
        curv = rng.normal(0, 0.002)
        depth = rng.uniform(0.3, 1.0)
        for s in range(steps):
            t = s / max(steps - 1, 1); aa = a + curv * s
            x = int(x0 + np.cos(aa) * s * 0.5) % N; y = int(y0 + np.sin(aa) * s * 0.5) % N
            fade = np.sin(np.pi * t) ** 0.5
            img[y, x] = max(img[y, x], depth * fade)
    return blur_wrap(img, width)

def height_to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength; dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, -dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)

# --- armour detail
scr = norm01(scratches(900, 140, 0.6, 0.35, 0.4) + 0.6 * scratches(500, 60, 0.5, 1.5, 1.6))
dents = fbm(3, 40)
dents = norm01(np.clip(dents - 0.45, 0, None) ** 1.5)
peel = fbm(2, 2.0)
height = -0.9 * scr - 2.5 * blur_wrap(dents, 6) + 0.08 * peel
Image.fromarray(height_to_normal(norm01(height), 6.0)).save(OUT + 'T_SB_ArmorDetail_N.png')
micro = fbm(4, 10)
masks = np.dstack([norm01(scr), norm01(blur_wrap(dents, 3)), micro])
Image.fromarray((masks * 255).astype(np.uint8)).save(OUT + 'T_SB_ArmorDetail_M.png')

# --- filigree scrollwork (periodic): sum of curled sine bands warped by noise
y, x = np.mgrid[0:N, 0:N] / N * 2 * np.pi
warp = (fbm(2, 30) - 0.5) * 2.5
p = np.sin(4 * x + 2.2 * np.sin(4 * y + warp)) * np.cos(4 * y + 2.2 * np.sin(4 * x - warp))
lines = np.exp(-(p / 0.12) ** 2)
dots = np.exp(-((np.sin(8 * x) * np.sin(8 * y) - 0.9) / 0.06) ** 2)
fil = norm01(blur_wrap(np.maximum(lines, dots * 0.8), 0.8))
Image.fromarray(height_to_normal(-fil, 10.0)).save(OUT + 'T_SB_Filigree_N.png')
Image.fromarray((fil * 255).astype(np.uint8)).save(OUT + 'T_SB_Filigree_H.png')
print('ok')
