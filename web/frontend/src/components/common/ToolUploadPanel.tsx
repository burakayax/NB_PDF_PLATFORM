import { useRef, useState } from "react";
import { Lock, Loader2, ShieldCheck, Trash2, UploadCloud, Zap, type LucideIcon } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { TOOLS, TOOL_HUE, HUES } from "../../lib/toolCatalog";
import { isOnDeviceTool } from "../../lib/onDeviceTools";
import { getToolBenefits } from "./toolBenefits";
import { useToolPageContext } from "./toolPageContext";

/**
 * ARAÇLARIN ORTAK YÜKLEME EKRANI.
 *
 * Her araç kendi yükleme alanını ayrı çiziyordu: sekiz ücretsiz araçta geniş,
 * renkli, rozetli bir alan vardı; geri kalan otuzdan fazla araçta ise küçük bir
 * "Dosya Seç" kutusu. Aynı siteyi gezen kullanıcı araç değiştirdikçe başka bir
 * ürün kullanıyormuş gibi hissediyordu. Artık hepsi bu panelden geçer.
 *
 * Panel üç parçadan oluşur, üçü de isteğe bağlıdır:
 *   1. Başlık şeridi — aracın adı, tek cümlelik işi ve nerede çalıştığı
 *   2. Bırakma alanı — büyük, renkli; dosya seçilince şeride küçülür
 *   3. Üç fayda kutusu — aracın ne kazandırdığı (yalnızca dosya yokken)
 *
 * ⚠ GİZLİLİK İDDİASI: rozet ve çipler `lib/onDeviceTools.ts` listesine bakar.
 * Sunucuya iş gönderen araçta "cihazından çıkmaz" YAZMAZ; onun yerine şifreli
 * aktarım ve işlem sonrası silme anlatılır. Listeye yanlış araç eklenirse
 * `__tests__/onDeviceClaims.test.ts` düşer.
 */

type Props = {
  /** Katalogdaki araç kimliği (ör. "merge", "pdf-to-word"). */
  toolId: string;
  language: Language;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Dosya zaten seçili → alan ince bir "dosya ekle / değiştir" şeridine iner. */
  compact?: boolean;
  /** Üstteki araç adı + açıklama + çalışma yeri rozeti. */
  showHeader?: boolean;
  /** Altındaki üç fayda kutusu (dosya yokken anlamlı). */
  showBenefits?: boolean;
  /** Bırakma alanının başlığı — verilmezse araca göre standart metin. */
  title?: string;
  /** Başlığın altındaki ince satır (ör. kabul edilen biçimler, boyut sınırı). */
  hint?: string;
  /** Kök öğeye eklenecek sınıf — araç formlarının ızgarasında tam satır kaplaması için. */
  className?: string;
  onFiles: (files: File[]) => void;
};

/** Katalogda karşılığı olmayan araçlar için nötr görünüm. */
const FALLBACK_HUE = "violet" as const;

export function toolVisual(toolId: string): { Icon: LucideIcon; tile: string; icon: string } {
  const tool = TOOLS.find((t) => t.id === toolId);
  const hue = HUES[TOOL_HUE[toolId] ?? FALLBACK_HUE];
  return { Icon: tool?.Icon ?? UploadCloud, tile: hue.tile, icon: hue.icon };
}

export function ToolUploadPanel({
  toolId,
  language,
  accept,
  multiple,
  busy,
  disabled,
  compact,
  showHeader = true,
  showBenefits = true,
  title,
  hint,
  className,
  onFiles,
}: Props) {
  const tr = language === "tr";
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tool = TOOLS.find((t) => t.id === toolId);
  const copy = tool ? (tr ? tool.tr : tool.en) : null;
  const { Icon, tile, icon } = toolVisual(toolId);
  const onDevice = isOnDeviceTool(toolId);
  const benefits = getToolBenefits(toolId);
  // Araç zaten kendini anlatan bir sayfanın içindeyse (misafir araç sayfası)
  // başlık şeridi ve fayda kutuları aynı şeyi üçüncü kez söylemiş olur.
  const { describesTool } = useToolPageContext();

  const pick = () => {
    if (!busy && !disabled) inputRef.current?.click();
  };

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    onFiles(multiple ? files : files.slice(0, 1));
  };

  const chips: { Icon: LucideIcon; label: string }[] = onDevice
    ? [
        { Icon: Zap, label: tr ? "Saniyeler içinde" : "In seconds" },
        { Icon: Lock, label: tr ? "Cihazında, gizli" : "On-device, private" },
        { Icon: ShieldCheck, label: tr ? "Yükleme yok" : "No upload" },
      ]
    : [
        { Icon: Zap, label: tr ? "Saniyeler içinde" : "In seconds" },
        { Icon: Lock, label: tr ? "Şifreli aktarım" : "Encrypted transfer" },
        { Icon: Trash2, label: tr ? "İşlem sonrası silinir" : "Deleted after processing" },
      ];

  return (
    <div className={`w-full ${className ?? ""}`}>
      {showHeader && copy && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tile} ${icon}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-white">{copy.name}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{copy.desc}</p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
              onDevice
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-sky-400/30 bg-sky-500/10 text-sky-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {onDevice
              ? tr ? "Cihazında çalışır" : "Runs on your device"
              : tr ? "Güvenli sunucuda" : "On our secure server"}
          </span>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          take(e.dataTransfer.files);
        }}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        }}
        className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed text-center transition ${
          compact ? "p-5" : "p-10 sm:p-12"
        } ${
          dragOver
            ? "border-white/60 bg-white/[0.06]"
            : "border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-white/30 hover:bg-white/[0.04]"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <div className={`pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-40 blur-3xl ${tile}`} />

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />

        {compact ? (
          <div className="relative flex items-center justify-center gap-2.5 text-slate-300">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tile} ${icon}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="text-[13px] font-semibold text-white">
              {busy
                ? tr ? "İşleniyor…" : "Processing…"
                : multiple
                  ? tr ? "+ Dosya ekle" : "+ Add file"
                  : tr ? "Dosya değiştir" : "Replace file"}
            </span>
          </div>
        ) : (
          <>
            <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl ring-1 transition group-hover:scale-105 ${tile} ${icon}`}>
              {busy ? <Loader2 className="h-9 w-9 animate-spin" /> : <Icon className="h-9 w-9" strokeWidth={1.75} />}
            </div>
            <p className="relative mt-5 text-lg font-bold text-white">
              {busy
                ? tr ? "İşleniyor…" : "Processing…"
                : (title ??
                  (multiple
                    ? tr ? "Dosyaları buraya sürükle" : "Drag your files here"
                    : tr ? "Dosyayı buraya sürükle" : "Drag your file here"))}
            </p>
            <p className="relative mt-1.5 text-[13px] text-slate-400">
              {hint ?? (tr ? "ya da tıklayıp seç" : "or click to choose")}
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
              {chips.map((c) => {
                const ChipIcon = c.Icon;
                return (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
                  >
                    <ChipIcon className="h-3 w-3 text-slate-400" />
                    {c.label}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showBenefits && !compact && !describesTool && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map((b) => {
            const BIcon = b.icon;
            return (
              <div
                key={b.en}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.03]"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tile} ${icon}`}>
                  <BIcon className="h-4 w-4" />
                </span>
                <p className="mt-2.5 text-[13px] font-bold text-white">{tr ? b.tr : b.en}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{tr ? b.trDesc : b.enDesc}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
