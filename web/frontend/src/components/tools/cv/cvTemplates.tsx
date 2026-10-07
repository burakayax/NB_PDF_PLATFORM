/**
 * CV ŞABLONLARI — altı yerleşim × farklı renk/yazı tipi/başlık biçimi.
 *
 * ÖNEMLİ KISIT: Şablonlar hem ekranda hem PDF'te AYNI DOM'dan üretilir (bkz. cvPdf.ts:
 * düzenlenmiş DOM'u gezip pdf-lib ile çizer). Bu yüzden yalnızca düz kutu, kenarlık,
 * arka plan rengi, yazı ve görsel kullanılır — gradyan, gölge, SVG, ::before yok.
 * Madde imi gibi süslemeler gerçek metin düğümüdür.
 *
 * A4 = 794×1123 CSS pikseli (96 dpi). Tüm boyutlar `em` olduğundan "yazı boyutu"
 * ayarı kökün font-size'ını değiştirerek her şeyi orantılı büyütür.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CvModel, CvPhoto, Fld } from "./cvModel";

export const PAGE_W = 794;
export const PAGE_H = 1123;

export type FontKey = "carlito" | "arial" | "caladea" | "gelasio" | "times";

export const FONT_CSS: Record<FontKey, string> = {
  carlito: "CvCarlito",
  arial: "CvArial",
  caladea: "CvCaladea",
  gelasio: "CvGelasio",
  times: "CvTimes",
};
export const FONT_FILE: Record<FontKey, string> = {
  carlito: "Carlito",
  arial: "LiberationSans",
  caladea: "Caladea",
  gelasio: "Gelasio",
  times: "LiberationSerif",
};
const BASE_PX: Record<FontKey, number> = { carlito: 14.6, arial: 12.8, caladea: 14.2, gelasio: 13.4, times: 14.6 };

export type HeadingStyle = "rule" | "bar" | "caps" | "dot" | "boxed";
export type SkillStyle = "bars" | "tags" | "plain";
export type PhotoShape = "circle" | "rounded" | "rect";
export type LayoutId = "single" | "sidebar" | "banner" | "timeline";

export type CvTheme = {
  font: FontKey;
  accent: string;
  text: string;
  muted: string;
  /** Açık ton (kutu/çizgi arka planı). */
  tint: string;
  heading: HeadingStyle;
  align: "left" | "center";
  photo: { shape: PhotoShape; w: number; h: number };
  skills: SkillStyle;
  /** sidebar/banner için */
  side?: { pos: "left" | "right"; bg: string; fg: string; muted: string; width: number };
  band?: { bg: string; fg: string; muted: string };
};

export type CvTemplate = {
  id: string;
  tr: string;
  en: string;
  descTr: string;
  descEn: string;
  layout: LayoutId;
  free: boolean;
  theme: CvTheme;
};

// ── Küçük yardımcılar ──────────────────────────────────────────────────────

const F = ({ f, style }: { f: Fld; style?: CSSProperties }) =>
  f ? (
    <span data-ghost={f.g ? "1" : undefined} style={style}>
      {f.t}
    </span>
  ) : null;

const photoCache = new Map<string, string>();
const imgCache = new Map<string, Promise<HTMLImageElement>>();

function loadImg(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("img"));
      i.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

