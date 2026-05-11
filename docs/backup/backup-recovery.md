# Yedekleme ve Kurtarma Rehberi

> **Yedek (backup) olmadan çalışmak, hiç iplik olmadan dağcılık yapmak gibidir. Düşmeyeceğini umarsın — ta ki düşene kadar.**

> 💻 **Platform Notu:**
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda
> Yedek scriptleri ve restore işlemleri SSH ile Linux sunucuda çalıştırılır.
> Yerel makinenden sadece SSH bağlantısı kurulur — her iki platformdan SSH aynı çalışır.

---

## 🎯 Ne Yedeklenir?

| Veri | Önem | Ne Sıklıkla | Nerede? |
|------|------|-------------|---------|
| PostgreSQL veritabanı | 🔴 Kritik | Her gün | Uzak depolama |
| `.env` dosyaları | 🔴 Kritik | Değişince | Şifreli not defteri |
| Nginx konfigürasyonu | 🟠 Yüksek | Değişince | Git repo |
| SSL sertifikaları | 🟠 Yüksek | Otomatik (Let's Encrypt) | Certbot yönetir |
| Upload edilen medya | 🟡 Orta | Günlük | Uzak depolama |
| Sistem konfigürasyonu | 🟡 Orta | Değişince | Git repo |
| Result store | ⚪ Düşük | Yedekleme | 30 dk TTL, geçici |

**NOT:** Result store yedeklenmez — kullanıcılar işlemi yeniden yapabilir.

---

## 🗄️ Veritabanı Yedekleme Kurulumu

### Otomatik Günlük Yedek Script'i

```bash
# 🖥️ SSH ile sunucuda — /usr/local/bin/nb-backup-db.sh oluştur:

#!/bin/bash
set -e

BACKUP_DIR="/var/backups/nb-pdf-platform"
DB_NAME="nb_pdf_platform"
DB_USER="postgres"
RETENTION_DAYS=30  # 30 günden eski yedekler silinir

mkdir -p $BACKUP_DIR

FILENAME="db-$(date +%Y-%m-%d-%H%M).sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "[$(date)] Yedek başlıyor: $FILENAME"

# PostgreSQL dump + sıkıştırma:
pg_dump -U $DB_USER -d $DB_NAME | gzip > $FILEPATH

# Boyutu kontrol et (sıfır byte değil mi?):
SIZE=$(stat -c %s $FILEPATH)
if [ $SIZE -lt 1000 ]; then
  echo "[$(date)] HATA: Yedek çok küçük ($SIZE bytes) — bir şeyler yanlış!"
  rm -f $FILEPATH
  exit 1
fi

echo "[$(date)] Yedek tamamlandı: $FILEPATH ($SIZE bytes)"

# Eski yedekleri sil:
find $BACKUP_DIR -name "db-*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] $RETENTION_DAYS günden eski yedekler temizlendi"

# İsteğe bağlı: uzak sunucuya kopyala
# rsync -az $FILEPATH yedek-sunucu:/backups/

echo "[$(date)] Tamamlandı"
```

```bash
# 🖥️ SSH ile sunucuda — script'i etkinleştir:

# Script'i çalıştırılabilir yap:
chmod +x /usr/local/bin/nb-backup-db.sh

# Cron'a ekle (her gece 02:00):
crontab -e
# Ekle:
0 2 * * * /usr/local/bin/nb-backup-db.sh >> /var/log/nb-pdf-platform/backup.log 2>&1

# İlk çalıştırmayı test et:
sudo /usr/local/bin/nb-backup-db.sh
ls -lh /var/backups/nb-pdf-platform/
```

---

## ☁️ Uzak Depolamaya Yedek Gönderme

Sunucu çökerse yerel yedekler de kaybolur. Uzak depolama şart:

### Seçenek A: Backblaze B2 (En Ucuz)

```bash
# 🖥️ SSH ile sunucuda:
# B2 CLI kur:
pip install b2

# B2 hesabını ayarla:
b2 authorize-account <ApplicationKeyId> <ApplicationKey>

# Yedek scriptin sonuna ekle:
b2 upload-file your-bucket-name $FILEPATH "backups/$FILENAME"
echo "Uzak yükleme tamamlandı"
```

### Seçenek B: Başka Sunucuya rsync

```bash
# 🖥️ SSH ile sunucuda:
# SSH key oluştur (parolasız):
ssh-keygen -t ed25519 -f ~/.ssh/backup_key -N ""

# Uzak sunucuya key ekle:
ssh-copy-id -i ~/.ssh/backup_key.pub yedek_kullanici@YEDEK_SUNUCU_IP

# Yedek scripte ekle:
rsync -az --remove-source-files \
  -e "ssh -i ~/.ssh/backup_key" \
  $FILEPATH \
  yedek_kullanici@YEDEK_SUNUCU_IP:/backups/nb-pdf-platform/
```

### Seçenek C: S3 (AWS veya DigitalOcean Spaces)

```bash
# 🖥️ SSH ile sunucuda:
# AWS CLI kur ve ayarla:
pip install awscli
aws configure  # Access key, secret, region gir

# Yedek yükle:
aws s3 cp $FILEPATH s3://your-backup-bucket/db-backups/
```

---

## 🔄 Veritabanı Kurtarma (Restore)

### Tam Kurtarma (Disaster Recovery)

```bash
# 🖥️ SSH ile sunucuda:

# 1. Hangi yedek kullanılacak?
ls -lht /var/backups/nb-pdf-platform/ | head -10
# En güncel ve anlamlı boyutta olanı seç

# 2. Servisleri durdur:
sudo systemctl stop nb-api nb-pdf-api
echo "Servisler durduruldu"

# 3. Mevcut veritabanını yedekle (son çare):
pg_dump -U postgres nb_pdf_platform | \
  gzip > /tmp/emergency-backup-$(date +%Y%m%d-%H%M).sql.gz

# 4. Veritabanını sıfırla:
psql -U postgres -c "DROP DATABASE IF EXISTS nb_pdf_platform;"
psql -U postgres -c "CREATE DATABASE nb_pdf_platform;"

# 5. Yedeği geri yükle:
gunzip -c /var/backups/nb-pdf-platform/db-2024-01-15-0200.sql.gz | \
  psql -U postgres -d nb_pdf_platform

# 6. Kontrol:
psql -U postgres -d nb_pdf_platform -c "
SELECT 
  (SELECT COUNT(*) FROM users) as kullanici,
  (SELECT COUNT(*) FROM payment_checkouts) as odeme,
  (SELECT MAX(created_at) FROM users) as son_kayit;"

# 7. Servisleri başlat:
sudo systemctl start nb-api nb-pdf-api

# 8. Health check:
curl -f http://localhost:4000/api/health && echo "OK"
```

---

## 🧪 Restore Testi (Her Ay Yapılmalı)

```bash
# 🖥️ SSH ile sunucuda:

# Test için geçici veritabanı oluştur:
psql -U postgres -c "CREATE DATABASE nb_test_restore;"

# Son yedeği buraya yükle:
gunzip -c /var/backups/nb-pdf-platform/$(ls /var/backups/nb-pdf-platform/ | tail -1) | \
  psql -U postgres -d nb_test_restore

# Verileri kontrol et:
psql -U postgres -d nb_test_restore -c "
SELECT 
  (SELECT COUNT(*) FROM users) as kullanici_sayisi,
  (SELECT COUNT(*) FROM payment_checkouts WHERE status='completed') as tamamlanan_odeme;"

echo "Restore testi başarılı!"

# Test veritabanını sil:
psql -U postgres -c "DROP DATABASE nb_test_restore;"
```

---

## 🔐 .env Dosyaları Güvenli Saklama

`.env` dosyaları sunucunda şifrelenmiş olarak, ek olarak başka bir yerde güvenli kopyalanmış olmalı.

**Seçenek 1: Bitwarden (Kişisel kullanım için en iyi)**
- https://bitwarden.com — ücretsiz
- Tüm .env içeriğini "Secure Note" olarak ekle
- Her değişiklikte güncelle

**Seçenek 2: Şifreli dosya**

```bash
# 🍎 Mac / Linux:
# .env'i şifrele:
gpg --symmetric --cipher-algo AES256 web/api/.env
# Şifre sor — güçlü bir şifre kullan

# Şifreli dosya oluştu: web/api/.env.gpg
# Bu dosyayı güvenli bir yere koy (email eki, harici disk)

# Geri yüklemek için:
gpg --decrypt web/api/.env.gpg > web/api/.env
```

```powershell
# 🪟 Windows (PowerShell):
# GPG kurulu değilse https://gpg4win.org adresinden kur
# .env'i şifrele:
gpg --symmetric --cipher-algo AES256 web\api\.env

# Geri yüklemek için:
gpg --decrypt web\api\.env.gpg | Out-File -Encoding utf8 web\api\.env
```

---

## 📊 Yedek Sağlık Kontrol Listesi

Her hafta şunu kontrol et:

```bash
# 🖥️ SSH ile sunucuda:

# Son yedek ne zaman?
ls -lt /var/backups/nb-pdf-platform/ | head -3

# Son yedeğin boyutu mantıklı mı?
ls -lh /var/backups/nb-pdf-platform/ | tail -5

# Disk'te kaç günlük yedek var?
ls /var/backups/nb-pdf-platform/ | wc -l  # 30'a yakın olmalı

# Cron çalışıyor mu?
grep "nb-backup-db" /var/log/nb-pdf-platform/backup.log | tail -5
```

---

## 🆘 En Kötü Senaryo: Her Şey Gitti

**Sunucu çöktü, yerel yedek yok, sadece uzak yedek var:**

```bash
# 🖥️ Yeni sunucuda SSH ile:

# 1. Yeni sunucu kur (hosting panelinden)
# 2. SSH bağlantısı kur
# 3. Yazılımları yükle:
apt-get update && apt-get install -y postgresql nodejs nginx python3-pip git

# 4. Projeyi clone'la:
git clone https://github.com/seninrepo/nb-pdf-platform.git /var/www/nb-pdf-platform

# 5. Uzak yedekten veritabanını indir:
# (B2/S3/rsync'ten son yedeği çek)

# 6. Veritabanını kur ve restore et:
createdb -U postgres nb_pdf_platform
gunzip -c latest-backup.sql.gz | psql -U postgres nb_pdf_platform

# 7. .env dosyalarını Bitwarden/şifreli kopyadan geri yükle

# 8. npm ci ve build:
cd /var/www/nb-pdf-platform/web/api && npm ci && npm run build

# 9. Servisleri başlat

# Tahmini süre: 2-4 saat (iyi hazırlıkla)
```

> **Gerçekçi beklenti:** İyi hazırlıkla bile tam kurtarma 2-4 saat sürer. Bunu kabul et ve önceden planla.
