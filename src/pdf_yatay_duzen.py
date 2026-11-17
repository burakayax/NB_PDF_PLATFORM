"""
Dikey sayfaları yatay sayfa düzenine yeniden yerleştirir (yalnız izinli kütüphaneler:
pikepdf [MPL], pypdfium2 [Apache/BSD], numpy).

Sayfa içeriği YENİDEN ÇİZİLMEZ: her sayfa PDF'in içinde "form nesnesi" olarak
yeniden kullanılıp yeni yatay sayfaya yerleştirilir. Böylece metin, yazı tipi,
görsel ve vektör çizim aynen korunur; yalnız konum/ölçek değişir.

Modlar
------
fit    Her sayfanın asıl içeriği (boş kenarlar atılır) yatay sayfaya sığdırılır.
       Belgedeki TÜM sayfalarda aynı ölçek kullanılır (sayfa sayfa boyut oynamaz).
split  SÜREKLİ AKIŞ: içerik, her sayfada iki sütun olacak biçimde sırayla dizilir.
       Sütun dolunca kesim, satırlar arasındaki en uygun boşluktan yapılır ve akış
       sonraki sütunda kaldığı yerden devam eder (sayfa sınırları sütunu bitirmez).
auto   İçeriği yatay olan sayfalar fit, dikey olanlar split.
Zaten yatay olan sayfalar aynen korunur.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pikepdf
import pypdfium2 as pdfium

_MOD = ("fit", "split", "auto")
_KENAR = 18.0         # yeni sayfada kenar boşluğu (pt)
_SUTUN_ARASI = 14.0   # iki sütun arası (pt)
_ICERIK_PAYI = 6.0    # içerik kutusuna eklenen pay (pt)
_PARCA_ARASI = 10.0   # akışta iki sayfa içeriği arası boşluk (çıktı pt)
_KOYU_ESIK = 238      # bu değerin altı "mürekkep" sayılır
_RENDER_OLCEK = 1.0   # kutu/kesim tespiti için 72 dpi yeterli


class YatayDuzenHatasi(Exception):
    pass


@dataclass
class _Sayfa:
    kaynak: pikepdf.Page
    bb: list                      # görünen sayfa kutusu [x0,y0,x1,y1] (pt)
    kx: float                     # pt / piksel (yatay)
    ky: float                     # pt / piksel (dikey)
    x0: float = 0.0               # içerik sol (pt)
    x1: float = 0.0               # içerik sağ (pt)
    ust: int = 0                  # içerik üst (piksel satırı)
    alt: int = 0                  # içerik alt (piksel satırı, hariç)
    bos_esik: int = 2
    kural_esik: int = 1 << 30            # bu kadar mürekkepli satır = yatay çizgi (tablo kuralı)
    satir: Optional[np.ndarray] = None     # satır başına mürekkep sayısı
    kare: Optional[pikepdf.Object] = None  # sayfanın form nesnesi (bir kez üretilir)

    @property
    def genislik(self) -> float:
        return self.x1 - self.x0

    @property
    def yukseklik(self) -> float:
        return (self.alt - self.ust) * self.ky

    def y_pt(self, satir_px: float) -> float:
        return self.bb[3] - satir_px * self.ky


def _gri(pdfium_sayfa) -> np.ndarray:
    bmp = pdfium_sayfa.render(scale=_RENDER_OLCEK, grayscale=True)
    return np.asarray(bmp.to_numpy()).reshape(bmp.height, bmp.width)


def _sayfa_analiz(pdfi, i, kaynak) -> Optional[_Sayfa]:
    """Sayfanın içerik kutusunu ve satır profilini çıkarır; boşsa None, yatayysa profilsiz."""
    fx = kaynak.as_form_xobject()
    bb = [float(v) for v in fx.BBox]
    sw, sh = bb[2] - bb[0], bb[3] - bb[1]
    if sw >= sh:
        return _Sayfa(kaynak, bb, 1.0, 1.0)

    gri = _gri(pdfi[i])
    koyu = gri < _KOYU_ESIK
    if not koyu.any():
        return None
    h, w = koyu.shape
    sat = koyu.sum(axis=1)
    sut = koyu.sum(axis=0)
    esik = max(2, int(w * 0.004))
    sat_ok = np.where(sat >= esik)[0]
    sut_ok = np.where(sut >= max(2, int(h * 0.004)))[0]
    if sat_ok.size == 0 or sut_ok.size == 0:
        sat_ok, sut_ok = np.where(sat > 0)[0], np.where(sut > 0)[0]

    s = _Sayfa(kaynak, bb, sw / w, sh / h, bos_esik=esik)
    s.kural_esik = max(esik + 1, int(0.7 * (int(sut_ok[-1]) + 1 - int(sut_ok[0]))))
    s.satir = sat.astype(np.int64)
    pay = _ICERIK_PAYI
    s.x0 = max(bb[0], bb[0] + int(sut_ok[0]) * s.kx - pay)
    s.x1 = min(bb[2], bb[0] + (int(sut_ok[-1]) + 1) * s.kx + pay)
    s.ust = max(0, int(sat_ok[0]) - int(pay / s.ky))
    s.alt = min(h, int(sat_ok[-1]) + 1 + int(pay / s.ky))

    # Etkileşimli öğeler (form alanı, bağlantı) de içeriktir; kesim onların ortasından geçmesin
    for a in (kaynak.obj.get("/Annots") or []):
        try:
            r = [float(v) for v in a.Rect]
        except Exception:
            continue
        ax0, ax1 = sorted((r[0], r[2]))
        ay0, ay1 = sorted((r[1], r[3]))
        s.x0 = min(s.x0, max(bb[0], ax0 - pay))
        s.x1 = max(s.x1, min(bb[2], ax1 + pay))
        ust_px = max(0, int((bb[3] - ay1) / s.ky) - 1)
        alt_px = min(h, int((bb[3] - ay0) / s.ky) + 2)
        s.ust = min(s.ust, ust_px)
        s.alt = max(s.alt, alt_px)
        s.satir[ust_px:alt_px] = np.maximum(s.satir[ust_px:alt_px], esik + 1)
    return s


def _bos_mu(s: _Sayfa, r: int) -> bool:
    return bool(s.satir[r] < s.bos_esik)


def _kesim_bul(s: _Sayfa, ust: int, limit: int) -> int:
    """[ust, limit] içinde kesim satırı.

    Öncelik: (1) limite en yakın boşluk bandının ortası (yazı satırları arası),
    (2) limite en yakın yatay tablo çizgisi (çizgili tabloda satır ortasından kesmemek için),
    (3) son %20'de en az mürekkepli satır.
    """
    alt_sinir = ust + int((limit - ust) * 0.25)
    r = limit - 1
    while r > alt_sinir and not _bos_mu(s, r):
        r -= 1
    if r > alt_sinir:
        bas = r
        while bas > alt_sinir and _bos_mu(s, bas - 1):
            bas -= 1
        return (bas + r) // 2 + 1
    r = limit - 1
    while r > alt_sinir and s.satir[r] < s.kural_esik:
        r -= 1
    if r > alt_sinir:
        bas = r
        while bas > alt_sinir and s.satir[bas - 1] >= s.kural_esik:
            bas -= 1
        return (bas + r) // 2
    lo = max(alt_sinir, limit - max(8, int((limit - ust) * 0.2)))
    return lo + int(np.argmin(s.satir[lo:limit])) + 1


def _ilk_dolu(s: _Sayfa, r: int, son: int) -> int:
    while r < son and _bos_mu(s, r):
        r += 1
    return r


def _son_dolu(s: _Sayfa, r: int, ilk: int) -> int:
    """r'den geriye doğru ilk dolu satırın altı (hariç)."""
    while r > ilk and _bos_mu(s, r - 1):
        r -= 1
    return r


