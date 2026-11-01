#!/usr/bin/env python3
"""Procedural theme generator, built from PLAN.md 11.2 (+ 11.1a checks).

- SplitMix64 stream, separate from any puzzle-logic stream.
- Recipe draws a harmony + a continuous base hue; symbol colours are
  worked in OKLCH with a chroma cap (0.19) and their lightness solved
  against WCAG contrast targets on white (plan: ~3.3 / 5.5 / 9 spread,
  shuffled), because colour-blind separation is mostly lightness.
- Every candidate palette is verified: symbol contrast >= 3:1 on the
  white card face (with margin), and the minimum CIE76 Lab difference
  between every pair of colours in use, across normal vision and the
  Machado (2009, severity 1.0) protanopia / deuteranopia / tritanopia
  simulations, must be >= 20 (the plan's locked threshold; margin 22
  used here). Failures re-roll deterministically, at most 8 tries,
  then fall back to the verified Shapes preset.
- Other axes are drawn too: symbol shape families, container shape
  family, style family (radius / border / gap / fill mode), backdrop
  generator (contrast vs ground <= ~1.3:1, margins/corners, <= 3
  layers), background tiers and the card-back colour (contrast vs
  the theme background >= 1.5:1 plus a visible edge).
"""
import json, math

MASK = (1 << 64) - 1

class SplitMix64:
    def __init__(self, seed): self.s = seed & MASK
    def next(self):
        self.s = (self.s + 0x9E3779B97F4A7C15) & MASK
        z = self.s
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)
    def f(self): return self.next() / (1 << 64)          # [0,1)
    def range(self, a, b): return a + self.f() * (b - a)
    def pick(self, xs): return xs[int(self.f() * len(xs)) % len(xs)]
    def shuffle(self, xs):
        xs = list(xs)
        for i in range(len(xs) - 1, 0, -1):
            j = int(self.f() * (i + 1)) % (i + 1)
            xs[i], xs[j] = xs[j], xs[i]
        return xs

# ---------- colour plumbing ----------
def oklch_to_srgb(L, C, Hdeg):
    H = math.radians(Hdeg)
    a, b = C * math.cos(H), C * math.sin(H)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    def gam(x):
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return (gam(r), gam(g), gam(bb)), (r, g, bb)

def hexof(rgb):
    return "#" + "".join(f"{round(max(0, min(1, v)) * 255):02X}" for v in rgb)

def lum(rgb):  # WCAG relative luminance from gamma sRGB
    def lin(v): return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(rgb1, rgb2):
    l1, l2 = lum(rgb1), lum(rgb2)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)

MACHADO = {
    "protanopia":    [[0.567, 0.433, 0.0], [0.558, 0.442, 0.0], [0.0, 0.242, 0.758]],
    "deuteranopia":  [[0.625, 0.375, 0.0], [0.700, 0.300, 0.0], [0.0, 0.300, 0.700]],
    "tritanopia":    [[0.950, 0.050, 0.0], [0.0, 0.433, 0.567], [0.0, 0.475, 0.525]],
}
def simulate(rgb, mode):
    if mode == "normal": return rgb
    m = MACHADO[mode]
    return tuple(sum(m[i][j] * rgb[j] for j in range(3)) for i in range(3))

def lab(rgb):  # gamma sRGB -> CIE Lab (D65)
    def lin(v):
        v = max(0.0, min(1.0, v))
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb)
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    def f(t): return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(X), f(Y), f(Z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))

def lab_diff(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab(c1), lab(c2))))

WHITE = (1.0, 1.0, 1.0)
def min_blind_diff(colors):
    worst = 1e9
    for mode in ("normal", "protanopia", "deuteranopia", "tritanopia"):
        sims = [simulate(c, mode) for c in colors]
        for i in range(len(sims)):
            for j in range(i + 1, len(sims)):
                worst = min(worst, lab_diff(sims[i], sims[j]))
    return worst

def solve_L_for_contrast(C, H, target, against=WHITE):
    lo, hi = 0.18, 0.92
    for _ in range(60):
        mid = (lo + hi) / 2
        rgb, _ = oklch_to_srgb(mid, C, H)
        if contrast(rgb, against) < target: hi = mid
        else: lo = mid
    return (lo + hi) / 2

