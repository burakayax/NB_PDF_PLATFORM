/**
 * KAMPANYA ŞABLONLARI — araştırmaya dayalı.
 *
 * Kaynaklar (kısa uygulanan ilkelerle):
 *  - Mailchimp (mailchimp.com/resources/email-marketing-trends): konu satırında
 *    sayı kullanmak açılma oranını yükseltir; gövdede TEK net başlık + net
 *    hiyerarşi (kalabalık değil).
 *  - Userpilot / Appcues (özellik duyurusu formülü): tek cümlelik sorun
 *    tanımı → 2-3 cümlelik özellik açıklaması → tek, belirgin CTA düğmesi.
 *  - Encharge / OptinMonster / ConstantContact (promosyon e-postaları):
 *    teklifi konu satırında açıkça söyle, indirim miktarını net yaz, gerçek
 *    bir bitiş tarihiyle aciliyet ver — abartılı aciliyet güveni azaltır.
 *  - HubSpot (geri-kazanım/"We miss you" e-postaları): suçlayıcı değil, sıcak
 *    ve insani ton; markanın faydasına odaklan, kullanıcının pasifliğine değil.
 *  - SurveyMonkey / Hiver (geri bildirim daveti): 300 kelimenin altı, tek net
 *    soru/istek, neden sorulduğunu şeffafça söyle, tek CTA.
 *  - Moosend / Stripo / Brevo (CTA best practice): CTA'yı düğme yap, kısa ve
 *    eylem fiili kullan ("Şimdi Dene", "İndirimi Kullan").
 *
 * NOT: Bu HTML, gönderim anında otomatik olarak marka header/footer ve
 * abonelikten-çıkma linkiyle SARILIYOR (bkz. web/api/src/lib/email-service.ts
 * `sendMassCampaignEmail` → `renderCorporateEmail`). Bu yüzden şablonlar tam
 * bir HTML doküman DEĞİL, yalnızca gövde içeriğidir.
 */

export type CampaignTemplate = {
  id: string;
  title: string;
  useCase: string;
  subject: string;
  bodyHtml: string;
};

const ctaButton = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 26px;border-radius:10px;background:#7c3aed;color:#ffffff;font-weight:700;text-decoration:none;">${label}</a>`;

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "feature-announce",
    title: "Yeni özellik / araç duyurusu",
    useCase: "Yeni bir PDF aracı veya özellik çıktığında kullanın.",
    subject: "Yeni: PDF'den Word'e artık tek tıkla ✨",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>Dosyanı doğru formatta paylaşmak için uğraşmak zorunda kalman canını sıkıyordu, biliyoruz.</p>` +
      `<p>Artık <strong>PDF Platform</strong>'da bu tamamen otomatik: dosyanı yükle, birkaç saniye içinde düzenlenebilir Word belgen hazır olsun — orijinal biçimlendirme korunur.</p>` +
      `<p>${ctaButton("Şimdi Dene", "https://pdfplatform.app")}</p>`,
  },
  {
    id: "promo-discount",
    title: "İndirim / promosyon kampanyası",
    useCase: "Sınırlı süreli bir indirim veya kampanya duyurusu için kullanın.",
    subject: "Yalnızca bugün: PRO planda %20 indirim ⏰",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>Bugüne özel: <strong>PRO plana geçenlere %20 indirim</strong>. Sınırsız kullanım, yapay zekâ araçları ve öncelikli işlem hızı bu fiyatla senin.</p>` +
      `<p>Bu teklif yalnızca <u>bugün 23:59'a kadar</u> geçerli — sonra normal fiyata döner.</p>` +
      `<p>${ctaButton("İndirimi Kullan", "https://pdfplatform.app/#pricing")}</p>`,
  },
  {
    id: "winback-manual",
    title: "Geri kazanım — \"seni özledik\"",
    useCase: "Bir süredir siteye girmemiş kullanıcılara sıcak bir hatırlatma için kullanın (otomatik 13-gün e-postasından ayrı, manuel/elle gönderim).",
    subject: "Seni özledik 👋",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>Bir süredir PDF Platform'da görünmüyorsun — umarız her şey yolundadır.</p>` +
      `<p>Sen yokken biz boş durmadık: birkaç araç hızlandı, yeni özellikler eklendi. Kaldığın yerden devam etmek ister misin?</p>` +
      `<p>${ctaButton("Tekrar Göz At", "https://pdfplatform.app")}</p>`,
  },
  {
    id: "tips-newsletter",
    title: "İpucu / haber bülteni",
    useCase: "Kullanıcılara ürünle ilgili kısa, değerli bir ipucu paylaşmak için kullanın.",
    subject: "PDF'lerini 3 katına kadar küçültmenin yolu",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>Kısa bir ipucu: Büyük PDF'leri e-postayla göndermeden önce <strong>Sıkıştır</strong> aracımızdan geçirirsen, kaliteden neredeyse hiç ödün vermeden dosya boyutunu büyük ölçüde küçültebilirsin.</p>` +
      `<p>Bir sonraki e-postan geri dönmesin diye deneyebilirsin:</p>` +
      `<p>${ctaButton("Şimdi Sıkıştır", "https://pdfplatform.app")}</p>`,
  },
  {
    id: "milestone-social-proof",
    title: "Ürün kilometre taşı / sosyal kanıt",
    useCase: "Önemli bir kullanıcı sayısı veya başarı haberini paylaşmak için kullanın (konu satırındaki somut sayı açılma oranını yükseltir).",
    subject: "50.000 kullanıcı bize güvendi 🎉",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>Bugün küçük ama bizim için büyük bir haberimiz var: PDF Platform'u <strong>50.000'den fazla kişi</strong> kullanıyor.</p>` +
      `<p>Bu yolculukta yanımızda olduğun için teşekkürler. Henüz denemediğin bir araç varsa şimdi tam zamanı.</p>` +
      `<p>${ctaButton("Araçları Gör", "https://pdfplatform.app")}</p>`,
  },
  {
    id: "feedback-survey",
    title: "Anket / geri bildirim daveti",
    useCase: "Kullanıcı görüşü toplamak için kısa bir anket daveti göndermek üzere kullanın.",
    subject: "30 saniyeni ayırır mısın?",
    bodyHtml:
      `<p>Merhaba {{name}},</p>` +
      `<p>PDF Platform'u nasıl daha iyi yapabileceğimizi senden dinlemek istiyoruz — 30 saniyenizi alacak tek bir soru.</p>` +
      `<p>Görüşün doğrudan yol haritamıza yansıyor.</p>` +
      `<p>${ctaButton("Geri Bildirim Ver", "https://pdfplatform.app/#faq")}</p>`,
  },
];
