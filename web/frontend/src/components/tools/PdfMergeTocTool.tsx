/**
 * PDF BİRLEŞTİR + TIKLANABİLİR İÇİNDEKİLER — dosyaları gruplara ayır, sırala, başlıklarını düzenle,
 * tek PDF'de içindekiler sayfası + yer imleriyle indir.
 *
 * Her şey cihazda yapılır (pdf-lib + pdf.js); dosyalar sunucuya gitmez.
 * Birleştirme zaten en az 2 dosya ister; bu yüzden tek dosyada düğme kapalıdır.
 *
 * Gruplama: kullanıcı «FATURALAR», «SÖZLEŞMELER» gibi gruplar (ve altlarında alt başlıklar) açar,
 * her PDF'i bir gruba atar. Grup varsa gruplanmamış PDF kalamaz (düğme o PDF'e götürür).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, ArrowDown, ArrowUp, FileText, GripVertical, ListTree, Loader2, Pencil, Plus, Trash2,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { MemberGateModal } from "../common/MemberGateModal";
import { PdfThumbError, renderPdfPage } from "../../lib/pdfThumbs";
import {
  type TocSub, readOutline, MAX_SUBS, MAX_GROUPS,
  TOC_DEFAULT_OUTPUT, TOC_MAX_FILES, TOC_MAX_FILE_BYTES, TocFileError, defaultTitle, mergeWithToc,
} from "../../lib/pdfToc";
import { type TocGroup, MAX_GROUP_NAME, normalizeTr, orderByGroups, suggestGroup, ungroupedItems } from "../../lib/tocGroups";

/** Kayıt gerekli mi? Karar verilince tek yerden değişir (katalogdaki free/account bayrağıyla birlikte). */
const KAYIT_GEREKLI = true;

/** İçindekiler sayfasında kullanılabilen yazı tipleri (hepsi Türkçe karakterli, cihazdan yüklenir). */
const YAZI_TIPLERI = [
  { id: "roboto", dosya: "/fonts/Roboto", tr: "Sade modern (Roboto)", en: "Clean modern (Roboto)" },
  { id: "arial", dosya: "/fonts/cv/LiberationSans", tr: "Arial tarzı", en: "Arial style" },
  { id: "times", dosya: "/fonts/cv/LiberationSerif", tr: "Times tarzı (resmî belge)", en: "Times style (formal)" },
  { id: "calibri", dosya: "/fonts/cv/Carlito", tr: "Calibri tarzı", en: "Calibri style" },
  { id: "cambria", dosya: "/fonts/cv/Caladea", tr: "Cambria tarzı", en: "Cambria style" },
  { id: "georgia", dosya: "/fonts/cv/Gelasio", tr: "Georgia tarzı", en: "Georgia style" },
  { id: "lato", dosya: "/fonts/toc/Lato", tr: "Lato (yumuşak, modern)", en: "Lato (soft, modern)" },
  { id: "ptsans", dosya: "/fonts/toc/PTSans", tr: "PT Sans (okunaklı)", en: "PT Sans (readable)" },
  { id: "ptserif", dosya: "/fonts/toc/PTSerif", tr: "PT Serif (kurumsal, kitap)", en: "PT Serif (corporate, book)" },
  { id: "fira", dosya: "/fonts/toc/FiraSans", tr: "Fira Sans (teknik, net)", en: "Fira Sans (technical, crisp)" },
  { id: "source", dosya: "/fonts/toc/SourceSans", tr: "Source Sans (sade, dar)", en: "Source Sans (plain, narrow)" },
  { id: "mono", dosya: "/fonts/toc/LiberationMono", tr: "Daktilo tarzı (Courier)", en: "Typewriter style (Courier)" },
] as const;

const SAKLA = "pdfplatform.toc.gruplar.v1";

