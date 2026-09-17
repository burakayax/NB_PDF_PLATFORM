import { Fragment, type ReactNode } from "react";

/** Satır içi **kalın** + `kod` işaretlemesini render eder. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // **bold** ve `code` desenlerini böl
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-fuchsia-200"
        >
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<Fragment key={`${keyBase}-t${i}`}>{part}</Fragment>);
    }
  });
  return nodes;
}

/** Altında içerik olmayan başlıkları atar (AI bazen boş başlık bırakıyor). */
function stripEmptySections(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const isHeading = (s: string) => /^#{1,6}\s+/.test(s.trim());
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i])) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      // Sonraki dolu satır yine başlık ya da metin bitti → bu başlık boş, atla.
      if (j >= lines.length || isHeading(lines[j])) continue;
    }
    kept.push(lines[i]);
  }
  return kept.join("\n");
}

/**
 * Hafif markdown renderer (bağımlılıksız) — AI özet/yanıt çıktısı için.
 * Destekler: #/##/### başlık, - / * / 1. liste, **kalın**, `kod`, paragraf, --- ayraç.
 */
/** "| a | b |" biçiminde bir tablo satırı mı? */
function tabloSatiriMi(satir: string): boolean {
  const t = satir.trim();
  return t.startsWith("|") && t.endsWith("|") && t.length > 2;
}

/** "|---|:---:|" gibi ayraç satırı mı? (başlıkla gövdeyi ayırır, ekranda gösterilmez) */
function tabloAyraciMi(satir: string): boolean {
  const t = satir.trim();
  return tabloSatiriMi(t) && /^\|[\s:|-]+\|$/.test(t) && t.includes("-");
}

/** Bir tablo satırını hücrelere böler. */
function tabloHucreleri(satir: string): string[] {
  return satir
    .trim()
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = stripEmptySections(text).split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const ordered = list.ordered;
    blocks.push(
      ordered ? (
        <ol key={`ol-${key++}`} className="my-3 ml-1 list-decimal space-y-1.5 pl-5 marker:text-fuchsia-300/80">
          {items.map((it, i) => (
            <li key={i} className="pl-1 leading-relaxed text-slate-200">
              {renderInline(it, `li-${key}-${i}`)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={`ul-${key++}`} className="my-3 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 leading-relaxed text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400/70" aria-hidden />
              <span>{renderInline(it, `li-${key}-${i}`)}</span>
            </li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li] ?? "";
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // TABLO — yapay zekâ özetleri kalemleri markdown tablosu olarak yazıyor.
    // Eskiden bu satırlar ham hâliyle ("| Kalem | Adet |" ve "|----|----|")
    // ekrana basılıyordu; profesyonel bir özet yerine bozuk metin görünüyordu.
    if (tabloSatiriMi(trimmed)) {
      const tabloSatirlari: string[] = [];
      let j = li;
      while (j < lines.length && tabloSatiriMi((lines[j] ?? "").trim())) {
        tabloSatirlari.push((lines[j] ?? "").trim());
        j++;
      }
      // En az bir başlık + bir veri satırı olmalı; değilse normal metin gibi işle.
      const veriSatirlari = tabloSatirlari.filter((t) => !tabloAyraciMi(t));
      if (veriSatirlari.length >= 2) {
        flushList();
        const basliklar = tabloHucreleri(veriSatirlari[0] ?? "");
        const govde = veriSatirlari.slice(1).map((t) => tabloHucreleri(t));
        blocks.push(
          <div key={`tbl-${key++}`} className="my-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-white/[0.04]">
                  {basliklar.map((b, i) => (
                    <th key={i} className="border-b border-white/10 px-3 py-2 font-semibold text-slate-200">
                      {renderInline(b, `th-${key}-${i}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {govde.map((satir, ri) => (
                  <tr key={ri} className="odd:bg-white/[0.02]">
                    {basliklar.map((_, ci) => (
                      <td key={ci} className="border-b border-white/5 px-3 py-2 align-top text-slate-300">
                        {renderInline(satir[ci] ?? "", `td-${key}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        li = j - 1;
        continue;
      }
    }
    // Ayraç
    if (/^---+$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} className="my-4 border-white/10" />);
      continue;
    }
    // Başlıklar
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushList();
      const level = h[1].length;
      const content = h[2];
      if (level === 1) {
        blocks.push(
          <h2 key={`h-${key++}`} className="mb-2 mt-5 text-xl font-bold text-white first:mt-0">
            {renderInline(content, `h${key}`)}
          </h2>,
        );
      } else if (level === 2) {
        blocks.push(
          <h3
            key={`h-${key++}`}
            className="mb-2 mt-5 flex items-center gap-2 text-[15px] font-bold uppercase tracking-wide text-fuchsia-300 first:mt-0"
          >
            <span className="h-1 w-4 rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-500" aria-hidden />
            {renderInline(content, `h${key}`)}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={`h-${key++}`} className="mb-1.5 mt-4 text-[14px] font-semibold text-slate-100 first:mt-0">
            {renderInline(content, `h${key}`)}
          </h4>,
        );
      }
      continue;
    }
    // Sıralı liste
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (ol) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[2]);
      continue;
    }
    // Sırasız liste
    const ul = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (ul) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    // Paragraf
    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="my-2.5 leading-relaxed text-slate-200">
        {renderInline(trimmed, `p${key}`)}
      </p>,
    );
  }
  flushList();

  return <div className="text-[14.5px]">{blocks}</div>;
}
