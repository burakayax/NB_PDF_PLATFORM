/**
 * Çöküş bekçisi kaydından sabah e-postası satırı üretir (saf fonksiyon; ağ/dosya yok).
 * Kayıt, Cloudflare Worker'ın (cloudflare/bekci-worker.mjs) özel R2 klasörüne yazdığı bekci/kayit.json'dur.
 * GÖLGE MODU: bu satırlar yalnız "ne yapardım" bilgisidir; hiçbir şey yapılmadı.
 */
const tr = (t) => new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const KARAR = { GERI_ALIRDIM: "GERİ ALIRDIM", GERI_ALMAZDIM: "geri ALMAZDIM" };

export function bekciOzet(kayit, now = Date.now()) {
  if (!kayit || typeof kayit !== "object" || !Number.isFinite(kayit.guncelleme)) {
    return { satir: "Bekçi kaydı henüz yok (kurulmamış ya da ilk kontrol bekleniyor).", dikkat: [] };
  }
  const dikkat = [];
  const parcalar = [];
  const yasSaat = (now - kayit.guncelleme) / 3600000;
  if (yasSaat > 2) dikkat.push(`Çöküş bekçisi ${Math.floor(yasSaat)} saattir kayıt yazmadı; Cloudflare'daki bekçi çalışmıyor olabilir.`);
  const k = kayit.son24 || {};
  parcalar.push(`Son 24 saatte ${k.kontrol ?? "?"} kontrol, ${k.basarisiz ?? "?"} başarısız.`);
  const olaylar = (Array.isArray(kayit.olaylar) ? kayit.olaylar : []).filter((o) => Number.isFinite(o.basladi) && now - o.basladi <= 24 * 3600000);
  for (const o of olaylar) {
    const sure = o.bitti ? `${o.sureDk} dk sürdü` : "hâlâ devam ediyor";
    const kural = (o.kurallar || []).filter((x) => !x.tamam).map((x) => x.aciklama);
    const neden = o.karar === "GERI_ALIRDIM" ? "4 kuralın hepsi sağlandı" : kural.join(" ");
    const bir = o.sonBirlestirme ? ` Son birleştirme: ${o.sonBirlestirme.sha}.` : "";
    parcalar.push(`Kesinti ${tr(o.basladi)} (TR) başladı, ${sure}. Gölge kaydı: ${KARAR[o.karar] || o.karar}. ${neden}${bir}`);
    dikkat.push(`Sitede kesinti oldu (${tr(o.basladi)} TR, ${sure}). Bekçi (gölge) kaydı: ${KARAR[o.karar] || o.karar}.`);
  }
  parcalar.push("Gölge modu: hiçbir şey yapılmadı.");
  return { satir: parcalar.join(" "), dikkat };
}