def _annot_tasi(kaynak, yeni, hedef_bbox, m, tasinanlar: set) -> None:
    ann = kaynak.obj.get("/Annots")
    if ann is None:
        return
    s, _, _, _, e, f = m
    bx0, by0, bx1, by1 = hedef_bbox
    for a in list(ann):
        if a.objgen in tasinanlar:
            continue
        try:
            r = [float(v) for v in a.Rect]
        except Exception:
            continue
        x0, x1 = sorted((r[0], r[2]))
        y0, y1 = sorted((r[1], r[3]))
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if not (bx0 <= cx <= bx1 and by0 <= cy <= by1):
            continue
        a.Rect = pikepdf.Array([x0 * s + e, y0 * s + f, x1 * s + e, y1 * s + f])
        if "/QuadPoints" in a:
            del a["/QuadPoints"]
        a.P = yeni.obj
        if "/Annots" not in yeni.obj:
            yeni.obj.Annots = pikepdf.Array([])
        yeni.obj.Annots.append(a)
        tasinanlar.add(a.objgen)


class _CiktiSayfasi:
    """Yatay çıktı sayfası; kaynak sayfa parçaları yerleştirilir."""

    def __init__(self, pdf: pikepdf.Pdf, w: float, h: float):
        self.pdf = pdf
        self.obj = pdf.make_indirect(pikepdf.Dictionary(
            Type=pikepdf.Name.Page,
            MediaBox=pikepdf.Array([0, 0, w, h]),
            Resources=pikepdf.Dictionary(),
        ))
        self.page = pikepdf.Page(self.obj)
        self.xobj = pikepdf.Dictionary()
        self.akis: list[str] = []

    def parca_koy(self, s: _Sayfa, bbox_pt, olcek, e, f, tasinanlar: set) -> None:
        """Kaynak sayfanın bbox_pt bölgesini (olcek, e, f) dönüşümüyle yerleştirir."""
        if s.kare is None:
            s.kare = self.pdf.make_indirect(s.kaynak.as_form_xobject())
        ad = f"P{len(self.akis)}"
        # İnce sarmalayıcı: sayfa içeriği tekrar yazılmaz, yalnız kırpma kutusu farklı olur
        sar = self.pdf.make_stream(b"/K Do")
        sar.Type = pikepdf.Name.XObject
        sar.Subtype = pikepdf.Name.Form
        sar.BBox = pikepdf.Array([float(v) for v in bbox_pt])
        sar.Resources = pikepdf.Dictionary(XObject=pikepdf.Dictionary(K=s.kare))
        self.xobj[f"/{ad}"] = self.pdf.make_indirect(sar)
        self.akis.append("q {:.5f} 0 0 {:.5f} {:.4f} {:.4f} cm /{} Do Q".format(olcek, olcek, e, f, ad))
        _annot_tasi(s.kaynak, self.page, bbox_pt, [olcek, 0, 0, olcek, e, f], tasinanlar)

    def bitir(self) -> pikepdf.Page:
        self.obj.Resources = pikepdf.Dictionary(XObject=self.xobj)
        self.obj.Contents = self.pdf.make_stream("\n".join(self.akis).encode("ascii"))
        return self.page


