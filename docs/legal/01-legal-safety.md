# Hukuki Güvenlik ve Kullanıcı Şikayetleri

> **Önemli not:** Bu belge hukuki tavsiye değildir. Genel operasyonel rehberliktir. Ciddi hukuki sorunlar için bir avukata danış.

---

## ⚖️ Türkiye'de SaaS ve Tüketici Hakları

### Neler Uygulanır Sana?

```
✅ Tüketicinin Korunması Hakkında Kanun (6502)
   - Cayma hakkı: Dijital içerikte kullanıcı onayıyla cayma hakkı kaldırılabilir
   - İade: Yazılı politikana göre

✅ Kişisel Verilerin Korunması Kanunu (KVKK - 6698)
   - Kullanıcı verilerini nasıl işlediğini açıklamalısın
   - Saklama sürelerini belirtmelisin
   - Veri silme talepleri 30 gün içinde yanıtlanmalı

✅ Elektronik Ticaret (e-Ticaret Kanunu)
   - Ödeme öncesi kullanıcıyı bilgilendirme
   - Onay alma

✅ Vergi Hukuku
   - Ödeme kayıtları 5 yıl saklanmalı
```

---

## 🚨 "Tüketici Mahkemesine Gideceğim" — Ne Yaparsın?

```
Önce: Panikle. Normal.
Sonra: Sistematik davran.

Kullanıcı bu tehdidi kullandığında genellikle:
A) Gerçekten haklı ve çaresiz hissediyor
B) Haksız fakat agresif
C) Test ediyor (ne kadar kolay iade alıyorum)

Her durumda ÖNCE araştır, SONRA karar ver.
```

**Hemen yapılacaklar:**
```
□ Saldırgan veya stresli bir yanıt yazma
□ Delilleri hemen topla (conversation_id, ödeme kaydı, kullanım logu)
□ Kullanıcının haklı olup olmadığını değerlendir
□ Haklıysa → İade et, özür dile, bitir
□ Haksızsa → Kanıtlarını hazırla, sakin ve profesyonel yanıt ver
```

**Yanıt şablonu (sakin, profesyonel):**
```
Merhaba [AD],

Yaşadığınız deneyim için üzgünüm. Hesabınızı detaylı inceledim.

[DURUM A - Haklıysa]:
Haklısınız, sistemimizde bir aksaklık yaşandı. İadeniz [X] gün içinde
hesabınıza yansıyacak. Şu an [TUTAR]₺ iade işlemi başlattım.

[DURUM B - Haksızsa]:
Kayıtlarımıza göre [TARİH] tarihinde [PLAN] planı [TUTAR]₺ karşılığında
satın alındı ve [N] kez kullanıldı. Ödeme makbuzu ektedir.
Politikamız gereğinde kullanılmış hizmet için iade yapılamamaktadır.
Bununla birlikte [ALTERNATİF ÖNERI - örn: 1 aylık uzatma] sunabilirim.

Herhangi bir sorunuz varsa buradayım.
```

---

## 📄 Hangi Belgeler Hukuki Korunma Sağlar?

### Kanıt Hiyerarşisi (Güçlüden Zayıfa)

```
1. iyzico Ödeme Dekontları
   → Resmi banka belgeleri
   → En güçlü kanıt

2. Veritabanı Kayıtları (Timestamps ile)
   → payment_checkouts tablosu
   → UTC timestamp'li, değiştirilemez

3. Structured Log Dosyaları
   → JSON format, tarihli
   → Her olayı belgeler

4. Admin Audit Log'ları
   → Admin eylemlerinin kaydı
   → "Kim ne zaman ne yaptı"

5. Email İletişimleri
   → Kullanıcıyla yazışma
   → Gmail'den çıkar, sakla

6. Kullanım Logları
   → Kullanıcı sistemi kullandı mı?
   → daily_usage tablosu
```

---

## 📁 Delil Paketleme Prosedürü

