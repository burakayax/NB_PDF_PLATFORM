import type { ReactNode } from "react";
import {
  Braces,
  Combine,
  Crop,
  Droplets,
  EyeOff,
  FilePlus2,
  FileText,
  Hash,
  Highlighter,
  Image as ImageIcon,
  Images,
  Languages,
  Layers,
  Lock,
  MessageSquare,
  Minimize2,
  Pencil,
  PenTool,
  Presentation,
  RotateCcw,
  ScanText,
  Sliders,
  Sparkles,
  Table,
  Trash2,
  Type,
  Unlock,
  Wrench,
} from "lucide-react";

/**
 * PDF araç kataloğu — PDF Merkezi (PdfHub) ve Taramalarım araç seçici menüsü ORTAK kullanır.
 * Yalnızca bir PDF'e uygulanabilen tek-dosya araçlar; kategorize + renkli (PWA launcher hissi).
 * (Birleştir / Word→PDF gibi çok-dosya veya PDF-dışı girdi isteyenler DIŞARIDA.)
 */
export type ToolItem = { id: string; icon: ReactNode; tr: string; en: string };
export type AccentKey = "cyan" | "amber" | "violet" | "emerald" | "fuchsia";
export type ToolCategory = { id: string; tr: string; en: string; accent: AccentKey; convert: boolean; tools: ToolItem[] };

export const CAT_ACCENT: Record<AccentKey, { text: string; dot: string; btn: string; icon: string }> = {
  cyan: {
    text: "text-cyan-300",
    dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]",
    btn: "border-cyan-400/20 bg-cyan-500/[0.06] hover:border-cyan-400/45 hover:bg-cyan-500/[0.12]",
    icon: "text-cyan-300",
  },
  amber: {
    text: "text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    btn: "border-amber-400/20 bg-amber-500/[0.06] hover:border-amber-400/45 hover:bg-amber-500/[0.12]",
    icon: "text-amber-300",
  },
  violet: {
    text: "text-violet-300",
    dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]",
    btn: "border-violet-400/20 bg-violet-500/[0.06] hover:border-violet-400/45 hover:bg-violet-500/[0.12]",
    icon: "text-violet-300",
  },
  emerald: {
    text: "text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
    btn: "border-emerald-400/20 bg-emerald-500/[0.06] hover:border-emerald-400/45 hover:bg-emerald-500/[0.12]",
    icon: "text-emerald-300",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    dot: "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.7)]",
    btn: "border-fuchsia-400/25 bg-fuchsia-500/[0.06] hover:border-fuchsia-400/45 hover:bg-fuchsia-500/[0.12]",
    icon: "text-fuchsia-300",
  },
};

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "edit", tr: "Düzenle", en: "Edit", accent: "cyan", convert: false,
    tools: [
      { id: "pdf-duzenle", icon: <Pencil className="h-5 w-5" />, tr: "PDF Düzenle", en: "Edit PDF" },
      { id: "organize-pdf", icon: <Sliders className="h-5 w-5" />, tr: "Sayfa Sırala", en: "Reorder" },
      { id: "split", icon: <Layers className="h-5 w-5" />, tr: "Sayfalara Böl", en: "Split" },
      { id: "rotate-pdf", icon: <RotateCcw className="h-5 w-5" />, tr: "Döndür", en: "Rotate" },
      { id: "delete-pages", icon: <Trash2 className="h-5 w-5" />, tr: "Sayfa Sil", en: "Delete pages" },
      { id: "crop-pdf", icon: <Crop className="h-5 w-5" />, tr: "Kırp", en: "Crop" },
      { id: "flatten-pdf", icon: <Combine className="h-5 w-5" />, tr: "Düzleştir", en: "Flatten" },
      { id: "merge", icon: <FilePlus2 className="h-5 w-5" />, tr: "Birleştir", en: "Merge" },
    ],
  },
  {
    id: "mark", tr: "İmzala & İşaretle", en: "Sign & mark", accent: "amber", convert: false,
    tools: [
      { id: "pdf-imzala", icon: <PenTool className="h-5 w-5" />, tr: "İmzala", en: "Sign" },
      { id: "pdf-yorumla", icon: <Highlighter className="h-5 w-5" />, tr: "İşaretle", en: "Markup" },
      { id: "watermark", icon: <Droplets className="h-5 w-5" />, tr: "Filigran", en: "Watermark" },
      { id: "page-numbers", icon: <Hash className="h-5 w-5" />, tr: "Sayfa No", en: "Page no." },
    ],
  },
  {
    id: "convert", tr: "Dönüştür & Çıkar", en: "Convert & extract", accent: "violet", convert: true,
    tools: [
      { id: "pdf-to-word", icon: <FileText className="h-5 w-5" />, tr: "Word'e", en: "To Word" },
      { id: "pdf-to-excel", icon: <Table className="h-5 w-5" />, tr: "Excel'e", en: "To Excel" },
      { id: "pdf-to-ppt", icon: <Presentation className="h-5 w-5" />, tr: "PPT'ye", en: "To PPT" },
      { id: "pdf-to-image", icon: <ImageIcon className="h-5 w-5" />, tr: "Resme", en: "To image" },
      { id: "pdf-to-text", icon: <Type className="h-5 w-5" />, tr: "Metne", en: "To text" },
      { id: "extract-images", icon: <Images className="h-5 w-5" />, tr: "Görsel Çıkar", en: "Extract images" },
      { id: "aranabilir-pdf", icon: <ScanText className="h-5 w-5" />, tr: "Aranabilir PDF (OCR)", en: "Searchable PDF (OCR)" },
    ],
  },
  {
    id: "improve", tr: "İyileştir & Güvenlik", en: "Optimize & secure", accent: "emerald", convert: true,
    tools: [
      { id: "compress", icon: <Minimize2 className="h-5 w-5" />, tr: "Sıkıştır", en: "Compress" },
      { id: "repair-pdf", icon: <Wrench className="h-5 w-5" />, tr: "Onar", en: "Repair" },
      { id: "unlock-pdf", icon: <Unlock className="h-5 w-5" />, tr: "Kilit Aç", en: "Unlock" },
      { id: "encrypt", icon: <Lock className="h-5 w-5" />, tr: "Şifrele", en: "Encrypt" },
    ],
  },
  {
    id: "ai", tr: "Yapay Zekâ", en: "AI", accent: "fuchsia", convert: true,
    tools: [
      { id: "pdf-ozetle", icon: <Sparkles className="h-5 w-5" />, tr: "Özetle", en: "Summarize" },
      { id: "pdf-sohbet", icon: <MessageSquare className="h-5 w-5" />, tr: "Sohbet", en: "Chat" },
      { id: "pdf-veri-cikar", icon: <Braces className="h-5 w-5" />, tr: "Veri Çıkar", en: "Extract data" },
      { id: "pdf-ceviri", icon: <Languages className="h-5 w-5" />, tr: "Çeviri", en: "Translate" },
      { id: "hassas-veri-gizle", icon: <EyeOff className="h-5 w-5" />, tr: "Veri Gizle", en: "Redact" },
    ],
  },
];