/** Fotoğrafı kutuya "cover" olarak kırpar; şekle göre maskeler. 2× çözünürlük. */
export async function bakePhoto(p: CvPhoto, w: number, h: number, shape: PhotoShape): Promise<string> {
  const key = `${p.src.length}:${p.src.slice(-24)}|${p.zoom}|${p.x}|${p.y}|${w}x${h}|${shape}`;
  const hit = photoCache.get(key);
  if (hit) return hit;
  const img = await loadImg(p.src);
  const k = 3;
  const W = w * k, H = h * k;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const cover = Math.max(W / img.width, H / img.height) * Math.max(1, p.zoom);
  const dw = img.width * cover, dh = img.height * cover;
  const slackX = Math.max(0, dw - W), slackY = Math.max(0, dh - H);
  const dx = -slackX / 2 + (p.x * slackX) / 2;
  const dy = -slackY / 2 + (p.y * slackY) / 2;
  if (shape !== "rect") {
    ctx.beginPath();
    if (shape === "circle") ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
    else {
      const r = Math.min(W, H) * 0.12;
      ctx.roundRect(0, 0, W, H, r);
    }
    ctx.clip();
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  const url = shape === "rect" ? c.toDataURL("image/jpeg", 0.92) : c.toDataURL("image/png");
  photoCache.set(key, url);
  return url;
}

export function PhotoBox({ model, th, size, ring }: { model: CvModel; th: CvTheme; size?: { w: number; h: number }; ring?: string }) {
  const ph = model.photo;
  const w = size?.w ?? th.photo.w;
  const h = size?.h ?? th.photo.h;
  const shape = th.photo.shape;
  const data = ph?.data ?? null;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!data) {
      setUrl(null);
      return;
    }
    void bakePhoto(data, w, h, shape).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [data, w, h, shape]);
  if (!ph) return null;
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? `${Math.round(Math.min(w, h) * 0.12)}px` : 0;
  const frame: CSSProperties = { width: w, height: h, borderRadius: radius, flex: "none", boxSizing: "border-box", border: ring ? `3px solid ${ring}` : undefined };
  if (ph.ghost || !url) {
    return (
      <div data-cv-photo-ghost="1" style={{ ...frame, background: th.tint, display: "flex", alignItems: "center", justifyContent: "center", color: th.muted, fontSize: "0.8em", opacity: ph.ghost ? 0.9 : 0.4 }}>
        <span>{model.lang === "tr" ? "Fotoğraf" : "Photo"}</span>
      </div>
    );
  }
  return <img alt="" src={url} width={w} height={h} style={{ ...frame, objectFit: "cover", display: "block" }} />;
}

// ── Başlık / bölüm ─────────────────────────────────────────────────────────

function Heading({ title, th, onDark, dim, boxBg }: { title: string; th: CvTheme; onDark?: { fg: string; line: string }; dim?: boolean; boxBg?: string }) {
  const col = onDark?.fg ?? th.accent;
  const base: CSSProperties = { fontSize: "0.86em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.13em", margin: dim ? "16px 0 7px" : "20px 0 9px", color: col };
  let style: CSSProperties = base;
  let lead: ReactNode = null;
  switch (th.heading) {
    case "rule":
      style = { ...base, paddingBottom: 4, borderBottom: `1.5px solid ${onDark?.line ?? th.accent}` };
      break;
    case "bar":
      style = { ...base, borderLeft: `4px solid ${col}`, paddingLeft: 8, lineHeight: 1.25 };
      break;
    case "caps":
      style = { ...base, color: onDark?.fg ?? th.text, paddingBottom: 3, borderBottom: `1px solid ${onDark?.line ?? "#d4d8de"}` };
      break;
    case "dot":
      lead = <span style={{ display: "inline-block", width: 9, height: 9, background: col, marginRight: 8, verticalAlign: "baseline" }} />;
      break;
    case "boxed":
      style = { ...base, background: onDark ? "rgba(255,255,255,0.12)" : boxBg ?? th.tint, padding: "4px 9px", borderRadius: 3 };
      break;
  }
  return (
    <div data-keep="head" style={style}>
      {lead}
      <span>{title}</span>
    </div>
  );
}

function Section({ title, th, children, onDark, dim, boxBg }: { title: string; th: CvTheme; children: ReactNode; onDark?: { fg: string; line: string }; dim?: boolean; boxBg?: string }) {
  return (
    <div>
      <Heading title={title} th={th} onDark={onDark} dim={dim} boxBg={boxBg} />
      {children}
    </div>
  );
}

const Bullets = ({ items, gap = 2, color }: { items: { t: string; g: boolean }[]; gap?: number; color?: string }) => (
  <div style={{ marginTop: 3 }}>
    {items.map((b, i) => (
      <div key={i} data-keep="1" style={{ display: "flex", gap: 7, marginTop: gap, lineHeight: 1.38, color }}>
        <span style={{ flex: "none", width: 7 }}>•</span>
        <span data-ghost={b.g ? "1" : undefined} style={{ flex: 1 }}>{b.t}</span>
      </div>
    ))}
  </div>
);

// ── Bölüm içerikleri (yerleşimlerde ortak) ─────────────────────────────────

