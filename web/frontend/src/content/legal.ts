import type { Language } from "../i18n/landing";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  summary: string;
  effectiveDateLabel: string;
  effectiveDate: string;
  sections: LegalSection[];
};

type CookieNoticeCopy = {
  title: string;
  description: string;
  accept: string;
  learnMore: string;
};

export const legalDocuments: Record<
  Language,
  {
    terms: LegalDocument;
    privacy: LegalDocument;
    kvkk: LegalDocument;
    "on-bilgilendirme": LegalDocument;
    "mesafeli-satis": LegalDocument;
    cookieNotice: CookieNoticeCopy;
  }
> = {
  en: {
    terms: {
      title: "Terms of Service",
      summary:
        "These Terms of Service (“Terms”) form a binding agreement between you and NB Global Studio regarding PDF PLATFORM. They set out how you may use the product, what we expect from you, how subscriptions work, and the limits of our liability. They do not replace our Privacy Policy, which covers personal data only.",
      effectiveDateLabel: "Effective date",
      effectiveDate: "24 March 2026",
      sections: [
        {
          title: "1. Who we are and what you accept",
          paragraphs: [
            "PDF PLATFORM is operated by NB Global Studio (“we”, “us”). By creating an account, subscribing, or otherwise using the service, you confirm that you have read these Terms and agree to be bound by them.",
            "If you use the service on behalf of a company, you represent that you are authorized to accept these Terms for that organization.",
          ],
        },
        {
          title: "2. The service",
          paragraphs: [
            "PDF PLATFORM provides software and web-based TOOLS for working with PDF and related documents (for example merge, split, conversion, compression, and encryption), together with account, authentication, and subscription features.",
            "We may change, suspend, or discontinue parts of the service for security, legal, operational, or product reasons. We do not guarantee uninterrupted or error-free operation.",
          ],
        },
        {
          title: "3. Usage rules (acceptable use)",
          paragraphs: [
            "You must use the service only in compliance with applicable laws and regulations. You must not use it to process unlawful content, infringe others’ rights, or circumvent technical or contractual limits.",
            "You must not probe, attack, or overload our systems; scrape or automate access in a way that harms performance or security; resell or redistribute the service without our written consent; or misrepresent your identity or affiliation.",
            "You are responsible for documents you upload or process and for ensuring you have the right to use them. We do not review your files for legality; you remain responsible for your own compliance.",
            "We may investigate suspected abuse and may suspend or terminate access, with or without notice, where we reasonably believe these rules or the security of the service are at risk.",
          ],
        },
        {
          title: "4. Accounts and security",
          paragraphs: [
            "You must provide accurate registration information and keep it up to date. You are responsible for safeguarding passwords, API tokens, and any other credentials.",
            "You must notify us promptly if you suspect unauthorized use of your account. We may require additional verification before restoring access.",
          ],
        },
        {
          title: "5. Subscription terms",
          paragraphs: [
            "Certain features or higher usage limits may require a paid plan. Plan names, prices, included features, and fair-use rules are those shown in the product, checkout, or order confirmation at the time you subscribe.",
            "Subscriptions renew according to the billing cycle you select (for example monthly or annual) until you cancel in accordance with the cancellation process we provide. Failure to pay may result in downgrade or loss of paid features.",
            "We may change plan prices or features for new purchases or renewals with reasonable notice where required by law. Continued use after a renewal may constitute acceptance of the updated plan terms.",
            "Taxes, if any, are your responsibility unless we state otherwise at checkout.",
          ],
        },
        {
          title: "6. Limitations (disclaimers and liability cap)",
          paragraphs: [
            "The service is provided “as is” and “as available”. To the fullest extent permitted by law, we disclaim implied warranties such as merchantability, fitness for a particular purpose, and non-infringement.",
            "We are not liable for loss of profits, loss of data, business interruption, or indirect, incidental, special, consequential, or punitive damages arising from your use of the service, even if we have been advised of the possibility of such damages.",
            "Our aggregate liability for any claim arising out of or related to these Terms or the service shall not exceed the greater of (a) the amount you paid us for the service in the twelve (12) months before the event giving rise to the claim, or (b) fifty U.S. dollars (USD 50), except where liability cannot be limited under mandatory law.",
            "Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the maximum extent permitted.",
          ],
        },
        {
          title: "7. Intellectual property",
          paragraphs: [
            "PDF PLATFORM, its branding, software, documentation, and related materials are owned by NB Global Studio or its licensors. These Terms do not grant you ownership of any intellectual property rights beyond the limited right to use the service as offered.",
            "You retain rights in your own content. You grant us only the rights reasonably necessary to operate the service (for example processing files you submit and hosting account data).",
          ],
        },
        {
          title: "8. Termination",
          paragraphs: [
            "You may stop using the service at any time. We may suspend or terminate your access if you materially breach these Terms, if we are required to do so by law, or if we wind down the service with reasonable notice where practicable.",
            "Provisions that by their nature should survive (including limitations of liability, intellectual property, and governing law) will survive termination.",
          ],
        },
        {
          title: "9. Governing law and disputes",
          paragraphs: [
            "These Terms are governed by the laws applicable in the jurisdiction we designate in a separate agreement with you, or otherwise by the laws of the country where NB Global Studio is established, without regard to conflict-of-law rules.",
            "For informal resolution of disputes, you may contact us at the email address shown in the product or on our website before initiating formal proceedings.",
          ],
        },
        {
          title: "10. Changes and contact",
          paragraphs: [
            "We may update these Terms from time to time. We will post the revised version with an updated effective date. Material changes may be communicated by email or in-product notice where appropriate.",
            "Questions about these Terms: nbglobalstudio@gmail.com.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      summary:
        "This Privacy Policy describes how NB Global Studio collects, uses, stores, and protects personal information when you use PDF PLATFORM (web application, authentication, and related services). It does not govern your contractual rights to use the product; see our Terms of Service for usage, subscriptions, and liability.",
      effectiveDateLabel: "Effective date",
      effectiveDate: "24 March 2026",
      sections: [
        {
          title: "1. Data controller",
          paragraphs: [
            "The data controller responsible for personal data processed in connection with PDF PLATFORM is NB Global Studio. For privacy requests, use the contact email at the end of this policy.",
          ],
        },
        {
          title: "2. Personal data we collect",
          paragraphs: [
            "Account and identity: email address, authentication identifiers (including hashed passwords or OAuth provider linkage where applicable), account role, subscription or plan identifiers, preferred language, and timestamps related to account activity.",
            "Usage and product data: feature usage, operational logs needed for security and reliability, and—if you opt in—basic analytics events from the web client (such as page or screen identifiers and session context).",
            "Support and communications: content you send via contact or support channels, including your email address and message text.",
            "Technical data: IP address, browser type, device or OS hints, and error reports you allow us to collect (which may include a short stack trace or diagnostic text).",
            "We do not use this policy to describe the full contents of documents you process; processing of file content is governed by how the product works technically and by these disclosures only to the extent personal data appears inside files you choose to upload.",
          ],
        },
        {
          title: "3. Why we use personal data",
          paragraphs: [
            "To provide and secure the service: register and authenticate users, enforce plan limits, prevent fraud and abuse, and maintain infrastructure.",
            "To communicate with you: transactional messages (e.g. verification, security notices), responses to support requests, and—where permitted—product updates.",
            "To improve the product: troubleshooting, aggregated statistics, and optional analytics when you have accepted cookies for that purpose.",
            "To meet legal obligations: responding to lawful requests and retaining records where the law requires.",
          ],
        },
        {
          title: "4. Cookies and local storage",
          paragraphs: [
            "We use essential cookies or similar storage to keep you signed in (including refresh-token handling where configured), remember language preference, and record your cookie consent choice.",
            "Non-essential analytics runs in the web client only after you accept the cookie notice. You may withdraw consent by clearing storage or adjusting browser settings; some features may not work without essential storage.",
          ],
        },
        {
          title: "5. Sharing and processors",
          paragraphs: [
            "We use trusted service providers (for example hosting, email delivery, or analytics) who process data on our instructions and under appropriate safeguards.",
            "We do not sell your personal data. We may disclose information if required by law, to protect rights and safety, or in connection with a merger or asset transfer subject to continued protection of your information.",
          ],
        },
        {
          title: "6. Retention",
          paragraphs: [
            "We retain personal data only as long as needed for the purposes above, including providing the service, resolving disputes, and meeting legal, tax, or accounting requirements. When retention periods end, we delete or anonymize data where feasible.",
          ],
        },
        {
          title: "7. Security",
          paragraphs: [
            "We implement appropriate technical and organizational measures designed to protect personal data against unauthorized access, alteration, disclosure, or destruction. No method of transmission over the Internet is completely secure; we encourage strong passwords and safe account practices.",
          ],
        },
        {
          title: "8. International transfers",
          paragraphs: [
            "If we process data in countries other than your own, we will ensure appropriate safeguards where required (such as standard contractual clauses or equivalent mechanisms), consistent with applicable data protection laws.",
          ],
        },
        {
          title: "9. Your rights",
          paragraphs: [
            "Depending on where you live, you may have rights to access, rectify, delete, restrict, or object to certain processing of your personal data, and to lodge a complaint with a supervisory authority.",
            "To exercise rights, contact nbglobalstudio@gmail.com with a clear description of your request. We may need to verify your identity before responding.",
          ],
        },
        {
          title: "10. Children",
          paragraphs: [
            "PDF PLATFORM is not directed at children under the age where parental consent is required in their jurisdiction. We do not knowingly collect personal data from such children.",
          ],
        },
        {
          title: "11. Changes to this policy",
          paragraphs: [
            "We may update this Privacy Policy from time to time. The effective date at the top will change, and we will provide additional notice for material changes where required.",
          ],
        },
        {
          title: "12. Contact",
          paragraphs: ["Privacy inquiries: nbglobalstudio@gmail.com."],
        },
      ],
    },
    kvkk: {
      title: "Privacy disclosure per Turkish Law No. 6698 (KVKK)",
      summary:
        "This notice summarizes how NB Global Studio processes personal data in PDF PLATFORM checkout-related flows (billing identity, contact telephone and postal addresses forwarded for PSP-hosted settlement via İyzico). It complements—not replaces—the Privacy Policy and Terms.",
      effectiveDateLabel: "Effective date",
      effectiveDate: "24 March 2026",
      sections: [
        {
          title: "1. Processing grounds",
          paragraphs: [
            "Purchasing bundles/subscriptions requires identity-ish fields (name, address, mobile) for fraud prevention, statutory invoicing obligations where applicable, and to satisfy payment-provider contractual controls.",
            "We store such fields with your account profile and transmit only what İyzico requires to render its hosted checkout form; card credentials never touch our servers.",
          ],
        },
        {
          title: "2. Legal bases",
          paragraphs: [
            "Processing relies on contract performance (supplying paid tools), legitimate interests (security/anti-abuse—balanced against your rights), and—to the extent consent is collected explicitly—your freely given approval at checkout.",
          ],
        },
        {
          title: "3. Rights & contact",
          paragraphs: [
            "You may request access, rectification, erasure, restriction or objection under Articles 11–13 KVKK / GDPR-style rights. Contact: nbglobalstudio@gmail.com.",
          ],
        },
      ],
    },
    "on-bilgilendirme": {
      title: "Pre-Purchase Information Form",
      summary:
        "Mandatory consumer information form required before payment, pursuant to the Distance Sales Regulation.",
      effectiveDateLabel: "Effective date",
      effectiveDate: "2024 and onwards",
      sections: [
        {
          title: "1. Seller Information",
          paragraphs: [
            "Seller: NB Global Studio",
            "Email: nbglobalstudio@gmail.com",
            "Website: nbglobalstudio.com",
            "Service: PDF PLATFORM — cloud-based PDF processing services",
          ],
        },
        {
          title: "2. Key Features of the Service",
          paragraphs: [
            "PDF PLATFORM is a cloud-based SaaS (Software as a Service) subscription offering tools for PDF merging, splitting, compression, conversion, encryption, and other PDF processing operations.",
            "Different usage limits, file size limits, and features apply depending on the subscription plan. Visit nbpdf.app/pricing for details.",
          ],
        },
        {
          title: "3. Price and Payment",
          paragraphs: [
            "Prices are determined by the plan you select and the billing period (monthly/yearly). For users residing in Turkey, 20% VAT is included in the total amount charged.",
            "Payment is made via credit card or debit card through the iyzico infrastructure.",
            "No refund is provided for the remaining period after the subscription term has commenced.",
          ],
        },
        {
          title: "4. Withdrawal Right Exception",
          paragraphs: [
            "Pursuant to Article 15/1(ğ) of the Distance Sales Regulation, the right of withdrawal does not apply to digital content services whose performance has begun with the consumer's consent.",
            "Once payment is completed and the service performance (subscription activation) has begun, you will not be able to exercise your right of withdrawal. If you accept this condition, you may proceed to payment.",
            "In case of technical issues or complete inability to use the service, please contact our support team.",
          ],
        },
        {
          title: "5. Complaints and Disputes",
          paragraphs: [
            "For complaints, you may send an email to nbglobalstudio@gmail.com.",
            "Your right to apply to Consumer Arbitration Committees and Consumer Courts remains reserved.",
          ],
        },
      ],
    },
    "mesafeli-satis": {
      title: "Distance Sales Agreement",
      summary:
        "Agreement drawn up pursuant to Law No. 6502 on the Protection of Consumers and the Distance Sales Regulation.",
      effectiveDateLabel: "Effective date",
      effectiveDate: "Applies to each subscription purchase",
      sections: [
        {
          title: "1. Parties",
          paragraphs: [
            "SELLER: NB Global Studio, Email: nbglobalstudio@gmail.com",
            "BUYER: The user identified by the name, surname, and email address provided at the payment step.",
          ],
        },
        {
          title: "2. Subject of the Agreement",
          paragraphs: [
            "The subject of this agreement is to regulate the terms and conditions relating to the purchase of a PDF PLATFORM digital service subscription for the plan selected by the BUYER at nbpdf.app.",
            "Service content and features vary by the selected plan.",
          ],
        },
        {
          title: "3. Price and Payment",
          paragraphs: [
            "The sales price including VAT is displayed to the BUYER at the payment screen.",
            "20% VAT applies to individual users residing in Turkey. VAT is not applied to users residing abroad (export exemption).",
            "Payment is made securely through the iyzico infrastructure. Card details are not stored by the SELLER.",
          ],
        },
        {
          title: "4. Subscription and Renewal",
          paragraphs: [
            "The subscription is activated immediately upon payment confirmation. The subscription term is determined by the selected plan (monthly/yearly).",
            "Subscriptions do not renew automatically. A new payment must be made for renewal.",
            "When the subscription term expires, paid features are deactivated and the account automatically reverts to the free plan.",
          ],
        },
        {
          title: "5. Right of Withdrawal",
          paragraphs: [
            "Pursuant to Article 15/1(ğ) of the Distance Sales Regulation, the right of withdrawal cannot be exercised for digital content services whose performance has begun with the BUYER's express consent.",
            "The BUYER has expressly declared at the payment step that they waive the right of withdrawal. Therefore, no refund can be requested after subscription activation.",
            "In case the service is completely unavailable, the situation will be evaluated upon contact with the SELLER.",
          ],
        },
        {
          title: "6. Protection of Personal Data",
          paragraphs: [
            "The BUYER's personal data is processed within the scope of KVKK and GDPR. Invoice records are retained for 10 years pursuant to VUK Article 253.",
            "For detailed information, please review the Privacy Policy and KVKK Disclosure Text.",
          ],
        },
        {
          title: "7. Dispute Resolution",
          paragraphs: [
            "Turkish law applies to disputes arising from this agreement.",
            "Under consumer rights, you may apply to the Consumer Arbitration Committee or Consumer Courts.",
          ],
        },
      ],
    },
    cookieNotice: {
      title: "Cookie Notice",
      description:
        "We use essential storage for login, language preference, and consent settings. With your approval, we also collect basic page analytics to improve product quality. See our Privacy Policy for details.",
      accept: "Accept Analytics",
      learnMore: "Privacy Policy",
    },
  },
  tr: {
    terms: {
      title: "Hizmet Şartları",
      summary:
        "İşbu Hizmet Şartları (“Şartlar”), PDF PLATFORM’un kullanımına ilişkin sizinle NB Global Studio arasında bağlayıcı bir sözleşmedir. Ürünü nasıl kullanabileceğinizi, abonelik kurallarını, yükümlülüklerinizi ve sorumluluğumuzun sınırlarını düzenler. Kişisel veriler yalnızca Gizlilik Politikamızda açıklanır; bu metin onun yerine geçmez.",
      effectiveDateLabel: "Yürürlük tarihi",
      effectiveDate: "24 Mart 2026",
      sections: [
        {
          title: "1. Taraflar ve kabul",
          paragraphs: [
            "PDF PLATFORM, NB Global Studio (“biz”) tarafından işletilir. Hesap oluşturarak, abone olarak veya hizmeti başka şekilde kullanarak bu Şartları okuduğunuzu ve bunlara uymayı kabul ettiğinizi beyan edersiniz.",
            "Hizmeti bir işletme adına kullanıyorsanız, bu Şartları o kuruluş adına kabul etmeye yetkili olduğunuzu taahhüt edersiniz.",
          ],
        },
        {
          title: "2. Hizmetin kapsamı",
          paragraphs: [
            "PDF PLATFORM; PDF ve ilgili belgeler üzerinde çalışmayı sağlayan yazılım ve web tabanlı araçlar (örneğin birleştirme, ayırma, dönüştürme, sıkıştırma ve şifreleme) ile hesap, kimlik doğrulama ve abonelik özelliklerini sunar.",
            "Güvenlik, yasal zorunluluklar, operasyon veya ürün gerekçeleriyle hizmetin bölümlerini değiştirebilir, askıya alabilir veya sonlandırabiliriz. Kesintisiz veya hatasız çalışma garantisi vermeyiz.",
          ],
        },
        {
          title: "3. Kullanım kuralları (kabul edilebilir kullanım)",
          paragraphs: [
            "Hizmeti yalnızca yürürlükteki mevzuata uygun kullanmalısınız. Yasadışı içerik işlemek, üçüncü kişi haklarını ihlal etmek veya teknik veya sözleşmesel sınırları aşmak için kullanamazsınız.",
            "Sistemlerimizi deneme, saldırı veya aşırı yük altında bırakma; performansı veya güvenliği zedeleyecek şekilde otomasyon veya tarama; yazılı onayımız olmadan hizmeti yeniden satma veya dağıtma; kimlik veya bağlantı bilgisi sahtekârlığı yasaktır.",
            "Yüklediğiniz veya işlediğiniz belgelerden ve bunları kullanma yetkisinden siz sorumlusunuz. Dosyalarınızın yasallığını denetlemek zorunda değiliz; uyumluluk yükümlülüğü size aittir.",
            "Kötüye kullanım şüphesinde inceleme yapabilir; bu Şartları veya hizmet güvenliğini tehdit ettiğine makul şekilde kanaat getirdiğimiz hallerde, bildirimli veya bildirimsiz erişimi askıya alabilir veya sonlandırabiliriz.",
          ],
        },
        {
          title: "4. Hesaplar ve güvenlik",
          paragraphs: [
            "Doğru kayıt bilgileri vermeli ve güncel tutmalısınız. Parolalar, API anahtarları ve diğer kimlik bilgilerinin korunması sizin sorumluluğunuzdadır.",
            "Hesabınızın yetkisiz kullanıldığından şüphelenirseniz bizi gecikmeksizin bilgilendirin. Erişimi yeniden açmadan önce ek doğrulama talep edebiliriz.",
          ],
        },
        {
          title: "5. Abonelik şartları",
          paragraphs: [
            "Bazı özellikler veya daha yüksek kullanım limitleri ücretli plan gerektirebilir. Plan adları, fiyatlar, dahil özellikler ve makul kullanım kuralları; abone olduğunuz andaki ürün, ödeme veya sipariş onayındaki hükümlerdir.",
            "Abonelikler, iptal sürecine uygun şekilde iptal edilene kadar seçtiğiniz faturalama döngüsüne (örneğin aylık veya yıllık) göre yenilenir. Ödeme yapılmaması plan düşürülmesine veya ücretli özelliklerin kaybına yol açabilir.",
            "Yasal gerekliliklere uygun makul bildirimle plan fiyatlarını veya özelliklerini yeni satın alımlar veya yenilemeler için değiştirebiliriz. Yenileme sonrası kullanım, güncellenmiş plan koşullarının kabulü anlamına gelebilir.",
            "Ödeme sırasında aksi belirtilmedikçe vergiler sizin sorumluluğunuzdadır.",
          ],
        },
        {
          title: "6. Sınırlamalar (feragatlar ve sorumluluk üst sınırı)",
          paragraphs: [
            "Hizmet “olduğu gibi” ve “müsait olduğu şekilde” sunulur. Yasal olarak izin verilen azami ölçüde; satılabilirlik, belirli bir amaca uygunluk ve ihlal etmeme dâhil zımni garantileri reddederiz.",
            "Hizmeti kullanımınızdan doğan kâr kaybı, veri kaybı, işin kesintiye uğraması veya dolaylı, arızi, özel, sonuç olarak doğan veya cezai zararlar için; bu tür zararların olasılığı konusunda uyarılmış olsak bile sorumlu tutulmayız.",
            "Bu Şartlar veya hizmetle bağlantılı herhangi bir talebe ilişkin toplam sorumluluğumuz, talebe konu olayı tetikleyen tarihten önceki on iki (12) ay içinde hizmet için bize ödediğiniz tutar ile elli ABD doları (50 USD) tutarından yüksek olanı aşamaz; zorunlu kanunda sınır konulamayan haller hariç.",
            "Bazı hukuk düzenleri belirli sınırlamalara izin vermez; bu durumlarda sorumluluğumuz kanunun izin verdiği azami ölçüde sınırlıdır.",
          ],
        },
        {
          title: "7. Fikri mülkiyet",
          paragraphs: [
            "PDF PLATFORM, markalar, yazılım, dokümantasyon ve ilgili materyaller NB Global Studio veya lisans verenlerinin mülkiyetindedir. Bu Şartlar, sunulan hizmeti kullanma dışında mülkiyet hakkı vermez.",
            "Kendi içeriğinizdeki haklar size aittir. Hizmeti işletmek için makul ölçüde gerekli hakları (örneğin gönderdiğiniz dosyaları işleme ve hesap verilerini barındırma) bize tanırsınız.",
          ],
        },
        {
          title: "8. Sona erdirme",
          paragraphs: [
            "Hizmeti dilediğiniz zaman kullanmayı bırakabilirsiniz. Bu Şartlara önemli ölçüde aykırılık, yasal zorunluluk veya mümkünse makul önceden bildirimle hizmeti sonlandırma hallerinde erişiminizi askıya alabilir veya sonlandırabiliriz.",
            "Doğası gereği sürmesi gereken hükümler (sorumluluk sınırları, fikri mülkiyet ve uygulanacak hukuk gibi) sona ermeden sonra da geçerliliğini korur.",
          ],
        },
        {
          title: "9. Uygulanacak hukuk ve uyuşmazlıklar",
          paragraphs: [
            "Bu Şartlar; sizinle ayrıca yazılı olarak kararlaştırdığımız yargı bölgesinin hukukuna, aksi halde NB Global Studio’nun faaliyet gösterdiği ülkenin kanunlarına tabidir; çatışan hukuk kuralları uygulanmaz.",
            "Resmi yollara başvurmadan önce ürün veya web sitemizde belirtilen e-posta üzerinden bizimle iletişime geçerek çözüm arayabilirsiniz.",
          ],
        },
        {
          title: "10. Değişiklikler ve iletişim",
          paragraphs: [
            "Bu Şartları zaman zaman güncelleyebiliriz. Güncellenmiş sürümü güncellenmiş yürürlük tarihiyle yayınlarız. Önemli değişiklikleri yasal gereklilik ve uygunluk çerçevesinde e-posta veya ürün içi bildirimle duyurabiliriz.",
            "Şartlarla ilgili sorular: nbglobalstudio@gmail.com.",
          ],
        },
      ],
    },
    privacy: {
      title: "Gizlilik Politikası",
      summary:
        "Bu Gizlilik Politikası, PDF PLATFORM’u (web uygulaması, kimlik doğrulama ve ilgili hizmetler) kullandığınızda NB Global Studio’nun kişisel verileri nasıl topladığını, kullandığını, sakladığını ve koruduğunu açıklar. Ürünü kullanma hakkınız, abonelikler ve sorumluluk sınırları Hizmet Şartlarımızda düzenlenir; bu metin onların yerine geçmez.",
      effectiveDateLabel: "Yürürlük tarihi",
      effectiveDate: "24 Mart 2026",
      sections: [
        {
          title: "1. Veri sorumlusu",
          paragraphs: [
            "PDF PLATFORM ile bağlantılı olarak işlenen kişisel verilerden sorumlu veri sorumlusu NB Global Studio’dur. Talepler için bu politikanın sonundaki iletişim adresini kullanabilirsiniz.",
          ],
        },
        {
          title: "2. Topladığımız kişisel veriler",
          paragraphs: [
            "Hesap ve kimlik: e-posta adresi, kimlik doğrulama tanımlayıcıları (karma parolalar veya OAuth sağlayıcı bağlantısı dahil), hesap rolü, abonelik veya plan bilgisi, tercih edilen dil ve hesap etkinliğiyle ilgili zaman damgaları.",
            "Kullanım ve ürün verileri: güvenlik ve güvenilirlik için gerekli operasyon günlükleri; açık rızanızla web istemcisinden temel analitik olayları (örneğin sayfa veya ekran tanımlayıcıları ve oturum bağlamı).",
            "Destek ve iletişim: iletişim veya destek kanalları aracılığıyla gönderdiğiniz içerik, e-posta adresiniz ve mesaj metni.",
            "Teknik veriler: IP adresi, tarayıcı türü, cihaz veya işletim sistemi ipuçları ve izin verdiğiniz hata raporları (kısa yığın izi veya tanı metni içerebilir).",
            "İşlediğiniz dosyaların tam içeriğini bu politika ayrıntılı olarak listelemez; dosya içeriği ürünün teknik işleyişi kapsamında işlenir ve yalnızca kişisel veri içermesi hâlinde bu açıklamalarla ilişkilidir.",
          ],
        },
        {
          title: "3. Kişisel verileri kullanma amaçları",
          paragraphs: [
            "Hizmeti sunmak ve güvence altına almak: kullanıcı kaydı ve kimlik doğrulama, plan limitlerini uygulama, dolandırıcılık ve kötüye kullanımı önleme, altyapıyı işletme.",
            "Sizinle iletişim: işlemsel mesajlar (doğrulama, güvenlik bildirimleri), destek taleplerine yanıt ve izin verildiğinde ürün güncellemeleri.",
            "Ürünü geliştirmek: sorun giderme, toplu istatistikler ve çerez bildirimini kabul ettiğinizde isteğe bağlı analitik.",
            "Yasal yükümlülükler: yasal taleplere yanıt ve kanunun gerektirdiği sürelerle kayıt saklama.",
          ],
        },
        {
          title: "4. Çerezler ve yerel depolama",
          paragraphs: [
            "Oturumu sürdürmek (yapılandırmaya bağlı olarak yenileme belirteci dahil), dil tercihini hatırlamak ve çerez onay tercihinizi kaydetmek için zorunlu çerezler veya benzeri depolama kullanırız.",
            "Zorunlu olmayan analitik, çerez bildirimini kabul ettikten sonra web istemcisinde çalışır. Depolamayı temizleyerek veya tarayıcı ayarlarınızı değiştirerek rızanızı geri alabilirsiniz; zorunlu depolama olmadan bazı özellikler çalışmayabilir.",
          ],
        },
        {
          title: "5. Paylaşım ve işleyenler",
          paragraphs: [
            "Barındırma, e-posta gönderimi veya analitik gibi güvenilir hizmet sağlayıcıları, talimatlarımız ve uygun güvenceler çerçevesinde veri işleyebilir.",
            "Kişisel verilerinizi satmayız. Yasal zorunluluk, hakların ve güvenliğin korunması veya birleşme veya varlık devri (verilerinizin korunmasının sürmesi koşuluyla) hallerinde bilgi açıklanabilir.",
          ],
        },
        {
          title: "6. Saklama süresi",
          paragraphs: [
            "Kişisel verileri yukarıdaki amaçlar için gerekli olduğu sürece, hizmeti sunmak, uyuşmazlıkları çözmek ve yasal, vergi veya muhasebe gerekliliklerini karşılamak üzere saklarız. Süre dolduğunda, mümkün olduğunda verileri siler veya anonimleştiririz.",
          ],
        },
        {
          title: "7. Güvenlik",
          paragraphs: [
            "Kişisel verileri yetkisiz erişim, değişiklik, ifşa veya imhaya karşı korumak için uygun teknik ve idari önlemler uygularız. İnternet üzerinden iletimde mutlak güvenlik yoktur; güçlü parola ve güvenli hesap alışkanlıkları önerilir.",
          ],
        },
        {
          title: "8. Uluslararası aktarım",
          paragraphs: [
            "Verilerinizi ikamet ettiğiniz ülke dışında işlersek, geçerli veri koruma kanunlarına uygun olarak standart sözleşme maddeleri veya eşdeğer mekanizmalarla uygun güvenceleri sağlarız.",
          ],
        },
        {
          title: "9. Haklarınız",
          paragraphs: [
            "Yaşadığınız yere bağlı olarak kişisel verilerinize erişme, düzeltme, silme, işlemeyi kısıtlama veya itiraz etme ve bir denetim otoritesine şikâyette bulunma haklarınız olabilir.",
            "Taleplerinizi nbglobalstudio@gmail.com adresine net bir açıklamayla iletebilirsiniz. Yanıt vermeden önce kimliğinizi doğrulamamız gerekebilir.",
          ],
        },
        {
          title: "10. Çocuklar",
          paragraphs: [
            "PDF PLATFORM, bulunduğu ülkede ebeveyn onayı gerektiren yaşın altındaki çocuklara yönelik değildir. Bu yaş grubundan bilerek kişisel veri toplamayız.",
          ],
        },
        {
          title: "11. Bu politikanın güncellenmesi",
          paragraphs: [
            "Bu Gizlilik Politikasını zaman zaman güncelleyebiliriz. Üstteki yürürlük tarihi değişir; önemli değişikliklerde yasal gereklilik ve uygunluk çerçevesinde ek bildirim sağlarız.",
          ],
        },
        {
          title: "12. İletişim",
          paragraphs: ["Gizlilik soruları: nbglobalstudio@gmail.com."],
        },
      ],
    },
    kvkk: {
      title: "Kişisel Verilerin İşlenmesi Hakkında Aydınlatma Metni",
      summary:
        "NB Global Studio olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamındaki veri sorumlusu sıfatıyla kişisel verilerinizin güvenliği ve gizliliği konusundaki sorumluluğumuzun bilinciyle hareket etmekteyiz. Bu Aydınlatma Metni, hangi kişisel verilerinizi, hangi amaçlarla, hangi hukuki sebeple işlediğimizi ve KVKK madde 11 kapsamındaki haklarınızı açıklamaktadır.",
      effectiveDateLabel: "Yürürlük tarihi",
      effectiveDate: "24 Mart 2026",
      sections: [
        {
          title: "1. Veri Sorumlusu",
          paragraphs: [
            "Veri sorumlusu: NB Global Studio (bundan böyle ‘Şirket’ olarak anılacaktır).",
            "İletişim: nbglobalstudio@gmail.com — KVKK kapsamındaki tüm başvurularınızı bu adrese iletebilirsiniz.",
          ],
        },
        {
          title: "2. İşlenen Kişisel Veriler",
          paragraphs: [
            "Kimlik ve iletişim bilgileri: Ad, soyad, e-posta adresi; hesap oluşturma ve kimlik doğrulama süreçlerinde işlenir.",
            "Ödeme ve fatura bilgileri: Ad, soyad, adres, posta kodu, şehir, ülke, cep telefonu; ödeme altyapısı sağlayıcısına (İyzico) iletilerek güvenli tahsilat ve fatura düzenlenmesi amacıyla işlenir. Kart numarası, CVV gibi ödeme aracı bilgileri sistemimizde saklanmaz; doğrudan İyzico’nun PCI DSS uyumlu altyapısında işlenir.",
            "Teknik ve kullanım verileri: IP adresi, tarayıcı/cihaz bilgisi, oturum bilgileri; güvenlik, sahteciliğin önlenmesi ve sistem performansı amaçlarıyla işlenir.",
            "Yüklenen belgeler: PDF ve diğer dosyalar işlem için geçici olarak sunucularımızda tutulur; işlem tamamlandıktan kısa süre sonra otomatik olarak silinir; içerik analizi yapılmaz.",
          ],
        },
        {
          title: "3. İşlemenin Amaçları ve Hukuki Sebebi",
          paragraphs: [
            "Sözleşmenin kurulması ve ifası (KVKK md. 5/2-c): Hesap oluşturma, ödeme işlemi, abonelik yönetimi ve hizmetlerin sunulması.",
            "Meşru menfaat (KVKK md. 5/2-f): Hizmetin güvenliğinin sağlanması, dolandırıcılık ve kötüye kullanımın önlenmesi, sistem performansı.",
            "Hukuki yükümlülüğün yerine getirilmesi (KVKK md. 5/2-ç): Vergi mevzuatı ve diğer kanuni yükümlülükler kapsamında fatura ve kayıt tutma.",
            "Açık rıza (KVKK md. 5/1): Analitik ve pazarlama amaçlı çerezler gibi zorunlu olmayan veri işleme faaliyetleri için ayrıca açık rızanız alınır.",
          ],
        },
        {
          title: "4. Kişisel Verilerin Aktarılması",
          paragraphs: [
            "Kişisel verileriniz; hizmetlerimizin sunulabilmesi için ihtiyaç duyulan ölçüde aşağıdaki alıcı gruplarına aktarılabilir:",
            "Ödeme kuruluşu (İyzico): Ödeme işlemlerinin gerçekleştirilmesi amacıyla gerekli kimlik ve adres bilgileri aktarılır.",
            "Bulut altyapısı ve barındırma hizmet sağlayıcıları: Hizmetin çalıştırıldığı sunucu altyapısını sunan şirketler; veri işleme sözleşmeleri çerçevesinde sınırlı erişim.",
            "Analitik hizmet sağlayıcıları (onay halinde): Ürün iyileştirme amacıyla anonimleştirilmiş kullanım verileri.",
            "Yasal zorunluluk: Mahkeme kararı veya yetkili kamu kurumu talebi halinde ilgili makamlarla paylaşılabilir.",
          ],
        },
        {
          title: "5. Kişisel Verilerin Saklanma Süresi",
          paragraphs: [
            "Hesap bilgileri: Hesabınız aktif olduğu süre boyunca ve hesap silme talebinin ardından en fazla 30 gün.",
            "Ödeme ve fatura kayıtları: Vergi mevzuatı gereği en az 5 yıl; ilgili mevzuat uyarınca daha uzun süreler uygulanabilir.",
            "Teknik günlükler (log): En fazla 90 gün; güvenlik ihlali şüphesi varsa ilgili soruşturma tamamlanana kadar.",
            "Yüklenen belgeler: İşlemin tamamlanmasının ardından otomatik olarak 24 saat içinde silinir.",
          ],
        },
        {
          title: "6. KVKK Kapsamındaki Haklarınız",
          paragraphs: [
            "KVKK’nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:",
            "a) Kişisel verilerinizin işlenip işlenmediğini öğrenme hakkı.",
            "b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme hakkı.",
            "c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme hakkı.",
            "ç) Kişisel verilerinizin yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme hakkı.",
            "d) Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme ve bu kapsamda yapılan işlemin aktarıldığı üçüncü kişilere bildirilmesini isteme hakkı.",
            "e) KVKK ve ilgili diğer kanun hükümlerine uygun olarak işlenmiş olmasına rağmen, işlenmesini gerektiren sebeplerin ortadan kalkması hâlinde kişisel verilerinizin silinmesini veya yok edilmesini isteme ve bu kapsamda yapılan işlemin aktarıldığı üçüncü kişilere bildirilmesini isteme hakkı.",
            "f) İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme hakkı.",
            "g) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme hakkı.",
          ],
        },
        {
          title: "7. Başvuru Yolu",
          paragraphs: [
            "Yukarıda belirtilen haklarınızı kullanmak için nbglobalstudio@gmail.com adresine kimliğinizi doğrulayan bilgilerle birlikte yazılı başvuruda bulunabilirsiniz.",
            "Başvurunuzda; adınız, soyadınız, e-posta adresiniz, talebinizin konusu ve açıklaması yer almalıdır. Kimlik teyidi yapıldıktan sonra talebiniz KVKK’da öngörülen süreler içinde (en geç 30 gün) sonuçlandırılır.",
            "Başvurunuzun olumsuz sonuçlanması veya başvuruya hiç yanıt verilmemesi hâlinde Kişisel Verileri Koruma Kurumu’na (www.kvkk.gov.tr) şikâyette bulunma hakkınız saklıdır.",
          ],
        },
      ],
    },
    "on-bilgilendirme": {
      title: "Ön Bilgilendirme Formu",
      summary:
        "Mesafeli Sözleşmeler Yönetmeliği kapsamında, ödeme öncesinde tüketiciye sunulması zorunlu bilgilendirme formu.",
      effectiveDateLabel: "Yürürlük tarihi",
      effectiveDate: "2024 yılı ve sonrası",
      sections: [
        {
          title: "1. Satıcı Bilgileri",
          paragraphs: [
            "Satıcı: NB Global Studio",
            "E-posta: nbglobalstudio@gmail.com",
            "Web sitesi: nbglobalstudio.com",
            "Hizmet: PDF PLATFORM — bulut tabanlı PDF işleme hizmetleri",
          ],
        },
        {
          title: "2. Hizmetin Temel Özellikleri",
          paragraphs: [
            "PDF PLATFORM; PDF birleştirme, bölme, sıkıştırma, dönüştürme, şifreleme ve diğer PDF işleme araçlarını içeren bulut tabanlı bir SaaS (Hizmet Olarak Yazılım) abonelik hizmetidir.",
            "Abonelik planlarına göre farklı işlem limitleri, dosya boyutu limitleri ve özellikler uygulanmaktadır. Detaylar için nbpdf.app/pricing adresini ziyaret ediniz.",
          ],
        },
        {
          title: "3. Fiyat ve Ödeme",
          paragraphs: [
            "Fiyatlar, seçtiğiniz plana ve ödeme dönemine (aylık/yıllık) göre belirlenmektedir. Türkiye'de mukim kullanıcılar için %20 KDV dahil toplam tutar tahsil edilmektedir.",
            "Ödeme iyzico altyapısı üzerinden kredi kartı veya banka kartı ile gerçekleştirilmektedir.",
            "Abonelik süresi başladıktan sonra kalan süre için ücret iadesi yapılmamaktadır.",
          ],
        },
        {
          title: "4. Cayma Hakkı İstisnası",
          paragraphs: [
            "Mesafeli Sözleşmeler Yönetmeliği Madde 15/1-ğ uyarınca; tüketicinin onayı ile ifasına başlanan dijital içerik niteliğindeki bu hizmet için cayma hakkı uygulanmaz.",
            "Ödeme tamamlandığında ve hizmetin ifasına (abonelik aktivasyonu) başlanması halinde cayma hakkınızı kullanamayacaksınız. Bu durumu onaylıyorsanız ödemeye devam edebilirsiniz.",
            "Teknik sorunlar veya hizmetin hiç kullanılamaması halinde destek ekibimizle iletişime geçebilirsiniz.",
          ],
        },
        {
          title: "5. Şikayet ve İtiraz",
          paragraphs: [
            "Şikayetleriniz için nbglobalstudio@gmail.com adresine e-posta gönderebilirsiniz.",
            "Tüketici olarak Tüketici Hakem Heyetlerine ve Tüketici Mahkemelerine başvurma hakkınız saklıdır.",
          ],
        },
      ],
    },
    "mesafeli-satis": {
      title: "Mesafeli Satış Sözleşmesi",
      summary:
        "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında düzenlenen sözleşme.",
      effectiveDateLabel: "Yürürlük tarihi",
      effectiveDate: "Her abonelik satın alımında geçerlidir",
      sections: [
        {
          title: "1. Taraflar",
          paragraphs: [
            "SATICI: NB Global Studio, E-posta: nbglobalstudio@gmail.com",
            "ALICI: Ödeme adımında belirtilen ad-soyad ve e-posta adresiyle tanımlanan kullanıcı.",
          ],
        },
        {
          title: "2. Sözleşme Konusu",
          paragraphs: [
            "Bu sözleşmenin konusu; ALICI'nın nbpdf.app adresinden seçtiği abonelik planına ait PDF PLATFORM dijital hizmet aboneliğinin satın alınmasına ilişkin koşulları düzenlemektir.",
            "Hizmet içeriği ve özellikleri seçilen plana göre değişmektedir.",
          ],
        },
        {
          title: "3. Fiyat ve Ödeme",
          paragraphs: [
            "Satış fiyatı, ödeme ekranında KDV dahil olarak ALICI'ya gösterilmektedir.",
            "Türkiye'de mukim bireysel kullanıcılar için %20 KDV uygulanmaktadır. Yurt dışında mukim kullanıcılar için KDV uygulanmamaktadır (ihracat istisnası).",
            "Ödeme, iyzico altyapısı üzerinden güvenli biçimde gerçekleştirilmektedir. Kart bilgileri SATICI tarafından saklanmamaktadır.",
          ],
        },
        {
          title: "4. Abonelik ve Yenileme",
          paragraphs: [
            "Abonelik, ödeme onayının ardından derhal aktive edilir. Abonelik süresi seçilen plana göre belirlenir (aylık/yıllık).",
            "Abonelik otomatik olarak yenilenmez. Yenileme için yeni bir ödeme yapılması gerekmektedir.",
            "Abonelik süresi dolduğunda ücretli özellikler devre dışı kalır, ücretsiz plana geçiş otomatik olarak gerçekleşir.",
          ],
        },
        {
          title: "5. Cayma Hakkı",
          paragraphs: [
            "Mesafeli Sözleşmeler Yönetmeliği Madde 15/1-ğ uyarınca; ALICI'nın açık onayı ile ifasına başlanan dijital içerik hizmetlerinde cayma hakkı kullanılamaz.",
            "ALICI, ödeme adımında cayma hakkından feragat ettiğini açıkça beyan etmiştir. Bu nedenle abonelik aktivasyonu gerçekleştikten sonra iade talep edilemez.",
            "Hizmetin tamamen kullanılamaması durumunda SATICI ile iletişime geçilmesi halinde değerlendirme yapılacaktır.",
          ],
        },
        {
          title: "6. Kişisel Verilerin Korunması",
          paragraphs: [
            "ALICI'ya ait kişisel veriler KVKK ve GDPR kapsamında işlenmektedir. Fatura bilgileri VUK Madde 253 uyarınca 10 yıl süreyle saklanmaktadır.",
            "Ayrıntılı bilgi için Gizlilik Politikası ve KVKK Aydınlatma Metni'ni inceleyiniz.",
          ],
        },
        {
          title: "7. Uyuşmazlık Çözümü",
          paragraphs: [
            "Bu sözleşmeden doğan uyuşmazlıklarda Türk hukuku uygulanır.",
            "Tüketici hakları kapsamında Tüketici Hakem Heyeti veya Tüketici Mahkemelerine başvurabilirsiniz.",
          ],
        },
      ],
    },
    cookieNotice: {
      title: "Çerez Bildirimi",
      description:
        "Giriş, dil tercihi ve onay bilgisini saklamak için zorunlu depolama kullanıyoruz. Onayınızla birlikte ürün kalitesini iyileştirmek için temel sayfa analitiği de topluyoruz. Ayrıntılar için Gizlilik Politikamıza bakın.",
      accept: "Analitikleri kabul et",
      learnMore: "Gizlilik Politikası",
    },
  },
};
