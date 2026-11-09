/**
 * İMZA E-POSTALARI — kurumsal ortak şablonla (renderCorporateEmail).
 *
 * Bunlar İŞLEM e-postasıdır (hizmetin işleyişinin parçası); tanıtım değildir.
 * Yine de imzalayan kişi çoğunlukla hesapsızdır, bu yüzden altta tek bir sakin
 * «ücretsiz başla» daveti bulunur — bağlantı yalnızca siteye gider, e-posta
 * adresi hiçbir yere aktarılmaz ve ayrı bir pazarlama izni varsayılmaz.
 */
import { env } from "../../config/env.js";
import { escapeHtml } from "../../lib/email-html.js";
import { notDuzMetin } from "./signature.note.js";
import {
  calloutBox,
  checkList,
  ctaButton,
  detailTable,
  EMAIL_COLORS,
  para,
  renderCorporateEmail,
} from "../../lib/email-layout.js";

const URUN = "PDF Platform";
/** Yerelde FRONTEND_ORIGIN localhost olduğundan e-posta istemcisi logoyu açamaz; her zaman herkese açık adres. */
const LOGO = "https://www.pdfplatform.app/emblem.png";

function site(): string {
  return (env.FRONTEND_ORIGIN || "https://www.pdfplatform.app").replace(/\/$/, "");
}

/** Gönderen için: ürünü dolaylı tanıtan, işe yarar bir sonraki-adım listesi. */
function sonrakiAdimlar(): string {
  return (
    `<div style="margin:26px 0 4px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">İmzalı belgeyle sıradaki adım</div>` +
    checkList([
      "<strong>Sıkıştırın:</strong> imzalı PDF'i e-postaya sığacak boyuta indirin.",
      "<strong>Birleştirin:</strong> sözleşme ve eklerini tek dosyada toplayın.",
      "<strong>Sayfa düzenleyin:</strong> sayfa ekleyin, silin, sıralayın; çoğu işlem tarayıcınızda, dosyanız cihazınızdan çıkmadan yapılır.",
    ])
  );
}