const T = {
  tr: {
    hint: "Birleştirmek istediğin PDF'leri seç (en az 2, en çok 20).",
    order: "Sırayı sürükleyerek ya da oklarla değiştir. Bir PDF'i grubun başlığına sürükleyerek o gruba da ekleyebilirsin.",
    az: "A-Z sırala", pages: "sayfa", up: "Yukarı taşı", down: "Aşağı taşı", remove: "Kaldır", titleLabel: "Bölüm başlığı",
    encrypted: "Bu dosya şifreli. Lütfen şifresini kaldırıp tekrar yükleyin.",
    broken: "Bu dosya okunamadı (bozuk olabilir). Birleştirmeye dahil edilmeyecek.",
    tooBig: "Bu dosya 50 MB'dan büyük, eklenmedi.",
    tooMany: "En fazla 20 dosya ekleyebilirsin; fazlası eklenmedi.",
    subsTitle: "PDF'in içindeki başlıklar", subsAdd: "Başlık ekle", subsTitleLabel: "Başlık", subsPage: "Sayfa", subsImport: "Dosyanın kendi yer imlerini al", subsNone: "Henüz başlık yok.", subsHint: "Bu başlıklar içindekilerde bölümün altında görünür; tıklanınca o sayfaya gider.",
    needTwo: "Birleştirmek için en az 2 geçerli PDF gerekli.",
    settings: "AYARLAR", heading: "Sayfa başlığı", headingDefault: "İçindekiler",
    numbering: "Bölümleri numaralandır (1., 2., 3. …)", footer: "Tüm sayfalara «Sayfa 3 / 42» alt bilgisi ekle",
    back: "Her bölümün başına «İçindekilere dön» bağlantısı ekle",
    separators: "Her grubun önüne, grubun adını yazan bir ayırıcı sayfa ekle (grup varsa)",
    outName: "Dosya adı", fontLabel: "Yazı tipi",
    addGroup: "Grup ekle", groupHint: "FATURALAR, SÖZLEŞMELER gibi gruplar aç ve her PDF'i bir gruba ata. İstersen grupların altına alt başlık (İnternet, Telefon gibi) da ekleyebilirsin.",
    restore: "Önceki gruplarımı getir", restoreNote: "Bu cihazda en son kullandığın gruplar:",
    ungrouped: "Gruplanmamış", ungroupedWarn: "Gruplanmamış PDF", ungroupedMsg: "Önce bu PDF'leri bir gruba ata (ya da grupları sil).",
    noGroup: "Gruplanmamış", pickGroup: "Grup", pickSub: "Alt başlık", noSub: "Alt başlık yok",
    newGroup: "＋ Yeni grup ekle…", newSub: "＋ Yeni alt başlık ekle…",
    addSub: "Alt başlık ekle", rename: "Adını değiştir", deleteGroup: "Grubu sil (PDF'ler silinmez)", deleteSub: "Alt başlığı sil (PDF'ler grupta kalır)",
    emptyGroup: "Bu grupta PDF yok; içindekilere eklenmez.",
    dlgGroup: "Yeni grup", dlgSub: "Yeni alt başlık", dlgRenameG: "Grubun adı", dlgRenameS: "Alt başlığın adı",
    dlgPh: "Ad yaz (ör. FATURALAR)", dlgPhSub: "Ad yaz (ör. İnternet)", dlgOk: "Ekle", dlgSave: "Kaydet", dlgCancel: "Vazgeç",
    dlgMax: `En fazla ${MAX_GROUPS} grup açabilirsin.`,
    selected: "seçili", assignTo: "Seçilenleri ata:", clearSel: "Seçimi kaldır", selectAll: "Hepsini seç",
    suggest: "Öneri:", accept: "Kabul et",
    build: "Birleştir ve içindekiler ekle", working: "Hazırlanıyor…", failed: "Birleştirme başarısız oldu. Dosyalardan biri korumalı ya da bozuk olabilir.",
    fileErr: "Hata:", addMore: "Dosya ekle", clearAll: "Tümünü sil", groupsWord: "grup",
    onDevice: "Dosyaların cihazından çıkmaz.", sub: "bölüm", pageWord: "Sayfa", continued: "(devam)", backLabel: "İçindekilere dön",
    reading: "Okunuyor…", dragRow: "Sürükle",
  },
  en: {
    hint: "Choose the PDFs to merge (at least 2, at most 20).",
    order: "Drag or use the arrows to reorder. Drag a PDF onto a group heading to add it to that group.",
    az: "Sort A-Z", pages: "pages", up: "Move up", down: "Move down", remove: "Remove", titleLabel: "Section title",
    encrypted: "This file is password-protected. Remove the password and upload it again.",
    broken: "This file could not be read (it may be corrupt). It will not be merged.",
    tooBig: "This file is larger than 50 MB and was not added.",
    tooMany: "You can add at most 20 files; the rest were not added.",
    subsTitle: "Headings inside the PDF", subsAdd: "Add heading", subsTitleLabel: "Heading", subsPage: "Page", subsImport: "Use the file's own bookmarks", subsNone: "No headings yet.", subsHint: "These headings appear under the section in the contents; a click jumps to that page.",
    needTwo: "At least 2 valid PDFs are needed to merge.",
    settings: "SETTINGS", heading: "Page heading", headingDefault: "Contents",
    numbering: "Number the sections (1., 2., 3. …)", footer: "Add a “Page 3 / 42” footer to every page",
    back: "Add a “Back to contents” link at the start of each section",
    separators: "Insert a divider page with the group name before each group (if groups exist)",
    outName: "File name", fontLabel: "Font",
    addGroup: "Add group", groupHint: "Create groups such as INVOICES or CONTRACTS and assign each PDF to one. You can add sub-headings (Internet, Phone …) under a group too.",
    restore: "Bring back my previous groups", restoreNote: "Groups you last used on this device:",
    ungrouped: "Ungrouped", ungroupedWarn: "Ungrouped PDF", ungroupedMsg: "Assign these PDFs to a group first (or delete the groups).",
    noGroup: "Ungrouped", pickGroup: "Group", pickSub: "Sub-heading", noSub: "No sub-heading",
    newGroup: "＋ Add new group…", newSub: "＋ Add new sub-heading…",
    addSub: "Add sub-heading", rename: "Rename", deleteGroup: "Delete group (PDFs are kept)", deleteSub: "Delete sub-heading (PDFs stay in the group)",
    emptyGroup: "No PDFs in this group; it is left out of the contents.",
    dlgGroup: "New group", dlgSub: "New sub-heading", dlgRenameG: "Group name", dlgRenameS: "Sub-heading name",
    dlgPh: "Type a name (e.g. INVOICES)", dlgPhSub: "Type a name (e.g. Internet)", dlgOk: "Add", dlgSave: "Save", dlgCancel: "Cancel",
    dlgMax: `You can create at most ${MAX_GROUPS} groups.`,
    selected: "selected", assignTo: "Assign selected to:", clearSel: "Clear selection", selectAll: "Select all",
    suggest: "Suggestion:", accept: "Accept",
    build: "Merge and add contents", working: "Working…", failed: "Merge failed. One of the files may be protected or corrupt.",
    fileErr: "Error:", addMore: "Add files", clearAll: "Clear all", groupsWord: "groups",
    onDevice: "Your files never leave your device.", sub: "sections", pageWord: "Page", continued: "(cont.)", backLabel: "Back to contents",
    reading: "Reading…", dragRow: "Drag",
  },
} as const;

