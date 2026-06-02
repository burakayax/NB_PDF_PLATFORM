# Güvenlik Operasyonları Rehberi

> **Güvenlik mükemmel değildir — katmanlıdır.** Hiçbir sistem %100 güvenli değildir. Amaç saldırıyı imkânsız değil, saldırganın işini yeterince zor hale getirmektir.

> 💻 **Platform Notu:**
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda
> `node`, `npm`, `git`, `npx` komutları her iki platformda aynı çalışır.

---

## 🔐 Gizli Anahtar Rotasyonu (Secret Rotation)

> **Neden rotasyon yapılır?** Sızdırılmış bir anahtarın etkisini sınırlamak için.

### JWT Anahtarları (Her 6-12 Ayda Bir)

> Bu komut yerel makinende proje dizininde çalıştırılır.

```bash
# 🍎 Mac / Linux ve 🪟 Windows — AYNI KOMUT (Node.js her iki platformda çalışır):
node -e "
const crypto = require('crypto');
console.log('JWT_ACCESS_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('JWT_REFRESH_SECRET=' + crypto.randomBytes(64).toString('hex'));
"
# Çıktıyı kopyala → web/api/.env dosyasına yapıştır
```

```bash
# 🖥️ Sunucuda servisi yeniden başlat:
sudo systemctl restart nb-api
# UYARI: Bu değişince tüm aktif kullanıcılar oturumdan çıkar!
```

### İyzico API Anahtarları (Her Yıl veya Şüphe Durumunda)

```
1. https://merchant.iyzico.com → Ayarlar → API Anahtarları
2. Yeni anahtar oluştur
3. web/api/.env'de güncelle (IYZICO_API_KEY ve IYZICO_SECRET_KEY)
4. 🖥️ Sunucuda: sudo systemctl restart nb-api
5. Test ödemesi yap (sandbox'ta)
6. Çalışıyorsa eski anahtarı devre dışı bırak
7. 24 saat bekle (eski anahtar ödeme işlemede kalsın)
```

### E-posta SMTP Şifresi (Her Yıl)

```
1. Gmail → Hesap → Güvenlik → Uygulama Şifreleri
2. "PDF PLATFORM API" adlı şifreyi sil
3. Yeni şifre oluştur
4. web/api/.env'de EMAIL_PASS güncelle
5. 🖥️ Sunucuda: sudo systemctl restart nb-api
6. Doğrulama e-postası gönder (test)
```

---

## 🔍 CVE (Güvenlik Açığı) İzleme

> **CVE nedir?** Common Vulnerabilities and Exposures. Keşfedilen güvenlik açıklarının numaralandırılmış listesi.

### Manuel İzleme (Yerel Makineden — npm/pip her iki platformda aynı)

```bash
# 🍎 Mac / Linux ve 🪟 Windows (PowerShell) — AYNI KOMUTLAR:

# Node.js açıkları:
cd web/api && npm audit 2>&1

# Python açıkları:
pip-audit --requirement web/backend/requirements.txt
```

```bash
# 🖥️ Sunucuda sistem paketleri:
sudo apt-get update && apt list --upgradable 2>/dev/null | grep -i security
```

**İzleme kaynakları:**
- https://nvd.nist.gov/vuln/search — NIST Ulusal Açık Veri Tabanı
- GitHub repository'nin Security sekmesi (Dependabot uyarıları)
- npm security advisories: https://www.npmjs.com/advisories

---

## 🚨 Sızdırılmış Anahtar Prosedürü

**Bir anahtar/şifre sızdırıldığını düşünüyorsan — HEMEN aksiyon al:**

### JWT Secret Değiştir (Yerel + Sunucu)

```bash
# 🍎 Mac / Linux ve 🪟 Windows — Yeni secret üret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Çıktıyı kopyala → web/api/.env'e JWT_ACCESS_SECRET olarak yapıştır

# 🖥️ Sunucuda:
sudo systemctl restart nb-api
```

### SSH Key Sızdıysa

```bash
# 🖥️ Sunucuda — authorized_keys'den kaldır:
sed -i '/eski_key_parmak_izi/d' ~/.ssh/authorized_keys

# Yeni SSH key oluştur (yerel makinende):
# 🍎 Mac / Linux:
ssh-keygen -t ed25519 -f ~/.ssh/nb_platform_key

# 🪟 Windows (PowerShell):
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\nb_platform_key"
```

