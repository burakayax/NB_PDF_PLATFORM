/**
 * OLAY → OKUNABİLİR TÜRKÇE CÜMLE.
 *
 * NEDEN AYRI DOSYA: Ham event adları (`sign_up_cta_shown`, `checkout_abandoned`
 * gibi) geliştirici jargonu; admin panelini kullanan kişi teknik bilgisi
 * olmayan biri olabilir. Bu dosya, backend'den gelen ham event listesini
 * "misafir X aracını kullandı, başarılı oldu → üye olma ekranı gösterildi →
 * kapattı" gibi tek bakışta anlaşılır bir hikayeye çevirir.
 */

/** ValueMomentNudge'ın `source` değeri → okunur araç adı. Bilinmeyen bir
 * toolId gelirse `_success` eki atılıp alt çizgiler boşluğa çevrilerek
 * makul bir varsayılan üretilir (yeni araç eklendiğinde burası unutulsa bile
 * ekran "ham kimlik" göstermez). */
const TOOL_NAMES: Record<string, string> = {
  merge_success: "PDF Birleştir",
  image_to_pdf_success: "Görseli PDF'e Çevir",
  image_compress_success: "Görsel Sıkıştır",
  udf_to_pdf_success: "UDF'den PDF'e Çevir",
  rotate_pdf_success: "PDF Döndür",
  delete_pages_success: "Sayfa Sil",
  organize_pdf_success: "Sayfaları Yeniden Sırala",
  split_success: "PDF Ayır",
  annotate_success: "PDF'e Not Ekle",
  sign_success: "PDF İmzala",
  snip_success: "PDF'ten Kırp",
  editor_success: "PDF Düzenle",
  layout_success: "Sayfa Düzeni Değiştir",
  metadata_clean_success: "Meta Veri Temizle",
  form_fill_success: "PDF Form Doldur",
  resize_success: "Görsel Boyutlandır",
  // Misafir PDF Sıkıştır (günde 1 hak): sonuç ekranındaki üyelik davetinin kaynağı.
  compress_success: "PDF Sıkıştır",
};

export function toolLabel(toolId: string | null | undefined): string {
  if (!toolId) return "bir araç";
  const known = TOOL_NAMES[toolId];
  if (known) return known;
  const bare = toolId.replace(/_success$/, "").replace(/[-_]/g, " ").trim();
  return bare.length > 0 ? bare.charAt(0).toUpperCase() + bare.slice(1) : toolId;
}

const PLAN_NAMES: Record<string, string> = {
  FREE: "Ücretsiz",
  STARTER: "Starter",
  PLUS: "Plus",
  PRO: "Pro",
  BUSINESS: "Business",
};

function planLabel(v: unknown): string {
  if (typeof v !== "string") return "bir plan";
  return PLAN_NAMES[v] ?? v;
}

export type Extra = Record<string, string | number | boolean> | null;

function parseExtra(extra: string | null): Extra {
  if (!extra) return null;
  try {
    return JSON.parse(extra) as Extra;
  } catch {
    return null;
  }
}

export type StoryTone = "success" | "info" | "warning" | "danger" | "neutral";

export type StoryLine = {
  text: string;
  tone: StoryTone;
};

/** Tek bir ham olayı, akışta bir satıra çevirir. */
export function eventToStoryLine(ev: { name: string; toolId: string | null; extra: string | null }): StoryLine {
  const extra = parseExtra(ev.extra);
  switch (ev.name) {
    case "sign_up_cta_shown":
      return { text: `${toolLabel(ev.toolId)} işlemini başarıyla tamamladı → üye olma ekranı gösterildi`, tone: "success" };
    case "sign_up_cta_dismissed":
      return { text: "Üye olma ekranını kapattı", tone: "warning" };
    case "sign_up_cta_click":
      return { text: "“Ücretsiz hesap aç” butonuna tıkladı", tone: "info" };
    case "sign_up_completed":
      return { text: "Kayıt oldu 🎉", tone: "success" };
    case "quota_wall_hit":
      return { text: "Günlük kullanım hakkı bitti → yükseltme ekranı gösterildi", tone: "warning" };
    case "quota_warning_shown":
      return { text: "Günlük hakkı azaldı uyarısı gösterildi", tone: "info" };
    case "upgrade_cta_clicked":
      return { text: "“Yükselt” butonuna tıkladı", tone: "info" };
    case "view_pricing":
      return { text: "Fiyatlandırma ekranını açtı", tone: "info" };
    case "select_plan":
      return { text: `${planLabel(extra?.plan)} planını seçti`, tone: "info" };
    case "add_payment_info":
      return { text: "Ödeme bilgilerini girmeye başladı", tone: "info" };
    case "checkout_abandoned": {
      const step = typeof extra?.step === "string" ? extra.step : null;
      const stepLabel =
        step === "billing_info"
          ? "fatura bilgisi adımında"
          : step === "payment_summary"
            ? "ödeme özeti adımında"
            : step === "payment_failed"
              ? "ödeme adımında (başarısız/iptal)"
              : "ödeme adımında";
      return { text: `Ödemeden vazgeçti (${stepLabel})`, tone: "danger" };
    }
    case "purchase":
      return { text: `${planLabel(extra?.plan)} planını satın aldı 🎉`, tone: "success" };
    default:
      return { text: ev.name, tone: "neutral" };
  }
}

export const TONE_CLASSES: Record<StoryTone, string> = {
  success: "border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-200",
  info: "border-sky-400/25 bg-sky-500/[0.06] text-sky-200",
  warning: "border-amber-400/25 bg-amber-500/[0.06] text-amber-200",
  danger: "border-rose-400/25 bg-rose-500/[0.06] text-rose-200",
  neutral: "border-white/[0.08] bg-white/[0.02] text-slate-300",
};

/** Yönlendiren adresi (referrer) → okunur, tanıdık kaynak adı. */
export function sourceLabel(referrer: string | null): string {
  if (!referrer) return "Doğrudan / bilinmiyor";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/chatgpt\.com|openai\.com/.test(host)) return "ChatGPT";
    if (/claude\.ai|anthropic\.com/.test(host)) return "Claude";
    if (/google\./.test(host)) return "Google";
    if (/bing\.com/.test(host)) return "Bing";
    if (/facebook\.com|instagram\.com/.test(host)) return "Meta (Facebook/Instagram)";
    if (/t\.co|twitter\.com|x\.com/.test(host)) return "X (Twitter)";
    return host;
  } catch {
    return "Doğrudan / bilinmiyor";
  }
}
