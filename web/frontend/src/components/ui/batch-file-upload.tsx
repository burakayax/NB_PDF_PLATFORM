import { useRef } from "react";

interface BatchFileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  language?: string;
  disabled?: boolean;
  /** Plan bazlı dosya boyutu sınırı (bayt). Aşan dosyalar eklenmez. Infinity/atlanmış = sınırsız. */
  maxFileBytes?: number;
  /** Boyutu aşan dosyalar reddedildiğinde çağrılır (uyarı göstermek için). */
  onOversized?: (names: string[], limitBytes: number) => void;
}

export function BatchFileUpload({ files, onChange, accept, maxFiles = 50, language = "tr", disabled = false, maxFileBytes = Infinity, onOversized }: BatchFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tr = language === "tr";

  function addFiles(incoming: FileList | null) {
    if (disabled || !incoming) return;
    const next = [...files];
    const oversized: string[] = [];
    for (const f of Array.from(incoming)) {
      if (next.length >= maxFiles) break;
      // Plan boyut sınırını aşan dosyaları sisteme ekleme.
      if (Number.isFinite(maxFileBytes) && f.size > maxFileBytes) {
        oversized.push(f.name);
        continue;
      }
      if (!next.some((e) => e.name === f.name && e.size === f.size)) {
        next.push(f);
      }
    }
    if (oversized.length > 0) {
      onOversized?.(oversized, maxFileBytes);
    }
    onChange(next);
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    onChange(next);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-2">
      {/* Desktop: Large dashed box */}
      <div className="hidden lg:block">
        <div
          className={`border border-dashed rounded-xl p-8 text-center transition-all min-h-[140px] w-full touch-manipulation flex flex-col items-center justify-center ${disabled ? "border-white/10 opacity-40 cursor-not-allowed" : "border-white/20 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5"}`}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => { if (!disabled) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (!disabled) onDrop(e); }}
        >
          <svg className="h-12 w-12 mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-gray-300 mb-1">
            {tr ? "Dosyaları Seçin veya Sürükleyin" : "Select or Drag Files"}
          </p>
          <p className="text-xs text-gray-500">
            {tr
              ? `${maxFiles} dosyaya kadar`
              : `Up to ${maxFiles} files`}
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            disabled={disabled}
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Tablet: Medium button style */}
      <div className="hidden md:block lg:hidden">
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className={`w-full rounded-lg border py-4 px-4 text-center transition-all font-medium ${disabled ? "border-white/10 opacity-40 cursor-not-allowed text-gray-500" : "border-white/20 bg-nb-panel/40 text-gray-300 hover:bg-nb-panel hover:border-blue-500/40"}`}
        >
          <p className="text-sm">{tr ? "📁 Dosya Seçin" : "📁 Choose Files"}</p>
          <p className="text-xs text-gray-500 mt-1">{files.length}/{maxFiles}</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            disabled={disabled}
            onChange={(e) => addFiles(e.target.files)}
          />
        </button>
      </div>

      {/* Mobile: Compact icon button */}
      <div className="block md:hidden">
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className={`w-full rounded-lg py-3 px-3 text-center transition-all font-semibold text-sm flex items-center justify-center gap-2 ${disabled ? "bg-white/5 opacity-40 cursor-not-allowed text-gray-600" : "bg-gradient-to-r from-blue-600/40 to-cyan-600/40 text-blue-300 hover:from-blue-600/60 hover:to-cyan-600/60 border border-blue-500/30"}`}
        >
          <span className="text-lg">📁</span>
          <span>{tr ? "Dosya Seç" : "Files"}</span>
          {files.length > 0 && <span className="ml-auto text-xs bg-blue-500/40 px-2 py-1 rounded">{files.length}</span>}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            disabled={disabled}
            onChange={(e) => addFiles(e.target.files)}
          />
        </button>
      </div>

      {/* Desktop & Tablet: List view */}
      {files.length > 0 && (
        <div className="hidden sm:block space-y-1 max-h-60 overflow-y-auto pr-1">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs hover:bg-white/[0.08] transition-colors"
            >
              <span className="truncate text-gray-300 flex-1">{f.name}</span>
              <button
                type="button"
                className="shrink-0 text-gray-500 hover:text-red-400 transition-colors flex-none"
                onClick={() => removeFile(i)}
                aria-label={tr ? "Kaldır" : "Remove"}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile: Compact list */}
      {files.length > 0 && (
        <div className="block sm:hidden space-y-1 max-h-40 overflow-y-auto">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 px-2 py-1.5 text-[11px] border border-blue-500/20"
            >
              <span className="truncate text-blue-200 flex-1 font-medium">{f.name.substring(0, 20)}...</span>
              <button
                type="button"
                className="shrink-0 text-red-400 hover:text-red-500 transition-colors flex-none"
                onClick={() => removeFile(i)}
                aria-label={tr ? "Kaldır" : "Remove"}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <p className="text-[10px] text-gray-500 text-center">
          {files.length}/{maxFiles} {tr ? "dosya" : "files"}
        </p>
      )}
    </div>
  );
}
