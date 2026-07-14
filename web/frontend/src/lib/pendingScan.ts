/**
 * Taranan (veya dışarıdan paylaşılan) PDF'i IndexedDB'de geçici saklar. Amaç:
 * kullanıcı "PDF Araçlarında aç" ile bir dönüştürme aracı seçtiğinde, araç giriş/
 * üyelik gerektirse bile taranan PDF KAYBOLMASIN — giriş sonrası araç sayfası bunu
 * geri yükler. localStorage/sessionStorage büyük Blob'lar için yetersiz; IndexedDB
 * File'ı (structured clone) doğrudan saklar.
 */
const DB_NAME = "nbpdf";
const STORE = "pendingScan";
const KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Taranan PDF'i sakla (önceki bekleyeni ezer). */
export async function saveScannedPdf(file: File): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Bekleyen PDF'i al VE sil (tek kullanımlık). Yoksa null. */
export async function takeScannedPdf(): Promise<File | null> {
  const db = await openDb();
  try {
    return await new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => {
        const val = getReq.result as File | undefined;
        store.delete(KEY);
        resolve(val ?? null);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } finally {
    db.close();
  }
}

/** Bekleyen PDF var mı (silmeden kontrol). */
export async function hasScannedPdf(): Promise<boolean> {
  try {
    const db = await openDb();
    try {
      return await new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).count(KEY);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      });
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
