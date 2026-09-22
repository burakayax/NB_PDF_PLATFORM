import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Loader2, Save, User } from "lucide-react";

import { saasFetch } from "../../api/saasHttp";

/**
 * Ticari e-postalarda görünen gönderen kimliği.
 *
 * NEDEN BU EKRAN VAR: Ticari İletişim Yönetmeliği md.7, tanıtım içeren her
 * e-postanın içinde işletmenin resmî kimliğinin ve bir iletişim bilgisinin
 * bulunmasını zorunlu kılıyor. Bu bilgiler değişebilir (şahıs firmasından
 * şirkete geçiş, adres/telefon değişimi), bu yüzden panelden düzenlenir ve
 * kaydedildiği anda e-postalara yansır.
 *
 * EKSİKSE NE OLUR: Tanıtım e-postaları HİÇ gönderilmez — ne otomasyon çalışır
 * ne de elle toplu duyuru gider. Eksik bilgiyle gönderilen her tanıtım
 * e-postası ihlal olacağı için, göndermemek doğru davranış. İşlem
 * e-postaları (doğrulama, fatura, parola sıfırlama) etkilenmez.
 */

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";
const INPUT =
  "w-full rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/60";
const LABEL = "block text-xs font-medium text-slate-300";

type Identity = {
  legalName: string;
  entityType: "company" | "sole";
  mersisNo: string;
  tckn: string;
  phone: string;
  contactEmail: string;
  postalAddress: string;
};

const EMPTY: Identity = {
  legalName: "",
  entityType: "sole",
  mersisNo: "",
  tckn: "",
  phone: "",
  contactEmail: "",
  postalAddress: "",
};

export function SenderIdentityCard({ accessToken }: { accessToken: string }) {
  const [form, setForm] = useState<Identity>(EMPTY);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasFetch("/api/admin/email-compliance/identity", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { identity: Identity; missing: string[] };
      setForm(data.identity);
      setMissing(data.missing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gönderen kimliği yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saasFetch("/api/admin/email-compliance/identity", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { identity: Identity; missing: string[] };
      setForm(data.identity);
      setMissing(data.missing);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Identity>(key: K, value: Identity[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  };

  const isCompany = form.entityType === "company";

  if (loading) {
    return (
      <div className={`${CARD} flex items-center justify-center p-10 text-slate-400`}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <section className={`${CARD} p-5`}>
      <header>
        <h3 className="text-base font-semibold text-white">Gönderen kimliği</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
          Bu bilgiler tanıtım e-postalarının altında görünür ve yasal olarak zorunludur.
          Buraya girdiğiniz an e-postalara yansır — başka bir yerde ayar yapmanız gerekmez.
          İşlem e-postalarında (doğrulama, fatura, parola) gösterilmez.
        </p>
      </header>

      {/* Durum şeridi: gönderim açık mı kapalı mı, tek bakışta */}
      <div
        className={`mt-4 flex items-start gap-3 rounded-xl border p-3 ${
          missing.length === 0
            ? "border-emerald-400/25 bg-emerald-400/[0.07]"
            : "border-amber-400/25 bg-amber-400/[0.07]"
        }`}
      >
        {missing.length === 0 ? (
          <>
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-200">
                Tanıtım e-postaları gönderilebilir
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Zorunlu bilgilerin hepsi tamam.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                Tanıtım e-postaları şu an GÖNDERİLMİYOR
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Eksik zorunlu bilgiler: <strong className="text-amber-200">{missing.join(", ")}</strong>.
                Bunlar tamamlanana kadar otomatik e-posta serileri çalışmaz ve toplu duyuru
                gönderilemez. İşlem e-postaları etkilenmez.
              </p>
            </div>
          </>
        )}
      </div>

      {/* İşletme türü — hangi kimlik bilgisinin isteneceğini belirler */}
      <div className="mt-5">
        <span className={LABEL}>İşletme türü</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("entityType", "sole")}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              !isCompany
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                : "border-white/[0.1] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            <User className="h-4 w-4" />
            Şahıs firması / esnaf
          </button>
          <button
            type="button"
            onClick={() => set("entityType", "company")}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              isCompany
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                : "border-white/[0.1] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Şirket (Ltd./A.Ş.)
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {isCompany
            ? "Şirketler için ticaret unvanı ve MERSİS numarası zorunlu."
            : "Şahıs firmaları için ad soyad ve T.C. kimlik numarası zorunlu."}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="si-legalName">
            {isCompany ? "Ticaret unvanı" : "Ad soyad"}
          </label>
          <input
            id="si-legalName"
            className={`${INPUT} mt-1.5`}
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder={isCompany ? "Örn. NB Global Studio Yazılım Ltd. Şti." : "Örn. Burak Ev"}
          />
        </div>

        {isCompany ? (
          <div>
            <label className={LABEL} htmlFor="si-mersis">
              MERSİS numarası
            </label>
            <input
              id="si-mersis"
              className={`${INPUT} mt-1.5`}
              value={form.mersisNo}
              onChange={(e) => set("mersisNo", e.target.value)}
              placeholder="16 haneli MERSİS numarası"
              inputMode="numeric"
            />
          </div>
        ) : (
          <div>
            <label className={LABEL} htmlFor="si-tckn">
              T.C. kimlik numarası
            </label>
            <input
              id="si-tckn"
              className={`${INPUT} mt-1.5`}
              value={form.tckn}
              onChange={(e) => set("tckn", e.target.value)}
              placeholder="11 haneli kimlik numarası"
              inputMode="numeric"
            />
          </div>
        )}

        <div>
          <label className={LABEL} htmlFor="si-phone">
            Telefon <span className="text-slate-500">(telefon veya e-postadan biri zorunlu)</span>
          </label>
          <input
            id="si-phone"
            className={`${INPUT} mt-1.5`}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="Örn. +90 555 000 00 00"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="si-contactEmail">
            İletişim e-postası
          </label>
          <input
            id="si-contactEmail"
            className={`${INPUT} mt-1.5`}
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="Örn. info@pdfplatform.app"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="si-address">
            Posta adresi
          </label>
          <input
            id="si-address"
            className={`${INPUT} mt-1.5`}
            value={form.postalAddress}
            onChange={(e) => set("postalAddress", e.target.value)}
            placeholder="Açık adres — il/ilçe dahil"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Yurt dışına gönderim için de gerekli (ABD ve Kanada kuralları fiziksel adres
            istiyor).
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {/* İYS hatırlatması: kimlik bilgisini doldurmak tek başına yetmiyor.
          Bu ikisi karıştırılırsa "her şeyi yaptım" sanılır — oysa kayıt
          olmadan gönderilen ticari e-posta yine ihlaldir. */}
      <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
        <p className="text-xs leading-relaxed text-slate-400">
          <strong className="text-slate-300">Bunlar İYS kaydının yerine geçmez.</strong>{" "}
          Ticari e-posta gönderebilmek için ayrıca İleti Yönetim Sistemi'ne (iys.org.tr)
          kayıtlı olmanız ve verdiğiniz izinleri oraya yüklemeniz gerekir. Kayıt için
          işletmenizin açılmış olması şart. Ayrıntılar:{" "}
          <span className="text-slate-300">docs/legal/02-ticari-eposta-uyum.md</span>
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </button>
        {savedAt ? (
          <span className="text-sm text-emerald-300">Kaydedildi — e-postalara yansıdı.</span>
        ) : null}
      </div>
    </section>
  );
}