function ExperienceList({ m, th, timeline }: { m: CvModel; th: CvTheme; timeline?: boolean }) {
  return (
    <>
      {m.experience.map((e, i) => (
        <div
          key={i}
          data-keep="1"
          style={timeline ? { position: "relative", borderLeft: `2px solid ${th.tint}`, paddingLeft: 16, paddingBottom: 12, marginLeft: 4 } : { marginBottom: 11 }}
        >
          {timeline ? <span style={{ position: "absolute", left: -6, top: 4, width: 10, height: 10, borderRadius: "50%", background: th.accent }} /> : null}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <div style={{ fontWeight: 700, fontSize: "1.04em" }}><F f={e.role} /></div>
            {e.dates ? <div style={{ color: th.muted, fontSize: "0.9em", flex: "none", whiteSpace: "nowrap" }}><F f={e.dates} /></div> : null}
          </div>
          {e.company || e.location ? (
            <div style={{ color: th.accent, fontWeight: 600, fontSize: "0.96em", marginTop: 1 }}>
              <F f={e.company} />
              {e.company && e.location ? <span style={{ color: th.muted, fontWeight: 400 }}>{" · "}</span> : null}
              <F f={e.location} style={{ color: th.muted, fontWeight: 400 }} />
            </div>
          ) : null}
          <Bullets items={e.bullets} />
        </div>
      ))}
    </>
  );
}

function EducationList({ m, th, timeline }: { m: CvModel; th: CvTheme; timeline?: boolean }) {
  return (
    <>
      {m.education.map((e, i) => (
        <div
          key={i}
          data-keep="1"
          style={timeline ? { position: "relative", borderLeft: `2px solid ${th.tint}`, paddingLeft: 16, paddingBottom: 10, marginLeft: 4 } : { marginBottom: 9 }}
        >
          {timeline ? <span style={{ position: "absolute", left: -6, top: 4, width: 10, height: 10, borderRadius: "50%", background: th.accent }} /> : null}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <div style={{ fontWeight: 700 }}><F f={e.school} /></div>
            {e.dates ? <div style={{ color: th.muted, fontSize: "0.9em", flex: "none", whiteSpace: "nowrap" }}><F f={e.dates} /></div> : null}
          </div>
          {e.degree || e.location ? (
            <div style={{ color: th.muted, marginTop: 1 }}>
              <F f={e.degree} />
              {e.degree && e.location ? <span>{" · "}</span> : null}
              <F f={e.location} />
            </div>
          ) : null}
          {e.bullets.length ? <Bullets items={e.bullets} /> : null}
        </div>
      ))}
    </>
  );
}

function CertList({ m, th }: { m: CvModel; th: CvTheme }) {
  return (
    <>
      {m.certs.map((c, i) => (
        <div key={i} data-keep="1" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div>
            <span style={{ fontWeight: 600 }}><F f={c.name} /></span>
            {c.issuer ? <span style={{ color: th.muted }}>{" — "}<F f={c.issuer} /></span> : null}
          </div>
          {c.date ? <div style={{ color: th.muted, fontSize: "0.9em", flex: "none" }}><F f={c.date} /></div> : null}
        </div>
      ))}
    </>
  );
}

function ProjectList({ m, th }: { m: CvModel; th: CvTheme }) {
  return (
    <>
      {m.projects.map((p, i) => (
        <div key={i} data-keep="1" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>
            <F f={p.name} />
            {p.link ? <span style={{ color: th.accent, fontWeight: 400, fontSize: "0.9em" }}>{"  "}<F f={p.link} /></span> : null}
          </div>
          {p.desc ? <div style={{ lineHeight: 1.4, marginTop: 1 }}><F f={p.desc} /></div> : null}
        </div>
      ))}
    </>
  );
}

function ReferenceList({ m, th }: { m: CvModel; th: CvTheme }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px" }}>
      {m.references.map((r, i) => (
        <div key={i} data-keep="1" style={{ minWidth: 190 }}>
          <div style={{ fontWeight: 700 }}><F f={r.name} /></div>
          {r.role ? <div style={{ color: th.muted }}><F f={r.role} /></div> : null}
          {r.contact ? <div style={{ color: th.muted }}><F f={r.contact} /></div> : null}
        </div>
      ))}
    </div>
  );
}