### Hasarı Değerlendir

```bash
# 🖥️ Sunucuda — şüpheli erişim var mı?
grep "invalid_jwt\|iyzico_signature_mismatch\|suspicious" \
  /var/log/nb-pdf-platform/api.log | tail -100
```

---

## 🕵️ Log Güvenlik Analizi (SSH ile Sunucuda)

### Şüpheli Aktivite Tespiti

```bash
# 🖥️ Sunucuda:

# Tek IP'den çok sayıda başarısız giriş (brute force):
grep "invalid_jwt\|login.*failed\|401" /var/log/nb-pdf-platform/api.log | \
  grep "$(date +%Y-%m-%d)" | \
  python3 -c "
import sys, json
from collections import Counter
ips = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        if d.get('status') == 401:
            ips.append(d.get('ip', '?'))
    except: pass
for ip, count in Counter(ips).most_common(10):
    if count > 10:
        print(f'ŞÜPHELI: {count} başarısız giriş → {ip}')
"

# İyzico sahtecilik girişimleri:
grep "iyzico_signature_mismatch\|iyzico_unknown_conversation\|iyzico_price_mismatch" \
  /var/log/nb-pdf-platform/api.log | tail -20

# Admin paneline yetkisiz erişim denemeleri:
grep '"/api/admin' /var/log/nb-pdf-platform/api.log | \
  grep '"status":403' | grep "$(date +%Y-%m-%d)" | wc -l
```

---

## 🔒 Güvenlik Duvarı (Firewall) Konfigürasyonu

```bash
# 🖥️ Sunucuda (UFW — Uncomplicated Firewall):
sudo ufw status verbose

# Doğru konfigürasyon:
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (nginx yönlendirme için)
sudo ufw allow 443/tcp   # HTTPS

# 4000 ve 8000 portları KAPALI olmalı:
sudo ufw deny 4000
sudo ufw deny 8000
sudo ufw deny 5432  # PostgreSQL — sadece localhost

sudo ufw enable
sudo ufw status
```

---

## 👤 Admin Erişim Güvenliği (Yerel Makineden — Her İki Platformda Aynı)

```bash
# 🍎 Mac / Linux ve 🪟 Windows (PowerShell) — npx her iki platformda çalışır:

# Sadece sen admin olmalısın:
npx prisma db execute --stdin <<'SQL'
SELECT id, email, role, created_at
FROM users
WHERE role = 'ADMIN'
ORDER BY created_at;
SQL
# Sadece nbglobalstudio@gmail.com görünmeli

# Son admin işlemleri:
npx prisma db execute --stdin <<'SQL'
SELECT created_at, admin_email, action, target_user_email, summary
FROM admin_audit_logs
ORDER BY created_at DESC
LIMIT 20;
SQL
```

---

## 📋 Aylık Güvenlik Kontrol Listesi

```
[ ] npm audit çalıştırıldı (web/api ve web/frontend)
    🍎🪟 Yerel: cd web/api && npm audit

[ ] pip-audit çalıştırıldı
    🍎🪟 Yerel: pip-audit --requirement web/backend/requirements.txt

[ ] Admin hesabı sadece tek kişi mi? (yukarıdaki sorgu)

[ ] Başarısız giriş denemeleri analiz edildi
    🖥️ Sunucuda: yukarıdaki brute force scripti

[ ] İyzico sahtecilik girişimi var mı?
    🖥️ Sunucuda: yukarıdaki grep komutu

[ ] SSH başarısız giriş denemeleri sayıldı
    🖥️ Sunucuda: grep "Failed password" /var/log/auth.log | wc -l

[ ] Açık portlar kontrol edildi
    🖥️ Sunucuda: ss -tlnp

[ ] .env dosyaları git'e commit edilmemiş mi?
    🍎 Mac: git ls-files | grep "\.env$"
    🪟 Windows: git ls-files | Select-String "\.env$"

[ ] Son 30 gün içinde beklenmedik şifre sıfırlama var mı?
    🍎🪟 npx prisma db execute ile password_reset_logs kontrol et
```
