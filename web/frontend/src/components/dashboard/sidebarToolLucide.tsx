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
};

type SidebarToolGlyphProps = {
  id: FeatureKey;
  className?: string;
  active: boolean;
};

export function SidebarToolGlyph({ id, className = "h-5 w-5", active }: SidebarToolGlyphProps) {
  const Icon = byId[id] ?? FileText;
  return (
    <Icon
      className={`${className} ${active ? "text-nb-primary-mid" : "text-nb-muted"}`}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}