function SkillBlock({ m, th, onDark }: { m: CvModel; th: CvTheme; onDark?: { fg: string; track: string; fill: string } }) {
  const style = th.skills;
  if (style === "tags") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {m.skills.map((s, i) => (
          <span key={i} data-keep="1" style={{ border: `1px solid ${onDark ? onDark.fill : th.accent}`, color: onDark?.fg ?? th.accent, borderRadius: 11, padding: "1px 9px", fontSize: "0.9em", lineHeight: 1.5 }}>
            <F f={s.name} />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div>
      {m.skills.map((s, i) => (
        <div key={i} data-keep="1" style={{ marginBottom: style === "bars" ? 7 : 3, color: onDark?.fg }}>
          <div><F f={s.name} /></div>
          {style === "bars" && s.level > 0 ? (
            <div style={{ height: 5, borderRadius: 3, background: onDark?.track ?? th.tint, marginTop: 3 }}>
              <div style={{ height: 5, borderRadius: 3, width: `${Math.min(100, s.level * 20)}%`, background: onDark?.fill ?? th.accent }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LanguageBlock({ m, th, fg, muted }: { m: CvModel; th: CvTheme; fg?: string; muted?: string }) {
  return (
    <div>
      {m.languages.map((l, i) => (
        <div key={i} data-keep="1" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, color: fg }}>
          <span style={{ fontWeight: 600 }}><F f={l.name} /></span>
          {l.level ? <span style={{ color: muted ?? th.muted, fontSize: "0.92em", textAlign: "right" }}><F f={l.level} /></span> : null}
        </div>
      ))}
    </div>
  );
}

type ContactRow = { label: string; f: Fld };
function contactRows(m: CvModel): ContactRow[] {
  const tr = m.lang === "tr";
  return [
    { label: tr ? "E-posta" : "Email", f: m.email },
    { label: tr ? "Telefon" : "Phone", f: m.phone },
    { label: tr ? "Adres" : "Location", f: m.city },
    { label: "Web", f: m.website },
    { label: "LinkedIn", f: m.linkedin },
    { label: m.labels.birth, f: m.birth },
    { label: m.labels.license, f: m.license },
  ].filter((r) => r.f);
}

function ContactStack({ m, fg, muted }: { m: CvModel; fg: string; muted: string }) {
  return (
    <div>
      {contactRows(m).map((r, i) => (
        <div key={i} data-keep="1" style={{ marginBottom: 7 }}>
          <div style={{ fontSize: "0.72em", textTransform: "uppercase", letterSpacing: "0.12em", color: muted, fontWeight: 700 }}>{r.label}</div>
          <div style={{ color: fg, wordBreak: "break-word", lineHeight: 1.3 }}><F f={r.f} /></div>
        </div>
      ))}
    </div>
  );
}

function ContactLine({ m, th, color, align }: { m: CvModel; th: CvTheme; color?: string; align?: "left" | "center" | "right" }) {
  const rows = contactRows(m).filter((r) => r.label !== m.labels.birth && r.label !== m.labels.license || r.f);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 0", justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", color: color ?? th.muted, fontSize: "0.94em", lineHeight: 1.5 }}>
      {rows.map((r, i) => (
        <span key={i} style={{ display: "inline-flex", marginRight: 18 }}>
          <F f={r.f} />
        </span>
      ))}
    </div>
  );
}

function InterestsBlock({ m, th, color }: { m: CvModel; th: CvTheme; color?: string }) {
  return (
    <div style={{ lineHeight: 1.45, color }}>
      {m.interests.map((it, i) => (
        <span key={i} data-keep="1">
          {i > 0 ? <span style={{ opacity: 0.6 }}>{"  •  "}</span> : null}
          <span data-ghost={it.g ? "1" : undefined}>{it.t}</span>
        </span>
      ))}
      {void th}
    </div>
  );
}

function NameBlock({ m, th, color, sub, big }: { m: CvModel; th: CvTheme; color?: string; sub?: string; big?: number }) {
  return (
    <div style={{ textAlign: th.align }}>
      <div style={{ fontSize: `${big ?? 2.35}em`, fontWeight: 800, lineHeight: 1.08, color: color ?? th.text, letterSpacing: "-0.01em" }}><F f={m.name} /></div>
      {m.title ? <div style={{ fontSize: "1.22em", color: sub ?? th.accent, fontWeight: 600, marginTop: 5 }}><F f={m.title} /></div> : null}
    </div>
  );
}

function SummaryBlock({ m, th }: { m: CvModel; th: CvTheme }) {
  if (!m.summary) return null;
  return (
    <Section title={m.labels.profile} th={th}>
      <div data-keep="1" style={{ lineHeight: 1.5 }}><F f={m.summary} /></div>
    </Section>
  );
}

/** Ana gövde bölümleri — yerleşimler hangilerini ana sütuna koyacağını seçer. */
function MainSections({ m, th, timeline, include }: { m: CvModel; th: CvTheme; timeline?: boolean; include: { skills?: boolean; languages?: boolean; interests?: boolean; contact?: boolean } }) {
  const L = m.labels;
  return (
    <>
      <SummaryBlock m={m} th={th} />
      {m.experience.length ? <Section title={L.experience} th={th}><ExperienceList m={m} th={th} timeline={timeline} /></Section> : null}
      {m.education.length ? <Section title={L.education} th={th}><EducationList m={m} th={th} timeline={timeline} /></Section> : null}
      {include.skills && m.skills.length ? <Section title={L.skills} th={th}><SkillBlock m={m} th={th} /></Section> : null}
      {include.languages && m.languages.length ? <Section title={L.languages} th={th}><LanguageBlock m={m} th={th} /></Section> : null}
      {m.certs.length ? <Section title={L.certs} th={th}><CertList m={m} th={th} /></Section> : null}
      {m.projects.length ? <Section title={L.projects} th={th}><ProjectList m={m} th={th} /></Section> : null}
      {include.interests && m.interests.length ? <Section title={L.interests} th={th}><InterestsBlock m={m} th={th} /></Section> : null}
      {m.references.length ? <Section title={L.references} th={th}><ReferenceList m={m} th={th} /></Section> : null}
    </>
  );
}

// ── Yerleşimler ────────────────────────────────────────────────────────────

function SingleLayout({ m, th, timeline }: { m: CvModel; th: CvTheme; timeline?: boolean }) {
  const center = th.align === "center";
  return (
    <div style={{ padding: "42px 48px 36px" }}>
      <div style={{ display: "flex", gap: 22, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <NameBlock m={m} th={th} />
          <div style={{ marginTop: 10 }}>
            <ContactLine m={m} th={th} align={center ? "center" : "left"} />
          </div>
        </div>
        {m.photo ? <PhotoBox model={m} th={th} /> : null}
      </div>
      <MainSections m={m} th={th} timeline={timeline} include={{ skills: true, languages: true, interests: true }} />
    </div>
  );
}

function SidebarLayout({ m, th }: { m: CvModel; th: CvTheme }) {
  const s = th.side!;
  const light = isLight(s.bg);
  const dark = light ? undefined : { fg: s.fg, line: "rgba(255,255,255,0.35)" };
  const boxBg = light ? "#ffffff" : undefined;
  const barDark = light ? undefined : { fg: s.fg, track: "rgba(255,255,255,0.25)", fill: s.fg };
  const L = m.labels;
  const sideEl = (
    <aside style={{ width: s.width, flex: "none", background: s.bg, color: s.fg, padding: "38px 22px 30px", boxSizing: "border-box" }}>
      {m.photo ? (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <PhotoBox model={m} th={th} size={{ w: th.photo.w, h: th.photo.h }} />
        </div>
      ) : null}
      {m.has.contact ? (
        <Section title={L.contact} th={th} onDark={dark} dim boxBg={boxBg}>
          <ContactStack m={m} fg={s.fg} muted={s.muted} />
        </Section>
      ) : null}
      {m.skills.length ? (
        <Section title={L.skills} th={th} onDark={dark} dim boxBg={boxBg}>
          <SkillBlock m={m} th={th} onDark={barDark} />
        </Section>
      ) : null}
      {m.languages.length ? (
        <Section title={L.languages} th={th} onDark={dark} dim boxBg={boxBg}>
          <LanguageBlock m={m} th={th} fg={s.fg} muted={s.muted} />
        </Section>
      ) : null}
      {m.interests.length ? (
        <Section title={L.interests} th={th} onDark={dark} dim boxBg={boxBg}>
          <InterestsBlock m={m} th={th} color={s.fg} />
        </Section>
      ) : null}
    </aside>
  );
  const mainEl = (
    <main style={{ flex: 1, minWidth: 0, padding: "42px 36px 36px", boxSizing: "border-box" }}>
      <NameBlock m={m} th={th} />
      <div style={{ height: 4, width: 56, background: th.accent, margin: "14px 0 2px" }} />
      <MainSections m={m} th={th} include={{}} />
    </main>
  );
  return (
    <div style={{ display: "flex", flexDirection: s.pos === "left" ? "row" : "row-reverse", alignItems: "stretch", minHeight: "100%" }}>
      {sideEl}
      {mainEl}
    </div>
  );
}

function BannerLayout({ m, th }: { m: CvModel; th: CvTheme }) {
  const b = th.band!;
  const s = th.side!;
  const L = m.labels;
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ background: b.bg, color: b.fg, padding: "34px 44px", display: "flex", gap: 24, alignItems: "center" }}>
        {m.photo ? <PhotoBox model={m} th={th} ring={b.fg} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <NameBlock m={{ ...m }} th={{ ...th, align: "left" }} color={b.fg} sub={b.muted} />
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "stretch" }}>
        <main style={{ flex: 1, minWidth: 0, padding: "10px 32px 36px 44px", boxSizing: "border-box" }}>
          <MainSections m={m} th={th} include={{}} />
        </main>
        <aside style={{ width: s.width, flex: "none", background: s.bg, color: s.fg, padding: "26px 24px 30px", boxSizing: "border-box" }}>
          {m.has.contact ? (
            <Section title={L.contact} th={th} dim boxBg="#ffffff">
              <ContactStack m={m} fg={s.fg} muted={s.muted} />
            </Section>
          ) : null}
          {m.skills.length ? <Section title={L.skills} th={th} dim boxBg="#ffffff"><SkillBlock m={m} th={th} /></Section> : null}
          {m.languages.length ? <Section title={L.languages} th={th} dim boxBg="#ffffff"><LanguageBlock m={m} th={th} fg={s.fg} muted={s.muted} /></Section> : null}
          {m.interests.length ? <Section title={L.interests} th={th} dim boxBg="#ffffff"><InterestsBlock m={m} th={th} color={s.fg} /></Section> : null}
        </aside>
      </div>
    </div>
  );
}

export function CvLayout({ m, tpl }: { m: CvModel; tpl: CvTemplate }) {
  const th = tpl.theme;
  switch (tpl.layout) {
    case "sidebar": return <SidebarLayout m={m} th={th} />;
    case "banner": return <BannerLayout m={m} th={th} />;
    case "timeline": return <SingleLayout m={m} th={th} timeline />;
    default: return <SingleLayout m={m} th={th} />;
  }
}

// ── Kök (A4 sayfa) ─────────────────────────────────────────────────────────

const SIZE_SCALE = { s: 0.93, m: 1, l: 1.07 } as const;

export function CvPage({ m, tpl, size, accent }: { m: CvModel; tpl: CvTemplate; size: "s" | "m" | "l"; accent: string | null }) {
  const th: CvTheme = accent ? recolor(tpl.theme, accent) : tpl.theme;
  const t = { ...tpl, theme: th };
  return (
    <div
      data-cv-root="1"
      data-cv-mode={m.mode}
      lang={m.lang}
      style={{
        width: PAGE_W,
        minHeight: PAGE_H,
        boxSizing: "border-box",
        background: "#ffffff",
        color: th.text,
        fontFamily: `'${FONT_CSS[th.font]}', sans-serif`,
        fontSize: BASE_PX[th.font] * SIZE_SCALE[size],
        lineHeight: 1.3,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <CvLayout m={m} tpl={t} />
    </div>
  );
}

/** Kullanıcının seçtiği vurgu rengini şablona uygular (kenar çubuğu/bant rengi de buna uyar). */
export function recolor(th: CvTheme, accent: string): CvTheme {
  const tint = mix(accent, "#ffffff", 0.88);
  const out: CvTheme = { ...th, accent, tint };
  if (th.side && th.side.bg !== "#f1f3f6" && !isLight(th.side.bg)) out.side = { ...th.side, bg: darken(accent, 0.0) };
  if (th.band) out.band = { ...th.band, bg: accent };
  if (th.side && isLight(th.side.bg)) out.side = { ...th.side, bg: tint };
  return out;
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function darken(a: string, t: number): string {
  return mix(a, "#000000", t);
}
function isLight(h: string): boolean {
  const [r, g, b] = hexToRgb(h);
  return 0.299 * r + 0.587 * g + 0.114 * b > 190;
}

// ── Şablon listesi ─────────────────────────────────────────────────────────

const tint = (c: string) => mix(c, "#ffffff", 0.88);

function T(
  id: string, tr: string, en: string, descTr: string, descEn: string, layout: LayoutId, free: boolean,
  o: { font: FontKey; accent: string; heading: HeadingStyle; align?: "left" | "center"; skills?: SkillStyle; photo?: CvTheme["photo"]; side?: CvTheme["side"]; band?: CvTheme["band"]; text?: string; muted?: string },
): CvTemplate {
  return {
    id, tr, en, descTr, descEn, layout, free,
    theme: {
      font: o.font, accent: o.accent, text: o.text ?? "#1f2430", muted: o.muted ?? "#5d6675", tint: tint(o.accent),
      heading: o.heading, align: o.align ?? "left", skills: o.skills ?? "tags",
      photo: o.photo ?? { shape: "rounded", w: 96, h: 120 },
      side: o.side, band: o.band,
    },
  };
}

export const CV_TEMPLATES: CvTemplate[] = [
  // ── Ücretsiz ──
  T("sade", "Sade", "Plain", "Her sektörde güvenle kullanılan, başvuru sistemlerinin kolay okuduğu klasik düzen.", "A classic layout any hiring system reads cleanly.", "single", true,
    { font: "arial", accent: "#2b3a55", heading: "rule", skills: "tags", photo: { shape: "rect", w: 92, h: 116 } }),
  T("net", "Net", "Clean", "Sol çizgili başlıklar ve ferah boşluklarla modern, okunaklı tek sütun.", "Modern single column with left-bar headings and airy spacing.", "single", true,
    { font: "carlito", accent: "#2563eb", heading: "bar", skills: "tags", photo: { shape: "rounded", w: 100, h: 100 } }),
  // ── Pro ──
  T("klasik-serif", "Klasik Serif", "Classic Serif", "Ortalanmış ad, ince çizgiler: akademik ve hukuk başvurularına uygun ciddi bir görünüm.", "Centred name and fine rules — a serious look for academic and legal roles.", "single", true,
    { font: "caladea", accent: "#3b3b3b", heading: "caps", align: "center", skills: "tags", photo: { shape: "rect", w: 92, h: 116 } }),
  T("zarif", "Zarif", "Elegant", "Bordo vurgulu, zarif serif yazı tipi; yönetici ve danışmanlık profilleri için.", "Burgundy accents with an elegant serif; suited to executive and consulting profiles.", "single", false,
    { font: "gelasio", accent: "#8a1c3b", heading: "rule", align: "center", skills: "tags", photo: { shape: "circle", w: 104, h: 104 } }),
  T("modern-mavi", "Modern Mavi", "Modern Blue", "Mavi kenar çubuğu, yuvarlak fotoğraf ve beceri çubukları.", "Blue sidebar, round photo and skill bars.", "sidebar", true,
    { font: "carlito", accent: "#1d4ed8", heading: "rule", skills: "bars", photo: { shape: "circle", w: 128, h: 128 }, side: { pos: "left", bg: "#1e3a8a", fg: "#ffffff", muted: "#bfd0ff", width: 260 } }),
  T("kurumsal", "Kurumsal Lacivert", "Corporate Navy", "Koyu lacivert kenar çubuğu; kurumsal başvurular için ağırbaşlı bir düzen.", "Dark navy sidebar; a dignified layout for corporate applications.", "sidebar", false,
    { font: "arial", accent: "#0f2a4a", heading: "caps", skills: "plain", photo: { shape: "rect", w: 150, h: 180 }, side: { pos: "left", bg: "#0f2a4a", fg: "#ffffff", muted: "#aebed3", width: 250 } }),
  T("orman", "Orman Yeşili", "Forest Green", "Doğal yeşil tonlar, yuvarlatılmış fotoğraf ve temiz bölümler.", "Natural greens with a rounded photo and tidy sections.", "sidebar", false,
    { font: "carlito", accent: "#166534", heading: "bar", skills: "bars", photo: { shape: "rounded", w: 140, h: 160 }, side: { pos: "left", bg: "#14532d", fg: "#ffffff", muted: "#b6e2c4", width: 258 } }),
  T("gun-batimi", "Gün Batımı", "Sunset", "Sağ kenar çubuğu ve sıcak turuncu vurgu; yaratıcı roller için canlı bir seçenek.", "Right-hand sidebar with warm orange accents; a lively pick for creative roles.", "sidebar", false,
    { font: "carlito", accent: "#c2410c", heading: "dot", skills: "tags", photo: { shape: "circle", w: 124, h: 124 }, side: { pos: "right", bg: "#c2410c", fg: "#ffffff", muted: "#ffd9c4", width: 250 } }),
  T("bant-mor", "Mor Bant", "Violet Banner", "Üstte geniş renkli bant, altında iki sütun; fotoğraf bantta öne çıkar.", "A wide colour band on top, two columns below; the photo stands out.", "banner", false,
    { font: "carlito", accent: "#6d28d9", heading: "rule", skills: "bars", photo: { shape: "circle", w: 112, h: 112 }, band: { bg: "#6d28d9", fg: "#ffffff", muted: "#e4d8ff" }, side: { pos: "right", bg: "#f5f1fd", fg: "#1f2430", muted: "#5d6675", width: 250 } }),
  T("bant-petrol", "Petrol Bant", "Teal Banner", "Petrol mavisi bant ve açık gri yan sütun; dengeli ve profesyonel.", "Teal band with a light grey side column; balanced and professional.", "banner", false,
    { font: "arial", accent: "#0f766e", heading: "boxed", skills: "tags", photo: { shape: "rounded", w: 104, h: 124 }, band: { bg: "#0f766e", fg: "#ffffff", muted: "#c5efe9" }, side: { pos: "right", bg: "#eef7f6", fg: "#1f2430", muted: "#5d6675", width: 246 } }),
  T("zaman-cizgisi", "Zaman Çizgisi", "Timeline", "Deneyim ve eğitimi zaman çizgisiyle anlatan, kariyer yolculuğunu öne çıkaran düzen.", "A timeline that tells your career story at a glance.", "timeline", false,
    { font: "carlito", accent: "#4f46e5", heading: "dot", skills: "tags", photo: { shape: "circle", w: 100, h: 100 } }),
  T("yaratici", "Yaratıcı", "Creative", "Pembe vurgu, açık kenar çubuğu ve iri başlık; tasarım ve medya için.", "Rose accents, a light sidebar and a bold name; for design and media.", "sidebar", false,
    { font: "carlito", accent: "#be185d", heading: "boxed", skills: "bars", photo: { shape: "rounded", w: 138, h: 138 }, side: { pos: "left", bg: "#fdf2f8", fg: "#1f2430", muted: "#6b5560", width: 256 } }),
  T("minimal-gri", "Minimal Gri", "Minimal Grey", "Açık gri kenar çubuğu, tek renkli sade tasarım; yazıcı dostu.", "Light grey sidebar, single-colour restraint; print friendly.", "sidebar", false,
    { font: "arial", accent: "#374151", heading: "caps", skills: "plain", photo: { shape: "rect", w: 150, h: 180 }, side: { pos: "left", bg: "#f1f3f6", fg: "#1f2430", muted: "#5d6675", width: 248 } }),
  T("yonetici", "Yönetici", "Executive", "Antrasit bant ve altın vurgu; üst düzey pozisyonlar için prestijli görünüm.", "Charcoal band with gold accents; a prestigious look for senior roles.", "banner", false,
    { font: "gelasio", accent: "#a16207", heading: "caps", skills: "plain", photo: { shape: "rect", w: 98, h: 122 }, band: { bg: "#27272a", fg: "#ffffff", muted: "#e8c76a" }, side: { pos: "right", bg: "#faf7ef", fg: "#1f2430", muted: "#5d6675", width: 248 } }),
  T("pastel", "Pastel Mavi", "Pastel Blue", "Yumuşak mavi tonlar ve sağ kenar çubuğu; sakin ve samimi.", "Soft blue tones with a right-hand sidebar; calm and friendly.", "sidebar", false,
    { font: "carlito", accent: "#0369a1", heading: "dot", skills: "tags", photo: { shape: "circle", w: 124, h: 124 }, side: { pos: "right", bg: "#e0f2fe", fg: "#0c2d48", muted: "#44657f", width: 250 } }),
  T("akademik", "Akademik", "Academic", "Times benzeri yazı tipi, yoğun içerik için sıkı yerleşim; yayın ve proje listeleri için.", "Times-style type and a tight layout for dense content such as publications.", "single", false,
    { font: "times", accent: "#1e3a5f", heading: "rule", skills: "plain", photo: { shape: "rect", w: 88, h: 110 } }),
];

export function getTemplate(id: string): CvTemplate {
  return CV_TEMPLATES.find((t) => t.id === id) ?? CV_TEMPLATES[0];
}

// ── Yazı tipleri + ortak stil ──────────────────────────────────────────────

let injected = false;
export function ensureCvStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const faces: string[] = [];
  (Object.keys(FONT_CSS) as FontKey[]).forEach((k) => {
    for (const [suf, w, it] of [["Regular", 400, "normal"], ["Bold", 700, "normal"], ["Italic", 400, "italic"], ["BoldItalic", 700, "italic"]] as const) {
      faces.push(`@font-face{font-family:'${FONT_CSS[k]}';src:url('/fonts/edit/${FONT_FILE[k]}-${suf}.woff2') format('woff2');font-weight:${w};font-style:${it};font-display:block;}`);
    }
  });
  const css = `${faces.join("")}
[data-cv-mode="draft"] [data-ghost]{opacity:.5;outline:1px dashed currentColor;outline-offset:2px;border-radius:2px}
[data-cv-mode="blank"] [data-ghost]{opacity:.55}
[data-cv-root] *{box-sizing:border-box}
[data-cv-root] div,[data-cv-root] span,[data-cv-root] main,[data-cv-root] aside{margin:0}`;
  const el = document.createElement("style");
  el.id = "cv-fonts";
  el.textContent = css;
  document.head.appendChild(el);
}
