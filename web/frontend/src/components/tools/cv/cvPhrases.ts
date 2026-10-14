/**
 * Meslek kütüphanesi: hazır madde/özet/beceri önerileri ve meslek örnek CV'leri.
 * Tamamı cihazda, kural tabanlı (yapay zekâ yok) — ücretsiz kullanıcıya da açık.
 *
 * DÜRÜSTLÜK: Maddelerdeki [X] yer tutucuları kullanıcıya ait gerçek rakamla doldurulmalıdır.
 * Uydurma başarı üretmeyiz; `findPlaceholders` doldurulmamış yer tutucuyu yakalar.
 */
import { normalizeCv, uid, type CvData, type CvLang } from "./cvModel";

type L2<T> = { tr: T; en: T };

export type Profession = {
  id: string;
  label: L2<string>;
  /** Unvan eşleştirme için küçük harfli kök parçalar */
  kw: string[];
  title: L2<string>;
  summary: L2<string[]>;
  bullets: L2<string[]>;
  skills: L2<string[]>;
};

export const PROFESSIONS: Profession[] = [
  {
    id: "sales", label: { tr: "Satış / Satış Danışmanı", en: "Sales" }, kw: ["satış", "satis", "sales", "bayi", "pazarlamacı"],
    title: { tr: "Satış Danışmanı", en: "Sales Representative" },
    summary: {
      tr: ["Müşteri ihtiyaçlarını doğru analiz eden, hedef odaklı satış profesyoneli. Kalıcı müşteri ilişkileri kurarak satış hedeflerini düzenli olarak aşmayı hedeflerim.", "[X] yıllık saha ve mağaza satış deneyimine sahibim. İkna, ilişki yönetimi ve takip konularında güçlüyüm."],
      en: ["Goal-driven sales professional who understands customer needs and builds lasting relationships to consistently exceed targets.", "[X] years of field and in-store sales experience; strong in persuasion, relationship management and follow-up."],
    },
    bullets: {
      tr: ["Aylık satış hedefini ortalama %[X] oranında aştı", "[X] aktif müşteriden oluşan portföyü yönetti ve yeniledi", "Yeni müşteri kazanımıyla satış cirosunu %[X] artırdı", "Teklif hazırlama ve fiyat görüşmelerini yürüttü", "Müşteri şikâyetlerini çözerek tekrar satın alma oranını yükseltti", "Satış verilerini düzenli raporlayarak yönetime sundu"],
      en: ["Exceeded the monthly sales target by an average of [X]%", "Managed and renewed a portfolio of [X] active customers", "Grew revenue by [X]% through new customer acquisition", "Prepared proposals and led pricing negotiations", "Resolved customer complaints and raised repeat purchases", "Reported sales figures regularly to management"],
    },
    skills: { tr: ["İkna ve Müzakere", "Müşteri İlişkileri", "Satış Raporlama", "CRM (Salesforce, HubSpot)", "Hedef Yönetimi", "Sunum Becerisi", "Zaman Yönetimi"], en: ["Negotiation", "Customer Relations", "Sales Reporting", "CRM (Salesforce, HubSpot)", "Target Management", "Presentation Skills", "Time Management"] },
  },
  {
    id: "accounting", label: { tr: "Muhasebe / Finans", en: "Accounting / Finance" }, kw: ["muhasebe", "mali", "finans", "accountant", "accounting", "finance", "bütçe"],
    title: { tr: "Muhasebe Uzmanı", en: "Accountant" },
    summary: {
      tr: ["Titiz ve detay odaklı muhasebe uzmanı. Aylık kapanış, KDV/stopaj beyannameleri ve mutabakat süreçlerinde deneyimliyim.", "[X] yıllık genel muhasebe ve raporlama deneyimi; mevzuata hâkim, doğruluk ve zamanlamaya önem veren bir çalışma tarzı."],
      en: ["Meticulous accountant experienced in month-end closing, tax filings and reconciliations.", "[X] years of general accounting and reporting experience; compliance-minded, accurate and punctual."],
    },
    bullets: {
      tr: ["Aylık kapanış işlemlerini [X] iş gününde tamamladı", "KDV, muhtasar ve geçici vergi beyannamelerini zamanında hazırladı", "Cari hesap mutabakatlarını yürüterek farkları %[X] azalttı", "Bütçe-gerçekleşme raporlarını hazırlayıp yönetime sundu", "Fatura ve tahsilat süreçlerini [X] adet müşteri için takip etti", "Denetim dönemlerinde belge ve kayıtları eksiksiz sağladı"],
      en: ["Completed month-end closing within [X] business days", "Prepared VAT, withholding and provisional tax returns on time", "Led account reconciliations and cut discrepancies by [X]%", "Prepared budget-vs-actual reports for management", "Tracked invoicing and collections for [X] customers", "Provided complete records during audit periods"],
    },
    skills: { tr: ["Genel Muhasebe", "Vergi Beyannameleri", "Excel (ileri)", "Logo / Mikro / Netsis", "Mutabakat", "Bütçeleme", "Finansal Raporlama"], en: ["General Accounting", "Tax Filings", "Excel (advanced)", "ERP (SAP, Oracle)", "Reconciliation", "Budgeting", "Financial Reporting"] },
  },
  {
    id: "software", label: { tr: "Yazılım Geliştirici", en: "Software Developer" }, kw: ["yazılım", "yazilim", "developer", "software", "programcı", "engineer", "frontend", "backend", "full stack"],
    title: { tr: "Yazılım Geliştirici", en: "Software Developer" },
    summary: {
      tr: ["Temiz, test edilebilir kod yazmaya önem veren yazılım geliştirici. Web uygulamalarını uçtan uca geliştirme ve ekip içinde iş birliği konusunda deneyimliyim.", "[X] yıllık deneyimle ölçeklenebilir arka uç servisleri ve kullanıcı dostu arayüzler geliştiriyorum."],
      en: ["Software developer who values clean, testable code and has built web applications end to end while collaborating closely with teams.", "[X] years building scalable back-end services and user-friendly interfaces."],
    },
    bullets: {
      tr: ["[Teknoloji] ile geliştirilen uygulamayı [X] kullanıcıya ulaştırdı", "Sayfa yüklenme süresini %[X] azalttı", "Birim ve entegrasyon testleriyle kod kapsamını %[X] seviyesine çıkardı", "CI/CD süreçlerini kurarak dağıtım süresini [X] dakikaya indirdi", "Kod incelemeleri yaparak ekip kod kalitesine katkı sağladı", "REST API'lerini tasarlayıp dokümante etti"],
      en: ["Shipped an application built with [technology] to [X] users", "Reduced page load time by [X]%", "Raised test coverage to [X]% with unit and integration tests", "Set up CI/CD and cut deployment time to [X] minutes", "Reviewed code and improved team code quality", "Designed and documented REST APIs"],
    },
    skills: { tr: ["JavaScript / TypeScript", "React", "Node.js", "SQL", "Git", "REST API", "Docker", "Test Yazımı"], en: ["JavaScript / TypeScript", "React", "Node.js", "SQL", "Git", "REST APIs", "Docker", "Testing"] },
  },
  {
    id: "teacher", label: { tr: "Öğretmen / Eğitmen", en: "Teacher / Trainer" }, kw: ["öğretmen", "ogretmen", "eğitmen", "egitmen", "teacher", "trainer", "akademisyen", "öğretim"],
    title: { tr: "Öğretmen", en: "Teacher" },
    summary: {
      tr: ["Öğrencilerin potansiyelini ortaya çıkarmayı hedefleyen, sabırlı ve yaratıcı öğretmen. Farklı öğrenme stillerine uygun ders planları hazırlarım.", "[X] yıllık sınıf deneyimi; ölçme-değerlendirme ve veli iletişiminde güçlü."],
      en: ["Patient, creative teacher who brings out each student's potential and plans lessons for different learning styles.", "[X] years of classroom experience; strong in assessment and parent communication."],
    },
    bullets: {
      tr: ["[X] öğrencilik sınıfta yıllık plan ve ders programı uyguladı", "Sınav başarı ortalamasını %[X] yükseltti", "Dijital araçlarla etkileşimli ders içerikleri hazırladı", "Veli toplantılarını planlayıp öğrenci gelişimini raporladı", "Okul etkinliklerinde ve projelerde koordinasyon görevi aldı", "Bireysel destek gereken öğrenciler için telafi programı yürüttü"],
      en: ["Delivered the annual plan and curriculum for a class of [X] students", "Raised the average exam score by [X]%", "Built interactive lesson content with digital tools", "Held parent meetings and reported student progress", "Coordinated school events and projects", "Ran catch-up programmes for students needing extra support"],
    },
    skills: { tr: ["Ders Planlama", "Sınıf Yönetimi", "Ölçme ve Değerlendirme", "Eğitim Teknolojileri", "Veli İletişimi", "Rehberlik"], en: ["Lesson Planning", "Classroom Management", "Assessment", "Educational Technology", "Parent Communication", "Mentoring"] },
  },
  {
    id: "health", label: { tr: "Hemşire / Sağlık", en: "Nurse / Healthcare" }, kw: ["hemşire", "hemsire", "sağlık", "saglik", "nurse", "doktor", "sağlık memuru", "teknisyen", "diş", "eczac"],
    title: { tr: "Hemşire", en: "Registered Nurse" },
    summary: {
      tr: ["Hasta güvenliğini ve empatiyi ön planda tutan hemşire. Yoğun tempoda çalışma, ekip iletişimi ve doğru kayıt tutma konularında deneyimliyim.", "[X] yıllık klinik deneyim; acil durum yönetimi ve hasta eğitiminde güçlü."],
      en: ["Nurse who puts patient safety and empathy first, experienced in fast-paced settings, team communication and accurate records.", "[X] years of clinical experience; strong in emergency response and patient education."],
    },
    bullets: {
      tr: ["Günde ortalama [X] hastanın bakımını ve takibini üstlendi", "İlaç ve tedavi uygulamalarını protokollere uygun yürüttü", "Hasta ve yakınlarına bakım eğitimi verdi", "Acil durumlarda ekiple koordineli müdahale etti", "Hasta dosyalarını eksiksiz ve zamanında kaydetti", "Enfeksiyon kontrol önlemlerine uyum oranını artırdı"],
      en: ["Cared for and monitored an average of [X] patients per day", "Administered medication and treatment according to protocol", "Educated patients and families on care", "Responded to emergencies in coordination with the team", "Kept patient records complete and timely", "Improved compliance with infection-control measures"],
    },
    skills: { tr: ["Hasta Bakımı", "Acil Müdahale", "İlaç Uygulama", "Hasta Eğitimi", "Hasta Kaydı", "Enfeksiyon Kontrolü", "Temel Yaşam Desteği (BLS)"], en: ["Patient Care", "Emergency Response", "Medication Administration", "Patient Education", "Medical Records", "Infection Control", "Basic Life Support (BLS)"] },
  },
  {
    id: "support", label: { tr: "Müşteri Hizmetleri", en: "Customer Service" }, kw: ["müşteri", "musteri", "çağrı", "customer", "support", "destek", "call center", "temsilci"],
    title: { tr: "Müşteri Temsilcisi", en: "Customer Service Representative" },
    summary: {
      tr: ["Sakin, çözüm odaklı müşteri temsilcisi. Zor durumdaki müşterileri memnun etmeyi ve ilk görüşmede çözüm sunmayı hedeflerim.", "[X] yıllık çağrı merkezi ve yazılı destek deneyimi; yüksek memnuniyet puanları."],
      en: ["Calm, solution-focused customer service representative who aims to resolve issues on the first contact.", "[X] years of call-centre and written-support experience with high satisfaction scores."],
    },
    bullets: {
      tr: ["Günde ortalama [X] müşteri talebini yanıtladı", "İlk temasta çözüm oranını %[X] seviyesine çıkardı", "Müşteri memnuniyet skorunu [X] puana yükseltti", "Şikâyetleri ilgili birimlerle koordine ederek çözüme kavuşturdu", "Yeni ekip üyelerinin eğitimine destek oldu", "Müşteri geri bildirimlerini raporlayarak süreç iyileştirmesi önerdi"],
      en: ["Handled an average of [X] customer requests per day", "Raised first-contact resolution to [X]%", "Improved the customer satisfaction score to [X]", "Resolved complaints by coordinating with internal teams", "Helped train new team members", "Reported customer feedback and proposed process improvements"],
    },
    skills: { tr: ["Aktif Dinleme", "Problem Çözme", "CRM Yazılımları", "Yazılı İletişim", "Stres Yönetimi", "Çağrı Yönetimi"], en: ["Active Listening", "Problem Solving", "CRM Software", "Written Communication", "Stress Management", "Call Handling"] },
  },
  {
    id: "hr", label: { tr: "İnsan Kaynakları", en: "Human Resources" }, kw: ["insan kaynakları", "ik ", "hr", "human resources", "işe alım", "recruit", "bordro"],
    title: { tr: "İnsan Kaynakları Uzmanı", en: "HR Specialist" },
    summary: {
      tr: ["İşe alım, çalışan deneyimi ve özlük süreçlerinde deneyimli İK uzmanı. Adayla ve yöneticiyle şeffaf iletişim kurarım.", "[X] yıllık İK deneyimi; işe alım, bordro desteği ve çalışan bağlılığı projelerinde aktif rol."],
      en: ["HR specialist experienced in recruitment, employee experience and personnel administration, communicating transparently with candidates and managers.", "[X] years in HR with active roles in hiring, payroll support and engagement projects."],
    },
    bullets: {
      tr: ["Yılda [X] pozisyon için işe alım sürecini yönetti", "Ortalama işe alım süresini [X] güne düşürdü", "Çalışan oryantasyon programını tasarlayıp uyguladı", "Özlük dosyalarını ve izin/bordro verilerini güncel tuttu", "Çalışan memnuniyeti anketlerini yürütüp aksiyon planı hazırladı", "İş mevzuatına uygun sözleşme ve belge süreçlerini yönetti"],
      en: ["Managed hiring for [X] positions per year", "Cut average time-to-hire to [X] days", "Designed and ran the employee onboarding programme", "Kept personnel files and leave/payroll data up to date", "Ran satisfaction surveys and prepared action plans", "Managed contract and document processes in line with labour law"],
    },
    skills: { tr: ["İşe Alım", "Mülakat Teknikleri", "Bordro Süreçleri", "İş Hukuku", "Çalışan Bağlılığı", "ATS Yazılımları"], en: ["Recruitment", "Interviewing", "Payroll Processes", "Labour Law", "Employee Engagement", "ATS Software"] },
  },
  {
    id: "marketing", label: { tr: "Pazarlama / Dijital", en: "Marketing / Digital" }, kw: ["pazarlama", "marketing", "dijital", "digital", "sosyal medya", "social", "seo", "reklam", "içerik"],
    title: { tr: "Dijital Pazarlama Uzmanı", en: "Digital Marketing Specialist" },
    summary: {
      tr: ["Veriye dayalı kampanyalar kuran dijital pazarlama uzmanı. Reklam, içerik ve sosyal medya yönetiminde ölçülebilir sonuçlara odaklanırım.", "[X] yıllık deneyimle markaların çevrimiçi görünürlüğünü ve dönüşüm oranlarını artırıyorum."],
      en: ["Digital marketer who builds data-driven campaigns and focuses on measurable results across ads, content and social media.", "[X] years raising brands' online visibility and conversion rates."],
    },
    bullets: {
      tr: ["Aylık [X] TL reklam bütçesini yönetti ve dönüşümü %[X] artırdı", "Sosyal medya takipçi sayısını [X] ay içinde %[X] büyüttü", "SEO çalışmalarıyla organik trafiği %[X] yükseltti", "E-posta kampanyalarında açılma oranını %[X] seviyesine çıkardı", "Google Analytics ile raporlayıp kampanyaları optimize etti", "İçerik takvimi hazırlayıp yayın akışını yönetti"],
      en: ["Managed a monthly ad budget of [X] and raised conversions by [X]%", "Grew social media followers by [X]% in [X] months", "Increased organic traffic by [X]% through SEO", "Raised email open rate to [X]%", "Reported with Google Analytics and optimised campaigns", "Built the content calendar and managed publishing"],
    },
    skills: { tr: ["Google Ads", "Meta Ads", "SEO", "Google Analytics", "İçerik Planlama", "E-posta Pazarlama", "Canva / Photoshop"], en: ["Google Ads", "Meta Ads", "SEO", "Google Analytics", "Content Planning", "Email Marketing", "Canva / Photoshop"] },
  },
  {
    id: "engineer", label: { tr: "Mühendis", en: "Engineer" }, kw: ["mühendis", "muhendis", "engineer", "üretim", "proje müh", "inşaat", "makine", "elektrik"],
    title: { tr: "Mühendis", en: "Engineer" },
    summary: {
      tr: ["Analitik düşünen, sahada ve ofiste proje yürütebilen mühendis. Güvenlik, kalite ve termin odaklı çalışırım.", "[X] yıllık mühendislik deneyimi; planlama, teknik çizim ve ekip koordinasyonunda güçlü."],
      en: ["Analytical engineer able to run projects both on site and in the office, with a focus on safety, quality and deadlines.", "[X] years of engineering experience; strong in planning, technical drawing and team coordination."],
    },
    bullets: {
      tr: ["[X] TL bütçeli projeyi zamanında ve bütçe içinde teslim etti", "Süreç iyileştirmeleriyle üretim verimini %[X] artırdı", "Teknik çizim ve şartnameleri hazırlayıp onaya sundu", "[X] kişilik saha ekibini koordine etti", "İş güvenliği ve kalite standartlarına uyumu denetledi", "Tedarikçi seçimi ve maliyet analizini yürüttü"],
      en: ["Delivered a project with a budget of [X] on time and within budget", "Raised production efficiency by [X]% through process improvements", "Prepared and submitted technical drawings and specifications", "Coordinated a field team of [X] people", "Audited compliance with safety and quality standards", "Handled supplier selection and cost analysis"],
    },
    skills: { tr: ["AutoCAD", "Proje Yönetimi", "MS Project", "Kalite Yönetimi (ISO 9001)", "İş Sağlığı ve Güvenliği", "Maliyet Analizi", "Excel"], en: ["AutoCAD", "Project Management", "MS Project", "Quality Management (ISO 9001)", "Occupational Safety", "Cost Analysis", "Excel"] },
  },
  {
    id: "hospitality", label: { tr: "Garson / Restoran / Otel", en: "Hospitality / Service" }, kw: ["garson", "restoran", "otel", "resepsiyon", "barista", "aşçı", "chef", "waiter", "hotel", "kafe", "komi", "servis"],
    title: { tr: "Servis Elemanı", en: "Service Staff" },
    summary: {
      tr: ["Güler yüzlü, hızlı ve müşteri memnuniyetini önceleyen servis profesyoneli. Yoğun saatlerde sakin kalarak ekiple uyumlu çalışırım.", "[X] yıllık restoran/otel deneyimi; hijyen standartlarına ve nazik hizmete önem veririm."],
      en: ["Friendly, fast service professional who prioritises guest satisfaction and stays calm and team-minded at peak hours.", "[X] years in restaurants/hotels, committed to hygiene standards and courteous service."],
    },
    bullets: {
      tr: ["Yoğun vardiyalarda günde ortalama [X] misafire hizmet verdi", "Menü ve ürün bilgisiyle ek satışı %[X] artırdı", "Kasa ve ödeme işlemlerini hatasız yürüttü", "Masa düzeni, temizlik ve hijyen standartlarını korudu", "Misafir şikâyetlerini yerinde çözüme kavuşturdu", "Yeni çalışanların oryantasyonuna destek oldu"],
      en: ["Served an average of [X] guests per day during busy shifts", "Raised upselling by [X]% through menu knowledge", "Handled cash and payments without errors", "Maintained table setup, cleanliness and hygiene standards", "Resolved guest complaints on the spot", "Supported onboarding of new staff"],
    },
    skills: { tr: ["Müşteri Hizmeti", "Takım Çalışması", "Kasa Kullanımı", "Hijyen Standartları", "Hızlı Karar Verme", "Ek Satış"], en: ["Guest Service", "Teamwork", "POS Operation", "Hygiene Standards", "Quick Decision-Making", "Upselling"] },
  },
  {
    id: "logistics", label: { tr: "Depo / Lojistik", en: "Warehouse / Logistics" }, kw: ["depo", "lojistik", "warehouse", "logistics", "sevkiyat", "forklift", "stok", "satın alma", "tedarik"],
    title: { tr: "Depo ve Lojistik Elemanı", en: "Warehouse & Logistics Associate" },
    summary: {
      tr: ["Düzenli, sorumluluk sahibi depo ve lojistik çalışanı. Stok doğruluğu, zamanında sevkiyat ve iş güvenliği konusunda titizim.", "[X] yıllık deneyim; forklift kullanımı ve stok yönetim sistemlerinde yetkinlik."],
      en: ["Organised, dependable warehouse and logistics worker, meticulous about stock accuracy, on-time shipping and safety.", "[X] years of experience; skilled with forklifts and stock management systems."],
    },
    bullets: {
      tr: ["Günde ortalama [X] koli/palet sevkiyatını hazırladı", "Stok sayımlarında doğruluk oranını %[X] seviyesinde tuttu", "Mal kabul ve yerleştirme süreçlerini yürüttü", "Forklift ve istif ekipmanlarını güvenli biçimde kullandı", "Sevkiyat gecikmelerini %[X] azalttı", "WMS/ERP sistemine giriş ve çıkışları kaydetti"],
      en: ["Prepared an average of [X] boxes/pallets for dispatch per day", "Kept stock-count accuracy at [X]%", "Handled goods receiving and put-away", "Operated forklifts and stacking equipment safely", "Reduced shipping delays by [X]%", "Recorded inbound and outbound movements in the WMS/ERP"],
    },
    skills: { tr: ["Stok Yönetimi", "Forklift Kullanımı", "WMS / ERP", "Sevkiyat Planlama", "İş Güvenliği", "Envanter Sayımı"], en: ["Inventory Management", "Forklift Operation", "WMS / ERP", "Shipment Planning", "Workplace Safety", "Stock Counting"] },
  },
  {
    id: "manager", label: { tr: "Yönetici / Müdür", en: "Manager" }, kw: ["yönetici", "yonetici", "müdür", "mudur", "manager", "direktör", "director", "lider", "şef", "supervisor"],
    title: { tr: "Yönetici", en: "Manager" },
    summary: {
      tr: ["Ekiplerini hedeflere taşıyan, sonuç odaklı yönetici. Strateji, bütçe ve insan yönetimini dengeli yürütürüm.", "[X] yıllık yöneticilik deneyimi; [X] kişilik ekipleri yönetme ve performansı artırma konusunda güçlü."],
      en: ["Results-driven manager who leads teams to their goals and balances strategy, budget and people management.", "[X] years in management leading teams of [X] and improving performance."],
    },
    bullets: {
      tr: ["[X] kişilik ekibi yöneterek hedeflerin %[X]'ini gerçekleştirdi", "Yıllık [X] TL bütçeyi planladı ve takip etti", "Süreç iyileştirmeleriyle maliyeti %[X] azalttı", "Ekip üyeleri için performans değerlendirme ve gelişim planı hazırladı", "Üst yönetime düzenli raporlama yaptı", "Departmanlar arası iş birliğini güçlendirdi"],
      en: ["Led a team of [X] and achieved [X]% of targets", "Planned and monitored an annual budget of [X]", "Cut costs by [X]% through process improvements", "Ran performance reviews and development plans for team members", "Reported regularly to senior management", "Strengthened cross-department collaboration"],
    },
    skills: { tr: ["Ekip Yönetimi", "Stratejik Planlama", "Bütçe Yönetimi", "Performans Yönetimi", "Liderlik", "Karar Verme"], en: ["Team Management", "Strategic Planning", "Budget Management", "Performance Management", "Leadership", "Decision-Making"] },
  },
  {
    id: "design", label: { tr: "Grafik / Tasarım", en: "Design" }, kw: ["tasarım", "tasarim", "grafik", "design", "designer", "ux", "ui", "illüstr"],
    title: { tr: "Grafik Tasarımcı", en: "Graphic Designer" },
    summary: {
      tr: ["Markaların hikâyesini görsel dille anlatan grafik tasarımcı. Baskı ve dijital mecralarda tutarlı kimlik çalışmaları yaparım.", "[X] yıllık deneyim; kurumsal kimlik, sosyal medya ve kampanya tasarımında güçlü bir portfolyo."],
      en: ["Graphic designer who tells brand stories visually, creating consistent identities across print and digital.", "[X] years of experience with a strong portfolio in branding, social media and campaign design."],
    },
    bullets: {
      tr: ["[X] markanın kurumsal kimliğini ve görsel setlerini tasarladı", "Sosyal medya tasarımlarıyla etkileşimi %[X] artırdı", "Baskı öncesi dosya hazırlığını hatasız yürüttü", "Müşteri geri bildirimlerine göre tasarımları [X] revizyonda onaya taşıdı", "Marka rehberi hazırlayarak tutarlılığı sağladı", "Aynı anda [X] projeyi takvimine uygun yönetti"],
      en: ["Designed brand identities and asset sets for [X] brands", "Raised engagement by [X]% with social media designs", "Prepared print-ready files without errors", "Took designs to approval in [X] revisions based on client feedback", "Created brand guidelines to ensure consistency", "Managed [X] projects at once on schedule"],
    },
    skills: { tr: ["Adobe Photoshop", "Adobe Illustrator", "Figma", "Marka Kimliği", "Tipografi", "Baskı Hazırlık"], en: ["Adobe Photoshop", "Adobe Illustrator", "Figma", "Brand Identity", "Typography", "Print Preparation"] },
  },
  {
    id: "admin", label: { tr: "Ofis / Sekreter / Asistan", en: "Admin / Assistant" }, kw: ["sekreter", "asistan", "ofis", "büro", "admin", "assistant", "secretary", "ön büro", "veri giriş"],
    title: { tr: "Ofis Asistanı", en: "Office Administrator" },
    summary: {
      tr: ["Organize, güvenilir ve çok görevli çalışmaya yatkın ofis asistanı. Yazışma, toplantı ve evrak süreçlerini eksiksiz yürütürüm.", "[X] yıllık idari destek deneyimi; Office programlarında ileri düzey."],
      en: ["Organised, dependable office administrator comfortable with multitasking, handling correspondence, meetings and paperwork.", "[X] years of administrative support experience; advanced in Office tools."],
    },
    bullets: {
      tr: ["Yöneticinin takvimini, toplantı ve seyahat planlarını yönetti", "Günde ortalama [X] e-posta ve telefon talebini yanıtladı", "Evrak, arşiv ve fatura takibini düzenli yürüttü", "Toplantı notlarını tutup aksiyon listelerini paylaştı", "Ofis malzeme alımlarını planlayarak maliyeti %[X] düşürdü", "Rapor ve sunum hazırlıklarına destek verdi"],
      en: ["Managed the manager's calendar, meetings and travel plans", "Answered an average of [X] emails and calls per day", "Kept paperwork, archives and invoices in order", "Took meeting notes and shared action lists", "Planned office purchases and cut costs by [X]%", "Supported report and presentation preparation"],
    },
    skills: { tr: ["MS Office (Word, Excel, PowerPoint)", "Takvim Yönetimi", "Yazışma", "Dosyalama", "Toplantı Organizasyonu", "Hızlı Klavye Kullanımı"], en: ["MS Office (Word, Excel, PowerPoint)", "Calendar Management", "Correspondence", "Filing", "Meeting Coordination", "Fast Typing"] },
  },
  {
    id: "general", label: { tr: "Diğer / Genel", en: "Other / General" }, kw: [],
    title: { tr: "", en: "" },
    summary: {
      tr: ["[X] yıllık deneyime sahip, sorumluluk sahibi ve öğrenmeye açık bir çalışanım. Takım çalışmasına yatkınım ve verilen işi zamanında, titizlikle tamamlarım.", "Hızlı öğrenen, düzenli ve iletişimi güçlü biriyim. Yeni bir ekibe değer katmak için pozisyonunuzla ilgileniyorum."],
      en: ["Responsible, eager-to-learn professional with [X] years of experience. I work well in teams and complete tasks on time with care.", "Quick learner, organised and a strong communicator, keen to add value to a new team."],
    },
    bullets: {
      tr: ["Günlük görevleri zamanında ve hatasız tamamladı", "[X] kişilik ekiple uyum içinde çalıştı", "Müşteri ve çalışma arkadaşlarıyla etkili iletişim kurdu", "Yeni sistemleri ve süreçleri kısa sürede öğrendi", "İş süreçlerini iyileştirerek zaman tasarrufu sağladı", "Sorumluluk alarak ek görevleri üstlendi"],
      en: ["Completed daily tasks on time and without errors", "Worked in harmony with a team of [X]", "Communicated effectively with customers and colleagues", "Learned new systems and processes quickly", "Improved work processes and saved time", "Took initiative on additional responsibilities"],
    },
    skills: { tr: ["Takım Çalışması", "İletişim", "Zaman Yönetimi", "Problem Çözme", "MS Office", "Öğrenmeye Açıklık"], en: ["Teamwork", "Communication", "Time Management", "Problem Solving", "MS Office", "Adaptability"] },
  },
];

