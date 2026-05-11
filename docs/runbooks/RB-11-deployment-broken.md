# RB-11 — Kötü Deployment / Rollback

> **Kritiklik:** 🔴 KRİTİK — Yeni deploy sonrası site kırık
> **Tipik çözüm süresi:** 2-10 dakika
> **Altın kural:** "Eğer şüphelisin, geri al." Rollback her zaman daha hızlıdır.

---

## 🔍 Belirtiler

- Yeni deploy'dan sonra hata başladı
- Tüm kullanıcılar aynı hatayı görüyor
- "Internal Server Error" sayısı arttı
- TypeScript/Python başlatma hatası var

---

## ✅ Adım 1: Gerçekten Deploy Mı Bozdu?

```bash
# Son commit neydi?
git log --oneline -5

# Deploy zamanı ile hata başlangıcı örtüşüyor mu?
# Log'da ilk hata ne zaman çıktı:
grep '"level":"error"' /var/log/nb-pdf-platform/api.log | tail -5
# Zaman damgasına bak
```

---

## 🚨 HIZLI ROLLBACK (En Hızlı Yol)

```bash
# === ROLLBACK PROSEDÜRÜ ===

# 1. Önceki commit'e geri dön:
git log --oneline -10
# Hangi commit çalışıyordu? O commit hash'ini al (örn: abc1234)

git checkout abc1234  # Çalışan eski versiyona geç

# 2. Node.js API'yi yeniden build et:
cd web/api
npm run build

# 3. Servisi yeniden başlat:
sudo systemctl restart nb-api

# 4. Test et:
curl -s https://siteadın.com/api/health
# 200 gelmeli

# 5. Python PDF API değişti mi? (değiştiyse onu da rollback et)
cd web/backend
# Değişiklik varsa servisi yeniden başlat:
sudo systemctl restart nb-pdf-api

# 6. Ana branch'e geri dön (kod rollback EDERKEN branch değiştirir):
# Rollback'tan sonra main branch'te olman gerekiyor:
git checkout main  # ya da master
```

---

## ✅ Adım 2: Neden Bozuldu? (Acil Düzeltme Sonrası)

```bash
# Servis başlatma hatalarına bak:
journalctl -u nb-api -n 100 --no-pager | grep -E "error|Error|FATAL"
journalctl -u nb-pdf-api -n 100 --no-pager | grep -E "error|Error|FATAL"

# TypeScript derleme hatası mı?
cd web/api && npx tsc --noEmit 2>&1 | head -20

# Python syntax hatası mı?
cd web/backend && python -m py_compile app/main.py app/core/*.py 2>&1

# .env değişkeni eksik mi?
grep "missing\|undefined\|not found" /var/log/nb-pdf-platform/api.log | tail -10
```

---

## 🛠️ Güvenli Deployment Prosedürü (Gelecek İçin)

**Bu prosedürü her deploy'dan önce uygula:**

```bash
#!/bin/bash
# deploy.sh — Güvenli deployment scripti

set -e  # Herhangi bir hata olursa dur

echo "=== DEPLOY BAŞLIYOR ==="
echo "Zaman: $(date)"
echo "Son commit: $(git log --oneline -1)"

# 1. Çalışan kodu yedekle
echo "--- Yedekleniyor ---"
git stash 2>/dev/null || true
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Yedek commit: $CURRENT_COMMIT"

# 2. Yeni kodu çek
echo "--- Kod güncelleniyor ---"
git pull origin main

# 3. Derleme testleri
echo "--- TypeScript kontrolü ---"
cd web/api && npx tsc --noEmit
cd ..

echo "--- Python sözdizimi kontrolü ---"
cd web/backend && python -m py_compile app/main.py
cd ..

# 4. Bağımlılıkları yükle
echo "--- Bağımlılıklar yükleniyor ---"
cd web/api && npm ci --production
cd ..

# 5. Servisleri yeniden başlat
echo "--- Servisler yeniden başlatılıyor ---"
sudo systemctl restart nb-api
sleep 5

# 6. Health check
echo "--- Sağlık kontrolü ---"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health)
if [ "$HEALTH" != "200" ]; then
  echo "HATA: Health check başarısız! Rollback yapılıyor..."
  git checkout $CURRENT_COMMIT
  cd web/api && npm run build
  sudo systemctl restart nb-api
  echo "Rollback tamamlandı: $CURRENT_COMMIT"
  exit 1
fi

echo "=== DEPLOY BAŞARILI ==="
echo "Commit: $(git log --oneline -1)"
```

---

## 📋 Deploy Öncesi Kontrol Listesi

```
Deployment yapmadan önce:
[ ] TypeScript hatasız derleniyor: npm run build (web/api)
[ ] Python sözdizimi hatasız: py_compile
[ ] npm audit geçiyor: npm audit --audit-level=high
[ ] Veritabanı migration gerekiyor mu? (schema.prisma değişti mi?)
    → npx prisma migrate deploy (üretimde)
    → Bu GERİ ALINAMAZ! Dikkat!
[ ] .env değişkeni eklendi mi? (yeni env var varsa sunucuda da ekle)
[ ] Küçük trafik saatinde deploy yap (gece yarısı, sabah erken)
```

---

## 🔴 ASLA YAPMA LİSTESİ

```
✗ Doğrudan production'da kod düzenleme
✗ git push --force (main/master branch)
✗ npm install yerine npm ci yapmamak (version farklılıkları)
✗ Test etmeden .env değiştirme
✗ Yedek almadan veritabanı migration
✗ Birden fazla büyük değişikliği aynı anda deploy etme
✗ "Küçük değişiklik test etmeye gerek yok" diye düşünme
```

---

## 🎯 Deployment Sıklığı Önerisi

**MVP aşaması için:**
- Günde 1-2 deploy maksimum
- Cuma akşamı deploy YAPMA (hafta sonu sorun çözecek kimse yok)
- Büyük değişiklikler için: Pazartesi sabahı deploy et, gün boyunca izle
