"""
OG paylasim gorsellerini uretir (1200x630, beyaz zemin, logo/emblem stili):
  - public/og-image.png     (TR tagline'lar)
  - public/og-image-en.png  (EN tagline'lar)

Sol: emblem ikon blogu. Sag: "PDF PLATFORM" wordmark + iki tagline.
Sag alt: pdfplatform.app.

Calistir:  web/.venv/Scripts/python.exe web/frontend/scripts/generate-og-image.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]  # web/frontend
PUBLIC = ROOT / "public"
FONTS = PUBLIC / "fonts"

W, H = 1200, 630

# Marka renkleri
NAVY = (15, 40, 100)      # "PDF"
BLUE = (37, 99, 235)      # "PLATFORM" + URL
SLATE = (51, 65, 85)      # tagline 1
GRAY = (110, 122, 140)    # tagline 2
BG = (255, 255, 255)

bold = str(FONTS / "Roboto-Bold.ttf")
reg = str(FONTS / "Roboto-Regular.ttf")


def fit_font(path, text, target_w, start=160, min_size=40):
    """Metni target_w'ya sigdiran en buyuk font boyutunu bul."""
    size = start
    while size > min_size:
        f = ImageFont.truetype(path, size)
        w = f.getbbox(text)[2]
        if w <= target_w:
            return f, size
        size -= 2
    return ImageFont.truetype(path, min_size), min_size


def build(tag1, tag2, out_name):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ── Sol: emblem ikon blogu ───────────────────────────────────────────────
    emblem = Image.open(PUBLIC / "emblem.png").convert("RGBA")
    EM = 300
    emblem = emblem.resize((EM, EM), Image.LANCZOS)
    em_x, em_y = 96, (H - EM) // 2
    img.paste(emblem, (em_x, em_y), emblem)

    # ── Sag blok: wordmark + tagline'lar ─────────────────────────────────────
    text_x = em_x + EM + 60          # 456
    right_margin = 80
    avail_w = W - text_x - right_margin  # ~664

    # Wordmark: "PDF PLATFORM" tek satir, iki renk
    word_font, _ = fit_font(bold, "PDF PLATFORM", avail_w, start=150)
    pdf_txt, plat_txt = "PDF ", "PLATFORM"
    asc, desc = word_font.getmetrics()
    word_h = asc + desc

    tag1_font = fit_font(bold, tag1, avail_w, start=40)[0]
    tag2_font = fit_font(reg, tag2, avail_w, start=33)[0]

    gap1, gap2 = 26, 16
    t1_h = tag1_font.getbbox(tag1)[3] - tag1_font.getbbox(tag1)[1]
    t2_h = tag2_font.getbbox(tag2)[3] - tag2_font.getbbox(tag2)[1]
    block_h = word_h + gap1 + t1_h + gap2 + t2_h
    start_y = (H - block_h) // 2

    # Wordmark ciz (iki renk)
    y = start_y
    draw.text((text_x, y), pdf_txt, font=word_font, fill=NAVY)
    pdf_w = word_font.getbbox(pdf_txt)[2]
    draw.text((text_x + pdf_w, y), plat_txt, font=word_font, fill=BLUE)

    # Tagline 1
    y += word_h + gap1
    draw.text((text_x, y), tag1, font=tag1_font, fill=SLATE)

    # Tagline 2
    y += t1_h + gap2
    draw.text((text_x, y), tag2, font=tag2_font, fill=GRAY)

    # ── Sag alt: URL ─────────────────────────────────────────────────────────
    url = "pdfplatform.app"
    url_font = ImageFont.truetype(bold, 34)
    uw = url_font.getbbox(url)[2]
    draw.text((W - right_margin - uw, H - 70), url, font=url_font, fill=BLUE)

    out = PUBLIC / out_name
    img.save(out, "PNG")
    print("[og] wrote", out, img.size)


build("Birleştir · Dönüştür · Sıkıştır · Düzenle",
      "Hızlı · Güvenli · Cihazında gizli",
      "og-image.png")
build("Merge · Convert · Compress · Edit",
      "Fast · Secure · Private on your device",
      "og-image-en.png")