**Hukuki süreç başlarsa veya ciddi şikayet gelirse:**

```bash
#!/bin/bash
# Kullanıcı için delil paketi oluştur
USER_EMAIL="kullanici@email.com"
CASE_ID="CASE_$(date +%Y%m%d)_$(echo $USER_EMAIL | md5sum | head -c 8)"
EVIDENCE_DIR="/var/secure/evidence/$CASE_ID"

mkdir -p $EVIDENCE_DIR

# 1. Ödeme kayıtları
psql -U postgres nb_pdf_platform -c "
SELECT * FROM payment_checkouts
WHERE user_id = (SELECT id FROM users WHERE email = '$USER_EMAIL')
ORDER BY created_at;" > $EVIDENCE_DIR/payment_records.txt

# 2. Kullanım kayıtları  
psql -U postgres nb_pdf_platform -c "
SELECT * FROM daily_usage
WHERE user_id = (SELECT id FROM users WHERE email = '$USER_EMAIL')
ORDER BY created_at;" > $EVIDENCE_DIR/usage_records.txt

# 3. Admin eylem geçmişi
psql -U postgres nb_pdf_platform -c "
SELECT * FROM admin_audit_logs
WHERE target_user_email = '$USER_EMAIL'
ORDER BY created_at;" > $EVIDENCE_DIR/admin_actions.txt

# 4. Log dosyasından ilgili kayıtlar
grep -i "$USER_EMAIL\|USER_ID" /var/log/nb-pdf-platform/api.log > $EVIDENCE_DIR/app_logs.txt

# 5. Paket özeti
echo "Delil Paketi: $CASE_ID" > $EVIDENCE_DIR/README.txt
echo "Oluşturulma: $(date -u)" >> $EVIDENCE_DIR/README.txt
echo "Kullanıcı: $USER_EMAIL" >> $EVIDENCE_DIR/README.txt

# 6. Şifrele (güvenli saklama için)
tar -czf /var/secure/evidence/$CASE_ID.tar.gz -C /var/secure/evidence $CASE_ID
gpg --symmetric --cipher-algo AES256 /var/secure/evidence/$CASE_ID.tar.gz

echo "Delil paketi hazır: $CASE_ID.tar.gz.gpg"
echo "Şifreyi güvenli yerde sakla!"
```

---

## 📝 Kullanım Şartları ve Gizlilik Politikası — Minimum Gereklilikler

### Kullanım Şartlarında Mutlaka Olmalı:

```
□ Hizmetin ne olduğu
□ Ödeme ve fiyatlandırma politikası
□ İade politikası (ne zaman, ne kadar, nasıl)
□ Hesap askıya alma/kapatma koşulları
□ Hizmetin kesintisiz olmayabileceği uyarısı
□ Fikri mülkiyet hakları
□ Uygulanacak hukuk (Türkiye)
□ Yetkili mahkeme (ticari merkez)
```

### Gizlilik Politikasında Mutlaka Olmalı:

```
□ Hangi veriler toplanıyor (email, IP, kullanım)
□ Veriler nasıl kullanılıyor
□ Veriler kimlerle paylaşılıyor (iyzico, email servisi)
□ Çerezler hakkında bilgi
□ Veri saklama süreleri
□ KVKK hakları (erişim, silme, düzeltme)
□ İletişim adresi (KVKK başvuruları için)
```

**Uyarı:** Bu metinler hukuki geçerlilik için bir avukat tarafından hazırlanmalı.

---

## 📊 Aylık Hukuki Kontrol Listesi

```
□ İade talepleri kayıt altına alındı mı?
□ KVKK başvurusu geldi mi? (30 gün içinde yanıtlanmalı)
□ Herhangi bir resmi şikayet geldi mi?
□ Ödeme kayıtları tam mı?
□ Kullanım şartları ve gizlilik politikası güncel mi?
□ iyzico sözleşme güncellemesi var mı?
```