def _akis_planla(grup, o, sutun_h, son_kap=None, son_baslangic=None):
    """Ardışık dikey sayfaların içeriğini sütunlara dizer (çizim yapmadan).

    Döner: ([(sayfa, p_ust, p_alt, sutun_no, sutundaki_y_pt, yukseklik_pt)], sutun_sayisi)
    son_baslangic'tan itibaren sütun yüksekliği son_kap ile sınırlanır (dengeli son sayfa için).
    """
    yerler = []
    kolon = 0
    kul = 0.0

    def kap():
        return son_kap if (son_baslangic is not None and kolon >= son_baslangic) else sutun_h

    for gi, s in enumerate(grup):
        if gi > 0 and kul > 0:
            kul += _PARCA_ARASI
        ust = s.ust
        while ust < s.alt:
            kalan_px = int((kap() - kul) / o / s.ky)
            if kalan_px < max(12, int(40 / o / s.ky)):
                kolon += 1
                kul = 0.0
                continue
            if s.alt - ust <= kalan_px:
                bit, sonraki = s.alt, s.alt
            else:
                kes = _kesim_bul(s, ust, ust + kalan_px)
                if kul > 0 and (kes - ust) / max(kalan_px, 1) < 0.25:
                    kolon += 1
                    kul = 0.0
                    continue
                bit = max(_son_dolu(s, kes, ust), ust + 1)
                sonraki = max(_ilk_dolu(s, kes, s.alt), ust + 1)
            pay_px = int(2 / s.ky)
            p_ust = max(0, ust - pay_px) if ust > s.ust else ust
            p_alt = min(bit + pay_px, s.alt) if bit < s.alt else bit
            h_pt = (p_alt - p_ust) * s.ky * o
            yerler.append((s, p_ust, p_alt, kolon, kul, h_pt))
            kul += h_pt
            if bit >= s.alt or sonraki >= s.alt:
                break
            ust = sonraki
            kolon += 1
            kul = 0.0
    return yerler, (yerler[-1][3] + 1 if yerler else 0)


