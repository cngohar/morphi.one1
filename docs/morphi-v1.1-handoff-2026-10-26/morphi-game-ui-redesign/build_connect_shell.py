#!/usr/bin/env python3
"""Connect (the v1.1 new game) designed in the accepted global shell.
GLOBAL (identical to Memory v6 / Block): name in the header row;
full-width bottom panel flush to the screen bottom (How to play /
Scoring & tips + Your high score); gaps — box touches nothing.
CONNECT'S OWN: generated theme (seed 314159: triadic, hue 304.3,
pale lilac; blind diff 32.7, generated first attempt); HUD per its
brief = Score / Pairs / Filled; 6x6 Band 2 board, dots carry colour
AND symbol; background scatter = Connect's own item — a dot pair
joined by a bent path — at 20% opacity, safe zones kept.
State shown: pair A connected (7 cells), pair B started (3 cells):
Score 200, Pairs 1/6, Filled 10/36.
Outputs desktop (1920x923) and phone (780x1688) renders.
"""
import sys
sys.path.insert(0, "/home/hatch/workspace/your_files/morphi-game-ui-redesign")
from theme_generator import generate_theme, SplitMix64
from build_memory_redesign_v3 import draw_symbol, hx, mix, font, BLACK, XBLACK, BOLD
from PIL import Image, ImageDraw

INK = "#1B2433"; LABEL = "#68798E"; CORAL = "#E5532D"
SEED = 314159
ALPHA = 51
t = generate_theme(SEED)
cols = [c["hex"] for c in t["symbol_colors"]]
fams = t["symbol_families"]
panel_line = mix(t["panel_bg"], INK, 0.18)

# pair: (color_idx, fam_idx, dotA, dotB, path cells or None)
PAIRS = [
    (0, 0, (0, 0), (5, 1), [(0, 0), (1, 0), (2, 0), (2, 1), (3, 1), (4, 1), (5, 1)]),
    (1, 1, (1, 3), (4, 5), [(1, 3), (1, 4), (2, 4)]),
    (2, 2, (0, 4), (5, 4), None),
    (3, 3, (0, 2), (5, 5), None),
    (0, 4, (2, 5), (4, 0), None),
    (1, 5, (5, 2), (3, 5), None),
]
STATS = [("SCORE", "200"), ("PAIRS", "1 / 6"), ("FILLED", "10 / 36")]

MOTIFS = [[(0, 1), (0, 0), (1, 0)], [(0, 0), (1, 0), (1, 1)],
          [(1, 1), (1, 0), (0, 0)], [(1, 1), (0, 1), (0, 0)]]

def scatter(img, seed_key, count, y_lo, y_hi, s_lo, s_hi):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    Wd, Hd = img.size
    rng = SplitMix64(SEED ^ seed_key)
    placed, tries = [], 0
    while len(placed) < count and tries < 400:
        tries += 1
        s = int(rng.range(s_lo, s_hi))
        pts = MOTIFS[rng.next() % 4]
        col = hx(cols[rng.next() % len(cols)]) + (ALPHA,)
        x0 = int(rng.range(-16, Wd - 80)); y0 = int(rng.range(y_lo, y_hi))
        cx, cy = x0 + s / 2, y0 + s / 2
        if any(abs(cx - px) < (s + ps) * 0.66 and abs(cy - py) < (s + ps) * 0.66 for px, py, ps in placed):
            continue
        placed.append((cx, cy, s))
        P = [(x0 + px * s, y0 + py * s) for px, py in pts]
        od.line(P, fill=col, width=max(6, int(s * 0.30)), joint="curve")
        for (px, py) in (P[0], P[-1]):
            r = s * 0.30
            od.ellipse([px - r, py - r, px + r, py + r], fill=col)
    return Image.alpha_composite(img, overlay)