# ---------- the generator ----------
HARMONIES = {  # first four offsets are the ones the 4 symbol colours use,
    # ordered spread-first (the Shapes preset also works with 4 colours;
    # 6 pairs get their distinctness from shape family x colour, 11.2)
    "analogous":           [0, 60, -55, 30, 95, -95],
    "complementary":       [0, 180, 30, 210, -30, 150],
    "split-complementary": [0, 150, 210, 30, 182, -30],
    "triadic":             [0, 120, 240, 60, 152, 268],
    "tetradic":            [0, 90, 180, 270, 42, 222],
    "monochrome + accent": [0, 180, 25, 205, -20, 160],
}
RECIPES = list(HARMONIES)
SHAPE_FAMILIES = ["polygon5", "star", "ring", "cross", "petals", "crescent", "triangle", "hexagon", "diamond"]
CONTAINERS = ["rounded", "squircle", "hexagon", "circle"]
STYLES = {  # name -> (corner radius factor, border width, gap, symbol fill)
    "flat":         (0.14, 2, 18, "solid"),
    "outlined":     (0.14, 4, 18, "outline"),
    "two-tone":     (0.10, 3, 16, "split"),
    "ink":          (0.06, 4, 14, "solid"),
    "blocky":       (0.03, 3, 12, "solid"),
    "soft-rounded": (0.24, 2, 20, "solid"),
}
BACKDROPS = ["giant symbols", "dots", "waves", "line pattern", "none"]
CONTRAST_TARGETS = [3.5, 5.0, 8.0, 14.0]  # the plan's first-run spread for four colours
PRESET_SHAPES_FALLBACK = ["#009A86", "#7D61AE", "#7C4100", "#003041", "#C27400", "#B42318"]

def _rgb(hexs):
    return tuple(int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))

def generate_theme(seed, need=4):
    rng = SplitMix64(seed)
    attempts = []
    for attempt in range(1, 9):
        recipe = rng.pick(RECIPES)
        base_hue = rng.f() * 360.0
        targets = rng.shuffle(CONTRAST_TARGETS)[:need]
        offs = HARMONIES[recipe]
        colors, ok = [], True
        for k in range(need):
            hue = (base_hue + offs[k % len(offs)] + rng.range(-8, 8)) % 360
            chroma = rng.range(0.10, 0.19)
            L = solve_L_for_contrast(chroma, hue, targets[k])
            rgb, _lin = oklch_to_srgb(L, chroma, hue)
            cr = contrast(rgb, WHITE)
            if cr < 3.1: ok = False
            colors.append({"hex": hexof(rgb), "rgb": rgb, "contrast_on_white": round(cr, 2),
                           "hue": round(hue, 1), "target": targets[k]})
        md = min_blind_diff([c["rgb"] for c in colors]) if ok else 0.0
        attempts.append({"attempt": attempt, "recipe": recipe, "base_hue": round(base_hue, 1),
                           "min_blind_diff": round(md, 1), "pass": bool(ok and md >= 22)})
        if ok and md >= 22:  # plan threshold 20, + margin
            # background tiers + card back, worked in OKLCH from the base hue
            page_bg, _ = oklch_to_srgb(0.965, 0.018, base_hue)
            panel_bg, _ = oklch_to_srgb(0.925, 0.040, base_hue)
            back_hue = (base_hue + rng.pick([0, 180, 120])) % 360
            back_L = solve_L_for_contrast(0.13, back_hue, 1.75, against=panel_bg)
            back_rgb, _ = oklch_to_srgb(back_L, 0.13, back_hue)
            back_edge, _ = oklch_to_srgb(max(0.2, back_L - 0.20), 0.13, back_hue)
            backdrop_col, _ = oklch_to_srgb(0.885, 0.030, base_hue)
            style_name = rng.pick(list(STYLES))
            theme = {
                "seed": seed, "attempts": attempts, "attempt_used": attempt,
                "recipe": recipe, "base_hue": round(base_hue, 1),
                "symbol_colors": [{k: c[k] for k in ("hex", "contrast_on_white", "hue", "target")} for c in colors],
                "min_blind_diff": round(md, 1),
                "page_bg": hexof(page_bg), "panel_bg": hexof(panel_bg),
                "card_back": hexof(back_rgb), "card_back_edge": hexof(back_edge),
                "card_back_vs_panel": round(contrast(back_rgb, panel_bg), 2),
                "backdrop_color": hexof(backdrop_col),
                "backdrop_vs_page": round(contrast(backdrop_col, page_bg), 2),
                "symbol_families": rng.shuffle(SHAPE_FAMILIES)[:6],
                "container": rng.pick(CONTAINERS),
                "style": style_name, "style_params": STYLES[style_name],
                "backdrop": rng.pick(BACKDROPS),
                "fallback": False,
            }
            return theme
    # fallback: verified Shapes preset (plan 11.1a)
    return {"seed": seed, "attempts": attempts, "attempt_used": None, "recipe": "PRESET FALLBACK (Shapes)",
            "base_hue": None, "symbol_colors": [{"hex": h} for h in PRESET_SHAPES_FALLBACK],
            "min_blind_diff": None, "page_bg": "#E8F0FC", "panel_bg": "#E8F0FC", "card_back": "#A9BCDD",
            "card_back_edge": "#8FA8C8", "card_back_vs_panel": None, "backdrop_color": "#DCE7F7",
            "backdrop_vs_page": None, "symbol_families": SHAPE_FAMILIES[:need],
            "container": "rounded", "style": "flat", "style_params": STYLES["flat"],
            "backdrop": "none", "fallback": True}

if __name__ == "__main__":
    import sys
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 20261026
    t = generate_theme(seed)
    t.pop("attempts", None) if "--brief" in sys.argv else None
    print(json.dumps(t, indent=1))