/** Hesapsız imzalayana tek satırlık, sakin davet. */
function ucretsizBasla(): string {
  const c = EMAIL_COLORS;
  const url = `${site()}/register`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:separate;border:1px solid ${c.line};border-radius:10px;background:${c.soft};">
      <tr>
        <td style="padding:18px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <div style="font-size:15px;font-weight:700;color:${c.ink};">Belgelerinizi siz de ücretsiz imzalayın</div>
          <div style="margin-top:6px;font-size:14px;line-height:1.6;color:${c.body};">
            PDF Platform ile PDF birleştirin, sıkıştırın, düzenleyin ve imza isteyin. Çoğu araç
            tarayıcınızda çalışır; dosyanız cihazınızdan çıkmaz. Kredi kartı gerekmez.
          </div>
          <div style="margin-top:12px;">
            <a href="${url}" target="_blank" style="font-size:14px;font-weight:700;color:${c.brand};text-decoration:none;">Ücretsiz başla &rarr;</a>
            <span style="color:${c.faint};padding:0 8px;">·</span>
            <a href="${site()}" target="_blank" style="font-size:14px;color:${c.muted};text-decoration:none;">pdfplatform.app</a>
          </div>
        </td>
      </tr>
    </table>`;
}

export function imzaIstegiEposta(p: {
  gonderenAd: string;
  gonderenEposta: string;
  baslik: string;
  /** Zaten temizlenmiş (beyaz listeli) HTML. */
  notHtml?: string;
  baglanti: string;
  gecerlilikGun: number;
}): { subject: string; text: string; html: string } {
  const ad = escapeHtml(p.gonderenAd);
  const rows = [
    { label: "Belge", value: `<strong>${escapeHtml(p.baslik)}</strong>` },
    { label: "Gönderen", value: `${ad}<br /><span style="color:${EMAIL_COLORS.muted};font-size:13px;">${escapeHtml(p.gonderenEposta)}</span>` },
    { label: "Geçerlilik", value: `${p.gecerlilikGun} gün` },
  ];
  const body =
    detailTable(rows) +
    (p.notHtml ? `<div style="height:16px;"></div>` + calloutBox("Gönderenin notu", p.notHtml) : "") +
    ctaButton(p.baglanti, "Belgeyi görüntüle ve imzala") +
    para(
      `<span style="font-size:13px;color:${EMAIL_COLORS.muted};">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br />` +
        `<a href="${p.baglanti}" style="color:${EMAIL_COLORS.brand};word-break:break-all;">${p.baglanti}</a></span>`,
    ) +
    para(
      `<span style="font-size:13px;color:${EMAIL_COLORS.muted};">Hesap açmanız gerekmez. Bağlantı yalnızca sizin için üretilmiştir; başkalarıyla paylaşmayın. ` +
        `Bu isteği beklemiyorsanız e-postayı yok sayabilirsiniz.</span>`,
    ) +
    ucretsizBasla();

  return {
    subject: `${p.gonderenAd} imzanızı bekliyor: «${p.baslik}» · hesap gerekmez, 1 dakika`,
    text:
      `${p.gonderenAd} (${p.gonderenEposta}) bir belgeyi imzalamanızı istiyor: ${p.baslik}\n\n` +
      (p.notHtml ? `Notu: ${notDuzMetin(p.notHtml)}\n\n` : "") +
      `Belgeyi görüntülemek ve imzalamak için: ${p.baglanti}\n\n` +
      `Bağlantı ${p.gecerlilikGun} gün geçerlidir ve yalnızca sizin için üretilmiştir. Hesap açmanız gerekmez.\n\n` +
      `PDF Platform — ücretsiz başlayın: ${site()}/register`,
    html: renderCorporateEmail({
      eyebrow: "İmza isteği",
      title: "İmzanız bekleniyor",
      intro: `<strong>${ad}</strong> sizden bir belgeyi imzalamanızı istiyor.`,
      bodyHtml: body,
      footerText: "Bu e-posta, bir kullanıcının PDF Platform üzerinden gönderdiği imza isteği nedeniyle iletildi.",
      productName: URUN,
      logoUrl: LOGO,
      preheader: `${p.gonderenAd} sizden «${p.baslik}» belgesini imzalamanızı istiyor.`,
    }),
  };
}

export function imzalandiGonderenEposta(p: {
  baslik: string;
  imzalayanAd: string;
  imzalayanEposta: string;
  imzaZamani: Date;
}): { subject: string; text: string; html: string } {
  const ad = escapeHtml(p.imzalayanAd);
  const zaman = p.imzaZamani.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const body =
    detailTable([
      { label: "Belge", value: `<strong>${escapeHtml(p.baslik)}</strong>` },
      { label: "İmzalayan", value: `${ad}<br /><span style="color:${EMAIL_COLORS.muted};font-size:13px;">${escapeHtml(p.imzalayanEposta)}</span>` },
      { label: "İmza zamanı", value: `${escapeHtml(zaman)} (TSİ)` },
    ]) +
    calloutBox(
      "İmzalı belge hazır",
      "İmzalı belge, imzalama sürecinin zaman damgalı kaydını taşıyan bir denetim sertifikası sayfasıyla birlikte hesabınızda hazır.",
    ) +
    ctaButton(`${site()}/tools/imza-iste?giris=1`, "İmzalı belgeye git") +
    para(
      `<span style="font-size:13px;color:${EMAIL_COLORS.muted};">Düğme sizi doğrudan İmza İste aracına götürür; oturumunuz açık değilse önce giriş ekranı gelir, girişten sonra araca dönersiniz.</span>`,
    ) +
    sonrakiAdimlar();

  return {
    subject: `✅ İmzalandı: «${p.baslik}» · ${p.imzalayanAd} belgeyi imzaladı`,
    text:
      `«${p.baslik}» belgesi ${p.imzalayanAd} tarafından imzalandı (${zaman}).\n\n` +
      `İmzalı belge, denetim sertifikasıyla birlikte hesabınızda hazır: ${site()}/tools/imza-iste?giris=1\n\n` +
      `İmzalı belgeyle sıradaki adım: sıkıştırın, birleştirin, sayfa düzenleyin — ${site()}`,
    html: renderCorporateEmail({
      eyebrow: "İmzalandı",
      title: "Belgeniz imzalandı",
      intro: `<strong>${ad}</strong> belgeyi imzaladı.`,
      bodyHtml: body,
      footerText: "Bu e-posta, gönderdiğiniz imza isteği tamamlandığı için iletildi.",
      productName: URUN,
      logoUrl: LOGO,
      preheader: `${p.imzalayanAd} «${p.baslik}» belgesini imzaladı.`,
    }),
  };
}

export function imzalandiImzalayanEposta(p: {
  baslik: string;
  gonderenAd: string;
  imzalayanAd: string;
  imzaZamani: Date;
  dosyaAdi: string;
}): { subject: string; text: string; html: string } {
  const c = EMAIL_COLORS;
  const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const zaman = p.imzaZamani.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const ad = escapeHtml(p.imzalayanAd.split(" ")[0] || p.imzalayanAd);
  const kayit = `${site()}/register`;

  // Özellik kartları: imzalayanı üründe "yapabileceği şeylerle" tanıştırır.
  const kart = (baslikMetin: string, aciklama: string) => `
    <td width="33%" valign="top" style="padding:0 5px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.line};border-radius:10px;background:#ffffff;">
        <tr><td style="padding:14px 14px 16px;font-family:${FONT};">
          <div style="font-size:13px;font-weight:700;color:${c.ink};">${baslikMetin}</div>
          <div style="margin-top:5px;font-size:12px;line-height:1.55;color:${c.muted};">${aciklama}</div>
        </td></tr>
      </table>
    </td>`;

  const body = `
    <!-- Başarı bandı -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td bgcolor="${c.brandDark}" style="background-color:${c.brandDark};border-radius:12px;padding:22px 24px;font-family:${FONT};">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a5b4fc;">&#10003;&nbsp; İmza tamamlandı</div>
          <div style="margin-top:8px;font-size:20px;font-weight:700;line-height:1.35;color:#ffffff;">${escapeHtml(p.baslik)}</div>
          <div style="margin-top:6px;font-size:13px;color:#c7d2fe;">${escapeHtml(zaman)} (TSİ) · ${escapeHtml(p.gonderenAd)} için imzalandı</div>
        </td>
      </tr>
    </table>

    <div style="height:14px;"></div>

    <!-- Ek bilgisi -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px dashed ${c.faint};border-radius:10px;background:${c.soft};">
      <tr>
        <td style="padding:14px 18px;font-family:${FONT};">
          <div style="font-size:14px;font-weight:700;color:${c.ink};">&#128206;&nbsp; İmzalı kopyanız bu e-postanın ekinde</div>
          <div style="margin-top:4px;font-size:13px;color:${c.muted};word-break:break-all;">${escapeHtml(p.dosyaAdi)}</div>
          <div style="margin-top:6px;font-size:12px;line-height:1.6;color:${c.muted};">Dosya, imzalama sürecinin zaman damgalı kaydını taşıyan bir denetim sertifikası sayfasıyla birlikte hazırlandı. Bir kopyası isteği gönderen tarafa da iletildi.</div>
        </td>
      </tr>
    </table>

    <!-- Tanıtım -->
    <div style="height:30px;"></div>
    <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${c.brand};">${ad}, sıra sizde</div>
    <div style="margin-top:6px;font-family:${FONT};font-size:22px;font-weight:700;line-height:1.3;color:${c.ink};">Bir sonraki imzayı siz isteyin.</div>
    <div style="margin-top:8px;font-family:${FONT};font-size:15px;line-height:1.7;color:${c.body};">
      Az önce hesap açmadan imzaladınız. PDF Platform ile siz de sözleşmenizi yükleyin, karşı tarafın e-postasını yazın; imza istemek, takip etmek ve imzalı belgeyi saklamak tek ekranda.
    </div>

    <div style="height:18px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        ${kart("İmza iste", "Belgeyi gönderin, karşı taraf hesap açmadan imzalasın.")}
        ${kart("Sıkıştır ve birleştir", "İmzalı PDF'i e-postaya sığacak boyuta indirin, eklerle tek dosya yapın.")}
        ${kart("Düzenle ve çevir", "Metni düzenleyin, Word/Excel'e çevirin, taranmış belgeyi okutun.")}
      </tr>
    </table>

    ${ctaButton(kayit, "Ücretsiz hesap oluştur")}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
      <tr>
        <td style="font-family:${FONT};font-size:12.5px;line-height:1.8;color:${c.muted};">
          <span style="color:${c.ok};font-weight:700;">&#10003;</span> Kredi kartı gerekmez &nbsp;&nbsp;
          <span style="color:${c.ok};font-weight:700;">&#10003;</span> Çoğu araç cihazınızda çalışır &nbsp;&nbsp;
          <span style="color:${c.ok};font-weight:700;">&#10003;</span> Dosyanız başka amaçla kullanılmaz
        </td>
      </tr>
    </table>`;

  return {
    subject: `İmzanız alındı: «${p.baslik}» · imzalı kopyanız ekte`,
    text:
      `«${p.baslik}» belgesini imzaladınız (${zaman}). İmzalı kopyanız bu e-postanın ekinde (${p.dosyaAdi}); bir kopyası isteği gönderen tarafa da iletildi.\n\n` +
      `Bir sonraki imzayı siz isteyin: PDF yükleyin, karşı tarafın e-postasını yazın, gerisini PDF Platform halletsin.\n` +
      `Ücretsiz hesap oluşturun (kredi kartı gerekmez): ${kayit}`,
    html: renderCorporateEmail({
      eyebrow: "İmzalandı",
      title: "Teşekkürler, imzanız alındı",
      intro: `İmzalı belgeniz ekte. ${ad}, bu kadar kolay.`,
      bodyHtml: body,
      footerText: "Bu e-posta, imzaladığınız belgenin onayı olarak iletildi.",
      productName: URUN,
      logoUrl: LOGO,
      preheader: `İmzalı kopyanız ekte: «${p.baslik}». Siz de ücretsiz imza isteyin.`,
    }),
  };
}

export function imzaReddedildiEposta(p: {
  baslik: string;
  imzalayanEposta: string;
  sebep?: string;
}): { subject: string; text: string; html: string } {
  const body =
    detailTable([
      { label: "Belge", value: `<strong>${escapeHtml(p.baslik)}</strong>` },
      { label: "Yanıtlayan", value: escapeHtml(p.imzalayanEposta) },
    ]) +
    (p.sebep ? `<div style="height:16px;"></div>` + calloutBox("Belirtilen sebep", escapeHtml(p.sebep).replace(/\n/g, "<br />")) : "") +
    ctaButton(`${site()}/tools/imza-iste?giris=1`, "İmza isteklerime git");

  return {
    subject: `İmza reddedildi: ${p.baslik}`,
    text: `«${p.baslik}» için imza isteği reddedildi.` + (p.sebep ? `\n\nBelirtilen sebep: ${p.sebep}` : ""),
    html: renderCorporateEmail({
      eyebrow: "Reddedildi",
      title: "İmza isteği reddedildi",
      intro: "Gönderdiğiniz belge imzalanmadı.",
      bodyHtml: body,
      footerText: "Bu e-posta, gönderdiğiniz imza isteği yanıtlandığı için iletildi.",
      productName: URUN,
      logoUrl: LOGO,
      preheader: `«${p.baslik}» için imza isteği reddedildi.`,
    }),
  };
}
