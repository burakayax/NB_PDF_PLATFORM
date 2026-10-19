// ─────────────────────────────────────────────────────────────────────────────
// CV ÖRNEĞİ REHBERLERİ — Sık Sorulan Sorular.
// Her rehberde 3 soru: iki genel (uzunluk, deneyimsizlik) + o mesleğe özgü bir soru.
// Genel tavsiye niteliğindedir; istatistik/vaat YOK (CV'ye uydurma rakam yazdırılmaz).
// TR ve EN ayrı yazılmıştır (çeviri değil).
// ─────────────────────────────────────────────────────────────────────────────

/** Mesleğe özgü soru-cevap: id → { tr: [q, a], en: [q, a] } */
const SPECIFIC = {
  sales: {
    tr: ["Satış rakamlarını CV'ye nasıl yazmalıyım?", "Gerçek rakamlarınızı kullanın: hedef gerçekleşme yüzdesi, ciro, müşteri sayısı gibi. Şirket cirosunu açıklamak istemiyorsanız yüzde ya da büyüme oranı yazabilirsiniz. Bilmediğiniz ya da tahmin ettiğiniz bir rakamı yazmayın; mülakatta sorulursa savunamazsınız."],
    en: ["How should I write sales figures on my CV?", "Use your real numbers: target attainment percentage, revenue, number of accounts. If you can't disclose company revenue, give a percentage or growth rate instead. Don't write a figure you don't know or are guessing; you won't be able to defend it in an interview."],
  },
  accounting: {
    tr: ["Muhasebe programlarını nasıl yazmalıyım?", "İlanın adını verdiği programı ve Excel düzeyinizi birebir yazın (ör. \"Excel: ileri düzey, DÜŞEYARA ve pivot tablo\"). Yalnızca gerçekten kullandığınız programları listeleyin; mülakatta bir örnek işlem sorulabilir."],
    en: ["How should I list accounting software?", "Name the exact program the ad mentions and state your Excel level (e.g. \"Excel: advanced, lookups and pivot tables\"). List only software you have really used; you may be asked to walk through an example task in the interview."],
  },
  software: {
    tr: ["CV'ye GitHub ya da proje bağlantısı eklemeli miyim?", "Evet, göstermeye değer çalışır projeleriniz varsa. Bağlantıya tıklayan kişi düzenli bir README ve çalışan bir örnek görmeli. Yarım kalmış ya da özel verili depoları eklemeyin; en iyi iki üç projeyi seçin."],
    en: ["Should I add a GitHub or project link to my CV?", "Yes, if you have projects worth showing. Whoever clicks should find a clear README and something that works. Skip unfinished repositories or ones with private data; pick your best two or three projects."],
  },
  teacher: {
    tr: ["Öğretmen CV'sinde nelere yer vermeliyim?", "Branşınızı, çalıştığınız kademeleri, formasyon ve sertifikalarınızı, kullandığınız ölçme-değerlendirme ve dijital araçları yazın. Mümkünse sınıf mevcudu ya da projeler gibi somut bilgiler ekleyin. Öğrenci bilgilerini veya adlarını yazmayın."],
    en: ["What should a teacher's CV include?", "List your subject, the levels you have taught, certifications, and the assessment and digital tools you use. Add concrete details such as class size or projects where you can. Don't include student names or personal information."],
  },
  health: {
    tr: ["Lisans ve sertifikaları nereye yazmalıyım?", "Eğitim bölümünün hemen altında ayrı bir \"Lisans ve Sertifikalar\" başlığı açın; kurum, veriliş ve (varsa) geçerlilik tarihini yazın. Hasta bilgisi, ad ya da tanı gibi gizli verileri CV'ye hiçbir şekilde koymayın."],
    en: ["Where should I put licences and certifications?", "Add a separate \"Licences and Certifications\" heading right below Education, with the issuing body, date and (if any) expiry. Never put confidential patient information such as names or diagnoses on your CV."],
  },
  support: {
    tr: ["Müşteri memnuniyeti puanlarını yazmalı mıyım?", "Gerçek ve doğrulanabilir bir puanınız varsa evet; günlük çağrı/talep sayısı ve ortalama çözüm süresi de iyi göstergelerdir. Rakamınız yoksa bir iyileştirmeyi (ör. yeni bir yanıt şablonu hazırladınız) anlatın, rakam uydurmayın."],
    en: ["Should I include customer satisfaction scores?", "Yes, if you have a real, checkable score; daily ticket or call volume and average resolution time are good indicators too. If you have no figures, describe an improvement you made (such as a new reply template) instead of inventing numbers."],
  },
  hr: {
    tr: ["İşe alım deneyimini nasıl göstermeliyim?", "Kapattığınız pozisyon sayısını, işe alım süresini ve kullandığınız kanalları (ilan siteleri, mülakat, değerlendirme yöntemleri) yazın. Aday ya da çalışan adı gibi kişisel verileri hiçbir şekilde paylaşmayın."],
    en: ["How do I show recruiting experience?", "State the number of roles you filled, time to hire and the channels you used (job boards, interviews, assessment methods). Never share personal data such as candidate or employee names."],
  },
  marketing: {
    tr: ["Kampanya sonuçlarını nasıl yazmalıyım?", "Gerçek ölçümlerinizi yazın: erişim, tıklama, dönüşüm, maliyet düşüşü gibi. Bütçeyi paylaşmak istemiyorsanız oran kullanın. Kullandığınız araçları (analitik, reklam yönetimi, e-posta platformu) da adlarıyla belirtin."],
    en: ["How should I write campaign results?", "Use your real measurements: reach, clicks, conversions, cost reduction. If you can't share the budget, use ratios. Also name the tools you used (analytics, ad management, email platforms)."],
  },
  engineer: {
    tr: ["Projelerimi CV'de nasıl anlatmalıyım?", "Her proje için rolünüzü, kullandığınız yazılım ya da standardı ve sonucu yazın. Ekip projesiyse kendi payınızı net belirtin (\"X modülünü tasarladım\" gibi). Gizlilik sözleşmesi olan işlerin ayrıntısını vermeyin."],
    en: ["How should I describe projects on my CV?", "For each project give your role, the software or standard you used and the outcome. For team projects, state your own part clearly (for example \"designed module X\"). Don't give details of work covered by a confidentiality agreement."],
  },
  hospitality: {
    tr: ["Yabancı dil ve vardiya bilgisini nasıl yazmalıyım?", "Dilleri düzeyiyle birlikte yazın (ör. \"İngilizce: orta, konuşma\"). Sezonluk çalıştıysanız dönemleri, vardiyalı düzeni ve hizmet verdiğiniz masa/oda ölçeğini belirtin. Düzeyinizi olduğundan yüksek göstermeyin."],
    en: ["How should I present languages and shift work?", "List languages with your level (e.g. \"English: intermediate, spoken\"). If you worked seasonally, give the periods, the shift pattern and the scale you served (tables, rooms). Don't overstate your level."],
  },
  logistics: {
    tr: ["Ehliyet ve operatör belgelerini nereye yazmalıyım?", "Sertifikalar bölümünde belge adı ve geçerlilik tarihiyle yazın (ör. ehliyet sınıfı, forklift/istif makinesi operatör belgesi). Kullandığınız depo yönetim yazılımını ya da el terminalini de adıyla belirtin."],
    en: ["Where should I list licences and operator certificates?", "Put them in a certifications section with the document name and validity date (for example driving licence class, forklift operator certificate). Also name the warehouse software or handheld terminals you have used."],
  },
  manager: {
    tr: ["Yönettiğim ekibi nasıl tarif etmeliyim?", "Ekip büyüklüğünü, sorumlu olduğunuz bütçe ya da hedefi ve elde edilen sonucu yazın (ör. \"8 kişilik ekibi yönettim\"). Sonuçta payınız ekibe aitse bunu dürüstçe \"ekiple birlikte\" diyerek belirtin."],
    en: ["How should I describe the team I managed?", "State team size, the budget or target you were responsible for and the result (e.g. \"managed a team of 8\"). If the result was a team effort, say so honestly with \"together with the team\"."],
  },
  design: {
    tr: ["CV'ye portfolyo bağlantısı eklemeli miyim?", "Evet. Bağlantıyı iletişim bilgilerinin yanına koyun ve içinde en iyi üç beş işinizi gösterin; her işte rolünüzü ve kullandığınız araçları yazın. Müşteri izni olmayan çalışmaları herkese açık paylaşmayın."],
    en: ["Should I add a portfolio link to my CV?", "Yes. Place it next to your contact details and show your best three to five pieces, stating your role and the tools used for each. Don't make client work public without permission."],
  },
  admin: {
    tr: ["Ofis programlarındaki düzeyimi nasıl yazmalıyım?", "\"Ofis programları\" yerine adlarını ve ne için kullandığınızı yazın (ör. \"Excel: tablo ve basit formüller\", \"e-posta ve takvim yönetimi\"). Yaptığınız evrak, randevu ve toplantı organizasyonunu rakamla destekleyebilirsiniz."],
    en: ["How should I state my office-software level?", "Instead of \"office software\", name the programs and what you use them for (e.g. \"Excel: tables and basic formulas\", \"email and calendar management\"). You can back up filing, scheduling and meeting organisation with numbers."],
  },
};

