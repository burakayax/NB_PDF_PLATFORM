/**
 * Taranan (veya dışarıdan paylaşılan) PDF'i IndexedDB'de geçici saklar. Amaç:
 * kullanıcı "PDF Araçlarında aç" ile bir dönüştürme aracı seçtiğinde, araç giriş/
 * üyelik gerektirse bile taranan PDF KAYBOLMASIN — giriş sonrası araç sayfası bunu
 * geri yükler. localStorage/sessionStorage büyük Blob'lar için yetersiz; IndexedDB
 * File'ı (structured clone) doğrudan saklar.
 */
/**
 * GİZLİLİK: Bu geçici saklama yalnızca giriş/kayıt yönlendirmesi sırasında dosya
 * kaybolmasın diye var. Teslim edilmeyen dosya cihazda KALMASIN diye her kayıt
 * zaman damgalı tutulur ve `PENDING_TTL_MS` sonra geçersiz sayılıp silinir.
 * Uygulama açılırken (`purgeExpiredScans`) ve çıkışta (`clearAllScans`) temizlenir.
 */
export const PENDING_TTL_MS = 30 * 60 * 1000;
type Stored = { file: File; savedAt: number };
const wrap = (file: File): Stored => ({ file, savedAt: Date.now() });
/** Süresi dolmamış kayıttan dosyayı çıkarır; eski biçim (zaman damgasız) ya da süresi dolmuş → null. */
function freshFile(v: unknown): File | null {
  const r = v as Partial<Stored> | undefined;
  if (!r || !(r.file instanceof Blob) || typeof r.savedAt !== "number") return null;
  return Date.now() - r.savedAt > PENDING_TTL_MS ? null : r.file;
}

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
      tx.objectStore(STORE).put(wrap(file), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Bekleyen PDF'i SİLMEDEN oku. `takeScannedPdf` okurken sildiği için, teslim
 * eden effect iptal edilirse (React araç/panel state'i otururken birkaç kez
 * koşuyor) dosya ne IndexedDB'de ne de araçta kalıyordu → sessizce kayboluyordu.
 * Doğru sıra: ÖNCE oku, araca TESLİM ET, SONRA `clearScannedPdf` ile sil.
 */
export async function peekScannedPdf(): Promise<File | null> {
  try {
    const db = await openDb();
    try {
      return await new Promise<File | null>((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(freshFile(req.result));
        req.onerror = () => resolve(null);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Bekleyen PDF kaydını sil (teslim BAŞARILI olduktan sonra çağrılır). */
export async function clearScannedPdf(): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } finally {
      db.close();
    }
  } catch {
    /* yoksay */
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
        const val = freshFile(getReq.result);
        store.delete(KEY);
        resolve(val);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } finally {
    db.close();
  }
}

/**
 * "Hesabıma kaydet" için bekleyen tarama. Misafir kullanıcı sonuç ekranında
 * "Hesabıma kaydet"e basıp giriş yaptığında (özellikle Google ile TAM SAYFA
 * yönlendirme olduğunda) belge bellekten kaybolur. Burada saklanır → giriş
 * sonrası otomatik olarak hesaba yüklenir ve kullanıcıya bildirilir.
 */
const ACCOUNT_KEY = "accountSave";

export async function saveScanForAccount(file: File): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(wrap(file), ACCOUNT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Hesaba kaydedilmeyi bekleyen taramayı al VE sil (tek kullanımlık). */
export async function takeScanForAccount(): Promise<File | null> {
  try {
    const db = await openDb();
    try {
      return await new Promise<File | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const getReq = store.get(ACCOUNT_KEY);
        getReq.onsuccess = () => {
          const val = freshFile(getReq.result);
          store.delete(ACCOUNT_KEY);
          resolve(val);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Bekleyen PDF var mı (silmeden kontrol). Süresi dolmuşsa yok sayılır. */
export async function hasScannedPdf(): Promise<boolean> {
  return (await peekScannedPdf()) !== null;
}

/** Süresi dolmuş (ya da eski biçimli, zaman damgasız) tüm kayıtları siler. Uygulama açılırken çağrılır. */
export async function purgeExpiredScans(): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          if (freshFile(cur.value) === null) cur.delete();
          cur.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } finally {
      db.close();
    }
  } catch {
    /* IndexedDB yok / kapalı */
  }
}

/** Bekleyen tüm dosyaları siler (çıkışta çağrılır). */
export async function clearAllScans(): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } finally {
      db.close();
    }
  } catch {
    /* yoksay */
  }
}
