# 🚀 NB PDF Platform — Üretim Yayınlama Rehberi

Bu doküman global lansman için gereken tüm adımları, ortam değişkenlerini ve doğrulama kontrollerini içerir.

---

## 📋 Mimari

```
Cloudflare CDN / DNS
   │
   ├── pdfplatform.app ──────────→ Frontend (Render Static Site)
   ├── api.pdfplatform.app ──────→ Auth API (Render Node.js)
   └── pdf-api.pdfplatform.app ──→ PDF API (Render Python/FastAPI)
                                        │
                              S3 / Cloudflare R2 (sonuç deposu)
                              PostgreSQL (Render Managed / Neon)
                              Upstash Redis (kötüye kullanım takibi)
```

`render.yaml` üç servisi de Blueprint olarak tanımlar. Render Dashboard → **New → Blueprint** ile repoyu bağlayın.

---

## 🔑 Ortam Değişkenleri

### Auth API (`nb-auth-api`)

| Değişken | Zorunlu | Açıklama |
|----------|:-------:|----------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host/db?connection_limit=10&pool_timeout=30` |
| `JWT_ACCESS_SECRET` | ✅ | 64+ karakter rastgele. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | ✅ | Yukarıdakinden farklı 64+ karakter |
| `BILLING_ENCRYPTION_KEY` | ✅ | AES-256-GCM. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `IYZICO_API_KEY` | ✅ | iyzico üretim anahtarı (sandbox değil) |
| `IYZICO_SECRET_KEY` | ✅ | iyzico üretim secret |
| `IYZICO_URI` | ✅ | `https://api.iyzipay.com` |
| `EMAIL_USER` / `EMAIL_PASS` | ✅ | Gmail + uygulama şifresi |
| `ADMIN_EMAIL` / `ROLE_ADMIN_EMAIL` | ✅ | Yönetici e-postası |
| `FRONTEND_ORIGIN` | ✅ | `https://pdfplatform.app` |
| `APP_BASE_URL` | ✅ | `https://api.pdfplatform.app` |
| `PAYMENT_CALLBACK_BASE_URL` | ✅ | `https://api.pdfplatform.app` (iyzico callback erişebilmeli) |
| `OAUTH_FRONTEND_REDIRECT_ORIGIN` | ⚠️ | `https://pdfplatform.app` (Google OAuth kullanılıyorsa) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⚠️ | Google OAuth (boş = devre dışı) |
| `REDIS_URL` | ⚠️ | `rediss://...` Upstash (boş = bellek içi, deploy'da sıfırlanır) |
| `SENTRY_DSN` | ⚠️ | Hata izleme |
| `TRUST_PROXY` | ✅ | `1` (Render edge arkasında) |
| `FORCE_HTTPS` | ✅ | `true` |

### PDF API (`nb-pdf-api`)

| Değişken | Zorunlu | Açıklama |
|----------|:-------:|----------|
| `NB_SAAS_API_BASE` | ✅ | `https://api.pdfplatform.app` (entitlement çağrıları için) |
| `CORS_ORIGINS` | ✅ | `https://pdfplatform.app` |
| `ENVIRONMENT` | ✅ | `production` |
| `PDF_SANDBOX_ENABLED` | ✅ | `true` (subprocess izolasyonu) |
| `PDF_SANDBOX_MEM_MB` | — | `1024` (alt süreç RAM limiti) |
| `PDF_SANDBOX_CPU_SEC` | — | `120` (alt süreç CPU limiti) |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | ✅ | Sonuç deposu (S3 veya R2) |
| `S3_ENDPOINT` | ⚠️ | Cloudflare R2 için endpoint URL'i |
| `S3_REGION` | ⚠️ | `eu-central-1` (AWS) veya `auto` (R2) |
| `S3_RESULT_TTL_HOURS` | — | `24` (lifecycle ile otomatik silme) |
| `SENTRY_DSN` | ⚠️ | Hata izleme |
| `TRUSTED_HTTPS` | ✅ | `true` |

### Frontend (`nb-pdf-frontend`)

| Değişken | Zorunlu | Açıklama |
|----------|:-------:|----------|
| `VITE_API_BASE` | ✅ | `https://pdf-api.pdfplatform.app` |
| `VITE_SAAS_PROXY_TARGET` | ✅ | `https://api.pdfplatform.app` |
| `VITE_PUBLIC_SITE_URL` | ✅ | `https://pdfplatform.app` (canonical + hreflang) |
| `VITE_SENTRY_DSN` | ⚠️ | Frontend hata izleme |
| `VITE_GA_MEASUREMENT_ID` | ⚠️ | Google Analytics 4 (`G-XXXXXXXXXX`) |

---

## 🌐 Cloudflare CDN Kurulumu

1. **DNS:** `pdfplatform.app`, `api.`, `pdf-api.` CNAME kayıtlarını Render URL'lerine yönlendirin (Proxied 🟠).
2. **SSL/TLS:** Mod = **Full (strict)**.
3. **Caching:**
   - `/assets/*` → Cache Everything (1 yıl, içerik hash'li)
   - `/index.html`, `/api/*` → Bypass cache
4. **Security:** Bot Fight Mode açık, OWASP WAF kuralları aktif.
5. **Speed:** Brotli sıkıştırma, HTTP/3, Early Hints açık.

> `render.yaml` zaten doğru `Cache-Control` başlıklarını gönderir; Cloudflare bunlara saygı duyar.

---

## ✅ Lansman Öncesi Kontrol Listesi

### Güvenlik
- [ ] Tüm JWT/şifreleme anahtarları 64+ karakter, benzersiz, üretime özel
- [ ] `IYZICO_URI` = `https://api.iyzipay.com` (sandbox DEĞİL)
- [ ] `DATABASE_URL` PostgreSQL (SQLite değil) + `connection_limit`
- [ ] `CORS_ORIGINS` yalnızca üretim domain'ini içerir
- [ ] PDF sandbox aktif (`PDF_SANDBOX_ENABLED=true`)

### Veritabanı
- [ ] `npx prisma migrate deploy` çalıştı (build komutu otomatik yapar)
- [ ] `npm run prisma:seed` plan config'leri yükledi
- [ ] Yedekleme stratejisi aktif (Render Managed PG otomatik günlük yedek)

### SEO
- [ ] `VITE_PUBLIC_SITE_URL` ayarlı (canonical + hreflang doğru)
- [ ] `robots.txt` ve `sitemap.xml` üretildi (build sırasında otomatik)
- [ ] Google Search Console'a sitemap gönderildi
- [ ] OG/Twitter kartları test edildi (opengraph.xyz, cards-dev.twitter.com)

### Ödeme
- [ ] iyzico üretim hesabı onaylı
- [ ] Callback URL iyzico panelinde `https://api.pdfplatform.app/api/payments/callback`
- [ ] Test satın alma + iade akışı doğrulandı

### İzleme
- [ ] Sentry (3 servis: frontend + auth + pdf) bağlandı
- [ ] `/api/health` ve `/health` endpoint'leri 200 dönüyor
- [ ] Uptime izleme (Render Health Check + harici monitör)

---

## 🔍 Sağlık Kontrolü

```bash
# Auth API
curl https://api.pdfplatform.app/api/health
# → {"status":"ok",...}

# PDF API (kütüphane versiyonları + araç durumu)
curl https://pdf-api.pdfplatform.app/health
# → {"status":"ok","pdf_libraries":{...},"system_tools":{"wkhtmltopdf":true,...}}

# Frontend
curl -I https://pdfplatform.app
# → 200, Strict-Transport-Security başlığı mevcut
```

---

## 🔄 Graceful Shutdown

Her iki API servisi de `SIGTERM`/`SIGINT` sinyallerinde:
- Yeni bağlantı kabulünü durdurur
- Mevcut istekleri 10 saniye içinde tamamlamaya çalışır
- PDF işleme alt süreçleri temizlenir

Render deploy sırasında zero-downtime sağlamak için bu mekanizma gereklidir.

---

## 🆘 Rollback

Render Dashboard → Servis → **Manual Deploy** → önceki commit'i seçin.
Veritabanı migration'ları geriye dönük uyumludur (yalnızca additive ALTER).
Acil durumda: `prisma migrate resolve --rolled-back <migration_adı>`.