def header(d, W, phone=False):
    if not phone:
        f_logo = font(BLACK, 34); x = 64
        for s_, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
            d.text((x, 30), s_, font=f_logo, fill=col, anchor="la"); x += d.textlength(s_, font=f_logo)
        d.text((W / 2, 28), "Connect", font=font(BLACK, 33), fill=INK, anchor="ma")
        pw2 = 168
        d.rounded_rectangle([W - 64 - 62 - 16 - pw2, 22, W - 64 - 62 - 16, 74], radius=26, outline="#7A889E", width=2, fill=(255, 255, 255))
        d.text((W - 64 - 62 - 16 - pw2 / 2, 48), "Your account", font=font(BOLD, 16.5), fill=INK, anchor="mm")
        sc = (W - 64 - 31, 48); sr = 31
    else:
        f_logo = font(BLACK, 33); x = 32
        for s_, col in [("Morphi", INK), (".", CORAL), ("One", INK)]:
            d.text((x, 42), s_, font=f_logo, fill=col, anchor="la"); x += d.textlength(s_, font=f_logo)
        d.text((W / 2, 40), "Connect", font=font(BLACK, 34), fill=INK, anchor="ma")
        sc = (W - 32 - 28, 66); sr = 28
        ac = (sc[0] - 56 - 26, 66)
        d.ellipse([ac[0] - 26, ac[1] - 26, ac[0] + 26, ac[1] + 26], fill=(255, 255, 255), outline="#C9D5E2", width=2)
        d.ellipse([ac[0] - 6, ac[1] - 13, ac[0] + 6, ac[1] - 1], fill=INK)
        d.arc([ac[0] - 11, ac[1] + 1, ac[0] + 11, ac[1] + 23], start=200, end=340, fill=INK, width=4)
    d.ellipse([sc[0] - sr, sc[1] - sr, sc[0] + sr, sc[1] + sr], fill=(255, 255, 255), outline="#C9D5E2", width=2)
    k = sr / 31
    d.polygon([(sc[0] - 12 * k, sc[1] - 4 * k), (sc[0] - 5 * k, sc[1] - 4 * k), (sc[0] + 2 * k, sc[1] - 11 * k),
               (sc[0] + 2 * k, sc[1] + 11 * k), (sc[0] - 5 * k, sc[1] + 4 * k), (sc[0] - 12 * k, sc[1] + 4 * k)], fill=INK)
    for r in (9 * k, 14 * k):
        d.arc([sc[0] + 2 * k, sc[1] - r, sc[0] + 2 * k + r * 1.4, sc[1] + r], start=-55, end=55, fill=INK, width=3)

