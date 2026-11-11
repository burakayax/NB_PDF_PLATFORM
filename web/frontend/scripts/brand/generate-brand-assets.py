"""Marka varlıklarını tek vektör kaynaktan üretir (emblem, PWA ikonları, favicon, logo).
Çalıştır:  web/.venv/Scripts/python.exe scripts/brand/generate-brand-assets.py
Gerekenler: fonttools, pillow, playwright (+ kurulu Chrome). Yalnızca marka değişince gerekir.
"""
import io, os
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
FONT = "C:/Windows/Fonts/arialbd.ttf"
FONT_L = "C:/Windows/Fonts/arial.ttf"


def text_path(txt, size, font=FONT, spacing=0.0):
    f = TTFont(font); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    sc = size / upm; x = 0.0; out = []
    for ch in txt:
        g = cmap[ord(ch)]; pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, 0)))
        out.append(pen.getCommands()); x += gs[g].width * sc + spacing
    return " ".join(out), x - spacing


TILE = "#EAF2FE"
W = "#fff"
stroke = f'fill="none" stroke="{W}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"'


def content():
    d, w = text_path("PDF", 96)
    tx = 700 - w / 2; ty = 700 + 0.716 * 96 / 2
    px, py, pw, ph, fold = 205, 580, 190, 235, 62
    def sq(x, y, c): return f'<rect x="{x}" y="{y}" width="370" height="370" rx="92" fill="{c}"/>'
    return (
        sq(115, 115, "#004592") + sq(515, 115, "#0969C3") + sq(115, 515, "#0F6FCB") + sq(515, 515, "#AAD2FD")
        + f'<path {stroke} d="M300 405V195M225 270L300 195L375 270"/>'
        + f'<path {stroke} d="M700 195V405M625 330L700 405L775 330"/>'
        + f'<path d="M{px+14} {py}H{px+pw-fold}L{px+pw} {py+fold}V{py+ph-14}Q{px+pw} {py+ph} {px+pw-14} {py+ph}H{px+14}Q{px} {py+ph} {px} {py+ph-14}V{py+14}Q{px} {py} {px+14} {py}Z" fill="#F2F7FF"/>'
        + f'<path d="M{px+pw-fold} {py}V{py+fold}H{px+pw}Z" fill="#0F6FCB"/>'
        + f'<path transform="translate({tx:.1f} {ty:.1f})" fill="#0B4E9E" d="{d}"/>'
    )


def svg(inner, vb="0 0 1000 1000"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{inner}</svg>'


def emblem_svg(rounded=True):
    return svg(f'<title>PDF PLATFORM</title><rect width="1000" height="1000" rx="{210 if rounded else 0}" fill="{TILE}"/>{content()}')


def padded_svg(scale, bg="#fff", rounded_tile=False):
    # tam kanama zemin + ölçeklenmiş içerik (maskable / apple-touch / profil)
    off = 500 * (1 - scale)
    tile = f'<rect width="1000" height="1000" fill="{TILE}"/>'
    return svg(f'<rect width="1000" height="1000" fill="{TILE}"/><g transform="translate({off} {off}) scale({scale})">{content()}</g>')


def profile_svg():
    # beyaz zeminde yuvarlak köşeli emblem (opak avatar)
    s = 0.88; off = 500 * (1 - s)
    return svg(f'<rect width="1000" height="1000" fill="#fff"/><g transform="translate({off} {off}) scale({s})"><rect width="1000" height="1000" rx="210" fill="{TILE}"/>{content()}</g>')


def lockup_svg():
    t1, w1 = text_path("PDF Platform", 90)
    t2, w2 = text_path("DOCUMENT SUITE", 40, FONT_L, 8)
    body = (
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F9FF"/><stop offset="1" stop-color="#E3ECFA"/></linearGradient></defs>'
        '<rect x="3" y="3" width="929" height="314" rx="30" fill="url(#g)" stroke="#B9CDEE" stroke-width="3"/>'
        f'<g transform="translate(36 36) scale(0.248)"><rect width="1000" height="1000" rx="210" fill="{TILE}" stroke="#9DBBEA" stroke-width="10"/>{content()}</g>'
        f'<path transform="translate(330 162)" fill="#0F2A66" d="{t1}"/>'
        '<rect x="330" y="188" width="560" height="3" fill="#7F9BCB"/>'
        f'<path transform="translate(330 240)" fill="#2F5AA8" d="{t2}"/>'
    )
    return body


def main():
    (ROOT / "scripts" / "brand" / "emblem.svg").write_text(emblem_svg(), encoding="utf-8")
    (PUB / "favicon.svg").write_text(emblem_svg(), encoding="utf-8")
    jobs = []  # (svg_markup, w, h, out_path)
    E = emblem_svg()
    for n in (16, 32, 48, 72, 96, 128, 144, 152, 192, 256, 384, 512):
        jobs.append((E, n, n, PUB / "icons" / f"icon-{n}.png"))
    jobs.append((E, 32, 32, PUB / "icons" / "favicon-32.png"))
    jobs.append((E, 512, 512, PUB / "emblem.png"))
    for n in (192, 512):
        jobs.append((padded_svg(0.74), n, n, PUB / "icons" / f"maskable-{n}.png"))
    jobs.append((padded_svg(0.9), 180, 180, PUB / "icons" / "apple-touch-icon.png"))
    for n in (400, 800):
        jobs.append((profile_svg(), n, n, PUB / f"profile-{n}.png"))
    L = svg(lockup_svg(), "0 0 935 320")
    jobs.append((L, 935, 320, PUB / "logo.png"))
    jobs.append((L, 468, 160, PUB / "navbar-logo.png"))
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        for markup, w, h, out in jobs:
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{width:{w}px;height:{h}px;display:block}}</style>{markup}')
            pg.screenshot(path=str(out), omit_background=True); pg.close()
        b.close()
    ims = [Image.open(PUB / "icons" / f"icon-{n}.png").convert("RGBA") for n in (16, 32, 48)]
    ims[2].save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])
    print("ok", len(jobs))


main()
