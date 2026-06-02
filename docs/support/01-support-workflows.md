# Müşteri Destek Operasyonları

> **Solo kurucuya gerçekçi uyarı:** Destek seni tüketebilir. Sistematik çalışmak hem senin sağlığın için hem kullanıcı deneyimi için kritik. Yüklenen her şikayete duygusal tepki verme — süreç takip et.

---

## 🧠 Destek Felsefesi

```
Temel kural: Hızlı yanıt + Doğru çözüm > Mükemmel yanıt + Geç çözüm

Birinci yanıt: 4 saat içinde (çalışma saatlerinde)
Çözüm: 24 saat içinde (teknik sorunlar hariç)

Yanıtın iki amacı:
1. Kullanıcının endişesini gidermek
2. Sorunu çözmek veya timeline vermek
```

---

## 📋 Destek Sorunları — Kategoriler ve Öncelikler

| Kategori | Öncelik | Hedef Süre | Örnek |
|----------|---------|------------|-------|
| **Ödeme alındı ama plan yok** | 🔴 Kritik | 1 saat | "Para çekti ama PRO olmadım" |
| **Çift ödeme şüphesi** | 🔴 Kritik | 1 saat | "İki kez para çekildi" |
| **Chargeback tehdidi** | 🔴 Kritik | Hemen | "Bankama şikayet edeceğim" |
| **PDF işlenmedi** | 🟠 Yüksek | 4 saat | "PDF yükledim ama indiremedim" |
| **Şifre sıfırlama çalışmıyor** | 🟠 Yüksek | 4 saat | "Email gelmiyor" |
| **Plan özellikleri yok** | 🟡 Orta | 24 saat | "PRO aldım ama X yok" |
| **Fatura istekleri** | 🟡 Orta | 24 saat | "Fatura/makbuz istiyorum" |
| **Genel soru** | 🟢 Düşük | 48 saat | "Hangi formatlar destekleniyor?" |

---

## 🔴 KRİTİK: "Ödeme Yaptım Ama Plan Değişmedi"

**İlk yanıt (5 dakika içinde yaz, araştırırken de gönder):**
```
Merhaba [AD],

Bildirdiğiniz sorun için özür dileriz. Şu an hesabınızı inceliyoruz.
En geç 1 saat içinde size dönüş yapacağız.

Lütfen aşağıdakileri paylaşır mısınız?
1. Ödeme sırasında kullandığınız email
2. Ödeme tarihi ve yaklaşık saati
3. Hangi plana geçmeye çalıştınız? (PRO / BUSINESS)

Teşekkürler.
```

**Araştırma:** RB-12 runbook'unu takip et.

**Çözüm sonrası yanıt:**
```
Merhaba [AD],

Sorununuzu inceledik. [AÇIKLAMA — örn: "Teknik bir aksaklık nedeniyle
planınız otomatik güncellenemedi."]

Hesabınız şu an [PLAN] olarak güncellendi ve [TARİH]'e kadar geçerli.

Lütfen çıkış yapıp tekrar giriş yapın.

Anlayışınız için teşekkür eder, iyi kullanımlar dileriz.
```

---

## 🔴 KRİTİK: "Çift Para Çektiniz"

**Sakin kal. Önce araştır, sonra yanıt ver.**

**Araştırma adımları:**
```
1. Kullanıcının emaili ile payment_checkouts tablosunu sorgula
2. İki adet COMPLETED kayıt var mı?
3. iyzico panelde iki ayrı işlem var mı?
4. Banka "pending" + "settled" şeklinde mi göstermiş?
```

```sql
SELECT conversation_id, iyzico_payment_id, amount_paid, status, created_at
FROM payment_checkouts
WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL')
  AND status = 'COMPLETED'
ORDER BY created_at;
```

**Senaryo 1: Gerçekten çift ödeme:**
```
1. İkinci ödemeyi iyzico panelden iade et
2. Kullanıcıya özür e-postası gönder
3. Postmortem yaz
```

**Senaryo 2: Banka pending gösteriyor:**
```
Merhaba [AD],

Sistemimizde yaptığımız kontrolde [TARİH] tarihinde tek bir ödeme
kaydı görüyoruz ([TUTAR] TL, İşlem No: [CONV_ID]).

Bankanızın gösterdiği iki kayıt, aynı işlemin "onay bekleniyor" ve
"tamamlandı" aşamalarını gösteriyor olabilir. Bu durum 1-3 iş günü
içinde kendiliğinden düzelir.

Eğer banka ekstrenizde iki ayrı tutarda çekim görüyorsanız lütfen
bize ekran görüntüsü gönderin, hemen inceleriz.
```

---

## 🟠 YÜKSEK: "PDF İşlenmedi"

