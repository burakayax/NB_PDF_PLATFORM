import { useRef } from "react";

interface BatchFileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  language?: string;
  disabled?: boolean;
}

export function BatchFileUpload({ files, onChange, accept, maxFiles = 50, language = "tr", disabled = false }: BatchFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tr = language === "tr";

  function addFiles(incoming: FileList | null) {
    if (disabled || !incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= maxFiles) break;
      if (!next.some((e) => e.name === f.name && e.size === f.size)) {
        next.push(f);
      }
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
      <div
        className={`border border-dashed rounded-xl p-4 text-center transition-all min-h-[80px] w-full touch-manipulation flex flex-col items-center justify-center ${disabled ? "border-white/10 opacity-40 cursor-not-allowed" : "border-white/20 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5"}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { if (!disabled) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (!disabled) onDrop(e); }}
      >
        <p className="text-xs text-gray-400">
          {tr
            ? `Toplu işlem — ${maxFiles} dosyaya kadar seçin veya sürükleyin`
            : `Batch mode — select or drop up to ${maxFiles} files`}
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

      {files.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs"
            >
              <span className="truncate text-gray-300">{f.name}</span>
              <button
                type="button"
                className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"
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
        <p className="text-[10px] text-gray-500">
          {files.length} {tr ? "dosya seçildi" : "files selected"}
          {files.length < maxFiles
            ? ` · ${tr ? "daha fazla ekleyebilirsiniz" : "you can add more"}`
            : ` · ${tr ? "limit doldu" : "limit reached"}`}
        </p>
      )}
    </div>
  );
}
