# RB-01 — Site Tamamen Çöktü

> **Kritiklik:** 🔴 KRİTİK — Tüm kullanıcılar etkileniyor
> **Tipik çözüm süresi:** 5-30 dakika

> 💻 **Platform Notu:**
> Sunucu komutları (systemctl, nginx, journalctl vb.) SSH ile Linux sunucuda çalıştırılır.
> `ssh kullanici@SUNUCU_IP` komutu hem Windows Terminal hem Mac Terminal'de aynı çalışır.
> Aşağıda **yerel makinende** çalıştırman gereken komutlar 🍎 ve 🪟 ile ayrı gösterilmiştir.

---

## 🔍 Belirtiler

- `https://siteadın.com` açılmıyor (tarayıcıda "Bu siteye ulaşılamıyor")
- UptimeRobot alarm verdi
- Birden fazla kullanıcı "site çöktü" mesajı attı

---

## ✅ Adım 1: Gerçekten Site mi Düştü? (Yerel Makinenden)

```bash
# 🍎 Mac / Linux Terminal:
curl -s -o /dev/null -w "%{http_code}" https://siteadın.com/
# 200 geliyorsa site ayakta

# Sunucu IP'sine direkt bağlan (DNS bypass):
curl -s -o /dev/null -w "%{http_code}" https://SUNUCU_IP --insecure
# 200 → DNS sorunu | Bağlanamıyorsa → Sunucu sorunu
```

```powershell
# 🪟 Windows (PowerShell):
(Invoke-WebRequest -Uri "https://siteadin.com/" -UseBasicParsing).StatusCode
# 200 geliyorsa site ayakta

# Sunucu IP'sine direkt bağlan:
(Invoke-WebRequest -Uri "https://SUNUCU_IP/" -UseBasicParsing -SkipCertificateCheck).StatusCode
```

**Tarayıcı ile de kontrol:** https://downforeveryoneorjustme.com/siteadın.com adresini aç — başka ülkelerden test eder.

---

## ✅ Adım 2: DNS mi, Sunucu mu? (Yerel Makinenden)

```bash
# 🍎 Mac / Linux Terminal:
dig siteadın.com +short
# Sonuç sunucu IP'sine eşit olmalı

ping -c 3 siteadın.com
# Ping çalışıyor ama site açılmıyorsa → nginx sorunu
# Ping de çalışmıyorsa → Sunucu down veya firewall
```

```powershell
# 🪟 Windows (PowerShell):
nslookup siteadin.com
# Dönen IP sunucu IP'nle eşleşmeli

ping -n 3 siteadin.com
# Ping çalışıyor ama site açılmıyorsa → nginx sorunu
# Ping de çalışmıyorsa → Sunucu down veya firewall
```

---

## ✅ Adım 3: Sunucuya SSH ile Bağlan

```bash
# 🍎 Mac / Linux Terminal ve 🪟 Windows Terminal — AYNI KOMUT:
ssh kullanıcı@SUNUCU_IP

# Bağlanamıyorsan → Sunucu tamamen çökmüş
# → Hosting panelinizden (DigitalOcean, AWS, vb.) sunucuyu yeniden başlat
```

> Aşağıdaki tüm komutlar **SSH bağlantısı sonrası sunucuda** çalıştırılır.

---

## ✅ Adım 4: Sunucudaki Servisleri Kontrol Et

```bash
# Sunucuda (SSH ile):
systemctl status nginx
systemctl status nb-api
systemctl status nb-pdf-api
systemctl status postgresql

# Hızlı özet:
systemctl is-active nginx nb-api nb-pdf-api postgresql
# Hepsi "active" yazmalı

# Nginx çalışmıyorsa:
sudo systemctl start nginx
sudo nginx -t  # Konfigürasyon hatası var mı?
```

---

## ✅ Adım 5: Servisleri Sırayla Başlat

**Sıra önemli!** Önce veritabanı, sonra API'lar, sonra nginx.

```bash
# Sunucuda (SSH ile):

# 1. Veritabanı:
sudo systemctl start postgresql
sleep 3
sudo systemctl status postgresql

# 2. Node.js Auth API:
sudo systemctl start nb-api
sleep 3
journalctl -u nb-api -n 50 --no-pager

# 3. Python PDF API:
sudo systemctl start nb-pdf-api
sleep 3
journalctl -u nb-pdf-api -n 50 --no-pager

# 4. Nginx web sunucusu:
sudo nginx -t
sudo systemctl start nginx
```

---

## ✅ Adım 6: Doğrulama

```bash
# Sunucuda iç test:
curl -s http://localhost:4000/api/health
curl -s http://localhost:8000/
```

```bash
# 🍎 Mac / Linux — Dışarıdan test:
curl -s https://siteadın.com/api/health
```

```powershell
# 🪟 Windows — Dışarıdan test:
Invoke-WebRequest -Uri "https://siteadin.com/api/health" -UseBasicParsing | Select-Object StatusCode, Content
```

---

## 🚨 Yaygın Senaryolar ve Çözümleri

### Senaryo A: Nginx Başlamıyor
```bash
# Sunucuda:
sudo nginx -t
# Hata mesajını oku, düzelt:
sudo nano /etc/nginx/sites-available/nb-pdf-platform
sudo nginx -t && sudo systemctl start nginx
```

### Senaryo B: Node.js API Başlamıyor
```bash
# Sunucuda:
journalctl -u nb-api -n 100 --no-pager
# "port already in use" → 4000 portunu tutan process:
lsof -i :4000
kill -9 <PID>
sudo systemctl start nb-api
```

### Senaryo C: Disk Doldu
```bash
# Sunucuda:
df -h
find /tmp -name "nbpdf-*" -mmin +60 -exec rm -rf {} +
journalctl --vacuum-size=500M
sudo systemctl start nb-api
```

### Senaryo D: Veritabanı Başlamıyor
```bash
# Sunucuda:
sudo journalctl -u postgresql -n 50 --no-pager
# "could not write to file" → Disk sorunu → Senaryo C'yi uygula
```

### Senaryo E: Hosting Panelinden Sunucu Yeniden Başlatma
```
DigitalOcean için:
1. https://cloud.digitalocean.com → Droplets
2. Sunucunu seç → Power → Power Cycle
3. 2-3 dakika bekle
4. SSH ile bağlan, servisleri başlat
```

---

## 📝 Postmortem Kontrol Listesi

```
Tarih/Saat başlangıç:
Tarih/Saat çözüm:
Etkilenen kullanıcı sayısı (tahmini):
Kök neden:
Çözüm:
Önleyici aksiyon:
```

**Kök neden kategorileri:**
- [ ] Disk doldu
- [ ] Bellek tükendi
- [ ] Kötü deployment
- [ ] Sertifika sorunu
- [ ] Veritabanı sorunu
- [ ] Ağ/DNS sorunu
- [ ] Harici servis kesintisi