**Sorulacaklar:**
```
1. Hangi işlemi yapmaya çalıştınız? (Birleştirme, bölme, sıkıştırma?)
2. Dosyanın boyutu neydi?
3. Tam olarak ne hata gördünüz?
4. Ne zaman denediniz? (Zaman damgası log araştırması için önemli)
```

**Araştırma:**
```bash
# Kullanıcı hatayı aldığı saatte ne olmuş?
grep "$(date -d '2024-01-15 13:30' '+%Y-%m-%dT%H:3')" \
  /var/log/nb-pdf-platform/api.log | grep "pdf_error\|pdf_failed"

# Thread pool dolu muydu?
grep "thread_pool_full\|queue_full" /var/log/nb-pdf-platform/api.log | \
  grep "2024-01-15T13"
```

**Çözüm seçenekleri:**
```
A) Teknik sorun gerçekten vardı → "Lütfen tekrar deneyin" + özür
B) Dosya limiti aşıldı → Limit bilgisini açıkla
C) Bozuk PDF idi → "Farklı bir PDF ile deneyin" + nasıl test edileceğini anlat
D) Onun hesabında sorun → Hesabını incele
```

---

## 🟡 ORTA: "Fatura İstiyorum"

**Türkiye'de yasal durum:**
```
İyzico ödemelerinde ödeme alındı belgesi (makbuz) var.
Resmi fatura için e-fatura mükellefi olman gerekiyor (şirket kurma sonrası).

MVP aşamasında:
→ İyzico ödeme dekontunu ilet
→ "Şu an e-fatura sistemimiz kurulum aşamasındadır" de
```

**Yanıt şablonu:**
```
Merhaba [AD],

[TARİH] tarihli ödemenizin dekontuna aşağıdaki bilgilerle
iyzico panelinden ulaşabilirsiniz: [Bilgiler]

Resmi fatura sistemimiz yakında aktife alınacaktır.
Fatura kesildiğinde size bildireceğiz.

Şimdilik ödeme dekontunuz yeterli mi?
```

---

## 🟡 ORTA: "Şifre Sıfırlama E-postası Gelmiyor"

**Kontrol sırası:**
```
1. Email doğru yazıldı mı? (Kullanıcı yanlış yazmış olabilir)
2. Spam/Junk klasörü kontrol edildi mi?
3. Gerçekten hesap var mı?
   SELECT id, email, is_verified FROM users WHERE email = 'EMAIL';
4. Email servisi çalışıyor mu?
   tail -20 /var/log/nb-pdf-platform/api.log | grep "email_sent\|email_failed"
```

**Yanıt:**
```
Merhaba [AD],

Lütfen aşağıdakileri kontrol eder misiniz?
1. Spam/Junk klasörünüze baktınız mı?
2. Email adresiniz tam olarak: [EMAIL] mi?

Bizim tarafta email gönderildi, ancak bazen spam filtreye düşebiliyor.

Hâlâ gelmediyse, bize doğrudan email'inizi gönderin, 
manuel olarak şifre sıfırlama bağlantısı oluşturalım.
```

---

## ❌ Destek'te YAPMA Listesi

```
❌ "Bu benim suçum değil" deme
❌ "Sistem çalışıyor, sorun sizde" deme  
❌ Bir şeyi araştırmadan vaat etme ("para hemen iade edeceğim")
❌ Kullanıcının duygusal mesajlarına duygusal yanıt verme
❌ Teknik detayları kullanıcıya dökme ("callback HMAC imzası yanlış...")
❌ 24 saatten uzun süre cevap vermeme
❌ "Bilmiyorum" deyip bırakma — "Araştırıp döneceğim" de
```

---

## ✅ Destek'te HER ZAMAN YAP

```
✅ İlk yanıtı hızlı gönder (araştırmadan önce bile)
✅ Kullanıcıyı bilgilendir ("X zaman içinde döneceğim")
✅ Somut bilgi iste (tarih, saat, işlem türü)
✅ Her vakayı logla (ne oldu, nasıl çözüldü)
✅ Çözüm sonrası doğrula ("Sorun çözüldü mü?")
✅ Hataları kendi üstlen, özür dile, somut çözüm sun
```

---

## 📊 Destek Metrikleri — Haftalık Takip

```bash
# Bu hafta kaç destek vakası geldi? (email sayısı — manuel say)
# Hangi kategori en çok? 
# Ortalama çözüm süresi?
# Kaç tanesi ödeme sorunuydu?
# Kaç tanesi teknik sorundu?

# İyi bir destek sistemi için:
- İlk yanıt < 4 saat (çalışma saatlerinde)
- Çözüm < 24 saat
- Kullanıcı memnuniyeti: Pozitif yanıt aldın mı?
```
