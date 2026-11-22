/**
 * Cloudflare Worker: pdfplatform-ajan-tetik
 * GitHub'in zamanlanmis isleri saatlerce geciktirdigi icin "durum" ve "ozet" ajanlarini zamaninda baslatir
 * (workflow_dispatch). Bu iki ajanin GitHub zamanlamasi kaldirildi; cift calisma olmaz.
 * Diger ajanlar (seo, sosyal, finans, bakim) GitHub zamanlamasiyla calismaya devam eder.
 *
 * Gerekli: GH_TOKEN (gizli degisken; fine-grained, yalniz bu depo, yalniz "Actions: Read and write").
 * Cron (UTC): "45 4 * * *" -> durum, "25 5 * * *" -> ozet.
 * Yalniz GitHub'a tek bir istek atar; baska hicbir yere erismez, hicbir sey yazmaz.
 */
const REPO = "burakayax/NB_PDF_PLATFORM";
const AJAN = { "45 4 * * *": "durum", "25 5 * * *": "ozet" };

export async function tetikle(cron, token, fetchFn = fetch) {
  const ajan = AJAN[cron];
  if (!ajan) return { ok: false, ajan: null, durum: "bilinmeyen-cron" };
  if (!token) return { ok: false, ajan, durum: "anahtar-yok" };
  const r = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/ajanlar.yml/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "pdfplatform-ajan-tetik",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { ajan } }),
  });
  return { ok: r.status === 204, ajan, durum: r.status };
}

export default {
  async scheduled(event, env) {
    const s = await tetikle(event.cron, env.GH_TOKEN);
    console.log(JSON.stringify(s)); // anahtar asla loga yazilmaz
    if (!s.ok) throw new Error(`tetik basarisiz: ${s.ajan} ${s.durum}`);
  },
  async fetch() {
    return new Response("yok", { status: 404 });
  },
};
