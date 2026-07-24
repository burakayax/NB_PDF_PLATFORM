import type { FeatureKey } from "../../api/subscription";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  Droplets,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Layers2,
  Globe,
  Image,
  ImageDown,
  Images,
  Layers,
  ListOrdered,
  Lock,
  Minimize2,
  Presentation,
  RotateCw,
  Scissors,
  Sheet,
  Trash2,
  Unlock,
  Wrench,
} from "lucide-react";

const byId: Record<FeatureKey, LucideIcon> = {
  split: Scissors,
  merge: Layers,
  "delete-pages": Trash2,
  "rotate-pdf": RotateCw,
  "organize-pdf": ArrowUpDown,
  compress: Minimize2,
  "pdf-to-word": FileText,
  "word-to-pdf": FileIcon,
  "excel-to-pdf": Sheet,
  "pdf-to-excel": FileSpreadsheet,
  "pdf-to-ppt": Presentation,
  "ppt-to-pdf": Presentation,
  "pdf-to-image": Image,
  "image-to-pdf": Images,
  "html-to-pdf": Globe,
  "unlock-pdf": Unlock,
  watermark: Droplets,
  "page-numbers": ListOrdered,
  "repair-pdf": Wrench,
  encrypt: Lock,
  "pdf-to-text": FileText,
  "flatten-pdf": Layers2,
  "extract-images": ImageDown,
};

/** Araç başına renk — sidebar ikonları PDF Düzenle gibi renkli görünür. */
const colorById: Record<FeatureKey, string> = {
  split: "text-sky-400",
  merge: "text-violet-400",
  "delete-pages": "text-rose-400",
  "rotate-pdf": "text-amber-400",
  "organize-pdf": "text-sky-400",
  compress: "text-emerald-400",
  "pdf-to-word": "text-blue-400",
  "word-to-pdf": "text-blue-400",
  "excel-to-pdf": "text-green-400",
  "pdf-to-excel": "text-green-400",
  "pdf-to-ppt": "text-orange-400",
  "ppt-to-pdf": "text-orange-400",
  "pdf-to-image": "text-fuchsia-400",
  "image-to-pdf": "text-fuchsia-400",
  "html-to-pdf": "text-cyan-400",
  "unlock-pdf": "text-teal-400",
  watermark: "text-sky-400",
  "page-numbers": "text-indigo-400",
  "repair-pdf": "text-yellow-400",
  encrypt: "text-red-400",
  "pdf-to-text": "text-blue-400",
  "flatten-pdf": "text-purple-400",
  "extract-images": "text-fuchsia-400",
};

type SidebarToolGlyphProps = {
  id: FeatureKey;
  className?: string;
  active: boolean;
};

export function SidebarToolGlyph({ id, className = "h-5 w-5", active }: SidebarToolGlyphProps) {
  const Icon = byId[id] ?? FileText;
  // Aktifken de renkli kalır; renk yoksa nb-primary'e düşer.
  const color = active ? "text-nb-primary-mid" : (colorById[id] ?? "text-nb-muted");
  return (
    <Icon
      className={`${className} ${color}`}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}