def bottom_panel(d, W, H, PX, PW, phone=False):
    BP_T = H - (128 if phone else 75)
    rad = 44 if phone else 26
    ext = 16 if phone else 8
    d.rounded_rectangle([-ext, BP_T, W + ext, H + (48 if phone else 24)], radius=rad, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
    if phone:
        def pill(text, x0):
            f = font(BOLD, 23); w = d.textlength(text, font=f) + 52
            y0 = BP_T + 28
            d.rounded_rectangle([x0, y0, x0 + w, y0 + 72], radius=36, fill=(255, 255, 255), outline=mix(t["panel_bg"], INK, 0.35), width=2)
            d.text((x0 + w / 2, y0 + 36), text, font=f, fill=INK, anchor="mm")
            return x0 + w + 14
        nx = pill("How to play", 32); pill("Scoring & tips", nx)
        f_hl, f_hv = font(BOLD, 16), font(XBLACK, 34); right = W - 32
        vw = d.textlength("0", font=f_hv)
        d.text((right - vw, BP_T + 62), "0", font=f_hv, fill=INK, anchor="la")
        hs = "YOUR HIGH SCORE"; lw = d.textlength(hs, font=f_hl) + 2.2 * (len(hs) - 1); cx = right - lw
        for ch in hs:
            d.text((cx, BP_T + 30), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.2
    else:
        def pill(text, x0):
            f = font(BOLD, 15); w = d.textlength(text, font=f) + 40
            y0 = BP_T + 16
            d.rounded_rectangle([x0, y0, x0 + w, y0 + 44], radius=22, fill=(255, 255, 255), outline=mix(t["panel_bg"], INK, 0.35), width=2)
            d.text((x0 + w / 2, y0 + 22), text, font=f, fill=INK, anchor="mm")
            return x0 + w + 10
        nx = pill("How to play", PX); pill("Scoring & tips", nx)
        f_hl, f_hv = font(BOLD, 10.5), font(XBLACK, 22); right = PX + PW
        d.text((right - d.textlength("0", font=f_hv), BP_T + 38), "0", font=f_hv, fill=INK, anchor="la")
        hs = "YOUR HIGH SCORE"; lw = d.textlength(hs, font=f_hl) + 2.4 * (len(hs) - 1); cx = right - lw
        for ch in hs:
            d.text((cx, BP_T + 14), ch, font=f_hl, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_hl) + 2.4

def board(d, GX, GY, CS, CG):
    path_fill = {}
    for ci, fi, a, b, path in PAIRS:
        if path:
            for cell in path: path_fill[cell] = cols[ci]
    empty = mix(t["panel_bg"], "#FFFFFF", 0.38)
    for r in range(6):
        for c in range(6):
            X, Y = GX + c * (CS + CG), GY + r * (CS + CG)
            fill = mix(path_fill[(r, c)], "#FFFFFF", 0.58) if (r, c) in path_fill else empty
            d.rounded_rectangle([X, Y, X + CS, Y + CS], radius=int(CS * 0.2), fill=fill,
                                outline=mix(t["panel_bg"], INK, 0.10), width=1)
    dot_r = CS * 0.36; sym = CS * 0.185
    for ci, fi, a, b, path in PAIRS:
        col = hx(cols[ci]); edge = tuple(int(v * 0.72) for v in col)
        for (r, c) in (a, b):
            cx, cy = GX + c * (CS + CG) + CS / 2, GY + r * (CS + CG) + CS / 2
            d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=col, outline=edge, width=3)
            draw_symbol(d, fams[fi], cx, cy, sym, (255, 255, 255), fill_mode="solid", face_col=col)

def hud(d, PX, PW, PT, phone=False):
    f_lab = font(BOLD, 16 if phone else 11.5); f_val = font(XBLACK, 33 if phone else 26)
    inner0, inner1 = PX + (24 if phone else 30), PX + PW - (24 if phone else 30)
    ly = PT + (26 if phone else 16); vy = PT + (58 if phone else 38)
    for i, (lab, val) in enumerate(STATS):
        ccx = inner0 + (inner1 - inner0) * (i + 0.5) / 3
        sp = 2.0 if phone else 2.6
        wl = d.textlength(lab, font=f_lab) + sp * (len(lab) - 1)
        cx = ccx - wl / 2
        for ch in lab:
            d.text((cx, ly), ch, font=f_lab, fill=LABEL, anchor="la"); cx += d.textlength(ch, font=f_lab) + sp
        d.text((ccx, vy), val, font=f_val, fill=INK, anchor="ma")
    dy = PT + (124 if phone else 84)
    d.line([inner0, dy, inner1, dy], fill=mix(t["panel_bg"], INK, 0.10), width=2)

# ---------- desktop ----------
W, H = 1920, 923
img = Image.new("RGBA", (W, H), hx(t["page_bg"]) + (255,))
img = scatter(img, 0xC0FFEE, 12, 126, 590, 54, 84)
d = ImageDraw.Draw(img)
header(d, W)
PW, PT, PB = 860, 128, 800; PX = (W - PW) // 2
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=34, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
hud(d, PX, PW, PT)
CS, CG = 82, 8; BWID = 6 * CS + 5 * CG
board(d, PX + (PW - BWID) // 2, PT + 112, CS, CG)
bottom_panel(d, W, H, PX, PW)
img.convert("RGB").save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/connect-game-ui-shell.png")

# ---------- phone ----------
W, H = 780, 1688
img = Image.new("RGBA", (W, H), hx(t["page_bg"]) + (255,))
img = scatter(img, 0xF04E, 9, 236, 1400, 84, 108)
d = ImageDraw.Draw(img)
header(d, W, phone=True)
PW, PT, PB = 732, 436, 1311; PX = (W - PW) // 2
d.rounded_rectangle([PX, PT, PX + PW, PB], radius=44, fill=hx(t["panel_bg"]), outline=panel_line, width=2)
hud(d, PX, PW, PT, phone=True)
CS, CG = 104, 11; BWID = 6 * CS + 5 * CG
board(d, PX + (PW - BWID) // 2, PT + 152, CS, CG)
bottom_panel(d, W, H, PX, PW, phone=True)
img.convert("RGB").save("/home/hatch/workspace/your_files/morphi-game-ui-redesign/connect-game-ui-shell-phone.png")
print("connect saved | theme:", t["recipe"], "hue", round(t["base_hue"], 1), "| high score shown: 0 (new game, none set yet)")
