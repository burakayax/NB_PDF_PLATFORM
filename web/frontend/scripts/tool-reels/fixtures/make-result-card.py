"""Sonuç kartı: indirilen dosyadan küçük resimler + gerçek özet satırı.

Kullanım: make-result-card.py <sonuç dosyası> <çıktı.png> <yazı tipi klasörü>
Çıktı: <çıktı.png> ve yanında card.json ({"png": ..., "caption": ...}). Desteklenmeyen tür → çıkış kodu 3.
"""
import io
import json
import os
import sys
import zipfile

import fitz  # pymupdf
from PIL import Image, ImageDraw, ImageFont

src, out, fonts = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 960, 700
bold = ImageFont.truetype(os.path.join(fonts, "Roboto-Bold.ttf"), 40)
small = ImageFont.truetype(os.path.join(fonts, "Roboto-Bold.ttf"), 30)
ext = os.path.splitext(src)[1].lower()
thumbs, caption = [], ""


def pdf_pages(doc, limit=3):
    res = []
    for i in range(min(limit, doc.page_count)):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.2, 1.2))
        res.append(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB"))
    return res


if ext == ".zip":
    z = zipfile.ZipFile(src)
    imgs = sorted(n for n in z.namelist() if n.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
    if not imgs:
        sys.exit(3)
    thumbs = [Image.open(io.BytesIO(z.read(n))).convert("RGB") for n in imgs[:3]]
    caption = f"{len(imgs)} görsel dosyası ZIP içinde hazır"
elif ext in (".png", ".jpg", ".jpeg"):
    thumbs = [Image.open(src).convert("RGB")]
    caption = "Görsel hazır"
elif ext == ".pdf":
    doc = fitz.open(src)
    thumbs = pdf_pages(doc)
    caption = f"{doc.page_count} sayfalık PDF hazır"
else:
    sys.exit(3)

card = Image.new("RGB", (W, H), "#0d1630")
d = ImageDraw.Draw(card)
n = len(thumbs)
gap = 28
tw = (W - 2 * 48 - gap * (n - 1)) // n
th = 500
x = 48
for im in thumbs:
    im.thumbnail((tw, th))
    ox = x + (tw - im.width) // 2
    oy = 48 + (th - im.height) // 2
    d.rounded_rectangle((ox - 4, oy - 4, ox + im.width + 4, oy + im.height + 4), 10, fill="#ffffff")
    card.paste(im, (ox, oy))
    x += tw + gap
name = os.path.basename(src)
d.text((W // 2, H - 96), name, font=bold, fill="#ffffff", anchor="mm")
d.text((W // 2, H - 44), caption, font=small, fill="#38bdf8", anchor="mm")
# Yuvarlatılmış köşe
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, W, H), 36, fill=255)
rgba = card.convert("RGBA")
rgba.putalpha(mask)
os.makedirs(os.path.dirname(out), exist_ok=True)
rgba.save(out)
with open(os.path.join(os.path.dirname(out), "card.json"), "w", encoding="utf-8") as f:
    json.dump({"png": out, "caption": caption, "name": name}, f, ensure_ascii=False)
