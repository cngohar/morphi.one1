#!/usr/bin/env python3
"""Memory in-play V3: the owner's V2 layout (game name + HUD on the top
row of the panel, help + high score on the bottom panel row), skinned
entirely by a PROCEDURALLY GENERATED theme from theme_generator.py
(PLAN 11.2) instead of any hand-picked colours.

State shown is mid-round (2 pairs matched, 2 cards just flipped) so the
generated symbol set is actually visible — face-down-only states hide
the palette, which is part of why v1/v2 looked plain.
"""
import json, math, sys
sys.path.insert(0, "/home/hatch/workspace/your_files/morphi-game-ui-redesign")
from theme_generator import generate_theme, _rgb
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 923
NOTO = "/usr/share/fonts/truetype/noto/"
def font(name, size): return ImageFont.truetype(NOTO + name, size)
BLACK = "NotoSansDisplay-Black.ttf"; XBLACK = "NotoSans-Black.ttf"
XBOLD = "NotoSans-ExtraBold.ttf"; BOLD = "NotoSans-Bold.ttf"
SEMI = "NotoSans-SemiBold.ttf"; MED = "NotoSans-Medium.ttf"
INK = "#1B2433"; SLATE = "#5A667B"; LABEL = "#68798E"; CORAL = "#E5532D"; WHITE = "#FFFFFF"

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(h1, h2, t):  # t of h2
    a, b = hx(h1), hx(h2)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw_symbol(d, fam, cx, cy, r, col, fill_mode="solid", face_col=(255, 255, 255)):
    out = dict(outline=col, width=5)
    if fam == "ring":
        d.ellipse([cx - r * .8, cy - r * .8, cx + r * .8, cy + r * .8], **({} if fill_mode == "solid" else {}), outline=col, width=6)
    elif fam == "diamond":
        pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
        d.polygon(pts, fill=col) if fill_mode == "solid" else d.polygon(pts, **out)
    elif fam == "triangle":
        pts = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in (-math.pi / 2, math.pi * 5 / 6, math.pi / 6)]
        d.polygon(pts, fill=col) if fill_mode == "solid" else d.polygon(pts, **out)
    elif fam in ("polygon5", "hexagon"):
        n = 5 if fam == "polygon5" else 6
        pts = [(cx + r * math.cos(-math.pi / 2 + i * 2 * math.pi / n), cy + r * math.sin(-math.pi / 2 + i * 2 * math.pi / n)) for i in range(n)]
        d.polygon(pts, fill=col) if fill_mode == "solid" else d.polygon(pts, **out)
    elif fam == "star":
        pts = []
        for i in range(8):
            ang = -math.pi / 2 + i * math.pi / 4
            rr = r if i % 2 == 0 else r * 0.38
            pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
        d.polygon(pts, fill=col) if fill_mode == "solid" else d.polygon(pts, **out)
    elif fam == "cross":
        w_ = r * 0.38
        pts = [(cx - w_, cy - r), (cx + w_, cy - r), (cx + w_, cy - w_), (cx + r, cy - w_), (cx + r, cy + w_),
               (cx + w_, cy + w_), (cx + w_, cy + r), (cx - w_, cy + r), (cx - w_, cy + w_), (cx - r, cy + w_),
               (cx - r, cy - w_), (cx - w_, cy - w_)]
        d.polygon(pts, fill=col) if fill_mode == "solid" else d.polygon(pts, **out)
    elif fam == "petals":
        for i in range(5):
            ang = -math.pi / 2 + i * 2 * math.pi / 5
            px, py = cx + r * 0.52 * math.cos(ang), cy + r * 0.52 * math.sin(ang)
            d.ellipse([px - r * 0.42, py - r * 0.42, px + r * 0.42, py + r * 0.42], fill=col if fill_mode == "solid" else None, outline=col, width=3)
        d.ellipse([cx - r * .16, cy - r * .16, cx + r * .16, cy + r * .16], fill=face_col)
    elif fam == "crescent":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        d.ellipse([cx - r * 0.25, cy - r * 1.05, cx + r * 1.15, cy + r * 0.35], fill=face_col)

