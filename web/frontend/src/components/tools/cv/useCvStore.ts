import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_CV, normalizeCv, uid, type CvData } from "./cvModel";

/**
 * ÇOKLU CV DEPOSU — kullanıcı farklı ilanlar için birden çok CV (sürüm) tutabilir.
 * Her şey bu cihazda (localStorage) durur; sunucuya gitmez. Depolama dolu/engelliyse
 * araç yine çalışır, yalnızca taslak kalıcı olmaz.
 *
 * Eski tek-taslak anahtarı (nb_cv_draft_v1) ilk açılışta otomatik içe alınır.
 */
const STORE_KEY = "nb_cv_store_v2";
const LEGACY_KEY = "nb_cv_draft_v1";
export const MAX_CVS = 12;

export type CvEntry = { id: string; name: string; data: CvData; templateId: string; updatedAt: number };
type Stored = { v: 2; currentId: string; cvs: CvEntry[] };

function fresh(lang: "tr" | "en", name?: string): CvEntry {
  return {
    id: uid(),
    name: name ?? (lang === "tr" ? "CV 1" : "CV 1"),
    data: normalizeCv({ ...EMPTY_CV, settings: { ...EMPTY_CV.settings, lang } }),
    templateId: "sade",
    updatedAt: Date.now(),
  };
}

function load(lang: "tr" | "en"): Stored {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Stored;
      if (j && j.v === 2 && Array.isArray(j.cvs) && j.cvs.length) {
        const cvs = j.cvs.map((c) => ({ ...c, data: normalizeCv(c.data) }));
        return { v: 2, cvs, currentId: cvs.some((c) => c.id === j.currentId) ? j.currentId : cvs[0].id };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const j = JSON.parse(legacy) as { data?: Partial<CvData>; templateId?: string };
      if (j?.data && typeof j.data === "object") {
        const e: CvEntry = { id: uid(), name: "CV 1", data: normalizeCv(j.data), templateId: j.templateId ?? "sade", updatedAt: Date.now() };
        return { v: 2, cvs: [e], currentId: e.id };
      }
    }
  } catch {
    /* bozuk kayıt → temiz başla */
  }
  const e = fresh(lang);
  return { v: 2, cvs: [e], currentId: e.id };
}

function save(s: Stored): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* depolama dolu/engelli olabilir; taslak kaydı bir kolaylıktır */
  }
}

export function useCvStore(lang: "tr" | "en", persist: boolean) {
  const [store, setStore] = useState<Stored>(() => load(lang));
  const first = useRef(true);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!persist) return;
    const id = window.setTimeout(() => save(store), 500);
    return () => window.clearTimeout(id);
  }, [store, persist]);

  const current = useMemo(() => store.cvs.find((c) => c.id === store.currentId) ?? store.cvs[0], [store]);

  const patch = useCallback((p: Partial<Pick<CvEntry, "data" | "templateId" | "name">>) => {
    setStore((s) => ({ ...s, cvs: s.cvs.map((c) => (c.id === s.currentId ? { ...c, ...p, updatedAt: Date.now() } : c)) }));
  }, []);

  const setData = useCallback((d: CvData) => patch({ data: d }), [patch]);
  const setTemplateId = useCallback((t: string) => patch({ templateId: t }), [patch]);

  const add = useCallback((opts?: { name?: string; data?: CvData; templateId?: string }) => {
    setStore((s) => {
      if (s.cvs.length >= MAX_CVS) return s;
      const base = fresh(lang, opts?.name ?? `CV ${s.cvs.length + 1}`);
      const e: CvEntry = { ...base, data: opts?.data ? normalizeCv(opts.data) : base.data, templateId: opts?.templateId ?? s.cvs.find((c) => c.id === s.currentId)?.templateId ?? "sade" };
      return { ...s, cvs: [...s.cvs, e], currentId: e.id };
    });
  }, [lang]);

  const duplicate = useCallback(() => {
    setStore((s) => {
      if (s.cvs.length >= MAX_CVS) return s;
      const cur = s.cvs.find((c) => c.id === s.currentId) ?? s.cvs[0];
      const e: CvEntry = { ...cur, id: uid(), name: `${cur.name} (${lang === "tr" ? "kopya" : "copy"})`, data: structuredClone(cur.data), updatedAt: Date.now() };
      return { ...s, cvs: [...s.cvs, e], currentId: e.id };
    });
  }, [lang]);

  const rename = useCallback((name: string) => patch({ name: name.slice(0, 40) }), [patch]);

  const remove = useCallback(() => {
    setStore((s) => {
      if (s.cvs.length <= 1) {
        const e = fresh(lang);
        return { ...s, cvs: [e], currentId: e.id };
      }
      const cvs = s.cvs.filter((c) => c.id !== s.currentId);
      return { ...s, cvs, currentId: cvs[0].id };
    });
  }, [lang]);

  const switchTo = useCallback((id: string) => setStore((s) => (s.cvs.some((c) => c.id === id) ? { ...s, currentId: id } : s)), []);

  /** Tüm CV'lerin yedeği (JSON). Fotoğraflar dahildir. */
  const exportJson = useCallback((): string => JSON.stringify({ app: "pdfplatform-cv", v: 2, exportedAt: new Date().toISOString(), cvs: store.cvs }, null, 2), [store.cvs]);

  /** Yedekten içe aktar: mevcutlara EKLER (üzerine yazmaz). Eklenen sayısını döndürür. */
  const importJson = useCallback((text: string): number => {
    const j = JSON.parse(text) as { app?: string; cvs?: CvEntry[]; data?: Partial<CvData> };
    const list: CvEntry[] = Array.isArray(j.cvs)
      ? j.cvs
      : j.data
        ? [{ id: uid(), name: "CV", data: normalizeCv(j.data), templateId: "sade", updatedAt: Date.now() }]
        : [];
    if (!list.length) throw new Error("empty");
    const s0 = storeRef.current;
    const room = MAX_CVS - s0.cvs.length;
    const take = list.slice(0, Math.max(0, room)).map((c) => ({ ...c, id: uid(), data: normalizeCv(c.data), name: String(c.name ?? "CV").slice(0, 40), updatedAt: Date.now() }));
    const added = take.length;
    if (added) setStore((s) => ({ ...s, cvs: [...s.cvs, ...take], currentId: take[0].id }));
    return added;
  }, []);

  return { cvs: store.cvs, current, data: current.data, templateId: current.templateId, setData, setTemplateId, add, duplicate, rename, remove, switchTo, exportJson, importJson };
}
