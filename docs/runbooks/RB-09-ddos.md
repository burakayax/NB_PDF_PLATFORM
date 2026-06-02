# RB-09: DDoS / Bot Saldırısı

**Belirti:** Nginx log'larında tek veya birkaç IP'den saniyede yüzlerce istek. CPU %90+. Gerçek kullanıcılar 503 alıyor.

**Etki:** Site yavaşlıyor veya tamamen erişilemez hale geliyor.

---

## Adım 1: Saldırıyı Doğrula

```bash
# Tek IP'den çok istek var mı? (son 5 dakika):
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20
# Bir IP'den 500+ istek → Kesin saldırı

# Hangi URL'lere istek geliyor?
grep "SALDIRGAN_IP" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -10
```

---

## Adım 2: Saldırgan IP'yi Engelle

```bash
# Tek IP engelle:
sudo ufw deny from SALDIRGAN_IP

# Birden fazla IP:
sudo ufw deny from 192.168.1.0/24  # Subnet

# Kontrol:
sudo ufw status | grep DENY

# nginx'te de engelle (daha hızlı):
# /etc/nginx/sites-available/nb-pdf-platform içine ekle:
# deny SALDIRGAN_IP;
nginx -t && nginx -s reload
```

---

## Adım 3: Rate Limiting Sıkılaştır (Nginx)

```nginx
# /etc/nginx/nginx.conf içine http{} bloğuna ekle:
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=pdf:10m rate=10r/m;

# /etc/nginx/sites-available/nb-pdf-platform içinde:
location /api/ {
    limit_req zone=general burst=10 nodelay;
    limit_req_status 429;
    proxy_pass http://localhost:4000;
}

location /api/pdf/ {
    limit_req zone=pdf burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://localhost:8000;
}
```

```bash
nginx -t && nginx -s reload
```

---

## Adım 4: Bot Trafiğini Filtrele

```bash
# User-agent bazlı engelleme (nginx):
# Bot'ların genellikle belirgin user-agent'ları var:
grep "SALDIRGAN_IP" /var/log/nginx/access.log | awk -F'"' '{print $6}' | sort | uniq -c
# "python-requests", "curl/7.68", "Go-http-client" gibi şüpheli ajanlar

# Nginx'te engelle:
# map $http_user_agent $blocked_agent {
#     default 0;
#     ~*python-requests 1;
#     ~*Go-http-client 1;
# }
# if ($blocked_agent) { return 403; }
```

---

## Adım 5: Cloudflare ile Koruma (Öneri)

Eğer Cloudflare kullanmıyorsan, şimdi geçmeyi düşün:

```
1. cloudflare.com → Ücretsiz plan
2. Domain'i Cloudflare'e ekle
3. DNS kayıtlarını Cloudflare'e taşı
4. "Under Attack" modunu etkinleştir (saldırı sırasında)
5. DDoS saldırıları otomatik filtrelenecek
```

**Cloudflare "Under Attack" modu:**
```
Dashboard → siteadin.com → Security → Security Level → "Under Attack"
→ Her ziyaretçi 5 saniyelik challenge görür
→ Botlar geçemez, gerçek kullanıcılar geçer
```

---

## Adım 6: Saldırı Geçtikten Sonra

```bash
# UFW kurallarını temizle (geçici engeller):
sudo ufw status numbered
sudo ufw delete NUMARA  # Geçici kuralları kaldır

# Nginx rate limit kalıcı bırak
# Log analizi yap:
grep "$(date +%Y-%m-%d)" /var/log/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn > /tmp/saldiri-raporu.txt
cat /tmp/saldiri-raporu.txt | head -20

# Saldırı raporunu kaydet (gelecekte referans için)
```

---

## Önlem: Rate Limiting Zaten Aktif mi?

NB PDF Platform içinde express-rate-limit kullanılıyor. Nginx seviyesinde ek koruma için yukarıdaki konfigürasyonu ekle.

```bash
# Mevcut rate limit ayarlarını kontrol et:
grep -r "rateLimit\|limit(" web/api/src/ --include="*.ts" | grep -v node_modules
```
