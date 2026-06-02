# Ne Zaman Yeniden Yazmalısın?

> **Uyarı:** "Her şeyi baştan yazayım" hissi geliştirici hastalığıdır. %90 vakada yanlış karardır. Bu rehber o %10'u tanımlamana yardımcı olur.

---

## 🚫 Yeniden Yazma Sinyali DEĞİL

Bunları görüyorsan yeniden yazma isteği gelir — ama genellikle haksızsın:

**"Kod çirkin / okunaksız"**
→ Refactor et. Yeniden yazma.

**"Daha iyi bir framework var"**
→ Büyük ihtimalle değer yok. Çalışan kodu çalışır bırak.

**"Ben şimdi daha iyi yazardım"**
→ Evet. Ama eski kod production'da çalışıyor, yeni kod henüz değil.

**"Bu kısım anlaşılması zor"**
→ Yorum ekle veya kısmi refactor yap.

**"Performans yavaş"**
→ Profil al, bottleneck'i bul, sadece onu düzelt.

**"Test yok"**
→ Test yaz. Yeniden yazma.

---

## ✅ Gerçek Yeniden Yazma Sinyalleri

### Sinyal 1: Fundamental Mimari Hatası

**Ne anlama gelir:** Temel tasarım kararı yanlış ve üstüne inşa etmek imkansız.

**NB PDF Platform örneği:**
```
Örnek: Tüm PDF işlemleri synchronous olarak auth API'da çalışıyor olsaydı
→ Asynchronous yapıya geçmek için tüm API yeniden yazılması gerekirdi
→ Bu gerçek bir yeniden yazma nedeni

Şu anki durum: FastAPI ayrı servis, thread pool mevcut → SORUN YOK
```

**Test sorusu:** "Özellik X'i ekleyebilir miyim?" sorusunun cevabı "Hayır, mimari izin vermiyor" ise sinyal var.

---

### Sinyal 2: Güvenlik Açığı — Kapatılması Mümkün Değil

**Ne anlama gelir:** Temel bir güvenlik kararı o kadar yanlış ki, düzeltmek için her katmanı değiştirmen gerekiyor.

**Örnek (gerçek olmayan):**
```
Kullanıcı ID'leri sequential integer: /api/user/1, /api/user/2...
→ IDOR açığı var
→ Her endpoint'e authorization check eklemek mümkün ama
→ ID'leri UUID'ye çevirmek daha güvenli
→ Ama bu tüm DB'yi ve API'ı etkiler
```

**NB PDF Platform:** UUID kullanıyor, JWT doğru — bu sinyal yok.

---

### Sinyal 3: Bakım Süreleri Özellik Süresini Geçti

**Ölçüm:**
```
Son 3 aydaki commit'leri kategorize et:
- Bug fix / bakım: X commit
- Yeni özellik: Y commit

X > Y × 2 ise → mimari borç kritik seviyede
```

```bash
git log --oneline --since="3 months ago" | \
  grep -c "fix\|hotfix\|patch\|revert"
# Bu sayı toplam commit'in %50'sinden fazlaysa sorun var
```

---

### Sinyal 4: Kritik Dependency Artık Desteklenmiyor

**Ne anlama gelir:** Kullandığın temel kütüphane/framework artık güncelleme almıyor ve güvenlik açıkları kapanmıyor.

**Nasıl kontrol edersin:**
```bash
# Node.js versiyonu EOL mi?
node --version
# https://nodejs.org/en/about/previous-releases kontrol et

# npm paketleri deprecated mi?
npm outdated --depth=0

# Python EOL kontrolü:
python --version
# https://devguide.python.org/versions/
```

---

### Sinyal 5: Ölçekleme Duvarına Çarptın

**Ne anlama gelir:** Kullanıcı sayısı arttıkça performans lineer olarak kötüleşiyor ve çözüm yok.

**Örnek threshold'lar:**
```
1000 kullanıcı → API 500ms yanıt veriyor → Normal
5000 kullanıcı → API 2000ms yanıt veriyor → Sorun var
10000 kullanıcı → API timeout ediyor → Mimaride sorun

Ama önce: Index ekle, connection pool artır, cache ekle
Sonra: Yeniden yaz
```

---

## 🔄 Yeniden Yazma Yerine: Kısmi Refactor Stratejisi

Çoğu zaman yeniden yazma değil, **kısmi refactor** doğrudur.

### Strangler Fig Pattern

```
1. Yeni kodu eski kodun yanına yaz
2. Trafiği yavaşça yeni koda kaydır
3. Eski kodu sil

Örnek: payments.service.ts çok karmaşıklaştıysa:
→ payment-v2.service.ts oluştur
→ Yeni özellikler v2'ye git
→ Eski kodları yavaşça v2'ye taşı
→ v1 servisini sil
```

### Modül Bazlı İzolasyon

```
Kötü: Tüm auth kodunu yeniden yaz
İyi: Auth'u bir modül olarak izole et, sadece o modülü yeniden yaz

NB PDF Platform zaten bunu yapıyor:
web/api/src/modules/auth/       ← değiştirilebilir
web/api/src/modules/payment/    ← değiştirilebilir
Birini değiştirmek diğerini etkilemez
```

---

## 📊 Karar Matrisi

| Durum | Tavsiye |
|-------|---------|
| Kod okunaksız | Refactor |
| Performans yavaş | Profil + optimize |
| Test yok | Test yaz |
| Framework eski | Upgrade dene önce |
| Mimari temel yanlış | Yeniden yaz (kısmi) |
| Güvenlik açığı kapatılamıyor | Yeniden yaz (o modülü) |
| Dependency EOL + güvenlik açığı | Yeniden yaz |
| Ölçekleme duvarı (önlemler sonrası) | Yeniden yaz (o katmanı) |

---

## ⏱️ Yeniden Yazma Kararı Verdiysen

### Gerçekçi Zaman Tahmini

```
"2 haftada yazarım" → Gerçekte 6-8 hafta
"1 ayda yazarım"   → Gerçekte 3-4 ay
"3 ayda yazarım"   → Gerçekte 6-9 ay

+%200 ekle. Bu kural değişmez.
```

### Minimum Gereksinimler

Yeniden yazmaya başlamadan önce:

```
[ ] Mevcut sistem production'da çalışmaya devam edecek
[ ] Yeni sistem production'a geçmeden beta test yapılacak
[ ] Rollback planı var (eski sisteme dönüş)
[ ] Feature parity listesi hazır (mevcut özelliklerin hepsi)
[ ] Test coverage — en azından kritik flow'lar için
```

### NB PDF Platform İçin Gerçek Tablo

```
Şu an yeniden yazılması gereken bir şey var mı?

auth/   → HAYIR. JWT, OAuth, rate limiting çalışıyor
payment/→ HAYIR. iyzico entegrasyon sağlam  
PDF API → HAYIR. FastAPI + thread pool yeterli
Frontend→ HAYIR. React + Vite stabil

Gelecekte yeniden yazma tetikleyebilecek şeyler:
- 50.000+ kullanıcıda single PostgreSQL bottleneck
- PDF işleme için ML özellik gerekirse (farklı dil/runtime)
- Çoklu bölge (multi-region) ihtiyacı
```

> **Sonuç:** Çalışan koda dokunma. Kullanıcı kazan. Gelir artır. Sonra gerek olursa düzelt.
