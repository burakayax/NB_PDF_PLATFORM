"""Harfleri satır / span / blok yapısına ayırır (PyMuPDF `get_text("dict")` karşılığı).

`pdfcore.content.Glyph` listesi (içerik akışı sırasıyla) → bloklar[satırlar[span glifleri]].
PDF Düzenle analizi ve PDF→Word dönüştürücü ortak kullanır.
"""

from __future__ import annotations

from typing import Any, List


def build_blocks(glyphs: list[Any]) -> list[list[list[Any]]]:
    """Harfleri blok → satır → span hiyerarşisine ayırır. Dönüş: bloklar[satırlar[span glifleri]]."""
    lines: list[list[Any]] = []
    cur: list[Any] = []
    for g in glyphs:
        if cur:
            p = cur[-1]
            sz = max(p.size, g.size, 1.0)
            same_base = abs(g.oy - p.oy) <= 0.35 * sz
            gap = g.ox - (p.ox + p.adv)
            if not same_base or gap < -0.6 * sz or gap > 2.5 * sz or abs(g.slope - p.slope) > 1.0:
                lines.append(cur)
                cur = []
        cur.append(g)
    if cur:
        lines.append(cur)
    # aynı satırda soldan sağa sıralı olmayan parçaları (nadir) olduğu gibi bırak.
    blocks: list[list[list[Any]]] = []
    prev_line: list[Any] | None = None
    for ln in lines:
        x0 = min(g.x0 for g in ln)
        x1 = max(g.x1 for g in ln)
        sz = max(g.size for g in ln)
        joined = False
        if prev_line is not None and blocks:
            py0 = min(g.y0 for g in prev_line)
            py1 = max(g.y1 for g in prev_line)
            y0 = min(g.y0 for g in ln)
            px0 = min(g.x0 for g in prev_line)
            px1 = max(g.x1 for g in prev_line)
            vgap = y0 - py1
            overlap = min(x1, px1) - max(x0, px0)
            if -0.2 * sz <= vgap <= 0.9 * sz and overlap > 0 and ln[0].oy > prev_line[0].oy:
                joined = True
        if joined:
            blocks[-1].append(ln)
        else:
            blocks.append([ln])
        prev_line = ln
    # satırları span'lere böl
    out: list[list[list[Any]]] = []
    for bl in blocks:
        lines_sp: list[list[Any]] = []
        for ln in bl:
            spans: list[list[Any]] = []
            for g in ln:
                if spans:
                    s0 = spans[-1][-1]
                    if (g.font is s0.font and abs(g.size - s0.size) < 0.05 and g.color == s0.color
                            and (g.mode == 3) == (s0.mode == 3)):
                        spans[-1].append(g)
                        continue
                spans.append([g])
            lines_sp.append([with_spaces(sp) for sp in spans])  # type: ignore[arg-type]
        out.append(lines_sp)  # type: ignore[arg-type]
    return out


def with_spaces(sp: list[Any]) -> list[Any]:
    """Bazı üreticiler (tarayıcı/Skia) kelimeleri boşluk glifi KOYMADAN, konumla ayırır. Harfler arası
    boşluk yazı boyutunun ~%20'sinden büyükse yapay bir boşluk eklenir (PyMuPDF de böyle yapıyordu)."""
    import dataclasses

    out: list[Any] = []
    for i, g in enumerate(sp):
        if out:
            a = out[-1]
            gap = g.ox - (a.ox + a.adv)
            if gap > 0.2 * max(a.size, 1.0) and not a.ch.isspace() and not g.ch.isspace() and a.ch and g.ch:
                out.append(dataclasses.replace(a, ch=" ", code=32, ox=a.ox + a.adv, nat=gap, adv=gap,
                                               x0=a.ox + a.adv, x1=g.ox))
        out.append(g)
    return out