def card_path(d, x0, y0, s, container, radius, fill, edge, bw):
    if container == "circle":
        d.ellipse([x0, y0, x0 + s, y0 + s], fill=fill, outline=edge, width=bw)
    elif container == "hexagon":
        pts = [(x0 + s * (0.5 + 0.5 * math.cos(math.pi / 6 + i * math.pi / 3)),
                y0 + s * (0.5 + 0.5 * math.sin(math.pi / 6 + i * math.pi / 3))) for i in range(6)]
        d.polygon(pts, fill=fill, outline=edge)
        for i in range(6):
            d.line([pts[i], pts[(i + 1) % 6]], fill=edge, width=bw)
    elif container == "diamond":
        pts = [(x0 + s / 2, y0), (x0 + s, y0 + s / 2), (x0 + s / 2, y0 + s), (x0, y0 + s / 2)]
        d.polygon(pts, fill=fill, outline=edge)
        for i in range(4):
            d.line([pts[i], pts[(i + 1) % 4]], fill=edge, width=bw)
    else:  # rounded / squircle
        d.rounded_rectangle([x0, y0, x0 + s, y0 + s], radius=radius, fill=fill, outline=edge, width=bw)

def render(seed, out_path, small=False):
    t = generate_theme(seed)
    radius_f, bw, gap, fill_mode = t["style_params"]
    if t["container"] == "squircle": radius_f = 0.30
    if t["container"] in ("circle", "hexagon", "diamond"): radius_f = 0
    img = Image.new("RGB", (W, H), hx(t["page_bg"]))
    d = ImageDraw.Draw(img)
    # backdrop axis (behind everything, margins/corners, <= ~1.3:1 by construction)
    bd = hx(t["backdrop_color"])
    if t["backdrop"] == "dots":
        for gx in range(60, W, 92):
            for gy in range(56, H, 92):
                if 430 < gx < 1490 and 80 < gy < 900: continue
                d.ellipse([gx - 7, gy - 7, gx + 7, gy + 7], fill=bd)
    elif t["backdrop"] == "giant symbols":
        for (cx, cy, r, fam) in [(180, 300, 90, t["symbol_families"][0]), (1740, 640, 110, t["symbol_families"][1]), (1720, 170, 60, t["symbol_families"][2])]:
            draw_symbol(d, fam, cx, cy, r, bd, fill_mode="outline")
    elif t["backdrop"] == "waves":
        for k in range(4):
            yb = 120 + k * 210
            pts = [(x, yb + 26 * math.sin(x / 150 + k)) for x in range(0, 430, 14)]
            d.line(pts, fill=bd, width=5)
            pts = [(x, yb + 26 * math.sin(x / 150 + k)) for x in range(1490, W, 14)]
            d.line(pts, fill=bd, width=5)
    elif t["backdrop"] == "line pattern":
        for gx in range(70, 420, 44):
            d.line([gx, 140, gx, H - 140], fill=bd, width=4)
        for gx in range(1500, 1860, 44):
            d.line([gx, 140, gx, H - 140], fill=bd, width=4)

    # header chrome (locked tokens, unchanged)
    f_logo = font(BLACK, 34); x = 64
    for s, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
        d.text((x, 30), s, font=f_logo, fill=col, anchor="la"); x += d.textlength(s, font=f_logo)
    pw_ = 168
    d.rounded_rectangle([W - 64 - 62 - 16 - pw_, 22, W - 64 - 62 - 16, 74], radius=26, outline="#7A889E", width=2, fill=(255, 255, 255))
    d.text((W - 64 - 62 - 16 - pw_ / 2, 48), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
    sc = (W - 64 - 31, 48)
    d.ellipse([sc[0] - 31, sc[1] - 31, sc[0] + 31, sc[1] + 31], fill=(255, 255, 255), outline="#C9D5E2", width=2)
    d.polygon([(sc[0] - 12, sc[1] - 4), (sc[0] - 5, sc[1] - 4), (sc[0] + 2, sc[1] - 11), (sc[0] + 2, sc[1] + 11), (sc[0] - 5, sc[1] + 4), (sc[0] - 12, sc[1] + 4)], fill=INK)
    for r in (9, 14):
        d.arc([sc[0] + 2, sc[1] - r, sc[0] + 2 + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

    # panel + owner's layout
    PW, PT, PB, PAD = 940, 102, 902, 38
    PX = (W - PW) // 2
    panel_line = mix(t["panel_bg"], INK, 0.18)
    d.rounded_rectangle([PX, PT, PX + PW, PB], radius=34, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
    d.text((PX + PAD, PT + 20), "Memory", font=font(BLACK, 37), fill=INK, anchor="la")
    d.text((PX + PAD + 2, PT + 68), "Round 1 · 6 pairs · Find the matching pairs", font=font(MED, 15), fill=SLATE, anchor="la")
    stats = [("SCORE", "5,905"), ("TIME", "00:47"), ("PAIRS", "2 / 6"), ("MISMATCHES", "3")]
    f_lab, f_val = font(BOLD, 11.5), font(XBLACK, 27)
    zx, zw = PX + 400, PW - PAD - 400
    for i, (lab, val) in enumerate(stats):
        ccx = zx + zw * (i + 0.5) / 4
        wl = d.textlength(lab, font=f_lab) + 2.6 * (len(lab) - 1)
        cx = ccx - wl / 2
        for ch in lab:
            d.text((cx, PT + 24), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + 2.6
        d.text((ccx, PT + 46), val, font=f_val, fill=INK, anchor="ma")
    d.line([PX + PAD, PT + 104, PX + PW - PAD, PT + 104], fill=mix(t["panel_bg"], INK, 0.10), width=2)

    # board — pairs: (family, colour) combos; M = matched, C = flipped this turn
    cols = [c["hex"] for c in t["symbol_colors"]]
    fams = t["symbol_families"]
    pairs = [(fams[i], cols[i % len(cols)]) for i in range(6)]
    grid = [(0, "M"), (3, "."), (1, "M"), (4, "C"), (5, "."), (0, "M"),
            (2, "."), (1, "M"), (2, "C"), (5, "."), (3, "."), (4, ".")]
    CS = 184
    GW = 4 * CS + 3 * gap
    GX, GY = PX + (PW - GW) // 2, PT + 120
    radius = int(CS * radius_f)
    for idx, (pid, state) in enumerate(grid):
        r, c = divmod(idx, 4)
        x0, y0 = GX + c * (CS + gap), GY + r * (CS + gap)
        fam, col = pairs[pid]
        if state == ".":
            card_path(d, x0, y0, CS, t["container"], radius, hx(t["card_back"]), hx(t["card_back_edge"]), bw)
            motif = mix(t["card_back"], "#FFFFFF", 0.55)
            draw_symbol(d, fams[0], x0 + CS / 2, y0 + CS / 2, 26, motif, fill_mode="outline")
        else:
            face = mix(col, "#FFFFFF", 0.86) if state == "M" else (255, 255, 255)
            card_path(d, x0, y0, CS, t["container"], radius, face, hx(col), bw + 1)
            draw_symbol(d, fam, x0 + CS / 2, y0 + CS / 2, 40, hx(col), fill_mode=fill_mode if fill_mode != "split" else "solid", face_col=face)

    BY = PB - 74
    d.line([PX + PAD, BY - 14, PX + PW - PAD, BY - 14], fill=mix(t["panel_bg"], INK, 0.10), width=2)
    def pill(text, x0):
        f = font(BOLD, 15.5); w = d.textlength(text, font=f) + 42
        d.rounded_rectangle([x0, BY, x0 + w, BY + 46], radius=23, fill=(255, 255, 255), outline=mix(t["panel_bg"], INK, 0.35), width=2)
        d.text((x0 + w / 2, BY + 23), text, font=f, fill=INK, anchor="mm")
        return x0 + w + 12
    nx = pill("How to play", PX + PAD); pill("Scoring & tips", nx)
    hs_lab = "YOUR HIGH SCORE"
    f_hl, f_hv = font(BOLD, 11.5), font(XBLACK, 24)
    vw = d.textlength("7,850", font=f_hv); right = PX + PW - PAD
    d.text((right - vw, BY + 12), "7,850", font=f_hv, fill=INK, anchor="la")
    lw = d.textlength(hs_lab, font=f_hl) + 2.6 * (len(hs_lab) - 1); cx = right - lw
    for ch in hs_lab:
        d.text((cx, BY + 2), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.6

    img.save(out_path)
    return t

if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 20261026
    out = sys.argv[2] if len(sys.argv) > 2 else "/home/hatch/workspace/your_files/morphi-game-ui-redesign/memory-game-ui-redesign-v3-procedural.png"
    t = render(seed, out)
    keep = {k: t[k] for k in ("seed", "recipe", "base_hue", "attempt_used", "fallback", "min_blind_diff",
                              "symbol_colors", "card_back", "card_back_vs_panel", "panel_bg", "page_bg",
                              "backdrop", "backdrop_vs_page", "symbol_families", "container", "style")}
    with open("/home/hatch/workspace/your_files/morphi-game-ui-redesign/theme-report-v3.json", "w") as fh:
        json.dump(keep, fh, indent=1)
    print(json.dumps(keep, indent=1))
