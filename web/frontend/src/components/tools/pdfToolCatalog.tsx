import type { ReactNode } from "react";
import {
  ScanLine,
  FlipHorizontal2,
  Scaling,
  Contrast,
  Shuffle,
  Braces,
  Combine,
  Crop,
  Droplets,
  EyeOff,
  FilePlus2,
  FileText,
  Eraser,
  Archive,
  Grid2x2,
  FileSignature,
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
  Gavel,
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
      { id: "organize-pdf", icon: <Sliders className="h-5 w-5" />, tr: "Sayfa Sırala", en: "Reorder Pages" },
      { id: "split", icon: <Layers className="h-5 w-5" />, tr: "PDF Böl", en: "Split PDF" },
      { id: "rotate-pdf", icon: <RotateCcw className="h-5 w-5" />, tr: "PDF Döndür", en: "Rotate PDF" },
      { id: "delete-pages", icon: <Trash2 className="h-5 w-5" />, tr: "Sayfa Sil", en: "Delete Pages" },
      { id: "grayscale-pdf", icon: <Contrast className="h-5 w-5" />, tr: "PDF Gri Tonlama", en: "Grayscale PDF" },
      { id: "resize-pdf", icon: <Scaling className="h-5 w-5" />, tr: "PDF Sayfa Boyutu", en: "Resize PDF Pages" },
      { id: "flip-pdf", icon: <FlipHorizontal2 className="h-5 w-5" />, tr: "PDF Çevir (Ayna)", en: "Flip PDF" },
      { id: "alternate-mix-pdf", icon: <Shuffle className="h-5 w-5" />, tr: "PDF Dönüşümlü Birleştir", en: "Alternate & Mix PDF" },
      { id: "deskew-pdf", icon: <ScanLine className="h-5 w-5" />, tr: "PDF Eğri Tarama Düzeltme", en: "Deskew PDF" },
      { id: "flatten-pdf", icon: <Combine className="h-5 w-5" />, tr: "PDF Düzleştir", en: "Flatten PDF" },
      { id: "form-doldur", icon: <FileText className="h-5 w-5" />, tr: "PDF Form Doldur", en: "Fill PDF Form" },
      { id: "ustveri-temizle", icon: <Eraser className="h-5 w-5" />, tr: "PDF Üstveri Temizle", en: "Remove PDF Metadata" },
      { id: "pdf-to-pdfa", icon: <Archive className="h-5 w-5" />, tr: "PDF → PDF/A (Arşiv)", en: "PDF to PDF/A (Archive)" },
      { id: "sayfa-duzeni", icon: <Grid2x2 className="h-5 w-5" />, tr: "PDF Sayfa Düzeni", en: "PDF Page Layout" },
      { id: "imza-iste", icon: <FileSignature className="h-5 w-5" />, tr: "İmza İste", en: "Request Signature" },
      { id: "merge", icon: <FilePlus2 className="h-5 w-5" />, tr: "PDF Birleştir", en: "Merge PDF" },
    ],
  },
  {
    id: "mark", tr: "İmzala & İşaretle", en: "Sign & mark", accent: "amber", convert: false,
    tools: [
      { id: "pdf-imzala", icon: <PenTool className="h-5 w-5" />, tr: "PDF İmzala", en: "Sign PDF" },
      { id: "pdf-yorumla", icon: <Highlighter className="h-5 w-5" />, tr: "PDF İşaretle", en: "Markup PDF" },
      { id: "watermark", icon: <Droplets className="h-5 w-5" />, tr: "Filigran Ekle", en: "Add Watermark" },
      { id: "page-numbers", icon: <Hash className="h-5 w-5" />, tr: "Sayfa Numarası", en: "Page Numbers" },
    ],
  },
  {
    id: "convert", tr: "Dönüştür & Çıkar", en: "Convert & extract", accent: "violet", convert: true,
    tools: [
      { id: "pdf-to-word", icon: <FileText className="h-5 w-5" />, tr: "PDF → Word", en: "PDF → Word" },
      { id: "pdf-to-excel", icon: <Table className="h-5 w-5" />, tr: "PDF → Excel", en: "PDF → Excel" },
      { id: "pdf-to-ppt", icon: <Presentation className="h-5 w-5" />, tr: "PDF → PowerPoint", en: "PDF → PowerPoint" },
      { id: "pdf-to-image", icon: <ImageIcon className="h-5 w-5" />, tr: "PDF → Görsel", en: "PDF → Image" },
      { id: "pdf-to-text", icon: <Type className="h-5 w-5" />, tr: "PDF → Metin", en: "PDF → Text" },
      { id: "extract-images", icon: <Images className="h-5 w-5" />, tr: "Görselleri Çıkar", en: "Extract Images" },
      { id: "aranabilir-pdf", icon: <ScanText className="h-5 w-5" />, tr: "Aranabilir PDF", en: "Searchable PDF" },
    ],
  },
  {
    id: "improve", tr: "İyileştir & Güvenlik", en: "Optimize & secure", accent: "emerald", convert: true,
    tools: [
      { id: "compress", icon: <Minimize2 className="h-5 w-5" />, tr: "PDF Sıkıştır", en: "Compress PDF" },
      { id: "repair-pdf", icon: <Wrench className="h-5 w-5" />, tr: "PDF Onar", en: "Repair PDF" },
      { id: "unlock-pdf", icon: <Unlock className="h-5 w-5" />, tr: "Şifre Kaldır", en: "Unlock PDF" },
      { id: "encrypt", icon: <Lock className="h-5 w-5" />, tr: "PDF Şifrele", en: "Encrypt PDF" },
    ],
  },
  {
    id: "ai", tr: "Yapay Zekâ", en: "AI", accent: "fuchsia", convert: true,
    tools: [
      { id: "pdf-ozetle", icon: <Sparkles className="h-5 w-5" />, tr: "PDF Özetle", en: "Summarize PDF" },
      { id: "pdf-sohbet", icon: <MessageSquare className="h-5 w-5" />, tr: "PDF ile Sohbet", en: "Chat with PDF" },
      { id: "pdf-veri-cikar", icon: <Braces className="h-5 w-5" />, tr: "PDF Veri Çıkar", en: "Extract Data" },
      { id: "pdf-ceviri", icon: <Languages className="h-5 w-5" />, tr: "PDF Çeviri", en: "Translate PDF" },
      { id: "sozlesme-denetci", icon: <Gavel className="h-5 w-5" />, tr: "Sözleşme Denetçisi", en: "Contract Auditor" },
      { id: "hassas-veri-gizle", icon: <EyeOff className="h-5 w-5" />, tr: "Hassas Veri Gizle", en: "Redact PDF" },
    ],
  },
];