/** Her mesleğe aynı iki genel soru. */
function generic(nameTr, nameEn) {
  const lowerTr = nameTr.toLocaleLowerCase("tr");
  const lowerEn = nameEn.toLowerCase();
  return {
    tr: [
      [`${nameTr} CV'si kaç sayfa olmalı?`, `Çoğu başvuru için tek sayfa yeterlidir. Uzun bir deneyim geçmişiniz varsa iki sayfaya çıkabilirsiniz; ama en önemli bilgiler (özet, son pozisyon, temel beceriler) ilk sayfada olmalı.`],
      [`Deneyimim yoksa ${lowerTr} CV'sine ne yazmalıyım?`, `Eğitiminizi, staj ve projelerinizi, gönüllü çalışmalarınızı ve sertifikalarınızı öne alın. Her birinde ne yaptığınızı ve sonucunu yazın. Olmayan bir deneyimi ya da rakamı eklemeyin.`],
    ],
    en: [
      [`How long should a ${lowerEn} CV be?`, `One page is enough for most applications. With a long work history you can go to two, but the most important content (summary, latest role, key skills) should be on the first page.`],
      [`What should a ${lowerEn} CV include if I have no experience?`, `Lead with education, internships and projects, volunteering and certificates. For each, say what you did and the result. Don't add experience or figures you don't have.`],
    ],
  };
}

/** `{ tr: [{q,a}], en: [{q,a}] }` döner. */
export function cvFaq(id, nameTr, nameEn) {
  const g = generic(nameTr, nameEn);
  const s = SPECIFIC[id];
  const toItems = (arr) => arr.map(([q, a]) => ({ q, a }));
  return {
    tr: toItems(s ? [s.tr, ...g.tr] : g.tr),
    en: toItems(s ? [s.en, ...g.en] : g.en),
  };
}
