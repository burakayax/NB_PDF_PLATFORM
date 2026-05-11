# Deployment Rehberi — Üretim'e Nasıl Kod Gönderilir?

> **Deployment nedir?** Yazdığın kodun gerçek kullanıcılara açık sunucuya aktarılması. En riskli operasyon budur — her şey bu anda kırılabilir.

> 💻 **Platform Notu:**
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda
> Deploy öncesi hazırlık yerel makinenden yapılır. Sunucu işlemleri SSH ile bağlanarak yapılır.
> `npm`, `git`, `npx` komutları her iki platformda aynı çalışır.

---

## 🏗️ Deployment Mimarisi

```
Geliştirme Ortamı              Üretim Ortamı
(Senin bilgisayarın)           (Sunucu)
─────────────────────          ─────────────────────
                               
  Kod yaz                      Nginx (80/443)
     ↓                              ↓
  Test et (local)          ┌────────┴─────────┐
     ↓                     ↓                  ↓
  git commit          Auth API           PDF API
     ↓                (Node:4000)      (Python:8000)
  git push                 ↓                  ↓
     ↓               PostgreSQL         Result Store
  Sunucu'da pull           ↓
     ↓               File Storage
  Build + Restart          (uploads/)
```

---

## 🔄 Deployment Prosedürü (Adım Adım)

### 1. Deploy Öncesi Hazırlık (Yerel Makineden — Her İki Platformda Aynı)

```bash
# 🍎 Mac / Linux ve 🪟 Windows — AYNI KOMUTLAR (npm, npx, git her yerde çalışır):

# TypeScript hatasız mı?
cd web/api && npx tsc --noEmit
# Çıktı boş olmalı (hata yoksa)

# Frontend build çalışıyor mu?
cd web/frontend && npm run build
# "build complete" görmeli

# Python hatasız mı?
cd web/backend && python -m py_compile app/main.py
# Hata çıkmamalı

# Güvenlik taraması:
cd web/api && npm audit --audit-level=high
cd web/frontend && npm audit --audit-level=high
# "found 0 vulnerabilities" görmeli

# Schema değişti mi? (varsa özel dikkat gerekir)
git diff HEAD~1 web/api/prisma/schema.prisma
# Değişiklik varsa → migration planla!
```

### 2. Veritabanı Migration (Varsa)

> **Migration nedir?** Veritabanı şemasındaki değişikliği uygulamak. Örneğin yeni tablo eklemek, sütun eklemek. BU GERİ ALINAMAZ — dikkatli ol!

```bash
# 🖥️ SSH ile sunucuda — önce yedek al:
pg_dump -U postgres your_db_name | gzip > /var/backups/before-migration-$(date +%Y%m%d-%H%M).sql.gz

# Migration'ı uygula (npx her iki platformda da aynı çalışır):
npx prisma migrate deploy
```

### 3. Sunucuya Bağlan ve Deploy Et

```bash
# 🍎 Mac / Linux veya 🪟 Windows — SSH bağlantısı (ikisinde de aynı):
ssh kullanıcı@SUNUCU_IP
```

```bash
# 🖥️ SSH ile sunucuda — aşağıdaki adımları sırayla uygula:

# Proje dizinine git:
cd /var/www/nb-pdf-platform  # veya projenin olduğu yer

# Bakım modu aç (kullanıcılara "bakım var" göster):
sudo ln -sf /etc/nginx/sites-available/maintenance /etc/nginx/sites-enabled/default
sudo nginx -s reload
echo "Bakım modu açıldı"

# Yeni kodu çek:
git fetch origin
git pull origin main

# Node.js bağımlılıklarını güncelle:
cd web/api
npm ci  # install değil, ci! (kesin sürüm kullanır)
npm run build  # TypeScript derle

# Python bağımlılıkları (değiştiyse):
cd ../backend
source ../.venv/bin/activate
pip install -r requirements.txt --quiet

# Servisleri yeniden başlat:
sudo systemctl restart nb-api
sleep 5  # Başlaması için bekle
sudo systemctl restart nb-pdf-api
sleep 5

# Health check:
curl -f http://localhost:4000/api/health && echo "Auth API OK" || echo "Auth API HATA!"
curl -f http://localhost:8000/ && echo "PDF API OK" || echo "PDF API HATA!"

# Sorun yoksa bakım modunu kapat:
sudo ln -sf /etc/nginx/sites-available/nb-pdf-platform /etc/nginx/sites-enabled/default
sudo nginx -s reload
echo "Deploy tamamlandı!"
```