export const professionById = (id: string): Profession | undefined => PROFESSIONS.find((p) => p.id === id);

/** Unvan/pozisyon metninden en uygun mesleği bulur; yoksa null. */
export function matchProfession(text: string): Profession | null {
  const t = ` ${text.toLocaleLowerCase("tr")} `;
  if (!t.trim()) return null;
  let best: { p: Profession; n: number } | null = null;
  for (const p of PROFESSIONS) {
    let n = 0;
    for (const k of p.kw) if (k && t.includes(k)) n += k.length;
    if (n > 0 && (!best || n > best.n)) best = { p, n };
  }
  return best ? best.p : null;
}

/** Doldurulmamış [X] / [Teknoloji] yer tutucuları. */
export function findPlaceholders(text: string): string[] {
  return text.match(/\[[^\]\n]{1,24}\]/g) ?? [];
}

export function hasPlaceholders(d: CvData): boolean {
  const all = [d.summary, ...d.experience.map((e) => e.desc), ...d.projects.map((p) => p.desc), ...d.education.map((e) => e.desc)].join("\n");
  return findPlaceholders(all).length > 0;
}

/** Bir meslek için tam örnek CV (kurgusal kişi). Kullanıcı üzerine yazıp kendi bilgisini girer. */
export function professionSample(id: string, lang: CvLang): CvData {
  const p = professionById(id) ?? PROFESSIONS[PROFESSIONS.length - 1];
  const tr = lang === "tr";
  const title = p.title[lang] || (tr ? "Pozisyon" : "Job title");
  return normalizeCv({
    name: tr ? "Ayşe Demir" : "Alex Morgan",
    title,
    email: tr ? "ayse.demir@ornek.com" : "alex.morgan@example.com",
    phone: tr ? "+90 532 000 00 00" : "+1 555 010 0000",
    city: tr ? "İstanbul" : "London",
    summary: p.summary[lang][0],
    experience: [
      { id: uid(), company: tr ? "Örnek Şirket A.Ş." : "Sample Company Ltd.", role: title, location: tr ? "İstanbul" : "London", start: "2021-02", end: "", current: true, desc: p.bullets[lang].slice(0, 3).join("\n") },
      { id: uid(), company: tr ? "Birinci Firma" : "First Employer", role: title, location: tr ? "Ankara" : "Manchester", start: "2018-06", end: "2021-01", current: false, desc: p.bullets[lang].slice(3, 5).join("\n") },
    ],
    education: [{ id: uid(), school: tr ? "Örnek Üniversitesi" : "Sample University", degree: tr ? "Lisans" : "Bachelor's degree", location: "", start: "2014-09", end: "2018-06", current: false, desc: "" }],
    skills: p.skills[lang].slice(0, 6).map((name, i) => ({ id: uid(), name, level: i < 2 ? 5 : 4 })),
    languages: [{ id: uid(), name: tr ? "Türkçe" : "English", level: tr ? "Ana dil" : "Native" }, { id: uid(), name: tr ? "İngilizce" : "Spanish", level: tr ? "Orta-üstü (B2)" : "Intermediate (B1)" }],
    settings: { ...normalizeCv({}).settings, lang },
  });
}
