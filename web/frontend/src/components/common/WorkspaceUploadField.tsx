import { useRef, useState } from "react";
import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";

type Props = {
  language: Language;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Buton yazısı "Dosya Ekle" olsun (listede zaten dosya varken). */
  appendMode?: boolean;
  /** Alan başlığı — varsayılan "Dosya Seç". */
  label?: string;
  /** Buton yanındaki açıklama — varsayılan araç tipine göre standart metin. */
  note?: string;
  onFiles: (files: File[]) => void;
};

/**
 * Çalışma alanı standart yükleme alanı — diğer TÜM araçlarla aynı tasarım
 * (`.upload-dropzone` + "Dosya Seç" butonu + sürükle-bırak ipucu). Kendi özel
 * dropzone'unu çizen araçlar (Düzenle / Kırp / İmzala / İşaretle / Görsel
 * Sıkıştır) bunu kullanır ki çalışma alanında tek bir yükleme dili olsun.
 */
export function WorkspaceUploadField({
  language,
  accept,
  multiple,
  disabled,
  appendMode,
  label,
  note,
  onFiles,
}: Props) {
  const W = ws(language);
  const tr = language === "tr";
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`field field--full upload-dropzone${dragOver ? " upload-dropzone--over" : ""}`}
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
        const dropped = Array.from(e.dataTransfer.files ?? []);
        if (dropped.length) onFiles(multiple ? dropped : dropped.slice(0, 1));
      }}
    >
      <span>{label ?? W.filePick}</span>
      <div className="file-picker-row flex-wrap">
        <button
          className="file-picker-button"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {appendMode ? W.fileAdd : W.filePick}
        </button>
        <span className="file-picker-note">
          {note ??
            (multiple
              ? appendMode
                ? W.filePickNoteAppend
                : W.filePickNoteMulti
              : W.filePickNoteSingle)}
        </span>
      </div>
      <p className="upload-dropzone__hint">
        {dragOver
          ? tr
            ? "Bırak, ekleyelim"
            : "Drop to add"
          : tr
            ? "veya dosyayı buraya sürükleyip bırak"
            : "or drag & drop your file here"}
      </p>
      <input
        ref={inputRef}
        className="hidden-file-input"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length) onFiles(list);
          e.target.value = "";
        }}
      />
    </div>
  );
}
