import type { Language } from "../../i18n/landing";
import { ToolUploadPanel } from "./ToolUploadPanel";

type Props = {
  /** Katalogdaki araç kimliği — panelin rengini, ikonunu ve metnini belirler. */
  toolId: string;
  language: Language;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Listede zaten dosya var → alan ince bir "dosya ekle" şeridine iner. */
  appendMode?: boolean;
  /** Bırakma alanının başlığı — verilmezse araca göre standart metin. */
  label?: string;
  /** Başlığın altındaki ince satır (kabul edilen biçimler, boyut sınırı…). */
  note?: string;
  /** Üstteki araç adı + açıklama + çalışma yeri rozeti gizlensin mi? */
  hideHeader?: boolean;
  /** Üç fayda kutusu gizlensin mi? */
  hideBenefits?: boolean;
  onFiles: (files: File[]) => void;
};

/**
 * Çalışma alanı yükleme alanı — artık `ToolUploadPanel`'in ince bir sarmalayıcısı.
 *
 * Eskiden burada küçük bir "Dosya Seç" kutusu çizilirdi; ana sayfadaki ücretsiz
 * araçlar ise geniş, renkli bir alan gösteriyordu. İki ayrı yükleme dili, aynı
 * ürün içinde araç değiştiren kullanıcıya kopukluk hissettiriyordu. Bu bileşen
 * korunuyor çünkü on iki araç onu çağırıyor; görünümü tek yerden geliyor.
 */
export function WorkspaceUploadField({
  toolId,
  language,
  accept,
  multiple,
  disabled,
  appendMode,
  label,
  note,
  hideHeader,
  hideBenefits,
  onFiles,
}: Props) {
  return (
    <ToolUploadPanel
      className="field field--full"
      toolId={toolId}
      language={language}
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      compact={appendMode}
      showHeader={!hideHeader}
      showBenefits={!hideBenefits}
      title={label}
      hint={note}
      onFiles={onFiles}
    />
  );
}
