import { useSettings } from "../contexts/SettingsContext";

/** PDF Düzenle günlük hakları — yönetim panelindeki değerler; ulaşılamazsa kod varsayılanları. */
export type EditorLimits = { guest: number; free: number; starter: number };
export const DEFAULT_EDITOR_LIMITS: EditorLimits = { guest: 1, free: 2, starter: 10 };

export function useEditorLimits(): EditorLimits {
  const { cards } = useSettings();
  const l = cards?.editorLimits;
  if (!l) return DEFAULT_EDITOR_LIMITS;
  const pick = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    guest: pick(l.guest, DEFAULT_EDITOR_LIMITS.guest),
    free: pick(l.free, DEFAULT_EDITOR_LIMITS.free),
    starter: pick(l.starter, DEFAULT_EDITOR_LIMITS.starter),
  };
}

/** Plan kartı metinlerindeki {editorFree}/{editorStarter}/{editorGuest} yer tutucularını canlı değerle doldurur. */
export function fillEditorTokens(text: string, l: EditorLimits): string {
  return text
    .replace(/\{editorGuest\}/g, String(l.guest))
    .replace(/\{editorFree\}/g, String(l.free))
    .replace(/\{editorStarter\}/g, String(l.starter));
}
