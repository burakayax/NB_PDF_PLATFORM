# RB-08: SSL Sertifikası Sona Erdi

**Belirti:** Kullanıcılar "Bağlantınız güvenli değil" / "NET::ERR_CERT_DATE_INVALID" hatası görüyor. Site açılmıyor.

**Etki:** Tüm kullanıcılar siteye erişemiyor. Ödemeler durdu. Güven zedelendi.

---

## Adım 1: Durumu Doğrula

```bash
# Sertifika ne zaman bitiyor?
echo | openssl s_client -connect siteadin.com:443 2>/dev/null | \
  openssl x509 -noout -enddate
# Geçmiş tarih varsa → Sona ermiş

# Certbot sertifika durumu:
certbot certificates
# "INVALID" veya geçmiş tarih → Sorun
```

---

## Adım 2: Acil Yenileme

```bash
# Nginx durdurarak yenile (port 80 gerekli):
systemctl stop nginx

certbot renew --standalone

# Nginx başlat:
systemctl start nginx

# Kontrol:
echo | openssl s_client -connect siteadin.com:443 2>/dev/null | \
  openssl x509 -noout -enddate
# Gelecek tarih olmalı (90 gün sonrası)
```

**Nginx webroot ile yenileme:**

```bash
# Nginx durdurma gerekmez:
certbot renew --webroot -w /var/www/html

# Ya da:
certbot renew --nginx

# Sonra nginx reload:
nginx -t && nginx -s reload
```

---

## Adım 3: Neden Otomatik Yenilenmedi?

```bash
# Certbot timer çalışıyor mu?
systemctl status certbot.timer
systemctl status certbot

# Timer yoksa:
systemctl enable certbot.timer
systemctl start certbot.timer

# Alternatif: cron ile yenileme:
crontab -l | grep certbot
# Yoksa ekle:
crontab -e
# Şu satırı ekle:
0 3 * * * certbot renew --quiet --post-hook "nginx -s reload"
```

```bash
# Otomatik yenileme log:
journalctl -u certbot --since "30 days ago" | tail -30
# Hata mesajı var mı?
```

### Sık Görülen Otomatik Yenileme Hataları

**Hata: Port 80 kapalı**
```bash
sudo ufw allow 80/tcp
certbot renew
```

**Hata: DNS çözümlenemiyor**
```bash
nslookup siteadin.com
# Domain IP'sini çözüyor mu?
dig siteadin.com A
```

**Hata: Rate limit (çok fazla sertifika isteği)**
```bash
# Let's Encrypt haftada 5 yeni sertifikaya izin verir
# Mevcut sertifikayı yenile (yeni oluşturma):
certbot renew --force-renewal
```

---

## Adım 4: Yenileme Başarısız Olursa

### Geçici Self-Signed Sertifika (son çare)

```bash
# Self-signed sertifika oluştur (tarayıcı uyarısı verir ama HTTPS çalışır):
openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
  -keyout /etc/ssl/private/temp.key \
  -out /etc/ssl/certs/temp.crt \
  -subj "/CN=siteadin.com"

# Nginx'te geçici olarak kullan:
# ssl_certificate /etc/ssl/certs/temp.crt;
# ssl_certificate_key /etc/ssl/private/temp.key;

nginx -t && nginx -s reload
```

**Kullanıcılara duyur:** Site geçici olarak güvenlik uyarısı veriyor, güvenli, yakında düzelecek.

---

## Adım 5: Kalıcı Önlem

```bash
# Otomatik yenileme test et (her 3 ayda bir):
certbot renew --dry-run
# "Congratulations" mesajı görmeli

# Sertifika bitiş tarihi alarmı kur:
# /usr/local/bin/nb-health-check.sh içine:
DAYS_LEFT=$(echo | openssl s_client -connect siteadin.com:443 2>/dev/null | \
  openssl x509 -noout -enddate | \
  awk -F= '{print $2}' | \
  xargs -I{} date -d "{}" +%s | \
  xargs -I{} bash -c 'echo $(( ($1 - $(date +%s)) / 86400 ))' -- {})
[ "$DAYS_LEFT" -lt 14 ] && send_alert "⚠️ SSL sertifikası $DAYS_LEFT gün içinde bitiyor!"
```
