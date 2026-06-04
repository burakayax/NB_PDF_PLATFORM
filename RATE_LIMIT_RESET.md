# Rate Limit Reset Guide

Kullanıcılar çok fazla login denemesi yapıp 429 hatası alırsa, rate limit'i reset etmek için bu rehberi kullan.

## 📋 Rate Limit Kuralları

| Endpoint | Limit | Pencere |
|----------|-------|---------|
| `/api/auth/login` | 10 istek | 5 dakika |
| `/api/auth/register` | 10 istek | 5 dakika |
| `/api/auth/forgot-password` | 10 istek | 1 saat |
| `/api/auth/me` (DELETE) | 1 istek | 1 dakika |

**Key Format:**
- Login: `login:IP_ADDRESS` (ör: `login:192.168.1.100`)
- Forgot-Password: `forgot-password:IP_ADDRESS`
- Delete-Account: `delete-account:USER_ID:IP_ADDRESS`

---

## 🔧 Reset Yöntemleri

### **1️⃣ HEMEN - Bekle veya IP Değiştir**

**Hiç bir şey yapma, 5 dakika sonra tekrar dene:**
```
Gelen hata: "Çok fazla giriş denemesi. Lütfen 5 dakika sonra tekrar deneyin."
```

**VEYA VPN/Proxy ile IP değiştir** → Rate limit reset olur

---

### **2️⃣ Development - Server Restart**

Eğer development'ta MemoryStore kullanıyorsan:

```bash
# Server'ı kapat ve yeniden başlat
npm run dev
```

✅ Rate limit'ler otomatik sıfırlanır

---

### **3️⃣ CLI Script - Recommended** ⭐

**Standalone Script (Production-ready):**

```bash
# Specific IP'yi reset et
npx tsx web/api/scripts/reset-rate-limit.ts --ip=192.168.1.100

# TÜM rate limit'leri temizle
npx tsx web/api/scripts/reset-rate-limit.ts --all

# Hakkında yardım
npx tsx web/api/scripts/reset-rate-limit.ts
```

**Çıktı örneği:**
```
✅ Redis'e baglandı
🗑️  1 rate limit key'i siliniyor...
✅ 1 key silindi (login/forgot-password)
✅ Bağlanti kapatıldı
```

---

### **4️⃣ Redis CLI - Direct Reset**

Eğer Redis production'da çalışıyorsa:

```bash
# SSH veya Redis CLI'da:
redis-cli

# Tüm blocked IP'leri gör
KEYS "login:*"

# Specific IP'yi reset et
DEL "login:192.168.1.100"

# TÜM login rate limit'lerini temizle
EVAL "return redis.call('del', unpack(redis.call('keys', 'login:*')))" 0

# TÜM rate limit'leri temizle (⚠️ dikkat!)
FLUSHALL
```

---

### **5️⃣ Node.js Script - Manual**

`web/api/scripts/reset-rate-limit.ts` kodu:

```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

// Specific IP
await redis.del("login:192.168.1.100");

// All login limits
const keys = await redis.keys("login:*");
await redis.del(keys);

await redis.disconnect();
```

---

## 🚨 Troubleshooting

### **"Redis bulunamadi (REDIS_URL env var)"**

```bash
# Environment variable ekle
export REDIS_URL=redis://localhost:6379

# Veya .env dosyasında:
REDIS_URL=redis://localhost:6379

# Sonra script'i çalıştır
npx tsx web/api/scripts/reset-rate-limit.ts --ip=192.168.1.100
```

### **"Connection refused"**

```bash
# Redis'in çalıştığını kontrol et
redis-cli ping  # "PONG" dönmeli

# Eğer çalışmıyorsa başlat
redis-server

# Veya Docker'da
docker run -d -p 6379:6379 redis:latest
```

### **Script çalışmıyor**

```bash
# Bağlantıları kontrol et
redis-cli INFO server

# yarn/npm yeniden yükle
npm install

# Sonra tekrar dene
npx tsx web/api/scripts/reset-rate-limit.ts --all
```

---

## 📊 Monitoring

Rate limit'leri monitor etmek için:

```bash
# Redis'te active keys say
redis-cli DBSIZE

# Rate limit keys say
redis-cli KEYS "login:*" | wc -l

# TTL kontrolü (kalan zaman)
redis-cli TTL "login:192.168.1.100"
```

---

## 🔐 Best Practices

✅ **DO:**
- Kullanıcı rate limit için talepte bulunursa, ona VPN'le IP değiştirmesini söyle
- Spam/brute-force saldırısı varsa, IP'yi block et (`admin/blocked-emails` bölümü)
- Production'da daima Redis kullan (MemoryStore yalnız dev'te)

❌ **DON'T:**
- Kullanıcıya sık sık rate limit reset etme
- `--all` flag'ini production'da gerekmedikçe kullanma
- FLUSHALL Redis komutu (tüm cache'i temizler)

---

## 📞 Support

Rate limit problemleri için:
1. Kullanıcıya 5 dakika bekleme/VPN'i söyle
2. Spam mı diye kontrol et → gerçek spam ise IP'yi block et
3. CLI script ile reset et: `npx tsx web/api/scripts/reset-rate-limit.ts --ip=USER_IP`
