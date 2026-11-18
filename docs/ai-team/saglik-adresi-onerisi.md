# UptimeRobot adresleri ve sağlık adresi önerisi (öneri; kod değiştirilmedi)

## 1) Önce kontrol: eklediğiniz adresler doğru sunucuya mı bakıyor?
2026-11-18'de dışarıdan denendi:

| Adres | Yanıt | Anlamı |
|---|---|---|
| `https://api.pdfplatform.app/api/health` | `{"status":"ok",...}` 200 | **Doğru.** Giriş/ödeme sunucusu |
| `https://api.pdfplatform.app/api/health/db` | `{"status":"ok","db":"up"}` 200 | **Doğru.** Veritabanı bağlantısı |
| `https://pdfplatform.app/api/health` ve `/api/health/db` | **Site sayfası (HTML)** 200 | **YANLIŞ.** Statik site bu adrese her zaman 200 verir; sunucu çökse bile "ayakta" görünür |
| `https://pdfplatform.app` | Site 200 | Doğru (siteyi izler) |

**Yapmanız gereken:** UptimeRobot'ta `/api/health` ve `/api/health/db` adreslerinin başında `pdfplatform.app` mi yoksa `api.pdfplatform.app` mi yazdığına bakın. `api.` olmalı. Ek olarak her adreste **anahtar kelime kontrolü** açın (yanıtta `"status":"ok"` ve veritabanı adresinde `"db":"up"` geçmeli); bu, sayfa yanıtını yanlışlıkla "ayakta" saymayı engeller.

## 2) PDF işlem servisi ve Office dönüştürücü dışarıdan izlenebiliyor mu?
- **`nb-pdf-api`:** Evet. `https://nb-pdf-api.onrender.com/api/health` 200 ve `"status":"ok"` dönüyor. Bu adresi UptimeRobot'a ekleyin (anahtar kelime: `"status":"ok"`).
  - Not: Bu yanıt şu an kütüphane sürümlerini de açık yazıyor (örn. `pikepdf`, `pypdf`). Hassas değil ama saldırgana bilgi verir; sadeleştirilmesi önerilir.
- **`nb-gotenberg` (Office dönüştürücü):** **Hayır.** Özel (private) servis; dışarıdan adresi yok. `nb-pdf-api` onu ayrıca kontrol etmiyor, yani dönüştürücü çökerse **hiçbir izleme uyarmaz.** (Word/Excel dönüşümü bozulur ama site "yeşil" görünür.)

## 3) Öneri: derin sağlık adresi (yeni, küçük)
`nb-pdf-api` üzerinde yeni bir adres: `GET /api/health/deps`

- Döndürmesi gereken (hassas bilgi yok):
  `{"status":"ok","gotenberg":"up"}` ya da gotenberg erişilemezse `503` + `{"status":"degraded","gotenberg":"down"}`
- Kontrol: `nb-gotenberg`'in kendi sağlık adresine 2 saniyelik zaman aşımıyla iç ağdan istek.
- Dönmeyecekler: sürüm numaraları, iç adresler, anahtarlar, hata ayrıntısı.
- Mevcut `/api/health` kalır (hafif); yeni adres ayrı, çünkü gotenberg kapalıyken tüm PDF servisini "çöktü" saymak istemeyiz.
- UptimeRobot: bu adresi 5 dakikada bir izleyin; `503` ya da `"gotenberg":"down"` yazınca e-posta gelsin.

**Uygulama (onay bekliyor):** Python tarafında küçük bir ekleme (`web/backend/app/api/routes.py`), kritik dosya değil, şema değişmez, yeni test ile. İsterseniz aynı PR'da `/api/health` yanıtındaki kütüphane sürümlerini de sadeleştiririm.

## 4) UptimeRobot için önerilen son liste
| Ad | Adres | Kontrol |
|---|---|---|
| Site | `https://pdfplatform.app` | HTTP 200 |
| Giriş/ödeme sunucusu | `https://api.pdfplatform.app/api/health` | `"status":"ok"` kelimesi |
| Veritabanı | `https://api.pdfplatform.app/api/health/db` | `"db":"up"` kelimesi |
| PDF servisi | `https://nb-pdf-api.onrender.com/api/health` | `"status":"ok"` kelimesi |
| Dönüştürücü (yeni adres hazır olunca) | `https://nb-pdf-api.onrender.com/api/health/deps` | `"gotenberg":"up"` kelimesi |