type Item = {
  id: number;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  thumb: string | null;
  title: string;
  error: "encrypted" | "broken" | null;
  subs: TocSub[];
  outline: TocSub[];
  open: boolean;
  gid: number | null;
  sid: number | null;
};

type Dlg = {
  mode: "group" | "sub" | "renameG" | "renameS";
  gid?: number;
  sid?: number;
  ids: number[];
  ad: string;
  hata?: string;
};

let sayac = 0;

export function PdfMergeTocTool({
  language,
  isSignedIn,
  onLogin,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
  isSignedIn?: boolean;
  onLogin?: () => void;
}) {
  const dil = language === "tr" ? "tr" : "en";
  const t = T[dil];
  const { describesTool } = useToolPageContext();
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<TocGroup[]>([]);
  const [secili, setSecili] = useState<number[]>([]);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [uyar, setUyar] = useState(false);
  const [kayitli, setKayitli] = useState<{ name: string; subs: string[] }[]>([]);
  const [notlar, setNotlar] = useState<string[]>([]);
  const [okuyor, setOkuyor] = useState(false);
  const [heading, setHeading] = useState<string>(t.headingDefault);
  const [yazi, setYazi] = useState<(typeof YAZI_TIPLERI)[number]["id"]>("roboto");
  const [yaziAcik, setYaziAcik] = useState(false);
  const [numbering, setNumbering] = useState(true);
  const [footer, setFooter] = useState(false);
  const [backLinks, setBackLinks] = useState(false);
  const [ayirici, setAyirici] = useState(false);
  const [outName, setOutName] = useState(TOC_DEFAULT_OUTPUT.replace(/\.pdf$/, ""));
  const [calisiyor, setCalisiyor] = useState(false);
  const [kapi, setKapi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ blob: Blob; ad: string; bolum: number; sayfa: number } | null>(null);
  const surukleniyor = useRef<number | null>(null);

  useEffect(() => {
    try {
      const ham = localStorage.getItem(SAKLA);
      if (ham) {
        const v = JSON.parse(ham) as { name: string; subs: string[] }[];
        if (Array.isArray(v)) setKayitli(v.filter((g) => typeof g.name === "string").slice(0, MAX_GROUPS));
      }
    } catch { /* kayıt okunamazsa sessizce geç */ }
  }, []);

  const ekle = async (files: File[]) => {
    setOkuyor(true);
    const yeniNotlar: string[] = [];
    const eklenecek: Item[] = [];
    let kalan = TOC_MAX_FILES - items.length;
    for (const f of files) {
      if (kalan <= 0) {
        yeniNotlar.push(t.tooMany);
        break;
      }
      if (f.size > TOC_MAX_FILE_BYTES) {
        yeniNotlar.push(`${f.name}: ${t.tooBig}`);
        continue;
      }
      kalan--;
      const bytes = new Uint8Array(await f.arrayBuffer());
      const item: Item = { id: ++sayac, name: f.name, bytes, pageCount: 0, thumb: null, title: defaultTitle(f.name), error: null, subs: [], outline: [], open: false, gid: null, sid: null };
      try {
        const th = await renderPdfPage(bytes, 0, 140);
        item.pageCount = th.pageCount;
        item.thumb = th.dataUrl;
        item.outline = await readOutline(bytes);
      } catch (e) {
        item.error = e instanceof PdfThumbError && e.kind === "encrypted" ? "encrypted" : "broken";
      }
      eklenecek.push(item);
    }
    setItems((m) => [...m, ...eklenecek]);
    setNotlar(yeniNotlar);
    setOkuyor(false);
  };

  // ── Gruplar ────────────────────────────────────────────────────────────────
  const ata = (ids: number[], gid: number | null, sid: number | null) =>
    setItems((m) => m.map((x) => (ids.includes(x.id) ? { ...x, gid, sid } : x)));

  const dlgAc = (mode: Dlg["mode"], ids: number[], extra: Partial<Dlg> = {}) => setDlg({ mode, ids, ad: "", ...extra });

  const dlgKaydet = () => {
    if (!dlg) return;
    const ad = dlg.ad.trim().slice(0, MAX_GROUP_NAME);
    if (!ad) return;
    const ayni = (a: string, b: string) => normalizeTr(a) === normalizeTr(b);
    if (dlg.mode === "group") {
      const var_ = groups.find((g) => ayni(g.name, ad));
      if (var_) { ata(dlg.ids, var_.id, null); setDlg(null); return; }
      if (groups.length >= MAX_GROUPS) { setDlg({ ...dlg, hata: t.dlgMax }); return; }
      const id = ++sayac;
      setGroups((m) => [...m, { id, name: ad, subs: [] }]);
      if (dlg.ids.length) ata(dlg.ids, id, null);
    } else if (dlg.mode === "sub") {
      const g = groups.find((x) => x.id === dlg.gid);
      if (!g) { setDlg(null); return; }
      const var_ = g.subs.find((s) => ayni(s.name, ad));
      const sid = var_ ? var_.id : ++sayac;
      if (!var_) setGroups((m) => m.map((x) => (x.id === g.id ? { ...x, subs: [...x.subs, { id: sid, name: ad }] } : x)));
      if (dlg.ids.length) ata(dlg.ids, g.id, sid);
    } else if (dlg.mode === "renameG") {
      setGroups((m) => m.map((x) => (x.id === dlg.gid ? { ...x, name: ad } : x)));
    } else {
      setGroups((m) => m.map((x) => (x.id === dlg.gid ? { ...x, subs: x.subs.map((s) => (s.id === dlg.sid ? { ...s, name: ad } : s)) } : x)));
    }
    setDlg(null);
  };

  const grupSil = (gid: number) => {
    setGroups((m) => m.filter((g) => g.id !== gid));
    setItems((m) => m.map((x) => (x.gid === gid ? { ...x, gid: null, sid: null } : x)));
  };
  const altSil = (gid: number, sid: number) => {
    setGroups((m) => m.map((g) => (g.id === gid ? { ...g, subs: g.subs.filter((s) => s.id !== sid) } : g)));
    setItems((m) => m.map((x) => (x.sid === sid ? { ...x, sid: null } : x)));
  };
  const grupTasi = (gid: number, d: -1 | 1) =>
    setGroups((m) => {
      const i = m.findIndex((g) => g.id === gid);
      const j = i + d;
      if (i < 0 || j < 0 || j >= m.length) return m;
      const c = [...m];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  const bolmeAz = (gid: number | null, sid: number | null) =>
    setItems((m) => {
      const yer = m.map((x, i) => (x.gid === gid && x.sid === sid ? i : -1)).filter((i) => i >= 0);
      const sirali = yer.map((i) => m[i]!).sort((a, b) => a.title.localeCompare(b.title, dil, { numeric: true }));
      const c = [...m];
      yer.forEach((i, k) => { c[i] = sirali[k]!; });
      return c;
    });
  const getirKayitli = () => {
    const yeni: TocGroup[] = [];
    for (const k of kayitli) {
      if (groups.some((g) => normalizeTr(g.name) === normalizeTr(k.name))) continue;
      yeni.push({ id: ++sayac, name: k.name, subs: k.subs.map((s) => ({ id: ++sayac, name: s })) });
    }
    setGroups((m) => [...m, ...yeni].slice(0, MAX_GROUPS));
  };

  // ── Sıralama ───────────────────────────────────────────────────────────────
  const tasi = (id: number, d: -1 | 1) =>
    setItems((m) => {
      const it = m.find((x) => x.id === id);
      if (!it) return m;
      const kova = m.filter((x) => x.gid === it.gid && x.sid === it.sid);
      const k = kova.findIndex((x) => x.id === id);
      const hedef = kova[k + d];
      if (!hedef) return m;
      const i = m.indexOf(it);
      const j = m.indexOf(hedef);
      const c = [...m];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });

  /** Sürüklenen PDF(ler)i hedef satırın önüne (ya da grup başlığına → sona) taşır ve hedefin grubuna katar. */
  const birak = (hedef: { beforeId?: number; gid: number | null; sid: number | null }) => {
    const sid = surukleniyor.current;
    surukleniyor.current = null;
    if (sid === null) return;
    const tasinan = secili.includes(sid) ? secili : [sid];
    setItems((m) => {
      const alinan = m.filter((x) => tasinan.includes(x.id)).map((x) => ({ ...x, gid: hedef.gid, sid: hedef.sid }));
      const kalan = m.filter((x) => !tasinan.includes(x.id));
      let konum = kalan.length;
      if (hedef.beforeId !== undefined) {
        const k = kalan.findIndex((x) => x.id === hedef.beforeId);
        if (k >= 0) konum = k;
      }
      return [...kalan.slice(0, konum), ...alinan, ...kalan.slice(konum)];
    });
  };

  const gecerli = items.filter((i) => !i.error);
  const toplamSayfa = gecerli.reduce((n, i) => n + i.pageCount, 0);
  const gruplanmamis = ungroupedItems(gecerli, groups);

  // Uyarı, sorun giderilince kendiliğinden kapanır
  useEffect(() => {
    if (uyar && gruplanmamis.length === 0) setUyar(false);
  }, [uyar, gruplanmamis.length]);

  const birlestir = async () => {
    if (gecerli.length < 2) return;
    if (KAYIT_GEREKLI && !isSignedIn) {
      setKapi(true);
      return;
    }
    if (gruplanmamis.length > 0) {
      setUyar(true);
      const ilk = gruplanmamis[0]!.id;
      requestAnimationFrame(() => document.getElementById(`toc-satir-${ilk}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setCalisiyor(true);
    setHata(null);
    const sirali = orderByGroups(gecerli, groups);
    try {
      const dosya = (YAZI_TIPLERI.find((y) => y.id === yazi) ?? YAZI_TIPLERI[0]).dosya;
      const [fontBytes, boldBytes] = await Promise.all(
        ["Regular", "Bold"].map((a) =>
          fetch(`${dosya}-${a}.ttf`).then((r) => {
            if (!r.ok) throw new Error("font");
            return r.arrayBuffer();
          }).then((b) => new Uint8Array(b)),
        ),
      );
      const r = await mergeWithToc(
        sirali.map(({ item: i, group, subgroup }) => ({
          name: i.name, title: i.title.trim() || defaultTitle(i.name), bytes: i.bytes, subs: i.subs, group, subgroup,
        })),
        {
          heading: heading.trim() || t.headingDefault, continued: t.continued, numbering, pageFooter: footer,
          pageWord: t.pageWord, backLinks, backLabel: t.backLabel, fontBytes, boldBytes,
          separators: ayirici && groups.length > 0,
        },
      );
      const ad = (outName.trim().replace(/[\\/:*?"<>|]+/g, "") || TOC_DEFAULT_OUTPUT.replace(/\.pdf$/, "")) + ".pdf";
      try {
        if (groups.length) localStorage.setItem(SAKLA, JSON.stringify(groups.map((g) => ({ name: g.name, subs: g.subs.map((s) => s.name) }))));
      } catch { /* saklanamazsa önemli değil */ }
      setSonuc({
        blob: new Blob([r.bytes as unknown as BlobPart], { type: "application/pdf" }),
        ad,
        bolum: r.sections.length,
        sayfa: r.totalPages,
      });
    } catch (e) {
      if (e instanceof TocFileError) {
        const dosya = sirali[e.index]?.item.name ?? "";
        setHata(`${t.fileErr} ${dosya} — ${e.kind === "encrypted" ? t.encrypted : t.broken}`);
      } else setHata(t.failed);
    } finally {
      setCalisiyor(false);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        ratingToolSlug="pdf-birlestir-icindekiler"
        blob={sonuc.blob}
        filename={sonuc.ad}
        language={language}
        processedOnDevice
        subtitle={`${sonuc.bolum} ${t.sub} · ${sonuc.sayfa} ${t.pages}${dil === "tr" ? " (içindekiler dahil)" : " (contents included)"}`}
        onClose={() => setSonuc(null)}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full">
        <div className="tool-form">
          <WorkspaceUploadField
            toolId="pdf-birlestir-icindekiler"
            language={language}
            accept="application/pdf,.pdf"
            multiple
            note={t.hint}
            hideHeader={describesTool}
            onFiles={(f) => void ekle(f)}
          />
        </div>
        {okuyor && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.reading}
          </p>
        )}
      </div>
    );
  }

  const girdi = "w-full rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[13px] text-white placeholder:text-slate-500";
  const secim = `${girdi} bg-slate-900`;
  const ikon = "rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-30";
  const sayfaToplam = (l: Item[]) => l.reduce((n, i) => n + i.pageCount, 0);
  const secildiHepsi = items.length > 0 && secili.length === items.length;
  const secGrup = (() => {
    const s = items.filter((x) => secili.includes(x.id));
    const g = s[0]?.gid ?? null;
    return s.length && s.every((x) => x.gid === g) ? g : null;
  })();

  /** Grup/alt başlık açılır menüsü değişince. */
  const grupDegisti = (ids: number[], v: string) => {
    if (v === "__new") return dlgAc("group", ids);
    ata(ids, v ? Number(v.slice(1)) : null, null);
  };
  const altDegisti = (ids: number[], gid: number, v: string) => {
    if (v === "__new") return dlgAc("sub", ids, { gid });
    ata(ids, gid, v ? Number(v.slice(1)) : null);
  };

  const satir = (it: Item) => {
    const g = groups.find((x) => x.id === it.gid);
    const kirmizi = uyar && groups.length > 0 && !g && !it.error;
    const oneri = !it.error && groups.length > 0 ? suggestGroup(it.name, groups) : null;
    const oneriGoster = oneri && (it.gid === null || (oneri.gid === it.gid && oneri.sid !== null && it.sid === null));
    const oneriG = oneriGoster ? groups.find((x) => x.id === oneri!.gid) : undefined;
    const oneriS = oneriG && oneri!.sid !== null ? oneriG.subs.find((s) => s.id === oneri!.sid) : undefined;
    return (
      <li
        key={it.id}
        id={`toc-satir-${it.id}`}
        draggable
        onDragStart={() => { surukleniyor.current = it.id; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.stopPropagation(); birak({ beforeId: it.id, gid: it.gid, sid: it.sid }); }}
        className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white/[0.03] px-3 py-2.5 ${
          kirmizi ? "border-rose-500/70 bg-rose-500/[0.08] ring-1 ring-rose-500/40" : it.error ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/[0.08]"
        }`}
      >
        <input type="checkbox" className="h-4 w-4 shrink-0" checked={secili.includes(it.id)} aria-label={it.name}
          onChange={(e) => setSecili((m) => (e.target.checked ? [...m, it.id] : m.filter((x) => x !== it.id)))} />
        <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-400 sm:block" aria-label={t.dragRow} />
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${it.error ? "bg-amber-500/10 text-amber-300" : "bg-white/[0.06] text-cyan-300"}`}>
          {it.error ? <AlertTriangle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <input className={girdi} value={it.title} aria-label={`${t.titleLabel}: ${it.name}`} maxLength={120}
            onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))} />
          <p className="mt-1 truncate text-[11px] text-slate-500">
            {it.name}{it.pageCount ? ` · ${it.pageCount} ${t.pages}` : ""}
          </p>
          {it.error && (
            <p className="mt-0.5 flex items-start gap-1 text-[12px] text-rose-300" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {it.error === "encrypted" ? t.encrypted : t.broken}
            </p>
          )}
          {kirmizi && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-rose-300" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t.ungroupedWarn}
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center">
          <button type="button" onClick={() => tasi(it.id, -1)} aria-label={t.up} className={ikon}><ArrowUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => tasi(it.id, 1)} aria-label={t.down} className={ikon}><ArrowDown className="h-4 w-4" /></button>
        </span>
        <button type="button" onClick={() => { setItems((m) => m.filter((x) => x.id !== it.id)); setSecili((m) => m.filter((x) => x !== it.id)); }}
          aria-label={t.remove} className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>

        {!it.error && (
          <div className="basis-full border-t border-white/[0.06] pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 text-[12px] text-slate-400">{t.pickGroup}
                <select className={secim} style={{ colorScheme: "dark" }} value={g ? `g${g.id}` : ""} aria-label={`${t.pickGroup}: ${it.name}`}
                  onChange={(e) => grupDegisti([it.id], e.target.value)}>
                  <option value="">{t.noGroup}</option>
                  {groups.map((x) => <option key={x.id} value={`g${x.id}`}>{x.name}</option>)}
                  <option value="__new">{t.newGroup}</option>
                </select>
              </label>
              {g && (
                <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 text-[12px] text-slate-400">{t.pickSub}
                  <select className={secim} style={{ colorScheme: "dark" }} value={it.sid ? `s${it.sid}` : ""} aria-label={`${t.pickSub}: ${it.name}`}
                    onChange={(e) => altDegisti([it.id], g.id, e.target.value)}>
                    <option value="">{t.noSub}</option>
                    {g.subs.map((s) => <option key={s.id} value={`s${s.id}`}>{s.name}</option>)}
                    <option value="__new">{t.newSub}</option>
                  </select>
                </label>
              )}
            </div>
            {oneriG && (
              <button type="button" onClick={() => ata([it.id], oneriG.id, oneriS ? oneriS.id : it.sid)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-500/20">
                {t.suggest} {oneriG.name}{oneriS ? ` › ${oneriS.name}` : ""} — {t.accept}
              </button>
            )}
            <button type="button" onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, open: !x.open } : x)))}
              aria-expanded={it.open} className="mt-2 block text-[12px] font-semibold text-cyan-300 hover:text-cyan-200">
              {t.subsTitle}{it.subs.length ? ` (${it.subs.length})` : ""} {it.open ? "▴" : "▾"}
            </button>
            {it.open && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-slate-500">{t.subsHint}</p>
                {it.subs.length === 0 && <p className="text-[12px] text-slate-400">{t.subsNone}</p>}
                {it.subs.map((s, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input className={girdi} value={s.title} maxLength={120} aria-label={t.subsTitleLabel}
                      onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.map((y, j) => (j === k ? { ...y, title: e.target.value } : y)) } : x)))} />
                    <label className="flex shrink-0 items-center gap-1 text-[12px] text-slate-400">{t.subsPage}
                      <input type="number" min={1} max={it.pageCount} value={s.page} aria-label={`${t.subsPage} (${s.title})`}
                        className="w-16 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-2 text-[13px] text-white"
                        onChange={(e) => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.map((y, j) => (j === k ? { ...y, page: Math.min(it.pageCount, Math.max(1, Number(e.target.value) || 1)) } : y)) } : x)))} />
                    </label>
                    <button type="button" aria-label={t.remove} onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.subs.filter((_, j) => j !== k) } : x)))}
                      className="rounded-md border border-white/15 p-1.5 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={it.subs.length >= MAX_SUBS}
                    onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: [...x.subs, { title: "", page: 1 }] } : x)))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-40">
                    <Plus className="h-3.5 w-3.5" /> {t.subsAdd}
                  </button>
                  {it.outline.length > 0 && (
                    <button type="button"
                      onClick={() => setItems((m) => m.map((x) => (x.id === it.id ? { ...x, subs: x.outline.slice(0, MAX_SUBS) } : x)))}
                      className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-500/20">
                      {t.subsImport} ({it.outline.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  const liste = (l: Item[]) => <ul className="space-y-2">{l.map(satir)}</ul>;

  const grupBasligi = (g: TocGroup, k: number) => {
    const ici = items.filter((x) => x.gid === g.id);
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.08] px-3 py-2.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.stopPropagation(); birak({ gid: g.id, sid: null }); }}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200"><ListTree className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-white">{g.name}</p>
          <p className="text-[11px] text-slate-400">{ici.length} {dil === "tr" ? "dosya" : "files"} · {sayfaToplam(ici)} {t.pages}</p>
        </div>
        <button type="button" onClick={() => dlgAc("sub", [], { gid: g.id })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-cyan-200 hover:bg-cyan-500/10"><Plus className="h-3.5 w-3.5" />{t.addSub}</button>
        <button type="button" onClick={() => bolmeAz(g.id, null)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.08]">A-Z</button>
        <button type="button" onClick={() => dlgAc("renameG", [], { gid: g.id, ad: g.name })} aria-label={`${t.rename}: ${g.name}`} className={ikon}><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={() => grupTasi(g.id, -1)} disabled={k === 0} aria-label={t.up} className={ikon}><ArrowUp className="h-4 w-4" /></button>
        <button type="button" onClick={() => grupTasi(g.id, 1)} disabled={k === groups.length - 1} aria-label={t.down} className={ikon}><ArrowDown className="h-4 w-4" /></button>
        <button type="button" onClick={() => grupSil(g.id)} aria-label={`${t.deleteGroup}: ${g.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
      </div>
    );
  };

  const altBasligi = (g: TocGroup, s: { id: number; name: string }) => {
    const ici = items.filter((x) => x.gid === g.id && x.sid === s.id);
    return (
      <div
        className="ml-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.stopPropagation(); birak({ gid: g.id, sid: s.id }); }}
      >
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-100">↳ {s.name}
          <span className="ml-2 text-[11px] font-normal text-slate-400">{ici.length} · {sayfaToplam(ici)} {t.pages}</span></p>
        <button type="button" onClick={() => bolmeAz(g.id, s.id)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.08]">A-Z</button>
        <button type="button" onClick={() => dlgAc("renameS", [], { gid: g.id, sid: s.id, ad: s.name })} aria-label={`${t.rename}: ${s.name}`} className={ikon}><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => altSil(g.id, s.id)} aria-label={`${t.deleteSub}: ${s.name}`} className="rounded-md p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    );
  };

  const dlgBaslik = dlg ? { group: t.dlgGroup, sub: t.dlgSub, renameG: t.dlgRenameG, renameS: t.dlgRenameS }[dlg.mode] : "";

  return (
    <div className="w-full">
      <div className="mt-1 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="font-bold text-white">{items.length} {dil === "tr" ? "dosya" : "files"}</span>
            {toplamSayfa > 0 && <span className="text-slate-400">{toplamSayfa} {t.pages}</span>}
            {groups.length > 0 && <span className="text-slate-400">{groups.length} {t.groupsWord}</span>}
            <span className="text-slate-500">{items.length}/{TOC_MAX_FILES}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white">
              <input type="checkbox" className="h-3.5 w-3.5" checked={secildiHepsi} onChange={(e) => setSecili(e.target.checked ? items.map((x) => x.id) : [])} />
              {t.selectAll}
            </label>
            <button type="button" onClick={() => setItems((m) => [...m].sort((a, b) => a.title.localeCompare(b.title, dil, { numeric: true })))}
              className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">{t.az}</button>
            <label className="cursor-pointer rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              {t.addMore}
              <input type="file" accept="application/pdf,.pdf" multiple className="sr-only"
                onChange={(e) => { void ekle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={() => { setItems([]); setGroups([]); setSecili([]); setNotlar([]); setHata(null); setUyar(false); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />{t.clearAll}
            </button>
          </div>
        </div>
        <p className="mt-1.5 border-t border-white/[0.05] pt-1.5 text-[12px] text-slate-400">{t.order}</p>
      </div>

      {secili.length > 0 && createPortal(
        <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(52rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-indigo-400/50 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur">
          <span className="text-[13px] font-bold text-white">{secili.length} {t.selected}</span>
          <span className="text-[12px] text-slate-400">{t.assignTo}</span>
          <select className={`${secim} !w-auto min-w-[9rem]`} style={{ colorScheme: "dark" }} value={secGrup === null ? "" : `g${secGrup}`} aria-label={t.pickGroup}
            onChange={(e) => grupDegisti(secili, e.target.value)}>
            <option value="">{t.noGroup}</option>
            {groups.map((x) => <option key={x.id} value={`g${x.id}`}>{x.name}</option>)}
            <option value="__new">{t.newGroup}</option>
          </select>
          {secGrup !== null && (
            <select className={`${secim} !w-auto min-w-[9rem]`} style={{ colorScheme: "dark" }} defaultValue="" aria-label={t.pickSub}
              onChange={(e) => altDegisti(secili, secGrup, e.target.value)}>
              <option value="">{t.noSub}</option>
              {groups.find((x) => x.id === secGrup)?.subs.map((s) => <option key={s.id} value={`s${s.id}`}>{s.name}</option>)}
              <option value="__new">{t.newSub}</option>
            </select>
          )}
          <button type="button" onClick={() => setSecili([])} className="ml-auto rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.08]">{t.clearSel}</button>
        </div>,
        document.body,
      )}

      {groups.length === 0 ? (
        liste(items)
      ) : (
        <div className="space-y-4">
          {ungroupedItems(items, groups).length > 0 ? (
            <section aria-label={t.ungrouped} className="space-y-2">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${uyar ? "border-rose-500/70 bg-rose-500/10" : "border-white/10 bg-white/[0.03]"}`}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); birak({ gid: null, sid: null }); }}>
                <p className={`text-[13px] font-bold ${uyar ? "text-rose-200" : "text-slate-200"}`}>{t.ungrouped}
                  <span className="ml-2 text-[11px] font-normal text-slate-400">{ungroupedItems(items, groups).length}</span></p>
                {uyar && <p className="text-[12px] text-rose-200" role="alert">{t.ungroupedMsg}</p>}
              </div>
              {liste(ungroupedItems(items, groups))}
            </section>
          ) : null}
          {groups.map((g, k) => {
            const dogrudan = items.filter((x) => x.gid === g.id && (x.sid === null || !g.subs.some((s) => s.id === x.sid)));
            return (
              <section key={g.id} aria-label={g.name} className="space-y-2">
                {grupBasligi(g, k)}
                {items.every((x) => x.gid !== g.id) && <p className="px-1 text-[12px] text-slate-500">{t.emptyGroup}</p>}
                {dogrudan.length > 0 && <div className="ml-4">{liste(dogrudan)}</div>}
                {g.subs.map((s) => (
                  <div key={s.id} className="space-y-2">
                    {altBasligi(g, s)}
                    {items.some((x) => x.gid === g.id && x.sid === s.id) && (
                      <div className="ml-8">{liste(items.filter((x) => x.gid === g.id && x.sid === s.id))}</div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {okuyor && <p className="mt-2 flex items-center gap-2 text-[13px] text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" /> {t.reading}</p>}
      {notlar.map((n, k) => <p key={k} className="mt-1 text-[12px] text-amber-300" role="alert">{n}</p>)}

      <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[13px] font-semibold text-slate-100">{t.settings}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1 block text-[12px] text-slate-400">{t.heading}</span>
            <input className={girdi} value={heading} maxLength={60} onChange={(e) => setHeading(e.target.value)} /></label>
          <label><span className="mb-1 block text-[12px] text-slate-400">{t.outName}</span>
            <span className="flex items-center gap-1">
              <input className={girdi} value={outName} maxLength={80} onChange={(e) => setOutName(e.target.value)} />
              <span className="text-[13px] text-slate-400">.pdf</span>
            </span></label>
          <div className="sm:col-span-2" role="group" aria-label={t.fontLabel}>
            <style>{YAZI_TIPLERI.map((y) => `@font-face{font-family:'toc-${y.id}';src:url('${y.dosya}-Regular.ttf') format('truetype');font-display:swap;}`).join("")}</style>
            <span className="mb-1 block text-[12px] text-slate-400">{t.fontLabel}</span>
            <div className="relative">
              <button type="button" aria-haspopup="listbox" aria-expanded={yaziAcik} onClick={() => setYaziAcik((v) => !v)}
                className={`${girdi} flex items-center justify-between gap-2 text-left`}>
                <span style={{ fontFamily: `'toc-${yazi}', sans-serif`, fontSize: 16 }}>{YAZI_TIPLERI.find((y) => y.id === yazi)![dil]}</span>
                <span aria-hidden className="text-slate-400">{yaziAcik ? "▴" : "▾"}</span>
              </button>
              {yaziAcik && (
                <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-white/20 bg-slate-900 py-1 shadow-xl">
                  {YAZI_TIPLERI.map((y) => (
                    <li key={y.id} role="option" aria-selected={yazi === y.id}>
                      <button type="button" onClick={() => { setYazi(y.id); setYaziAcik(false); }}
                        className={`block w-full px-3 py-2 text-left text-[17px] text-white hover:bg-white/10 ${yazi === y.id ? "bg-cyan-500/20" : ""}`}
                        style={{ fontFamily: `'toc-${y.id}', sans-serif` }}>{y[dil]}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.05] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => dlgAc("group", [])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[13px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"><Plus className="h-4 w-4" />{t.addGroup}</button>
            {groups.length === 0 && kayitli.length > 0 && (
              <button type="button" onClick={getirKayitli}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                title={`${t.restoreNote} ${kayitli.map((k) => k.name).join(", ")}`}>{t.restore}</button>
            )}
          </div>
          <p className="mt-2 text-[12px] text-slate-400">{t.groupHint}</p>
        </div>
        <div className="mt-3 space-y-2">
          {([[numbering, setNumbering, t.numbering], [footer, setFooter, t.footer], [backLinks, setBackLinks, t.back], [ayirici, setAyirici, t.separators]] as const).map(([v, set, l]) => (
            <label key={l} className="flex items-start gap-2.5 text-sm text-slate-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v} onChange={(e) => set(e.target.checked)} /> {l}
            </label>
          ))}
        </div>
      </div>

      {gecerli.length < 2 && <p className="mt-3 text-[13px] text-amber-300" role="status">{t.needTwo}</p>}
      {uyar && gruplanmamis.length > 0 && <p className="mt-3 text-[13px] font-semibold text-rose-300" role="alert">{gruplanmamis.length} {t.ungroupedWarn} — {t.ungroupedMsg}</p>}
      {hata && <p className="mt-3 text-[13px] text-rose-300" role="alert">{hata}</p>}

      <button
        type="button"
        onClick={() => void birlestir()}
        disabled={gecerli.length < 2 || calisiyor}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-70 disabled:saturate-50"
      >
        {calisiyor ? <><Loader2 className="h-5 w-5 animate-spin" />{t.working}</> : <>{t.build} →</>}
      </button>
      <p className="mt-2 text-center text-[12px] text-slate-500">{t.onDevice}</p>

      {dlg && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={dlgBaslik}
          onClick={() => setDlg(null)}>
          <form className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); dlgKaydet(); }}>
            <p className="text-[15px] font-bold text-white">{dlgBaslik}</p>
            <input autoFocus className={`${girdi} mt-3`} value={dlg.ad} maxLength={MAX_GROUP_NAME}
              placeholder={dlg.mode === "sub" || dlg.mode === "renameS" ? t.dlgPhSub : t.dlgPh} aria-label={dlgBaslik}
              onChange={(e) => setDlg({ ...dlg, ad: e.target.value, hata: undefined })} />
            {dlg.hata && <p className="mt-2 text-[12px] text-rose-300" role="alert">{dlg.hata}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDlg(null)} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/[0.08]">{t.dlgCancel}</button>
              <button type="submit" disabled={!dlg.ad.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {dlg.mode === "renameG" || dlg.mode === "renameS" ? t.dlgSave : t.dlgOk}
              </button>
            </div>
          </form>
        </div>
      )}
      {kapi && !isSignedIn && (
        <MemberGateModal language={language} icon={<ListTree className="h-7 w-7" />} toolName={dil === "tr" ? "Birleştir + İçindekiler" : "Merge + Table of Contents"} onClose={() => setKapi(false)} onLogin={onLogin} />
      )}
    </div>
  );
}