def _dengeli_planla(grup, o, sutun_h):
    """Akışı planlar; son sayfada yalnız sol sütun doluysa (ve yeterince uzunsa) iki sütuna dengeler."""
    yerler, n = _akis_planla(grup, o, sutun_h)
    if n % 2 == 1:
        son = [y for y in yerler if y[3] == n - 1]
        L = sum(y[5] for y in son)
        if L >= 0.3 * sutun_h:
            kap = L / 2 + 15
            while kap < sutun_h:
                y2, n2 = _akis_planla(grup, o, sutun_h, son_kap=kap, son_baslangic=n - 1)
                if n2 == n + 1:
                    return y2, n2
                kap += 15
    return yerler, n


def yatay_duzene_cevir(
    giris_yolu: str,
    cikis_yolu: str,
    mod: str = "auto",
    sifre: Optional[str] = None,
) -> dict:
    """Dikey sayfaları yatay düzene çevirir.

    Döner: {"sayfa": kaynak sayfa sayısı, "cikis_sayfa": n, "degisen": n, "bos_sayfa": n,
            "moda_gore": [sayfa başına 'fit'|'split'|'ayni'|'bos']}
    """
    if mod not in _MOD:
        raise YatayDuzenHatasi("Mod 'fit', 'split' veya 'auto' olmalıdır.")
    try:
        pdf = pikepdf.open(giris_yolu, password=sifre or "")
    except pikepdf.PasswordError as exc:
        raise YatayDuzenHatasi("PDF parola korumalı veya parola hatalı.") from exc

    with open(giris_yolu, "rb") as fh:
        veri = fh.read()
    pdfi = pdfium.PdfDocument(veri, password=sifre or None)

    kaynaklar = list(pdf.pages)
    sonuc = {"sayfa": len(kaynaklar), "cikis_sayfa": 0, "degisen": 0, "bos_sayfa": 0, "moda_gore": []}

    try:
        bilgi = [_sayfa_analiz(pdfi, i, k) for i, k in enumerate(kaynaklar)]

        karar: list[str] = []
        for s in bilgi:
            if s is None:
                karar.append("bos")
            elif s.satir is None:
                karar.append("ayni")
            elif mod == "auto":
                karar.append("fit" if s.genislik >= s.yukseklik * 0.95 else "split")
            else:
                karar.append(mod)
        sonuc["moda_gore"] = list(karar)
        sonuc["bos_sayfa"] = karar.count("bos")

        ref = next((s for s, k in zip(bilgi, karar) if k in ("fit", "split")), None)
        if ref is None:
            pdf.save(cikis_yolu)
            sonuc["cikis_sayfa"] = len(kaynaklar)
            return sonuc
        yw = ref.bb[3] - ref.bb[1]   # yeni genişlik = eski yükseklik
        yh = ref.bb[2] - ref.bb[0]

        # Ortak sol-sağ çerçeve: tüm sayfalar aynı kenara hizalanır (başlık olan sayfa
        # ile yalnız tablo olan sayfa birbirine göre kaymaz)
        cerceve = [s for s, k in zip(bilgi, karar) if k in ("fit", "split")]
        gx0 = min(s.x0 for s in cerceve)
        gx1 = max(s.x1 for s in cerceve)
        for s in cerceve:
            s.x0, s.x1 = gx0, gx1

        # Belge çapında tek ölçek (sayfadan sayfaya yazı boyutu oynamaz)
        sutun_w = (yw - 2 * _KENAR - _SUTUN_ARASI) / 2.0
        sutun_h = yh - 2 * _KENAR
        fit_olcek = None
        for s, k in zip(bilgi, karar):
            if k == "fit":
                o = min((yw - 2 * _KENAR) / s.genislik, sutun_h / s.yukseklik)
                fit_olcek = o if fit_olcek is None else min(fit_olcek, o)
        split_maks_w = max((s.genislik for s, k in zip(bilgi, karar) if k == "split"), default=None)
        split_olcek = min(1.0, sutun_w / split_maks_w) if split_maks_w else None

        siralama: list[pikepdf.Page] = []
        tasinanlar: set = set()
        grup: list[_Sayfa] = []

        def grubu_isle():
            if not grup:
                return
            yerler, n = _dengeli_planla(grup, split_olcek, sutun_h)
            sayfalar: dict[int, _CiktiSayfasi] = {}
            for (s, p_ust, p_alt, kolon_no, y_pt, h_pt) in yerler:
                sn, kol = divmod(kolon_no, 2)
                if sn not in sayfalar:
                    sayfalar[sn] = _CiktiSayfasi(pdf, yw, yh)
                o = split_olcek
                bbox = (s.x0, s.y_pt(p_alt), s.x1, s.y_pt(p_ust))
                sutun_x = _KENAR if kol == 0 else yw - _KENAR - sutun_w
                e = sutun_x - s.x0 * o
                f = (yh - _KENAR - y_pt - h_pt) - bbox[1] * o
                sayfalar[sn].parca_koy(s, bbox, o, e, f, tasinanlar)
            for sn in sorted(sayfalar):
                siralama.append(sayfalar[sn].bitir())
            sonuc["degisen"] += len(grup)
            grup.clear()

        for s, k, kaynak in zip(bilgi, karar, kaynaklar):
            if k == "split":
                grup.append(s)
                continue
            grubu_isle()
            if k in ("ayni", "bos"):
                siralama.append(kaynak)
                continue
            # fit
            cur = _CiktiSayfasi(pdf, yw, yh)
            o = fit_olcek
            bbox = (s.x0, s.y_pt(s.alt), s.x1, s.y_pt(s.ust))
            ox = _KENAR + ((yw - 2 * _KENAR) - s.genislik * o) / 2.0
            e = ox - s.x0 * o
            f = (yh - _KENAR - s.yukseklik * o) - bbox[1] * o
            cur.parca_koy(s, bbox, o, e, f, tasinanlar)
            siralama.append(cur.bitir())
            sonuc["degisen"] += 1
        grubu_isle()

        while len(pdf.pages):
            del pdf.pages[0]
        for p in siralama:
            pdf.pages.append(p)
        sonuc["cikis_sayfa"] = len(siralama)
        pdf.save(cikis_yolu, linearize=False, compress_streams=True)
    finally:
        pdfi.close()
        pdf.close()
    return sonuc
