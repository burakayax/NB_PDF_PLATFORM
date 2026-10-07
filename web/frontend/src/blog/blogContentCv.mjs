// ─────────────────────────────────────────────────────────────────────────────
// CV ve FOTOĞRAF REHBERLERİ — CV Oluştur + AI Fotoğraf Stüdyosu araçlarının blog yazıları.
// blogContent.mjs bu diziyi BLOG_POSTS'un başına ekler. Biçim ve blok tipleri orada tanımlıdır.
// İçerik ürünün gerçek özelliklerine sadıktır; resmî ölçüler için "kurumun güncel şartını
// kontrol edin" uyarısı bilinçli olarak her yerde tekrarlanır.
// ─────────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

export const CV_PHOTO_POSTS = [
  // 1 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "cv-nasil-hazirlanir",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 7,
      tags: { tr: ["CV", "Özgeçmiş", "İş Başvurusu"], en: ["CV", "Resume", "Job Application"] },
      accent: "sky",
      tool: "/tools/cv-olustur",
    },
    {
      title: "CV Nasıl Hazırlanır? Adım Adım Rehber",
      description:
        "İşe alımcının 30 saniyede okuyup hatırlayacağı bir CV'nin adımları: bölüm sırası, deneyimi rakamla anlatma, uzunluk, fotoğraf ve PDF kaydetme.",
      excerpt:
        "İyi bir CV her şeyi anlatan değil, doğru şeyleri hızlı gösteren CV'dir. Başlıkların sırasından deneyim maddelerinin nasıl yazılacağına kadar adım adım bir yol haritası.",
      blocks: [
        { t: "lead", x: "İşe alımcılar bir CV'ye çoğunlukla çok kısa bir süre ayırır; bu yüzden ilk bakışta işe yarar bilgiyi bulabilmeleri gerekir. İyi bir CV, yaptığınız her şeyi sıralayan değil, başvurduğunuz pozisyonla en ilgili olanları öne çıkaran belgedir. Aşağıdaki adımlar sıfırdan CV hazırlarken izleyebileceğiniz sade bir yol haritası." },
        { t: "h2", x: "1. Önce hedefi belirleyin" },
        { t: "p", x: "Aynı CV'yi her ilana göndermek yerine, başvurduğunuz pozisyonun ilanını okuyun ve istenen becerileri not edin. CV'nizdeki deneyim ve becerilerden ilanla örtüşenleri öne alın, ilgisiz olanları kısaltın. Bu, CV'nizi her seferinde baştan yazmak demek değildir; yalnızca sıralamayı ve vurguyu ayarlamak yeterlidir." },
        { t: "h2", x: "2. Bölümleri doğru sırayla dizin" },
        { t: "ol", items: [
          "Üst bilgi: Ad soyad, hedef unvan, telefon, e-posta, şehir. LinkedIn ya da portfolyo bağlantısı varsa ekleyin.",
          "Profil özeti: 2–4 cümle. Kim olduğunuz, hangi alanda kaç yıllık deneyiminiz olduğu ve ne aradığınız.",
          "İş deneyimi: En yeniden eskiye. Her kalemde pozisyon, şirket, tarih aralığı ve 2–4 madde.",
          "Eğitim: Yeni mezunsanız deneyimden önce, deneyimliyseniz sonra gelir.",
          "Beceriler, diller, sertifikalar: İlanla ilgili olanları seçin; yüzlerce araç adı sıralamayın.",
        ] },
        { t: "h2", x: "3. Deneyimi görev değil sonuç olarak yazın" },
        { t: "p", x: "“Satış raporlarını hazırladı” bir görevi anlatır; “Haftalık satış raporlarıyla stok planlamasını iyileştirdi, fire oranını %12 düşürdü” ise sonucu. Elinizde sayı yoksa süreyi, ölçeği ya da ekibin büyüklüğünü yazın: kaç kişilik ekip, kaç müşteri, hangi bütçe. Her madde bir eylem fiiliyle başlasın ve tek satırı ya da en fazla iki satırı geçmesin." },
        { t: "tip", x: "Rakam uydurmayın. Kesin bir sayı yoksa “yaklaşık” ya da aralık yazmak da dürüst ve yeterlidir; mülakatta sorulacağını varsayın." },
        { t: "h2", x: "4. Uzunluk ve görünüm" },
        { t: "ul", items: [
          "Birkaç yıllık deneyim için tek sayfa genellikle yeterlidir; uzun kariyerlerde iki sayfa makuldür.",
          "En fazla iki yazı tipi ve tek bir vurgu rengi kullanın. Bol boşluk, yoğun metinden daha okunaklıdır.",
          "Tutarlı olun: tarih biçimi, madde işareti ve büyük-küçük harf kullanımı baştan sona aynı kalsın.",
        ] },
        { t: "h2", x: "5. Fotoğraf koymalı mısınız?" },
        { t: "p", x: "Türkiye'de CV'ye fotoğraf koymak yaygındır ve birçok işveren bekler. Başka ülkelere (ör. ABD, Birleşik Krallık) başvururken ise çoğu zaman fotoğraf konmaz; ilanda belirtilmemişse o ülkenin yaygın uygulamasına uyun. Fotoğraf koyacaksanız düz arka planlı, net ve profesyonel bir kare seçin." },
        { t: "cta", title: "CV Oluştur", x: "Şablonu seçin, bilgilerinizi sağa yazın; CV'niz solda canlı oluşsun. Boş bıraktığınız bölümler PDF'e eklenmez.", btn: "CV'ni oluştur", tool: "/tools/cv-olustur" },
        { t: "h2", x: "6. PDF olarak kaydedin ve dosyayı adlandırın" },
        { t: "steps", items: [
          { title: "PDF olarak indirin", x: "PDF her cihazda aynı görünür; Word dosyası ise yazı tipi ya da sayfa farkıyla bozulabilir." },
          { title: "Dosyayı anlamlı adlandırın", x: "ad-soyad-cv.pdf gibi. “CV_son_son2.pdf” işveren için belirsizdir." },
          { title: "Yazıların seçilebildiğini kontrol edin", x: "PDF'te metni fareyle seçebiliyorsanız başvuru sistemleri de okuyabilir." },
        ] },
        { t: "p", x: "Son olarak CV'nizi bir arkadaşınıza gösterin ve 30 saniyede neyi hatırladığını sorun. Hatırladığı şey, öne çıkarmak istediğiniz şey değilse sıralamayı değiştirin." },
      ],
      faq: [
        { q: "CV kaç sayfa olmalı?", a: "Birkaç yıllık deneyimde tek sayfa genellikle yeterli, uzun kariyerlerde iki sayfa makuldür. Önemli olan sayfa sayısı değil, en ilgili bilginin ilk yarım sayfada görünmesidir." },
        { q: "CV'de hangi bilgiler yer almamalı?", a: "Başvuruyla ilgisiz kişisel ayrıntılar (T.C. kimlik numarası, tam ev adresi, banka bilgisi vb.) yazılmamalıdır. Şehir ve iletişim bilgisi yeterlidir." },
        { q: "Referansları yazmalı mıyım?", a: "Zorunlu değildir. İlan istiyorsa ya da referansınız güçlüyse ekleyin; değilse bu bölümü boş bırakın. CV Oluştur'da boş bölümler PDF'e eklenmez." },
        { q: "CV'mi ücretsiz hazırlayabilir miyim?", a: "Evet. Ücretsiz üyelikle dört şablonu kullanıp PDF olarak indirebilirsiniz; bilgileriniz tarayıcınızda kalır." },
      ],
    },
    {
      title: "How to Write a CV: A Step-by-Step Guide",
      description:
        "The steps to a CV a recruiter can scan in seconds: section order, writing experience with numbers, length, photo and saving as PDF.",
      excerpt:
        "A good CV is not the one that says everything, but the one that shows the right things quickly. A step-by-step roadmap from section order to how to word each bullet.",
      blocks: [
        { t: "lead", x: "Recruiters tend to spend very little time on a first read of a CV, so the useful information has to be easy to find. A good CV doesn't list everything you've done; it puts the items most relevant to the role up front. These steps give you a simple route when starting from scratch." },
        { t: "h2", x: "1. Start with the target" },
        { t: "p", x: "Instead of sending the same CV to every posting, read the job ad and note the skills it asks for. Move the matching experience and skills up and shorten the rest. This doesn't mean rewriting the CV each time; adjusting order and emphasis is enough." },
        { t: "h2", x: "2. Put the sections in the right order" },
        { t: "ol", items: [
          "Header: name, target title, phone, email, city. Add a LinkedIn or portfolio link if you have one.",
          "Profile summary: two to four sentences — who you are, how many years in which field, and what you're looking for.",
          "Work experience: newest first. For each entry give title, company, dates and two to four bullets.",
          "Education: before experience if you are a recent graduate, after it if you are experienced.",
          "Skills, languages, certifications: choose those relevant to the ad; don't list hundreds of tool names.",
        ] },
        { t: "h2", x: "3. Write results, not duties" },
        { t: "p", x: "“Prepared sales reports” describes a duty; “Improved stock planning with weekly sales reports, cutting waste by 12%” describes a result. If you don't have a figure, give the scale: team size, number of customers, budget. Start each bullet with an action verb and keep it to one or at most two lines." },
        { t: "tip", x: "Don't invent numbers. When there's no exact figure, “about” or a range is honest and enough; assume you will be asked about it in the interview." },
        { t: "h2", x: "4. Length and look" },
        { t: "ul", items: [
          "One page is usually enough for a few years of experience; two is reasonable for a long career.",
          "Use at most two typefaces and a single accent colour. Generous white space reads better than dense text.",
          "Be consistent: date format, bullet style and capitalisation should be the same throughout.",
        ] },
        { t: "h2", x: "5. Should you include a photo?" },
        { t: "p", x: "In Turkey a CV photo is common and many employers expect it. When applying to other countries (for example the US or UK) a photo is usually left out; follow local practice unless the ad says otherwise. If you include one, choose a sharp, professional shot against a plain background." },
        { t: "cta", title: "CV Maker", x: "Pick a template, type your details on the right and watch the CV build live on the left. Sections you leave empty are not added to the PDF.", btn: "Build your CV", tool: "/tools/cv-olustur" },
        { t: "h2", x: "6. Save as PDF and name the file" },
        { t: "steps", items: [
          { title: "Download as a PDF", x: "A PDF looks the same on every device; a Word file can break with different fonts or page sizes." },
          { title: "Name the file clearly", x: "Something like first-last-cv.pdf. “CV_final_final2.pdf” tells the employer nothing." },
          { title: "Check the text is selectable", x: "If you can select text with the mouse in the PDF, hiring systems can read it too." },
        ] },
        { t: "p", x: "Finally, show your CV to a friend and ask what they remember after 30 seconds. If it isn't what you want to stand out, change the order." },
      ],
      faq: [
        { q: "How long should a CV be?", a: "One page is usually enough for a few years of experience; two is reasonable for a long career. What matters is that the most relevant information appears in the first half page." },
        { q: "What should not be on a CV?", a: "Personal details unrelated to the application (national ID number, full home address, bank details) should be left out. A city and contact details are enough." },
        { q: "Do I need to list references?", a: "Not necessarily. Add them if the ad asks or your references are strong; otherwise leave the section out. In CV Maker, empty sections are not added to the PDF." },
        { q: "Can I make my CV for free?", a: "Yes. With a free account you can use four templates and download a PDF; your details stay in your browser." },
      ],
    },
  ),

  // 2 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "ats-uyumlu-cv-nasil-yazilir",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 6,
      tags: { tr: ["ATS", "CV", "İşe Alım"], en: ["ATS", "CV", "Hiring"] },
      accent: "blue",
      tool: "/tools/cv-olustur",
    },
    {
      title: "ATS Uyumlu CV Nasıl Yazılır? 9 Pratik Kural",
      description:
        "Başvuru takip sistemlerinin (ATS) CV'nizi doğru okuması için 9 kural: gerçek metin PDF, standart başlıklar, sade yerleşim ve anahtar kelimeler.",
      excerpt:
        "Birçok şirket CV'leri önce bir başvuru takip sisteminden geçirir. Sistemin CV'nizi eksiksiz okuyabilmesi için dikkat edilecek dokuz pratik kural.",
      blocks: [
        { t: "lead", x: "Birçok şirket başvuruları bir başvuru takip sistemi (ATS) üzerinden toplar. Bu sistemler CV'nizi okuyup bilgileri alanlara ayırır; okuyamadıkları ya da yanlış yerleştirdikleri bilgi, işe alımcının ekranında eksik görünür. Güzel görünen ama makinenin okuyamadığı bir CV, görünmez bir CV olabilir. Aşağıdaki kurallar bunu önlemenin pratik yolları." },
        { t: "h2", x: "Dosya ve metin" },
        { t: "ol", items: [
          "Gerçek metin içeren PDF kullanın. Ekran görüntüsü ya da taranmış resim olarak kaydedilmiş bir CV'deki yazı sisteme okunmayabilir. PDF'te metni fareyle seçebiliyorsanız doğru yoldasınız.",
          "Bilgileri resmin içine gömmeyin. Telefon, e-posta ve beceriler gibi önemli bilgiler logo ya da görsel olarak değil, yazı olarak bulunmalı.",
          "Standart yazı tipleri seçin. Okunaklı, yaygın yazı tipleri hem insanlar hem sistemler için en güvenli seçenektir; Türkçe karakterlerin (ş, ğ, ı, İ) eksiksiz göründüğünden emin olun.",
        ] },
        { t: "h2", x: "Yapı ve başlıklar" },
        { t: "ol", start: 4, items: [
          "Bilinen başlıkları kullanın: “İş Deneyimi”, “Eğitim”, “Beceriler”. Yaratıcı başlıklar (“Yolculuğum”) sistemin bölümü tanımasını zorlaştırabilir.",
          "Sade bir yerleşim tercih edin. Bazı sistemler çok sütunlu, tablolu ya da kutulu tasarımları yanlış sırada okuyabilir. Emin değilseniz tek sütunlu bir şablon seçin.",
          "Tarihleri tutarlı yazın: “Mar 2020 – Devam ediyor” gibi. Her kalemde pozisyon, şirket ve tarih bulunsun.",
        ] },
        { t: "h2", x: "İçerik" },
        { t: "ol", start: 7, items: [
          "İlandaki anahtar kelimeleri doğal biçimde kullanın. İlan “proje yönetimi” diyorsa ve bu deneyiminiz varsa aynı ifadeyi kullanın; ancak sırf kelime eklemek için olmayan bir beceriyi yazmayın.",
          "Kısaltmaları bir kez açın: “Müşteri İlişkileri Yönetimi (CRM)”. Hem insanlar hem sistemler her iki biçimi de tanır.",
          "Üst bilgi/alt bilgi alanına kritik bilgi yazmayın. Bazı sistemler sayfa üst ve alt bölgesini okumaz; iletişim bilgilerinizi sayfanın ana gövdesine koyun.",
        ] },
        { t: "tip", x: "ATS kuralları sistemden sisteme değişir; hiçbiri her sistemde kusursuz sonuç garanti etmez. Amaç, bilgiyi hem insanın hem makinenin kolay okuyacağı biçimde sunmaktır." },
        { t: "cta", title: "CV Oluştur", x: "Şablonlarımızdaki yazılar resim değil, seçilebilir gerçek metin olarak PDF'e yazılır. En sade yerleşim için Sade şablonunu deneyin.", btn: "Şablonu seç", tool: "/tools/cv-olustur" },
        { t: "h2", x: "Göndermeden önce 1 dakikalık kontrol" },
        { t: "ul", items: [
          "PDF'i açın, tümünü seçip (Ctrl+A) bir metin düzenleyiciye yapıştırın: sıra ve içerik mantıklı mı?",
          "Telefon ve e-posta başlıkta, açık biçimde yazılı mı?",
          "Dosya adı ad-soyad-cv.pdf gibi anlaşılır mı?",
        ] },
      ],
      faq: [
        { q: "ATS nedir?", a: "Başvuru takip sistemi; şirketlerin başvuruları topladığı, CV'lerden bilgi çıkarıp aday listesi oluşturduğu yazılımdır." },
        { q: "Fotoğraf ATS'yi bozar mı?", a: "Görsel genellikle sistem tarafından yok sayılır, ancak bazı sistemler resimli CV'lerde sorun çıkarabilir. Tek sütunlu sade bir şablon ve metin olarak yazılmış bilgiler en güvenli yoldur." },
        { q: "CV'mi Word olarak mı PDF olarak mı göndermeliyim?", a: "İlan başka bir biçim istemiyorsa gerçek metinli PDF güvenli bir seçimdir; her cihazda aynı görünür." },
        { q: "Bu araçtaki CV'ler ATS'ye uygun mu?", a: "PDF'teki yazılar seçilebilir gerçek metindir ve tek akışta okunur. Yine de hiçbir araç belirli bir sistemde sonuç garantisi veremez." },
      ],
    },
    {
      title: "ATS-Friendly CV: 9 Practical Rules",
      description:
        "Nine rules so applicant tracking systems (ATS) read your CV correctly: real-text PDF, standard headings, a simple layout and the right keywords.",
      excerpt:
        "Many companies run CVs through an applicant tracking system first. Nine practical rules to make sure it reads yours completely.",
      blocks: [
        { t: "lead", x: "Many companies collect applications through an applicant tracking system (ATS). These systems read your CV and split the information into fields; anything they can't read, or place wrongly, looks incomplete on the recruiter's screen. A CV that looks beautiful but can't be read by a machine can be an invisible CV. These rules are practical ways to avoid that." },
        { t: "h2", x: "File and text" },
        { t: "ol", items: [
          "Use a PDF that contains real text. Text in a CV saved as a screenshot or scanned image may not be read. If you can select text in the PDF with your mouse, you're on the right track.",
          "Don't bury information in images. Phone, email and skills should be text, not part of a logo or graphic.",
          "Choose standard fonts. Common, readable fonts are safest for people and systems alike; make sure Turkish characters (ş, ğ, ı, İ) display fully.",
        ] },
        { t: "h2", x: "Structure and headings" },
        { t: "ol", start: 4, items: [
          "Use familiar headings: “Work Experience”, “Education”, “Skills”. Creative headings (“My Journey”) can stop a system recognising the section.",
          "Prefer a simple layout. Some systems read multi-column, table or boxed designs in the wrong order. If unsure, choose a single-column template.",
          "Write dates consistently, such as “Mar 2020 – Present”. Give every entry a title, company and date.",
        ] },
        { t: "h2", x: "Content" },
        { t: "ol", start: 7, items: [
          "Use the ad's keywords naturally. If the ad says “project management” and you have that experience, use the same phrase — but never list a skill you don't have just to add a word.",
          "Spell out abbreviations once: “Customer Relationship Management (CRM)”. People and systems recognise both forms.",
          "Don't put key details in the page header or footer. Some systems skip those areas; place your contact details in the main body.",
        ] },
        { t: "tip", x: "ATS behaviour varies from system to system and none guarantees a perfect read everywhere. The aim is to present information so that both people and machines read it easily." },
        { t: "cta", title: "CV Maker", x: "The text in our templates is written to the PDF as selectable real text, not an image. For the simplest layout try the Plain template.", btn: "Pick a template", tool: "/tools/cv-olustur" },
        { t: "h2", x: "A one-minute check before you send" },
        { t: "ul", items: [
          "Open the PDF, select all (Ctrl+A) and paste into a text editor: do the order and content make sense?",
          "Are your phone and email written plainly in the header?",
          "Is the file name clear, like first-last-cv.pdf?",
        ] },
      ],
      faq: [
        { q: "What is an ATS?", a: "An applicant tracking system: software companies use to collect applications and extract information from CVs into a candidate list." },
        { q: "Does a photo break the ATS?", a: "The image is usually ignored, but some systems struggle with CVs that include pictures. A simple single-column template with information written as text is the safest route." },
        { q: "Should I send Word or PDF?", a: "Unless the ad asks for another format, a PDF with real text is a safe choice; it looks the same on every device." },
        { q: "Are the CVs from this tool ATS-ready?", a: "The text in the PDF is selectable real text and reads in a single flow. Still, no tool can guarantee a result in a specific system." },
      ],
    },
  ),

  // 3 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "cv-fotografi-nasil-olmali",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 6,
      tags: { tr: ["CV Fotoğrafı", "Profesyonel Fotoğraf", "İş Başvurusu"], en: ["CV Photo", "Professional Photo", "Job Application"] },
      accent: "fuchsia",
      tool: "/tools/ai-fotograf-studyosu",
    },
    {
      title: "CV Fotoğrafı Nasıl Olmalı? Ölçü, Arka Plan, Kadraj",
      description:
        "CV'ye konacak fotoğrafta kadraj, arka plan, kıyafet ve ölçü nasıl olmalı? Hataları ve telefonla çekilen fotoğrafı CV'ye hazırlamanın yolunu anlattık.",
      excerpt:
        "İlk izlenim çoğu zaman fotoğrafla başlar. CV fotoğrafında kadraj, arka plan, ışık ve ölçü için pratik ölçütler ve sık yapılan hatalar.",
      blocks: [
        { t: "lead", x: "CV'deki fotoğraf, işe alımcının sizinle ilk karşılaşmasıdır. İyi seçilmiş bir fotoğraf güven verir; özensiz bir fotoğraf ise diğer her şeyin önüne geçebilir. Profesyonel stüdyo şart değil: doğru ışık, düz bir arka plan ve uygun kadrajla telefonla çekilen bir fotoğraf da iş görür." },
        { t: "h2", x: "İyi bir CV fotoğrafının ölçütleri" },
        { t: "ul", items: [
          "Kadraj: Baş ve omuzlar (göğüs hizasına kadar). Yüz, kadrajın yaklaşık yarısını kaplasın; baş çok küçük ya da çerçeveye yapışık olmasın.",
          "Bakış: Kameraya, göz hizasında. Hafif, doğal bir gülümseme genellikle güven verir.",
          "Arka plan: Düz ve sade; açık gri, açık mavi ya da beyaz. Dağınık bir oda ya da tatil manzarası dikkat dağıtır.",
          "Işık: Yüzünüzü yumuşak aydınlatan pencere ışığı idealdir. Arkadan gelen ışık yüzü karartır; doğrudan flaş parlama yapar.",
          "Kıyafet: Başvurduğunuz sektöre uygun, sade ve düz renk. Çok desenli kıyafetler dikkat dağıtır.",
          "Güncellik: Bugünkü görünüşünüze benzeyen, yakın zamanda çekilmiş bir fotoğraf.",
        ] },
        { t: "h2", x: "Sık yapılan hatalar" },
        { t: "ul", items: [
          "Kırpılmış grup ya da tatil fotoğrafı kullanmak (omuzdaki başka bir kol görünür).",
          "Filtre ve aşırı rötuş; kişi tanınmaz hâle gelir.",
          "Çok düşük çözünürlük: CV'de bulanık görünür.",
          "Yan dönük ya da eğik duruş.",
          "Arka planın gün ışığıyla karışık, renkli ve karmaşık olması.",
        ] },
        { t: "h2", x: "Ölçü ve dosya" },
        { t: "p", x: "Çoğu CV şablonu dikey 3:4 portre ya da kare bir alan kullanır. Fotoğrafı şablonun alanına yakın oranda hazırlarsanız CV'de kırpma sorunu yaşamazsınız. Dosya boyutu CV'yi şişirmesin diye 300 KB civarı yeterlidir; CV'nize eklendiğinde PDF'e gömülen görsel zaten küçültülür." },
        { t: "steps", items: [
          { title: "Fotoğrafı çekin", x: "Pencereye dönük, düz bir duvarın önünde, telefonu göz hizasında sabitleyin." },
          { title: "AI Fotoğraf Stüdyosu'nda “CV portre” ölçüsünü seçin", x: "Yapay zekâ yüzü bulup ortalar, başı doğru oranda kadraja yerleştirir; arka planı açık gri ya da açık mavi yapabilirsiniz." },
          { title: "Uygunluk listesine bakın ve indirin", x: "Işık, baş oranı ve duruş için uyarıları kontrol edin; JPG olarak indirin." },
        ] },
        { t: "cta", title: "AI Fotoğraf Stüdyosu", x: "CV portre, CV kare ve LinkedIn ölçülerine tek tıkla kırpar, arka planı değiştirir. Fotoğrafınız cihazınızdan çıkmaz.", btn: "Fotoğrafımı hazırla", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "Fotoğrafı CV'ye eklemek için CV Oluştur aracında “Fotoğraf” bölümünden yükleyip sürükleyerek konumlandırabilirsiniz." },
      ],
      faq: [
        { q: "CV'ye fotoğraf koymak zorunlu mu?", a: "Hayır. Türkiye'de yaygındır ve birçok işveren bekler; ancak ilan özellikle istemiyorsa zorunlu değildir. Başka ülkelere başvururken çoğu zaman fotoğraf konmaz." },
        { q: "CV fotoğrafında gülümsemeli miyim?", a: "Hafif, doğal bir gülümseme genellikle olumlu algılanır. Resmî belge (kimlik, pasaport) fotoğrafında ise nötr ifade istenir; ikisini karıştırmayın." },
        { q: "Telefonla çektiğim fotoğraf olur mu?", a: "Evet; ışık ve arka plan doğruysa olur. Arka kamerayı kullanın, ön kamera yüzü bozabilir." },
        { q: "Fotoğrafım sunucuya yükleniyor mu?", a: "AI Fotoğraf Stüdyosu fotoğrafı cihazınızda işler; sunucuya yüklenmez ve saklanmaz." },
      ],
    },
    {
      title: "What Makes a Good CV Photo? Size, Background, Framing",
      description:
        "Framing, background, clothing and size for a photo on your CV, the common mistakes, and how to prepare a phone photo for your resume.",
      excerpt:
        "The first impression often starts with the photo. Practical standards for framing, background, light and size, and the mistakes people make most.",
      blocks: [
        { t: "lead", x: "The photo on a CV is a recruiter's first meeting with you. A well-chosen one builds trust; a careless one can overshadow everything else. You don't need a studio: the right light, a plain background and good framing make a phone photo work." },
        { t: "h2", x: "What a good CV photo looks like" },
        { t: "ul", items: [
          "Framing: head and shoulders (down to chest level). The face should fill about half the frame — not tiny, and not touching the edges.",
          "Gaze: toward the camera at eye level. A slight, natural smile usually builds trust.",
          "Background: plain and simple — light grey, light blue or white. A cluttered room or holiday scenery distracts.",
          "Light: soft window light on your face is ideal. Backlight darkens the face; direct flash causes glare.",
          "Clothing: suited to the industry, simple and solid. Busy patterns distract.",
          "Recency: recent, and looking like you do today.",
        ] },
        { t: "h2", x: "Common mistakes" },
        { t: "ul", items: [
          "Using a cropped group or holiday photo (someone's arm on your shoulder still shows).",
          "Filters and heavy retouching that make you unrecognisable.",
          "Very low resolution that looks blurry on the CV.",
          "A side-on or tilted pose.",
          "A coloured, busy background mixed with daylight.",
        ] },
        { t: "h2", x: "Size and file" },
        { t: "p", x: "Most CV templates use a 3:4 portrait or a square slot. Prepare the photo in a ratio close to the slot to avoid awkward cropping. Around 300 KB is plenty; the image is reduced when embedded in the PDF anyway." },
        { t: "steps", items: [
          { title: "Take the photo", x: "Face a window, stand in front of a plain wall and hold the phone steady at eye level." },
          { title: "Choose the “CV portrait” size in AI Photo Studio", x: "AI finds your face, centres it and sets the head at the right proportion; you can make the background light grey or light blue." },
          { title: "Read the suitability list and download", x: "Check the warnings for light, head size and pose; download as JPG." },
        ] },
        { t: "cta", title: "AI Photo Studio", x: "Crops to CV portrait, CV square and LinkedIn sizes in one click and swaps the background. Your photo never leaves your device.", btn: "Prepare my photo", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "To place the photo on your CV, upload it in the Photo section of CV Maker and drag to position it." },
      ],
      faq: [
        { q: "Is a CV photo mandatory?", a: "No. In Turkey it is common and many employers expect it, but it isn't required unless the ad asks. When applying abroad a photo is often left out." },
        { q: "Should I smile in a CV photo?", a: "A slight, natural smile is usually well received. Official ID photos (ID card, passport) need a neutral expression; don't mix the two." },
        { q: "Can I use a phone photo?", a: "Yes, if the light and background are right. Use the rear camera; the front camera can distort the face." },
        { q: "Is my photo uploaded to a server?", a: "AI Photo Studio processes your photo on your device; it is not uploaded or stored." },
      ],
    },
  ),

  // 4 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "biyometrik-fotograf-olculeri-ve-kurallari",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 6,
      tags: { tr: ["Biyometrik Fotoğraf", "Pasaport", "Vize"], en: ["Biometric Photo", "Passport", "Visa"] },
      accent: "violet",
      tool: "/tools/ai-fotograf-studyosu",
    },
    {
      title: "Biyometrik Fotoğraf Ölçüleri ve Kuralları (2026)",
      description:
        "Kimlik, pasaport, ehliyet ve vize için biyometrik fotoğraf ölçüleri: Türkiye 50×60, Schengen 35×45, ABD 2×2 inç ve baş oranı kuralları.",
      excerpt:
        "Kimlik, pasaport ve vize fotoğrafı reddedilmesin: ülkelere göre ölçüler, baş oranları, arka plan ve sık yapılan hatalar tek yazıda.",
      blocks: [
        { t: "lead", x: "Biyometrik fotoğraf, yüz tanıma sistemlerinin de kullanabileceği biçimde, belirli ölçü ve kurallara göre çekilmiş resmî belge fotoğrafıdır. Ölçü, arka plan veya baş oranındaki küçük bir sapma başvurunun reddedilmesine yol açabilir. Aşağıdaki tablo yaygın ölçüleri özetler." },
        { t: "h2", x: "Yaygın ölçüler" },
        { t: "ul", items: [
          "Türkiye (kimlik kartı, pasaport, ehliyet): 50×60 mm, düz beyaz arka plan; yüz fotoğrafın yaklaşık %70–80'ini kaplar.",
          "Schengen ve AB ülkeleri: 35×45 mm; baş yüksekliği yaklaşık 32–36 mm; açık, düz arka plan.",
          "Birleşik Krallık: 35×45 mm; baş yüksekliği yaklaşık 29–34 mm.",
          "ABD: 2×2 inç (51×51 mm); baş yüksekliği yaklaşık 25–35 mm; beyaz arka plan.",
          "Kanada: 50×70 mm; baş yüksekliği yaklaşık 31–36 mm.",
          "Çin (vize): 33×48 mm; beyaz arka plan.",
        ] },
        { t: "tip", x: "Kurallar ülkeden ülkeye ve zamanla değişir. Yukarıdakiler genel bilgi içindir; başvuru yapacağınız kurumun ya da konsolosluğun güncel şartını mutlaka kontrol edin." },
        { t: "h2", x: "Hemen her yerde geçerli temel kurallar" },
        { t: "ul", items: [
          "Karşıdan, kameraya düz bakış; baş eğik ya da yana dönük olmasın.",
          "Nötr ifade, ağız kapalı, gözler açık.",
          "Gölgesiz, düz ve açık renkli arka plan; gözde ve yüzde parlama olmasın.",
          "Yüzü kapatan şapka, saç ya da aksesuar olmasın; gözlük kuralı ülkeye göre değişir ve çoğu başvuruda gözlüksüz istenir.",
          "Dijital filtre ve yüz hatlarını değiştiren rötuş kabul edilmez.",
          "Fotoğraf yakın zamanda çekilmiş olmalı (genellikle son 6 ay).",
        ] },
        { t: "h2", x: "Fotoğrafı hazırlama adımları" },
        { t: "steps", items: [
          { title: "Düz bir duvar önünde çekin", x: "Pencere ışığında, kameraya karşıdan ve göz hizasında; telefonu bir yere sabitleyin." },
          { title: "Ölçüyü seçin", x: "AI Fotoğraf Stüdyosu'nda “Türkiye biyometrik (50×60)”, “Schengen” ya da “ABD” gibi ön ayarı seçin; baş oranı otomatik ayarlanır." },
          { title: "Arka planı beyaz yapın", x: "Yapay zekâ arka planı saç tellerine kadar ayırır; beyaz ya da açık gri uygulayın." },
          { title: "Uygunluk listesini okuyun", x: "Baş oranı, ifade ve ışık için uyarılar gösterilir; gerekirse yeniden çekin." },
          { title: "Boyut sınırı varsa yazın", x: "e-Devlet gibi portallar KB sınırı koyabilir; en fazla boyutu girin, araç dosyayı sığdırır." },
        ] },
        { t: "cta", title: "AI Fotoğraf Stüdyosu", x: "Biyometrik ölçülere kırpar, arka planı değiştirir ve baskı sayfası hazırlar. Fotoğraf cihazınızdan çıkmaz.", btn: "Fotoğrafı hazırla", tool: "/tools/ai-fotograf-studyosu" },
        { t: "p", x: "Baskı için 10×15 cm fotoğraf kâğıdına aynı fotoğraftan birçok kopya diziliş seçeneği vardır; yazdırırken “%100 / gerçek boyut” seçip sayfayı küçültmediğinizden emin olun." },
      ],
      faq: [
        { q: "Biyometrik fotoğrafı evde çekebilir miyim?", a: "Bazı başvurularda kabul edilir, bazılarında kimlik/pasaport işlemleri için fotoğrafçı çekimi istenir. Başvuracağınız kurumun yöntemini önceden öğrenin." },
        { q: "Gözlükle çekilebilir mi?", a: "Birçok resmî başvuruda gözlüksüz istenir. Kuralı kurumun güncel şartından kontrol edin." },
        { q: "Arka plan tam beyaz olmak zorunda mı?", a: "Türkiye'de düz beyaz istenir; bazı ülkelerde açık gri ya da açık renk kabul edilir. Seçtiğiniz ön ayar önerilen rengi uygular." },
        { q: "Fotoğrafım nereye yüklenir?", a: "Hiçbir yere: işlem cihazınızda yapılır, sunucuya yüklenmez." },
      ],
    },
    {
      title: "Biometric Photo Sizes and Rules by Country (2026)",
      description:
        "Biometric photo sizes for ID, passport, driving licence and visa: Turkey 50×60, Schengen 35×45, US 2×2 in, plus head-size and background rules.",
      excerpt:
        "Don't get your ID, passport or visa photo rejected: sizes, head proportions, backgrounds and the usual mistakes by country in one post.",
      blocks: [
        { t: "lead", x: "A biometric photo is an official document photo taken to specific size and rules so that face-recognition systems can use it too. A small deviation in size, background or head proportion can get an application rejected. The list below summarises common sizes." },
        { t: "h2", x: "Common sizes" },
        { t: "ul", items: [
          "Turkey (ID card, passport, driving licence): 50×60 mm, plain white background; the face covers roughly 70–80% of the photo.",
          "Schengen and EU countries: 35×45 mm; head height about 32–36 mm; light, plain background.",
          "United Kingdom: 35×45 mm; head height about 29–34 mm.",
          "United States: 2×2 in (51×51 mm); head height about 25–35 mm; white background.",
          "Canada: 50×70 mm; head height about 31–36 mm.",
          "China (visa): 33×48 mm; white background.",
        ] },
        { t: "tip", x: "Rules differ by country and change over time. The above is general information; always check the current requirements of the authority or consulate you apply to." },
        { t: "h2", x: "Basic rules that apply almost everywhere" },
        { t: "ul", items: [
          "Facing the camera straight on; head not tilted or turned.",
          "Neutral expression, mouth closed, eyes open.",
          "Shadow-free, plain, light background; no glare on face or eyes.",
          "No hat, hair or accessories covering the face; the glasses rule varies by country and most applications want none.",
          "No digital filters or retouching that alters facial features.",
          "Recent photo (usually within the last 6 months).",
        ] },
        { t: "h2", x: "How to prepare the photo" },
        { t: "steps", items: [
          { title: "Shoot in front of a plain wall", x: "In window light, facing the camera at eye level, with the phone fixed in place." },
          { title: "Choose the size", x: "In AI Photo Studio pick a preset such as “Turkey biometric (50×60)”, “Schengen” or “US”; the head proportion is set automatically." },
          { title: "Make the background white", x: "AI separates the background down to strands of hair; apply white or light grey." },
          { title: "Read the suitability list", x: "Warnings for head size, expression and light are shown; retake if needed." },
          { title: "Set a size limit if required", x: "Portals may cap file size in KB; enter the maximum and the tool fits the file." },
        ] },
        { t: "cta", title: "AI Photo Studio", x: "Crops to biometric sizes, swaps the background and prepares a print sheet. The photo never leaves your device.", btn: "Prepare the photo", tool: "/tools/ai-fotograf-studyosu" },
        { t: "p", x: "For printing, you can lay out many copies on 10×15 cm photo paper; choose “100% / actual size” when printing so the sheet isn't scaled down." },
      ],
      faq: [
        { q: "Can I take a biometric photo at home?", a: "Some applications accept it; for others a photographer's shot is required. Find out the authority's method in advance." },
        { q: "Can I wear glasses?", a: "Many official applications require no glasses. Check the current rule of the authority." },
        { q: "Must the background be pure white?", a: "Turkey asks for plain white; some countries accept light grey or other light colours. Your preset applies the suggested colour." },
        { q: "Where is my photo uploaded?", a: "Nowhere: processing happens on your device and nothing is uploaded." },
      ],
    },
  ),

  // 5 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "vesikalik-fotograf-evde-nasil-cekilir",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 5,
      tags: { tr: ["Vesikalık", "Fotoğraf", "Telefon"], en: ["ID Photo", "Photography", "Phone"] },
      accent: "emerald",
      tool: "/tools/ai-fotograf-studyosu",
    },
    {
      title: "Evde Vesikalık Fotoğraf Nasıl Çekilir? 8 İpucu",
      description:
        "Telefonla evde vesikalık çekmek için 8 ipucu: ışık, duvar, mesafe, poz ve hatalar. Sonra arka planı beyaz yapıp doğru ölçüye getirin.",
      excerpt:
        "Fotoğrafçıya gitmeden telefonla vesikalık çekmek mümkün. Işığı, mesafeyi ve duruşu doğru ayarlamak sonucun çoğunu belirler.",
      blocks: [
        { t: "lead", x: "Bir başvuru için aceleyle vesikalık gerektiğinde fotoğrafçıya gitmek zaman alabilir. Telefonla evde çekilen bir fotoğraf, ışığı ve duruşu doğru ayarlandığında iyi bir başlangıçtır; arka planı ve ölçüyü sonradan düzeltmek kolaydır. Kimlik ve pasaport gibi resmî belgelerde fotoğrafın nasıl çekilmesi gerektiğini ilgili kurumun güncel şartından kontrol edin." },
        { t: "h2", x: "Çekim öncesi 8 ipucu" },
        { t: "ol", items: [
          "Pencere ışığını kullanın: Pencereye dönük durun. Işık yüzünüze yumuşak düşsün; güneşin sert vurduğu saatlerde perde ya da tül ile yumuşatın.",
          "Düz bir duvar seçin: Açık renkli, desensiz bir duvar önünde durun. Arka plan sonradan değiştirilebilir ama düz bir zemin sonucu iyileştirir.",
          "Telefonu sabitleyin: Göz hizasında, bir yere dayayın ya da birinden isteyin. Aşağıdan ya da yukarıdan çekim yüzü bozar.",
          "Mesafeyi koruyun: Telefon yaklaşık 1,5–2 metre uzakta olsun; çok yakın çekim burun ve alnı büyütür. Sonra yakınlaştırarak kırpmak daha doğal sonuç verir.",
          "Arka kamerayı kullanın: Ön kamera daha düşük kalitelidir ve yüzü bozabilir; zamanlayıcıyla çekin.",
          "Doğrudan kameraya bakın: Baş düz, omuzlar karşıdan; ifade nötr, gözler açık.",
          "Saçı ve yüzü açık tutun: Alın ve kulak çizgisini kapatan saç, gözlük yansıması ve parlayan alın sorun çıkarır.",
          "Birkaç kare çekin: Gözün kırpılmadığı, ifadenin doğal olduğu en iyi kareyi seçin.",
        ] },
        { t: "h2", x: "Çekimden sonra" },
        { t: "p", x: "Çektiğiniz fotoğrafı AI Fotoğraf Stüdyosu'na yükleyin; yapay zekâ yüzü bulup başı doğru orana yerleştirir, eğik duruşu düzeltir, arka planı beyaz yapar ve istenen ölçüye kırpar. Dosya boyutu sınırı varsa KB olarak girin. Fotoğraf cihazınızdan çıkmaz." },
        { t: "cta", title: "AI Fotoğraf Stüdyosu", x: "Vesikalık, biyometrik ve vize ölçüleri hazır; arka planı beyaz yapar, baskı sayfası verir.", btn: "Fotoğrafı hazırla", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "Bu araç resmî uygunluğu garanti etmez; uygunluk denetimi yardımcı bir kılavuzdur. Önemli başvurularda kurumun şartını ayrıca kontrol edin." },
      ],
      faq: [
        { q: "Telefon fotoğrafı resmî başvuruda geçerli mi?", a: "Bu kuruma göre değişir. Bazı başvurular dijital fotoğrafı kabul eder, bazıları (ör. pasaport) kurum yöntemini şart koşar. Önceden öğrenin." },
        { q: "Arka planı sonradan beyaz yapmak sorun olur mu?", a: "Çoğu dijital başvuruda düz arka plan yeterlidir; ancak doğal olmayan kenarlar kabul edilmeyebilir. Mümkünse çekim sırasında da açık, düz bir duvar kullanın." },
        { q: "Aynı fotoğraftan baskı alabilir miyim?", a: "Evet; 10×15 cm baskı sayfasında aynı fotoğraftan birçok kopya gerçek boyutta dizilir." },
      ],
    },
    {
      title: "How to Take an ID Photo at Home: 8 Tips",
      description:
        "Eight tips for taking an ID photo with your phone at home: light, wall, distance, pose and mistakes — then fix the background and size.",
      excerpt:
        "You can shoot an ID photo with your phone without visiting a studio. Getting light, distance and pose right decides most of the result.",
      blocks: [
        { t: "lead", x: "When an application needs a photo in a hurry, visiting a studio can take time. A phone shot at home is a good start when the light and pose are right, and the background and size are easy to fix afterwards. For official documents such as ID and passports, check the current photo requirements of the authority." },
        { t: "h2", x: "Eight tips before you shoot" },
        { t: "ol", items: [
          "Use window light: face the window so soft light falls on you; use a curtain to soften harsh sun.",
          "Pick a plain wall: stand before a light, patternless wall. The background can be changed later, but a plain one improves the result.",
          "Fix the phone: at eye level, propped up or held by someone. Shooting from above or below distorts the face.",
          "Keep your distance: about 1.5–2 metres away; very close shots enlarge the nose and forehead. Cropping in afterwards looks more natural.",
          "Use the rear camera: the front camera is lower quality and can distort; use a timer.",
          "Look straight into the lens: head level, shoulders square, neutral expression, eyes open.",
          "Keep hair and face clear: hair over the forehead or ears, glasses glare and a shiny forehead cause trouble.",
          "Take several: pick the best frame, with no blink and a natural expression.",
        ] },
        { t: "h2", x: "After the shoot" },
        { t: "p", x: "Upload the photo to AI Photo Studio: AI finds the face and sets the head to the right proportion, levels a tilt, makes the background white and crops to the size you need. If there is a file size limit, enter it in KB. The photo never leaves your device." },
        { t: "cta", title: "AI Photo Studio", x: "ID, biometric and visa sizes ready; makes the background white and gives you a print sheet.", btn: "Prepare the photo", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "The tool cannot guarantee official acceptance; the suitability check is a guide. For important applications confirm the authority's rules separately." },
      ],
      faq: [
        { q: "Is a phone photo valid for official applications?", a: "It depends on the authority. Some accept digital photos, others (such as passports) specify their own method. Find out beforehand." },
        { q: "Is a background swapped afterwards a problem?", a: "Most digital applications accept a plain background, but unnatural edges may be refused. If possible use a light, plain wall when shooting too." },
        { q: "Can I print copies of the same photo?", a: "Yes; a 10×15 cm print sheet lays out many copies at true size." },
      ],
    },
  ),

  // 6 ─────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "linkedin-profil-fotografi-ipuclari",
      date: "2026-10-07",
      updated: "2026-10-07",
      readMinutes: 5,
      tags: { tr: ["LinkedIn", "Profil Fotoğrafı", "Kariyer"], en: ["LinkedIn", "Profile Photo", "Career"] },
      accent: "cyan",
      tool: "/tools/ai-fotograf-studyosu",
    },
    {
      title: "LinkedIn Profil Fotoğrafı: Ölçü ve 7 İpucu",
      description:
        "LinkedIn profil fotoğrafı için ideal ölçü, kadraj, arka plan ve ışık: profilinizi daha güvenilir gösteren 7 ipucu ve hazırlama adımları.",
      excerpt:
        "Profil fotoğrafı, LinkedIn'de görülen ilk şeydir. Ölçü, kadraj ve arka plan için pratik ipuçları.",
      blocks: [
        { t: "lead", x: "LinkedIn'de ilk görülen şeylerden biri profil fotoğrafınızdır. İyi bir fotoğraf profilinizi daha güvenilir ve ulaşılabilir gösterir. Büyük bir bütçe gerekmez; kadraj, ışık ve arka plana dikkat etmek yeterlidir." },
        { t: "h2", x: "Ölçü" },
        { t: "p", x: "LinkedIn kare bir alan kullanır ve fotoğrafı yuvarlak gösterir. LinkedIn'in yardım sayfasına göre fotoğraf en az 400×400 piksel olmalı ve dosya boyutu 8 MB'ı aşmamalıdır; 800×800 piksel kare bir fotoğraf rahatça yeterlidir. Yuvarlak kırpılacağı için yüzünüzü kadrajın ortasında tutun, köşelere önemli bir şey koymayın." },
        { t: "h2", x: "7 ipucu" },
        { t: "ol", items: [
          "Yüz kadrajın yaklaşık %60'ını kaplasın; çok uzak ya da çok yakın olmasın.",
          "Net bir yüz: Bulanık ya da pikselli fotoğraf güveni azaltır.",
          "Doğal bir gülümseme: Ulaşılabilir görünürsünüz.",
          "Sade arka plan: Açık gri ya da açık mavi, dikkati yüzünüze toplar.",
          "Profesyonel ama size ait kıyafet: Sektörünüzün normuna uygun, sade.",
          "Tek kişi: Grup fotoğrafı kırpmayın.",
          "Güncel: Bugünkü görünüşünüze benzesin; yıllar önceki fotoğraf mülakatta şaşırtır.",
        ] },
        { t: "h2", x: "Hazırlama adımları" },
        { t: "steps", items: [
          { title: "Pencere ışığında, düz bir duvar önünde çekin", x: "Telefonu göz hizasında sabitleyin; arka kamerayı kullanın." },
          { title: "AI Fotoğraf Stüdyosu'nda “LinkedIn profil (800×800)” seçin", x: "Yüz bulunur, ortalanır ve doğru orana kırpılır." },
          { title: "Arka planı seçin", x: "Açık mavi ya da açık gri kurumsal bir görünüm verir; isterseniz bulanık arka plan da uygulayabilirsiniz." },
          { title: "İndirip LinkedIn'e yükleyin", x: "JPG olarak indirin; boyut sınırı genellikle sorun olmaz." },
        ] },
        { t: "cta", title: "AI Fotoğraf Stüdyosu", x: "LinkedIn, CV ve profil fotoğrafı ölçüleri hazır; arka planı değiştirir, ışığı iyileştirir. Fotoğraf cihazınızdan çıkmaz.", btn: "Fotoğrafımı hazırla", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "LinkedIn'in kuralları ve ölçü önerileri değişebilir; yüklemeden önce güncel yardım sayfasına göz atın." },
      ],
      faq: [
        { q: "LinkedIn fotoğrafı resmî fotoğraf gibi mi olmalı?", a: "Hayır; resmî belge fotoğrafındaki katı kurallar gerekmez. Yine de net, düz arka planlı ve profesyonel olmalıdır; hafif gülümseme tercih edilir." },
        { q: "Yuvarlak kırpma nasıl çalışır?", a: "LinkedIn kare fotoğrafı yuvarlak gösterir; yüzünüzü ortada tutarsanız kırpma sorun çıkarmaz." },
        { q: "Fotoğrafım sunucuya yükleniyor mu?", a: "AI Fotoğraf Stüdyosu fotoğrafı cihazınızda işler; sunucumuza yüklenmez ve saklanmaz. LinkedIn'e yüklemeyi siz yaparsınız." },
      ],
    },
    {
      title: "LinkedIn Profile Photo: Size and 7 Tips",
      description:
        "The ideal size, framing, background and light for a LinkedIn profile photo: seven tips that make your profile look more trustworthy, and how to prepare it.",
      excerpt:
        "Your profile photo is one of the first things people see on LinkedIn. Practical tips for size, framing and background.",
      blocks: [
        { t: "lead", x: "Your profile photo is among the first things people see on LinkedIn. A good one makes your profile look more trustworthy and approachable. It doesn't need a big budget; attention to framing, light and background is enough." },
        { t: "h2", x: "Size" },
        { t: "p", x: "LinkedIn uses a square slot and displays the photo as a circle. According to LinkedIn's help pages the photo should be at least 400×400 pixels and under 8 MB; an 800×800 pixel square is comfortably enough. Because it's cropped round, keep your face in the centre and nothing important in the corners." },
        { t: "h2", x: "Seven tips" },
        { t: "ol", items: [
          "Let the face fill about 60% of the frame — not too far, not too close.",
          "Keep it sharp: blurry or pixelated photos reduce trust.",
          "A natural smile makes you look approachable.",
          "Plain background: light grey or light blue keeps attention on your face.",
          "Professional but personal clothing: appropriate for your industry and simple.",
          "Only you: don't crop a group photo.",
          "Current: look like you do today; an old photo surprises people at interviews.",
        ] },
        { t: "h2", x: "Preparing it" },
        { t: "steps", items: [
          { title: "Shoot in window light in front of a plain wall", x: "Fix the phone at eye level and use the rear camera." },
          { title: "Choose “LinkedIn profile (800×800)” in AI Photo Studio", x: "The face is found, centred and cropped to the right proportion." },
          { title: "Pick a background", x: "Light blue or light grey gives a corporate look; you can also apply a blurred background." },
          { title: "Download and upload to LinkedIn", x: "Save as JPG; the size limit is rarely an issue." },
        ] },
        { t: "cta", title: "AI Photo Studio", x: "LinkedIn, CV and profile photo sizes ready; swaps the background and improves light. Your photo never leaves your device.", btn: "Prepare my photo", tool: "/tools/ai-fotograf-studyosu" },
        { t: "tip", x: "LinkedIn's rules and size recommendations can change; check the current help page before uploading." },
      ],
      faq: [
        { q: "Must a LinkedIn photo look like an official ID photo?", a: "No; the strict rules of official photos don't apply. It should still be sharp, plainly backed and professional; a slight smile is preferred." },
        { q: "How does the round crop work?", a: "LinkedIn shows the square photo as a circle; keep your face centred and the crop won't cause problems." },
        { q: "Is my photo uploaded to your server?", a: "AI Photo Studio processes your photo on your device; it is not uploaded or stored. You upload to LinkedIn yourself." },
      ],
    },
  ),
];