---

## 🛡️ Bakım Modu (Maintenance Mode)

Nginx'te bakım modu için sayfa:

```nginx
# 🖥️ Sunucuda — /etc/nginx/sites-available/maintenance

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl;
    
    ssl_certificate /etc/letsencrypt/live/siteadın.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/siteadın.com/privkey.pem;
    
    location / {
        return 503;
    }
    
    error_page 503 /maintenance.html;
    
    location = /maintenance.html {
        root /var/www/html;
        internal;
    }
    
    # Health check her zaman erişilebilir:
    location /api/health {
        return 200 '{"status":"maintenance","message":"Bakım modu aktif"}';
        add_header Content-Type application/json;
    }
}
```

```html
<!-- /var/www/html/maintenance.html -->
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Bakım Modu — PDF PLATFORM</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .box { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: auto; }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="box">
        <h1>🔧 Bakım Çalışması</h1>
        <p>Sistemimizi güncelliyoruz. Kısa süre içinde geri döneceğiz.</p>
        <p>Rahatsızlık için özür dileriz.</p>
    </div>
</body>
</html>
```

---

## 🔙 Rollback Prosedürü

```bash
# 🖥️ SSH ile sunucuda:

# Önceki versiyona hızlı geri dön:

# Önceki çalışan commit neydi?
git log --oneline -5

# O commit'e geri dön:
git checkout <eski-commit-hash>

# Ya da son tag'e (sürüm):
git checkout v1.2.3

# Build et:
cd web/api && npm run build

# Servisleri yeniden başlat:
sudo systemctl restart nb-api nb-pdf-api

# Test:
curl -f http://localhost:4000/api/health
```

---

## 🌍 Ortam Yönetimi

### Development (Geliştirme)
```
web/api/.env            → NODE_ENV=development, SQLite
web/backend/.env        → CORS_ORIGINS=http://localhost:5173
web/frontend/.env       → VITE_API_BASE=http://localhost:8000
```

### Production (Üretim)
```
web/api/.env            → NODE_ENV=production, PostgreSQL, IYZICO gerçek
web/backend/.env        → CORS_ORIGINS=https://siteadın.com
web/frontend/.env       → VITE_API_BASE=https://siteadın.com
```

**Kritik üretim farkları (yerel makinenden kontrol):**

```bash
# 🍎 Mac / Linux:
grep "NODE_ENV" web/api/.env          # production
grep "DATABASE_URL" web/api/.env       # postgresql:// (sqlite değil!)
grep "IYZICO_URI" web/api/.env         # https://api.iyzipay.com (sandbox değil!)
grep "FRONTEND_ORIGIN" web/api/.env   # https://siteadın.com (localhost değil!)
```

```powershell
# 🪟 Windows (PowerShell):
Select-String "NODE_ENV" web\api\.env
Select-String "DATABASE_URL" web\api\.env
Select-String "IYZICO_URI" web\api\.env
Select-String "FRONTEND_ORIGIN" web\api\.env
```

---

## 📋 Deploy Kontrol Listesi

```
DEPLOY ÖNCESİ (Yerel Makineden):
[ ] TypeScript hatasız derliyor (npx tsc --noEmit)
[ ] Frontend build başarılı (npm run build)
[ ] Python hatasız (python -m py_compile)
[ ] npm audit geçiyor
[ ] Schema değişikliği var mı? (Yedek al!)
[ ] .env değişkeni eklendi mi? (Sunucuda da ekle!)
[ ] Düşük trafik saati mi? (Gece, sabah erken)

DEPLOY SIRASINDA (SSH ile Sunucuda):
[ ] Bakım modu açıldı
[ ] Veritabanı yedeği alındı (migration varsa)
[ ] git pull başarılı
[ ] npm ci başarılı
[ ] Build başarılı
[ ] Servisler başladı (systemctl status)
[ ] Health check 200 döndü

DEPLOY SONRASI (Yerel Makineden veya Tarayıcıdan):
[ ] Bakım modu kapatıldı
[ ] Tarayıcıdan test edildi (gizli pencere)
[ ] Ödeme akışı test edildi
[ ] PDF işleme test edildi
[ ] 10 dakika loglar izlendi (hata artışı var mı?)
[ ] UptimeRobot alarm göndermedi
```
