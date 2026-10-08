// ─────────────────────────────────────────────────────────────────────────────
// CV ARACI YENİ ÖZELLİK REHBERLERİ — ilana göre uyarlama, Europass tarzı düzen, ön yazı.
// blogContent.mjs bu diziyi CV_PHOTO_POSTS'tan sonra ekler. İçerik ürünün gerçek
// özelliklerine sadıktır; istatistik/vaat uydurulmaz. Yapay zekâ özellikleri Pro'ya özeldir.
// ─────────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

export const CV_TOOL_POSTS = [
  // 1 ──────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "cv-is-ilanina-gore-nasil-uyarlanir",
      date: "2026-10-08",
      updated: "2026-10-08",
      readMinutes: 7,
      tags: { tr: ["CV", "İş İlanı", "ATS"], en: ["CV", "Job Ad", "ATS"] },
      accent: "sky",
      tool: "/tools/cv-olustur",
    },
    {
      title: "CV İş İlanına Göre Nasıl Uyarlanır? Anahtar Kelime Rehberi",
      description:
        "Aynı CV'yi her ilana göndermek yerine ilana göre uyarlamanın yolu: ilandaki kelimeleri bulma, CV'ye dürüstçe yedirme, eksikleri görme ve kopya CV tutma.",
      excerpt:
        "İlanın kullandığı kelimeler çoğu zaman CV'nizde de geçmelidir. Hangi kelimelerin eksik olduğunu nasıl bulur, uydurmadan nasıl eklersiniz?",
      blocks: [
        { t: "lead", x: "Aynı CV'yi her ilana göndermek kolaydır ama çoğu zaman en az etkili yoldur. İlan, işverenin aradığı becerileri kendi kelimeleriyle yazar; CV'niz aynı şeyi başka kelimelerle anlatıyorsa hem insan okuyucu hem başvuru sistemi bunu gözden kaçırabilir." },
        { t: "h2", x: "1. İlanı bir kez dikkatle okuyun" },
        { t: "p", x: "İlandaki zorunlu nitelikleri (\"en az 3 yıl\", \"Excel\", \"B sınıfı ehliyet\") ve tercih sebeplerini ayrı ayrı not edin. Sık tekrar eden kelimeler işverenin önceliğini gösterir. Şirket tanıtım cümlelerini değil, aranan nitelikleri ve görevleri okuyun." },
        { t: "h2", x: "2. CV'nizde olanı ilanın diliyle eşleştirin" },
        { t: "p", x: "Bir deneyiminiz ilandaki bir gereksinimi karşılıyorsa, aynı kavramı ilanın kullandığı kelimeyle yazın. İlan \"paydaş yönetimi\" diyorsa ve siz \"ilgili birimlerle iletişim\" yazdıysanız, gerçekten yaptığınız iş aynıysa bunu ilanın diliyle ifade edebilirsiniz." },
        { t: "tip", x: "Kural basit: CV'nizde olmayan bir beceriyi ya da deneyimi yalnızca ilanda geçtiği için eklemeyin. Mülakatta sorulduğunda anlatamayacağınız hiçbir cümle CV'de durmamalı." },
        { t: "h2", x: "3. Eksikleri görün" },
        { t: "p", x: "İlan metnini CV Oluştur'un Analiz sekmesindeki ilan eşleştiriciye yapıştırdığınızda araç ilandaki anahtar kelimeleri çıkarır ve hangilerinin CV'nizde geçtiğini, hangilerinin geçmediğini gösterir. Türkçe ekler (\"yönetimi\", \"yönettim\") kelime gövdesine göre eşleştirilir. Bu işlem tamamen cihazınızda yapılır; ilan ya da CV'niz sunucuya gönderilmez." },
        { t: "ul", items: [
          "Eksik çıkan kelimelerden gerçekten sahip olduklarınızı CV'ye ekleyin.",
          "Sahip olmadıklarınızı eklemeyin; gerekirse ön yazıda öğrenmeye istekli olduğunuzu dürüstçe belirtin.",
          "Aynı kelimeyi arka arkaya tekrarlamak yerine ilgili deneyim maddesinde bir kez, bağlamıyla kullanın.",
        ] },
        { t: "h2", x: "4. Yapay zekâ ile uyarlama (Pro)" },
        { t: "p", x: "CV Oluştur'un Yapay Zekâ sekmesindeki \"İlana göre uyarla\" özelliği, ilanı ve CV'nizin deneyim–beceri metnini birlikte değerlendirir; özet ve madde önerileri üretir. Sonuçlar özgün CV'nizin üzerine yazılmaz: seçtiğiniz öneriler CV'nizin ayrı bir kopyasına uygulanır." },
        { t: "p", x: "Uydurmayı önlemek için iki koruma vardır: CV'nizde bulunmayan yeni bir rakam öneride çıkarsa o öneri reddedilir; CV'nizde geçmeyen bir araç ya da kavram eklenirse size ayrıca uyarı olarak gösterilir. Yapay zekâ bir bilgiyi bulamazsa uydurmak yerine size soru sorar." },
        { t: "tip", x: "Yapay zekâya adınız, e-postanız, telefonunuz, adresiniz ve fotoğrafınız gönderilmez; yalnızca deneyim, eğitim ve beceri metni gider. Neyin gittiğini arayüzde kendiniz görebilirsiniz." },
        { t: "cta", title: "CV Oluştur", x: "İlan metnini yapıştırın, eksik anahtar kelimeleri görün ve CV'nizin kopyasını ilana göre düzenleyin.", btn: "CV'ni uyarla", tool: "/tools/cv-olustur" },
        { t: "h2", x: "5. Her ilana ayrı kopya tutun" },
        { t: "p", x: "CV Oluştur aynı cihazda 12 CV'ye kadar saklar. Ana CV'nizi koruyup her başvuru için bir kopya oluşturabilir, kopyaya şirket ya da pozisyon adını verebilirsiniz. Böylece hangi ilana hangi sürümü gönderdiğinizi sonradan bulabilirsiniz." },
        { t: "h2", x: "6. Göndermeden önce son kontrol" },
        { t: "steps", items: [
          { title: "Tutarlılık", x: "Analiz sekmesi tarih çakışması gibi kesin hataları gösterir." },
          { title: "ATS röntgeni", x: "PDF'inizin başvuru sistemlerince nasıl okunduğunu görün: adınız ilk satırda mı, e-posta ve telefon tanınıyor mu, başlıklar anlaşılıyor mu?" },
          { title: "Sayfa sayısı", x: "İki sayfaya taşan bir CV'yi \"Tek sayfaya sığdır\" ile tek sayfaya indirebilirsiniz." },
        ] },
      ],
      faq: [
        { q: "CV'yi her başvuru için değiştirmek şart mı?", a: "Şart değil ama önerilir. Özellikle özet bölümü ve en üstteki deneyim maddelerini ilana göre ayarlamak çoğu zaman yeterli olur." },
        { q: "İlandaki her kelimeyi CV'ye eklemeli miyim?", a: "Hayır. Yalnızca gerçekten sahip olduğunuz beceri ve deneyimleri ilanın kelimeleriyle yazın; sahip olmadıklarınızı eklemeyin." },
        { q: "İlan eşleştirici ücretsiz mi?", a: "Evet, analiz araçları cihazınızda çalışır. Yapay zekâ ile uyarlama ise Pro üyelere özeldir." },
        { q: "İlan metnim sunucuya gönderiliyor mu?", a: "İlan eşleştirici yalnızca tarayıcınızda çalışır. Yapay zekâ ile uyarlamada ilan metni ve CV'nizin deneyim–beceri metni yapay zekâ hizmetine gönderilir; kişisel iletişim bilgileriniz gönderilmez." },
      ],
    },
    {
      title: "How to Tailor Your CV to a Job Ad: A Keyword Guide",
      description:
        "Instead of sending one CV everywhere, tailor it: find the ad's keywords, work them in honestly, see what's missing and keep a copy per application.",
      excerpt:
        "The words an ad uses often need to appear in your CV too. How to find what's missing and add it without making anything up.",
      blocks: [
        { t: "lead", x: "Sending the same CV to every ad is easy, but it is often the least effective approach. The ad describes what the employer wants in its own words; if your CV describes the same thing in different words, both the human reader and the applicant tracking system can miss it." },
        { t: "h2", x: "1. Read the ad carefully, once" },
        { t: "p", x: "Note the required qualifications (\"at least 3 years\", \"Excel\", \"driving licence\") separately from the nice-to-haves. Words that repeat show the employer's priorities. Read the requirements and duties, not the company blurb." },
        { t: "h2", x: "2. Match what you have to the ad's language" },
        { t: "p", x: "If an experience of yours meets a requirement, describe it with the ad's own word. If the ad says \"stakeholder management\" and you wrote \"liaising with departments\", and the work you did is genuinely the same, use the ad's wording." },
        { t: "tip", x: "A simple rule: never add a skill or experience just because the ad mentions it. Nothing should be on your CV that you couldn't explain in an interview." },
        { t: "h2", x: "3. See what's missing" },
        { t: "p", x: "Paste the ad into the job matcher in CV Maker's Analysis tab. It pulls out the ad's keywords and shows which appear in your CV and which don't. Word forms are matched by stem, so \"managed\" and \"management\" are treated alike. It all runs on your device; neither the ad nor your CV is sent to a server." },
        { t: "ul", items: [
          "Add the missing keywords you genuinely have to your CV.",
          "Don't add ones you don't have; say honestly in a cover letter that you are keen to learn.",
          "Use a keyword once, in context, within the relevant bullet rather than repeating it.",
        ] },
        { t: "h2", x: "4. Tailoring with AI (Pro)" },
        { t: "p", x: "The \"Tailor to a job ad\" feature in CV Maker's AI tab reads the ad together with your CV's experience and skills text and proposes a summary and bullet rewrites. Nothing overwrites your original: the suggestions you pick are applied to a separate copy of your CV." },
        { t: "p", x: "Two safeguards guard against invention: a suggestion containing a number that isn't in your CV is rejected, and any tool or concept that isn't in your CV is flagged for you. When the AI can't find something, it asks you rather than making it up." },
        { t: "tip", x: "Your name, email, phone, address and photo are never sent to the AI — only experience, education and skills text. You can see exactly what is sent in the interface." },
        { t: "cta", title: "CV Maker", x: "Paste the ad, see the missing keywords and adjust a copy of your CV to it.", btn: "Tailor my CV", tool: "/tools/cv-olustur" },
        { t: "h2", x: "5. Keep a copy per application" },
        { t: "p", x: "CV Maker stores up to 12 CVs on your device. Keep your master CV intact and create a copy for each application, named after the company or role, so you can find which version went where." },
        { t: "h2", x: "6. Final checks before sending" },
        { t: "steps", items: [
          { title: "Consistency", x: "The Analysis tab flags clear errors such as overlapping dates." },
          { title: "ATS X-ray", x: "See how hiring systems read your PDF: is your name the first line, are your email and phone recognised, are the headings understood?" },
          { title: "Page count", x: "If the CV spills onto a second page, \"Fit to one page\" can bring it back to one." },
        ] },
      ],
      faq: [
        { q: "Do I have to change my CV for every application?", a: "No, but it helps. Adjusting the summary and the top experience bullets to the ad is often enough." },
        { q: "Should I add every word from the ad?", a: "No. Only describe skills and experience you genuinely have in the ad's words; don't add the ones you don't." },
        { q: "Is the job matcher free?", a: "Yes, the analysis tools run on your device. Tailoring with AI is for Pro members." },
        { q: "Is the ad text sent to a server?", a: "The job matcher runs only in your browser. For AI tailoring the ad text and your CV's experience and skills text are sent to the AI service; your contact details are not." },
      ],
    },
  ),

  // 2 ──────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "europass-tarzi-cv-nasil-hazirlanir",
      date: "2026-10-08",
      updated: "2026-10-08",
      readMinutes: 6,
      tags: { tr: ["CV", "Europass", "Yurt Dışı Başvuru"], en: ["CV", "Europass", "International"] },
      accent: "blue",
      tool: "/tools/cv-olustur",
    },
    {
      title: "Europass Tarzı CV Nedir, Ne Zaman Kullanılır?",
      description:
        "Tarihlerin solda, ayrıntıların sağda durduğu Europass tarzı CV düzeninin ne olduğu, hangi başvurularda işe yaradığı ve nasıl hazırlanacağı.",
      excerpt:
        "Avrupa'da yaygın olan tarih sütunlu CV düzeni, kariyer yolunuzu bir bakışta gösterir. Ne zaman tercih edilir, nelere dikkat edilir?",
      blocks: [
        { t: "lead", x: "Europass, Avrupa Birliği'nin geliştirdiği özgeçmiş ve belge çerçevesidir; ilgili resmî site çevrimiçi bir CV düzenleyici de sunar. Bu yazıda anlatılan \"Europass tarzı\" ise o resmî şablon değil, ondan esinlenen düzendir: tarihler solda, görev ve ayrıntılar sağda." },
        { t: "h2", x: "Düzen neden işe yarar?" },
        { t: "p", x: "Gözünüz soldaki tarih sütunundan aşağı inerek kariyer sırasını ve boşlukları anında görür. Bu yüzden akademik, kamu, hukuk, sağlık ve uluslararası başvurularda sık tercih edilir." },
        { t: "h2", x: "Ne zaman uygun olur?" },
        { t: "ul", items: [
          "Yurt dışı ya da Erasmus, burs ve araştırma programı başvurularında.",
          "Kariyeri uzun ve düzenli ilerleyen, tarih sıralamasının güçlü olduğu profillerde.",
          "Kamu, akademi, hukuk ve sağlık gibi geleneksel alanlarda.",
        ] },
        { t: "tip", x: "Başvurduğunuz kurum belirli bir şablon ya da resmî Europass biçimi istiyorsa, onun şartını izleyin. Bu araçtaki düzen resmî Europass dosyası üretmez." },
        { t: "h2", x: "Hazırlarken dikkat edilecekler" },
        { t: "ol", items: [
          "En yeni deneyimi en üste yazın; her kalemde tarih aralığını, pozisyonu ve kurumu net belirtin.",
          "Her deneyim için 2–4 madde yazın ve mümkünse sonucu rakamla anlatın.",
          "Eğitim ve diller bölümünü kısa tutun; dil seviyelerini tutarlı bir ölçekle yazın.",
          "Fotoğraf koyup koymamak ülkeye göre değişir; ilanda aksi istenmedikçe yerel uygulamayı izleyin.",
        ] },
        { t: "h2", x: "CV Oluştur'da hangi şablonlar var?" },
        { t: "p", x: "CV Oluştur'da tarih sütunlu üç şablon bulunur: Europass Tarzı, Tarih Sütunlu Serif ve Tarih Sütunlu Petrol. Tümü Pro üyelere açıktır; renk, yazı tipi ve başlık stilini değiştirebilirsiniz." },
        { t: "p", x: "Tarih sütunlu düzenlerde içerik PDF'e önce yazıldığı için metin sırası bozulmaz; ancak ATS röntgeni bu düzeni sütunlu olarak işaretleyebilir. Başvuru sistemine yükleyeceğiniz CV için tek sütunlu bir şablon daha güvenli olabilir; röntgen sonucunu görüp kendiniz karar verin." },
        { t: "cta", title: "CV Oluştur", x: "Tarih sütunlu şablonu seçin, bilgilerinizi girin ve ATS röntgeniyle PDF'in nasıl okunduğunu görün.", btn: "Şablonu dene", tool: "/tools/cv-olustur" },
        { t: "h2", x: "İngilizce CV hazırlama" },
        { t: "p", x: "Yurt dışı başvurularda \"Görünüm ve dil\" bölümünden CV dilini İngilizce seçin; bölüm başlıkları ve tarih biçimi buna göre değişir. İçeriği kendiniz yazarsınız; araç içeriği çevirmez." },
      ],
      faq: [
        { q: "Bu şablon resmî Europass dosyası mı üretir?", a: "Hayır. Düzen Europass'tan esinlenmiştir; resmî bir Europass dosyası değildir. Resmî biçim gerekiyorsa ilgili resmî siteyi kullanın." },
        { q: "Europass tarzı CV başvuru sistemlerine uygun mu?", a: "PDF'teki yazı gerçek metindir ve okunabilir; ancak sütunlu düzenler bazı sistemlerde karışabilir. ATS röntgeni bu konuda sizi uyarır." },
        { q: "Fotoğraf eklemeli miyim?", a: "Ülkeye ve kuruma göre değişir. Eklerseniz AI Fotoğraf Stüdyosu ile CV'ye uygun arka plan ve kadrajı hazırlayabilirsiniz." },
        { q: "Bu şablonlar ücretsiz mi?", a: "Hayır, Pro üyelere özeldir. Ücretsiz üyelikte dört şablon kullanılabilir." },
      ],
    },
    {
      title: "What Is a Europass-Style CV and When Should You Use It?",
      description:
        "What the date-column, Europass-style CV layout is, which applications it suits and how to prepare one.",
      excerpt:
        "The date-column layout common in Europe shows your career path at a glance. When is it a good choice and what should you watch for?",
      blocks: [
        { t: "lead", x: "Europass is a CV and documents framework developed by the European Union, and its official site offers an online CV editor. The \"Europass-style\" layout described here is not that official template; it is inspired by it: dates on the left, duties and details on the right." },
        { t: "h2", x: "Why the layout works" },
        { t: "p", x: "Your eye runs down the date column and sees the sequence of your career and any gaps at once. That is why it is popular for academic, public-sector, legal, healthcare and international applications." },
        { t: "h2", x: "When it fits" },
        { t: "ul", items: [
          "International, Erasmus, scholarship and research programme applications.",
          "Long, steady careers where a clear timeline is a strength.",
          "Traditional fields such as the public sector, academia, law and healthcare.",
        ] },
        { t: "tip", x: "If the institution asks for a specific template or the official Europass format, follow that. The layout in this tool does not produce an official Europass file." },
        { t: "h2", x: "Preparing it" },
        { t: "ol", items: [
          "Put your latest role first; give each entry a clear date range, position and organisation.",
          "Write 2–4 bullets per role and describe outcomes with numbers where you can.",
          "Keep education and languages short; use one consistent scale for language levels.",
          "Whether to include a photo depends on the country; follow local practice unless the ad says otherwise.",
        ] },
        { t: "h2", x: "Which templates does CV Maker offer?" },
        { t: "p", x: "CV Maker has three date-column templates: Europass Style, Dated Serif and Dated Teal. All are for Pro members; you can change the colour, typeface and heading style." },
        { t: "p", x: "In the date-column layouts the content is written to the PDF first, so the text order isn't scrambled; the ATS X-ray may still flag the layout as multi-column. For a CV you'll upload to an applicant tracking system a single-column template can be safer; look at the X-ray result and decide for yourself." },
        { t: "cta", title: "CV Maker", x: "Pick a date-column template, enter your details and check with the ATS X-ray how the PDF reads.", btn: "Try the template", tool: "/tools/cv-olustur" },
        { t: "h2", x: "Preparing an English CV" },
        { t: "p", x: "For international applications, choose English under \"Look & language\"; section headings and date formats follow. You write the content yourself; the tool does not translate it." },
      ],
      faq: [
        { q: "Does this template produce an official Europass file?", a: "No. The layout is inspired by Europass and is not an official Europass file. If you need the official format, use the official site." },
        { q: "Is a Europass-style CV ATS-friendly?", a: "The text in the PDF is real, readable text, but multi-column layouts can get scrambled in some systems. The ATS X-ray warns you about this." },
        { q: "Should I add a photo?", a: "It depends on the country and institution. If you do, the AI Photo Studio can prepare a CV-suited background and framing." },
        { q: "Are these templates free?", a: "No, they are for Pro members. A free account can use four templates." },
      ],
    },
  ),

  // 3 ──────────────────────────────────────────────────────────────────────────
  post(
    {
      slug: "cv-on-yazi-nasil-yazilir",
      date: "2026-10-08",
      updated: "2026-10-08",
      readMinutes: 6,
      tags: { tr: ["Ön Yazı", "CV", "İş Başvurusu"], en: ["Cover Letter", "CV", "Job Application"] },
      accent: "emerald",
      tool: "/tools/cv-olustur",
    },
    {
      title: "Ön Yazı (Cover Letter) Nasıl Yazılır? Örnek Yapı ve İpuçları",
      description:
        "Kısa, somut ve ilana özel bir ön yazının yapısı: açılış, kanıt, motivasyon ve kapanış. CV'nizle aynı tasarımda PDF olarak hazırlama.",
      excerpt:
        "İyi bir ön yazı CV'nin tekrarı değildir; CV'nin söylemediğini söyler. Dört paragrafta hazırlanacak bir yapı.",
      blocks: [
        { t: "lead", x: "Ön yazı, CV'nizin yanında işverene \"neden bu iş, neden ben\" sorusunu yanıtladığınız kısa mektuptur. CV'nizi tekrar etmek yerine, onu bağlama oturtur." },
        { t: "h2", x: "Dört paragraflık yapı" },
        { t: "ol", items: [
          "Açılış: Hangi pozisyona başvurduğunuzu ve sizi neyin ilgilendirdiğini bir iki cümleyle söyleyin.",
          "Kanıt: İlandaki bir ya da iki gereksinimi, CV'nizdeki somut bir sonuçla ilişkilendirin (rakam ve bağlamla).",
          "Motivasyon: Bu şirketi ya da rolü neden seçtiğinizi, size ne kattığını anlatın.",
          "Kapanış: Görüşme isteğinizi belirtin, teşekkür edin, iletişim bilgilerinize atıf yapın.",
        ] },
        { t: "h2", x: "Uzunluk ve ton" },
        { t: "p", x: "Bir sayfayı geçmeyin; yaklaşık 250–350 kelime çoğu başvuru için yeterlidir. Samimi ama profesyonel bir dil kullanın; \"Sayın İlgili\" yerine biliyorsanız kişinin adını yazmak daha iyidir." },
        { t: "h2", x: "Kaçınılacaklar" },
        { t: "ul", items: [
          "CV'nizin cümle cümle tekrarı.",
          "Her şirkete gönderilebilecek genel cümleler.",
          "Yapmadığınız bir işi ya da sahip olmadığınız bir beceriyi yazmak.",
          "Yazım hataları: göndermeden önce yüksek sesle okuyun.",
        ] },
        { t: "h2", x: "Yapay zekâ ile taslak (Pro)" },
        { t: "p", x: "CV Oluştur'un Yapay Zekâ sekmesindeki \"Ön yazı hazırla\" özelliği, CV'nizin deneyim–beceri metni, isteğe bağlı iş ilanı, şirket ve pozisyon adıyla bir taslak üretir. Tonu (resmî, samimi veya doğrudan) seçebilirsiniz." },
        { t: "p", x: "Taslak CV'nizde bulunmayan bir rakam ya da kısaltma içeriyorsa size ayrıca bildirilir. Yine de bu bir taslaktır: göndermeden önce her cümlenin doğru olduğunu kontrol edin ve kendi sesinize göre düzenleyin. Metin kutusunda doğrudan değişiklik yapabilirsiniz." },
        { t: "tip", x: "Adınız, e-postanız, telefonunuz ve fotoğrafınız yapay zekâya gönderilmez; mektubun üst bilgisi cihazınızda CV'nizdeki bilgilerle eklenir." },
        { t: "h2", x: "CV'nizle aynı tasarımda PDF" },
        { t: "p", x: "Ön yazıyı indirdiğinizde seçili CV şablonunuzun yazı tipi, rengi ve başlık düzeniyle bir PDF olarak alırsınız; böylece CV ve ön yazı aynı kimliği taşır. Metin gerçek metindir, seçilebilir ve başvuru sistemlerince okunur. PDF cihazınızda üretilir." },
        { t: "cta", title: "CV Oluştur", x: "Ön yazı taslağını hazırlayın, düzenleyin ve CV'nizle aynı tasarımda PDF olarak indirin.", btn: "Ön yazı hazırla", tool: "/tools/cv-olustur" },
      ],
      faq: [
        { q: "Ön yazı zorunlu mu?", a: "İlan istiyorsa evet. İstemiyorsa da iyi bir ön yazı fark yaratabilir; özellikle kariyer değişikliği ya da CV'de açıklanması gereken durumlarda faydalıdır." },
        { q: "Ön yazı ne kadar olmalı?", a: "Tek sayfa, yaklaşık 250–350 kelime ve dört kısa paragraf çoğu başvuru için yeterlidir." },
        { q: "Yapay zekâ ön yazıda bilgi uydurur mu?", a: "Uydurmaması için istem ve kod kontrolleri vardır; CV'nizde olmayan rakam ya da kavram çıkarsa uyarılırsınız. Yine de göndermeden önce her cümleyi kontrol etmelisiniz." },
        { q: "Ön yazı özelliği ücretsiz mi?", a: "Ön yazı özelliği Yapay Zekâ sekmesinin bir parçasıdır ve Pro üyelere özeldir. Üretilen taslağı metin kutusunda düzenleyip PDF olarak indirebilirsiniz." },
      ],
    },
    {
      title: "How to Write a Cover Letter: Structure and Tips",
      description:
        "The structure of a short, concrete, role-specific cover letter: opening, evidence, motivation and close — as a PDF in the same design as your CV.",
      excerpt:
        "A good cover letter doesn't repeat the CV; it says what the CV doesn't. A four-paragraph structure.",
      blocks: [
        { t: "lead", x: "A cover letter is the short letter alongside your CV where you answer \"why this job, why me\". Rather than repeating the CV, it puts it in context." },
        { t: "h2", x: "A four-paragraph structure" },
        { t: "ol", items: [
          "Opening: say which role you're applying for and what interests you, in a sentence or two.",
          "Evidence: link one or two requirements from the ad to a concrete result from your CV, with numbers and context.",
          "Motivation: why this company or role, and what it adds for you.",
          "Close: state that you'd welcome an interview, thank the reader and refer to your contact details.",
        ] },
        { t: "h2", x: "Length and tone" },
        { t: "p", x: "Stay within one page; about 250–350 words is enough for most applications. Be warm but professional, and if you know the reader's name use it instead of a generic greeting." },
        { t: "h2", x: "What to avoid" },
        { t: "ul", items: [
          "Repeating your CV sentence by sentence.",
          "Generic lines that could go to any company.",
          "Claiming work you haven't done or skills you don't have.",
          "Typos: read it aloud before sending.",
        ] },
        { t: "h2", x: "Drafting with AI (Pro)" },
        { t: "p", x: "The \"Write a cover letter\" feature in CV Maker's AI tab drafts a letter from your CV's experience and skills text, plus an optional job ad, company and position. You can choose the tone: formal, warm or direct." },
        { t: "p", x: "If the draft contains a number or abbreviation that isn't in your CV you're told so. It is still only a draft: check every sentence is true and edit it into your own voice before sending. You can edit directly in the text box." },
        { t: "tip", x: "Your name, email, phone and photo are not sent to the AI; the letterhead is added on your device from your CV details." },
        { t: "h2", x: "A PDF in the same design as your CV" },
        { t: "p", x: "When you download the letter you get a PDF in your selected CV template's typeface, colour and heading style, so your CV and letter share one identity. The text is real, selectable text that hiring systems can read, and the PDF is generated on your device." },
        { t: "cta", title: "CV Maker", x: "Draft your cover letter, edit it and download it as a PDF matching your CV.", btn: "Write a cover letter", tool: "/tools/cv-olustur" },
      ],
      faq: [
        { q: "Is a cover letter mandatory?", a: "If the ad asks for one, yes. If not, a good one can still set you apart, especially for career changes or things your CV needs to explain." },
        { q: "How long should it be?", a: "One page, around 250–350 words in four short paragraphs, is enough for most applications." },
        { q: "Does the AI make things up in the letter?", a: "Prompt rules and code checks guard against it, and a number or concept that isn't in your CV is flagged. You should still check every sentence before sending." },
        { q: "Is the cover letter feature free?", a: "The cover letter feature is part of the AI tab and is for Pro members. You can edit the generated draft in the text box and download it as a PDF." },
      ],
    },
  ),
];
