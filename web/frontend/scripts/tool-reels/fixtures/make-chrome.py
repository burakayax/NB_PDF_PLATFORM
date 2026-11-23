"""Video çerçevesi görselleri: degrade arka plan, ışık lekesi, tarayıcı penceresi çerçevesi, köşe maskesi, kapanış düğmesi.

Kullanım: make-chrome.py <çıktı klasörü> <yazı tipi klasörü> <VW1> <VH1> <VW2> <VH2>
Çıktı: bg.png, glow.png, frame1.png, frame2.png, mask1.png, mask2.png, cta.png, sheen.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

out, fonts = sys.argv[1], sys.argv[2]
VW1, VH1, VW2, VH2 = (int(x) for x in sys.argv[3:7])
os.makedirs(out, exist_ok=True)
bold = lambda s: ImageFont.truetype(os.path.join(fonts, "Roboto-Bold.ttf"), s)

BAR = 48  # pencere başlık çubuğu yüksekliği
PAD = 12  # video ile çerçeve kenarı arası
SHADOW = 70  # gölge payı
R = 26  # çerçeve köşe yarıçapı


def blob(size, color, alpha, blur):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((size * 0.2, size * 0.2, size * 0.8, size * 0.8), fill=color + (alpha,))
    return im.filter(ImageFilter.GaussianBlur(blur))


# ---- Arka plan: koyu lacivert degrade + iki ışık lekesi + ince nokta ızgarası ----
W, H = 1080, 1920
bg = Image.new("RGB", (W, H))
px = ImageDraw.Draw(bg)
top, bot = (10, 16, 36), (6, 10, 24)
for y in range(H):
    t = y / (H - 1)
    px.line((0, y, W, y), fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
bg = bg.convert("RGBA")
for (cx, cy, size, col, a) in [(930, 250, 1100, (56, 189, 248), 70), (80, 1620, 1200, (99, 102, 241), 64)]:
    b = blob(size, col, a, size * 0.16)
    bg.alpha_composite(b, (cx - size // 2, cy - size // 2))
dots = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(dots)
for gy in range(30, H, 60):
    for gx in range(30, W, 60):
        dd.ellipse((gx - 1.5, gy - 1.5, gx + 1.5, gy + 1.5), fill=(148, 163, 184, 30))
bg.alpha_composite(dots)
bg.convert("RGB").save(os.path.join(out, "bg.png"))

# Yavaşça süzülen ışık (animasyonlu katman)
blob(900, (56, 189, 248), 90, 150).save(os.path.join(out, "glow.png"))


def window(vw, vh, idx):
    w = vw + 2 * PAD + 2 * SHADOW
    h = vh + BAR + 2 * PAD + 2 * SHADOW
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    box = (SHADOW, SHADOW, SHADOW + vw + 2 * PAD, SHADOW + vh + BAR + 2 * PAD)
    # gölge
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((box[0], box[1] + 22, box[2], box[3] + 22), R, fill=(0, 0, 0, 190))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
    # mavi dış parıltı
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).rounded_rectangle(box, R, outline=(56, 189, 248, 120), width=5)
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(9)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(box, R, fill=(17, 26, 51, 255), outline=(71, 94, 150, 255), width=2)
    # başlık çubuğu: üç nokta + adres hapı
    cy = box[1] + PAD + BAR // 2 - 2
    for i, col in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        x = box[0] + 28 + i * 26
        d.ellipse((x - 8, cy - 8, x + 8, cy + 8), fill=col)
    pw = min(vw - 230, 430)
    px0 = box[0] + (vw + 2 * PAD - pw) // 2 + 40
    d.rounded_rectangle((px0, cy - 15, px0 + pw, cy + 15), 15, fill=(8, 13, 30, 255))
    d.text((px0 + pw // 2, cy), "pdfplatform.app", font=bold(18), fill=(148, 190, 230, 255), anchor="mm")
    # kilit simgesi
    lx = px0 + 22
    d.rounded_rectangle((lx - 6, cy - 2, lx + 6, cy + 8), 2, fill=(52, 211, 153, 255))
    d.arc((lx - 4, cy - 10, lx + 4, cy + 2), 180, 360, fill=(52, 211, 153, 255), width=2)
    # video penceresinin kendi yeri şeffaf bırakılmaz: video üstüne bindirilir (çerçeve altta kalır)
    im.save(os.path.join(out, f"frame{idx}.png"))
    # Köşe maskesi: yalnız alt köşeler yuvarlak (üst, çubuğa bitişik)
    rr = R - 6
    m = Image.new("L", (vw, vh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, -rr * 2, vw - 1, vh - 1), rr, fill=255)
    m.save(os.path.join(out, f"mask{idx}.png"))


window(VW1, VH1, 1)
window(VW2, VH2, 2)

# ---- Kapanış düğmesi ----
cw, ch = 760, 128
cta = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0))
glow = Image.new("RGBA", cta.size, (0, 0, 0, 0))
ImageDraw.Draw(glow).rounded_rectangle((40, 40, 40 + cw, 40 + ch), ch // 2, fill=(56, 189, 248, 150))
cta.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))
grad = Image.new("RGBA", (cw, ch))
gd = ImageDraw.Draw(grad)
for x in range(cw):
    t = x / (cw - 1)
    gd.line((x, 0, x, ch), fill=(int(56 + (99 - 56) * t), int(189 + (102 - 189) * t), int(248 + (241 - 248) * t), 255))
mask = Image.new("L", (cw, ch), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), ch // 2, fill=255)
cta.paste(grad, (40, 40), mask)
ImageDraw.Draw(cta).text((40 + cw // 2, 40 + ch // 2 - 2), "Ücretsiz dene", font=bold(60), fill=(255, 255, 255, 255), anchor="mm")
cta.save(os.path.join(out, "cta.png"))
