# Otomatik Fatura Sistemi — Adım Adım Nasıl Çalışır?

> **Bu belge kimin için:** Fatura sistemini ilk kez anlayan, "ödeme gelince ne oluyor,
> fatura nasıl kesiliyor" sorusunu sormak isteyen geliştirici için yazıldı.
> Kodu çalıştırmadan önce bu belgeyi oku.

---

## Terminoloji Sözlüğü

| Terim | Açıklama |
|-------|----------|
| **Provider** | Fatura kesen servis (Paraşüt, BirFatura, vs.). Adapter pattern sayesinde kod değişmeden servis değişebilir. |
| **Adapter Pattern** | "Aynı arayüz, farklı uygulama" tasarım deseni. `BILLING_PROVIDER=parasut` yazınca tüm sistem Paraşüt'e geçer. |
| **e-Arşiv** | Bireysel müşterilere kesilen elektronik fatura. GİB'e bildirilir, müşteriye e-posta gider. |
| **e-Fatura** | Vergi mükellefi şirketlere kesilen elektronik fatura. e-Arşiv'den farklı bir kanal kullanır. |
| **Webhook** | iyzico'nun ödeme tamamlanınca sizin sunucunuza gönderdiği HTTP POST isteği. |
| **Pull Model** | BirFatura'nın kullandığı mimari: BirFatura sizin endpoint'lerinizi çağırır, veriyi kendisi çeker. |
| **Push Model** | Paraşüt'ün kullandığı mimari: Siz Paraşüt API'sini çağırır, veriyi kendiniz gönderirsiniz. |
| **InvoiceResult** | Fatura akışının sonucunu tutan veri yapısı: ID, numara, PDF linki, hata mesajı. |
| **full_invoice_flow** | Tek çağrıyla tüm adımları (müşteri bul/oluştur → fatura oluştur → yayımla → PDF al) çalıştıran orkestratör metot. |

---

## Büyük Resim: Sistem Mimarisi

```
KULLANICI
    │
    │  1. "Satın Al" → iyzico ödeme formu
    ▼
iYZİCO
    │
    │  2. Ödeme başarılı → POST /webhooks/iyzico
    ▼
WEBHOOK HANDLER  (billing/webhook_handler.py)
    │
    │  3. Payload doğrula, müşteri + sepet verisini çıkar
    ▼
BILLING MANAGER  (billing/manager.py)
    │
    │  4. BILLING_PROVIDER env'e bak → doğru provider'ı döndür
    ▼
PROVIDER (parasut.py / birfatura.py / mock.py)
    │
    │  5. full_invoice_flow() çalışır
    │     ├─ find_or_create_customer()
    │     ├─ create_invoice()
    │     ├─ publish_invoice()
    │     └─ get_invoice_pdf_url()
    ▼
EMAIL SERVICE  (billing/email_service.py)
    │
    │  6. PDF indir, e-posta oluştur, müşteriye gönder
    ▼
MÜŞTERİ    ← fatura PDF'i e-postada
```

---

## Dosya Yapısı

```
web/backend/app/billing/
├── __init__.py          # Dışarıya açılan public API
├── models.py            # Veri yapıları (dataclass'lar)
├── base.py              # Soyut arayüz — tüm provider'lar bunu uygular
├── mock.py              # Geliştirme provider'ı — gerçek API çağrısı yapmaz
├── parasut.py           # Paraşüt V4 entegrasyonu (push modeli)
├── birfatura.py         # BirFatura entegrasyonu (pull modeli) + FastAPI router
├── manager.py           # Factory: env'e göre doğru provider'ı döndürür
├── email_service.py     # Fatura PDF'ini e-posta ile gönderir
└── webhook_handler.py   # iyzico webhook'unu işler

web/backend/tests/billing/
├── test_mock_provider.py       # Mock provider tam akış testleri
├── test_webhook_handler.py     # iyzico webhook senaryoları
├── test_email_service.py       # E-posta gönderim testleri
└── test_birfatura_provider.py  # BirFatura endpoint + callback testleri
```

---

## Veri Modelleri (models.py)

Sistemdeki tüm servisler bu 4 veri yapısını konuşur. Provider değişse bile
bu yapılar değişmez.

```python
@dataclass
class CustomerInfo:
    name: str           # "Ahmet Yılmaz"
    email: str          # "ahmet@example.com"
    phone: str | None
    tax_number: str | None   # Şirket vergi no (10 hane)
    national_id: str | None  # TC kimlik no (11 hane)
    tax_office: str | None   # "Kadıköy"
    address: str | None
    city: str | None
    country: str = "Turkey"
    contact_type: str = "person"  # "person" veya "company"

@dataclass
class InvoiceItem:
    name: str           # "Pro Plan Aboneliği"
    quantity: float     # 1.0
    unit_price: float   # KDV HARİÇ fiyat: 83.33
    vat_rate: int       # 20 (Türkiye 2024 KDV oranları: 0, 10, 20)
    description: str | None
    unit: str = "Adet"

@dataclass
class PaymentInfo:
    payment_id: str     # iyzico ödeme ID: "12345678"
    amount_paid: float  # KDV dahil toplam: 100.00
    currency: str = "TRL"
    payment_date: str   # "2026-05-13"

@dataclass
class InvoiceResult:
    success: bool
    invoice_id: str | None      # Provider'daki dahili ID
    invoice_number: str | None  # "E-ARŞ-2026-00042"
    pdf_url: str | None         # İndirilebilir PDF linki
    e_document_type: str | None # "e_archive" | "e_invoice"
    issued_at: str | None       # "2026-05-13"
    error: str | None           # Hata varsa açıklaması
```

---

## Provider Adapter Pattern — Neden Önemli?

Şu anda iki gerçek provider var: Paraşüt ve BirFatura. Yarın farklı bir
servis gerekirse tek yapman gereken:

1. `billing/yeni_servis.py` dosyası oluştur, `BillingProviderBase`'i uygula
2. `manager.py`'e bir `elif` satırı ekle
3. `.env`'de `BILLING_PROVIDER=yeni_servis` yaz

**Webhook handler, email service, testler hiç değişmez.**

```python
# base.py — her provider bu 5 metodu uygulamak zorunda
class BillingProviderBase(ABC):
    def find_or_create_customer(self, customer_info: CustomerInfo) -> str: ...
    def create_invoice(self, customer_id, items, payment_info) -> InvoiceResult: ...
    def publish_invoice(self, invoice_id: str) -> InvoiceResult: ...
    def get_invoice_pdf_url(self, invoice_id: str) -> str: ...
    def cancel_invoice(self, invoice_id: str) -> bool: ...
    # full_invoice_flow() yukarıdakileri sırayla çağırır; override etmene gerek yok
```

---

## Provider Karşılaştırması

| Özellik | Mock | Paraşüt | BirFatura |
|---------|------|---------|-----------|
| Gerçek API çağrısı | Hayır | Evet | Hayır\* |
| Mimari | — | Push (siz çağırırsınız) | Pull (BirFatura çağırır) |
| Senkron mu? | Evet | Evet | Hayır (callback bekler) |
| Kurulum | Sıfır | OAuth2 + şirket ID | Token + public URL |
| Ne zaman kullan | Geliştirme/test | Üretim (Paraşüt aboneniz varsa) | Üretim (BirFatura aboneniz varsa) |

\* BirFatura sizin endpoint'lerinizi çağırır, siz BirFatura'yı değil.

---

## 1. MOCK PROVIDER — Geliştirme Ortamı

Mock provider gerçek hiçbir API çağrısı yapmaz. Loglar basar, sahte veri
döner. `.env` ayarı gerekmez.

```bash
# .env
BILLING_PROVIDER=mock
```

```python
# Kod içinde nasıl çalıştığını görüntüle
import logging
logging.basicConfig(level=logging.DEBUG)

from app.billing import get_provider
from app.billing.models import CustomerInfo, InvoiceItem, PaymentInfo

provider = get_provider()  # MockProvider döner

result = provider.full_invoice_flow(
    customer_info=CustomerInfo(
        name="Test Kullanıcı",
        email="test@example.com",
    ),
    items=[
        InvoiceItem(name="Pro Plan", quantity=1, unit_price=83.33, vat_rate=20)
    ],
    payment_info=PaymentInfo(
        payment_id="PAY-TEST-001",
        amount_paid=100.0,
        payment_date="2026-05-13",
    ),
)

print(result.success)       # True
print(result.invoice_number) # "MOCK-20260513-A1B2C3"
print(result.pdf_url)        # "https://mock-pdf-url/invoice-<uuid>.pdf"
```

Logda şunu görürsün:

```
[MOCK] Creating customer: Test Kullanıcı (test@example.com) → id=<uuid>
[MOCK] Creating invoice for customer_id=<uuid> → invoice_id=<uuid>
[MOCK] Publishing invoice: <uuid>
[MOCK] Invoice PDF URL: https://mock-pdf-url/invoice-<uuid>.pdf
[MOCK] Full flow complete — invoice_id=... number=... pdf=...
```

---

## 2. PARAŞÜT PROVIDER — Push Modeli

Paraşüt'ün çalışma mantığı:

```
Senin kodun                     Paraşüt API
     │                               │
     │── GET /contacts?email=... ──►│  (müşteri var mı?)
     │◄── [{id: "123", ...}] ───────│
     │                               │
     │── POST /sales_invoices ─────►│  (fatura oluştur)
     │◄── {id: "456", ...} ─────────│
     │                               │
     │── POST /e_archives ─────────►│  (e-arşiv yayımla)
     │◄── {id: "789", ...} ─────────│
     │                               │
     │── GET /e_archives/789/pdf ──►│  (PDF hazır mı?)
     │◄── {url: "https://..."} ─────│
```

```bash
# .env
BILLING_PROVIDER=parasut
PARASUT_CLIENT_ID=your-client-id
PARASUT_CLIENT_SECRET=your-client-secret
PARASUT_USERNAME=your@email.com
PARASUT_PASSWORD=your-password
PARASUT_COMPANY_ID=123456
```

**Token otomatik yönetilir:** Token süresi dolmadan 60 saniye önce otomatik
yenilenir. Her API çağrısından önce geçerlilik kontrol edilir.

**Retry mantığı:** Ağ hatalarında 3 deneme yapılır (1s, 2s, 4s bekleme).
`tenacity` kütüphanesi kullanılır.

**e-Fatura mı, e-Arşiv mi?** Paraşüt provider müşterinin vergi numarasını
otomatik kontrol eder. Şirket vergi numarası GİB e-fatura sisteminde kayıtlıysa
e-fatura, değilse e-arşiv kesilir.

---

## 3. BİRFATURA PROVIDER — Pull Modeli (Önemli Fark!)

BirFatura diğer provider'lardan **mimari olarak farklı** çalışır.

### Nasıl Çalışır?

```
Senin sunucun                   BirFatura Sunucusu
     │                               │
     │◄── POST /api/birfatura/orders/ ── │  (BirFatura bekleyen siparişleri çeker)
     │──►  [{OrderId, items, ...}] ──────│
     │                               │
     │  [BirFatura fatura keser, GİB'e gönderir]
     │                               │
     │◄── POST /api/birfatura/invoiceLinkUpdate/ ─│  (fatura hazır, al!)
     │──► {"success": true}  ─────────────────────│
```

### Aktivasyon

**Adım 1 — `main.py`'de router'ı aç:**

```python
# web/backend/app/main.py
from app.billing.birfatura import birfatura_router
app.include_router(birfatura_router, prefix="/api/birfatura")
```

**Adım 2 — `.env` ayarları:**

```bash
BILLING_PROVIDER=birfatura
BIRFATURA_API_TOKEN=oluşturduğun-guid-örn-a1b2c3d4-e5f6-...
BIRFATURA_POLL_TIMEOUT_SEC=600   # 10 dakika bekle
```

**Adım 3 — BirFatura Paneli:**
- Mağaza Ayarları → Özel Entegrasyon → Yeni Mağaza
- API URL: `https://sizin-domain.com/api/birfatura`
- API Şifresi: `.env`'deki `BIRFATURA_API_TOKEN` değeri

### BirFatura Router Endpoint'leri

Uygulamanızda aşağıdaki endpoint'ler aktif olur:

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/birfatura/orderStatus/` | Sipariş durumlarını döner |
| `POST /api/birfatura/paymentMethods/` | Ödeme yöntemlerini döner |
| `POST /api/birfatura/orders/` | **Bekleyen siparişleri döner** (en kritik) |
| `POST /api/birfatura/orderCargoUpdate/` | BirFatura kargo güncellemesi gönderir |
| `POST /api/birfatura/invoiceLinkUpdate/` | **Fatura hazır callback'i** (en kritik) |

### `full_invoice_flow()` BirFatura'da Nasıl Çalışır?

```python
result = provider.full_invoice_flow(customer_info, items, payment_info)
# ↑ Bu çağrı BLOKE OLUR — BirFatura callback gelene kadar bekler
#   Timeout: BIRFATURA_POLL_TIMEOUT_SEC (varsayılan 600s)
```

Yani webhook handler'da bu çağrı, BirFatura faturayı kesip
`/invoiceLinkUpdate/` endpoint'ini çağırana kadar tamamlanmaz.
**Bu normal bir davranıştır** — `full_invoice_flow` BirFatura'dan cevap
gelince otomatik devam eder.

---

## iyzico Webhook Entegrasyonu

Webhook handler tüm provider'larla aynı şekilde çalışır. FastAPI'ye
eklemek için:

```python
# web/backend/app/api/routes.py veya ayrı bir dosyada
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from app.billing.webhook_handler import handle_iyzico_webhook

router = APIRouter()

@router.post("/webhooks/iyzico")
async def iyzico_webhook(request: Request):
    payload = await request.json()
    # handle_iyzico_webhook HİÇBİR ZAMAN exception fırlatmaz
    # iyzico başarısız webhook'larda tekrar dener, bu yüzden her zaman 200 dön
    result = handle_iyzico_webhook(payload, dict(request.headers))
    return JSONResponse(result)
```

### Webhook Handler Ne Yapar?

```
İyzico payload → doğrula → status == "SUCCESS" mu? → hayır → hata dön (ama 200)
                                                    ↓ evet
                              buyer bilgisinden CustomerInfo oluştur
                                                    ↓
                              basketItems'dan InvoiceItem listesi oluştur
                              (fiyatlar KDV dahil gelir → /1.20 ile KDV'siz hesapla)
                                                    ↓
                              get_provider().full_invoice_flow() çağır
                                                    ↓
                              send_invoice_email() çağır
                                                    ↓
                              {"success": True, "invoice_id": ..., "pdf_url": ...} dön
```

### iyzico'nun Gönderdiği Payload Örneği

```json
{
  "paymentId": "12345678",
  "status": "SUCCESS",
  "price": "100.00",
  "paidPrice": "100.00",
  "currency": "TRL",
  "buyer": {
    "name": "Ahmet",
    "surname": "Yılmaz",
    "email": "ahmet@example.com",
    "gsmNumber": "+905551234567",
    "identityNumber": "12345678901",
    "registrationAddress": "Atatürk Cad. No:1",
    "city": "İstanbul"
  },
  "basketItems": [
    {
      "name": "Pro Plan",
      "price": "100.00",
      "itemType": "VIRTUAL"
    }
  ]
}
```

---

## E-posta Servisi

Fatura PDF'i hazır olunca `send_invoice_email()` çağrılır.

```bash
# SMTP ile (Gmail örneği)
EMAIL_BACKEND=smtp
EMAIL_FROM=billing@yourapp.com
EMAIL_FROM_NAME=NB PDF Platform
COMPANY_NAME=NB PDF Platform
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=billing@yourapp.com
SMTP_PASSWORD=gmail-uygulama-sifresi   # Gmail → Güvenlik → Uygulama Şifreleri

# VEYA SendGrid ile
EMAIL_BACKEND=sendgrid
SENDGRID_API_KEY=SG.xxxx...
EMAIL_FROM=billing@yourapp.com
```

---

## TESTLER — Nasıl Çalıştırılır?

### Ön Koşul

```bash
# Web venv'i aktifleştir (projenin kök dizininden)
# Windows:
web\.venv\Scripts\activate

# MacOS/Linux:
source web/.venv/bin/activate

# pytest'i yükle (ilk seferinde)
pip install pytest
```

### Tüm Billing Testlerini Çalıştır

```bash
cd web/backend
python -m pytest tests/billing/ -v
```

Beklenen çıktı:

```
tests/billing/test_birfatura_provider.py::test_order_status_no_token PASSED
tests/billing/test_birfatura_provider.py::test_full_flow_with_callback PASSED
...
tests/billing/test_mock_provider.py::test_full_invoice_flow PASSED
...
tests/billing/test_webhook_handler.py::test_successful_payment_returns_success PASSED
...
46 passed in 2.14s
```

### Sadece Belirli Bir Test Dosyasını Çalıştır

```bash
python -m pytest tests/billing/test_mock_provider.py -v
python -m pytest tests/billing/test_webhook_handler.py -v
python -m pytest tests/billing/test_birfatura_provider.py -v
python -m pytest tests/billing/test_email_service.py -v
```

### Tek Bir Test Fonksiyonunu Çalıştır

```bash
python -m pytest tests/billing/test_webhook_handler.py::test_successful_payment_returns_success -v
```

### Logları Görmek İçin

```bash
python -m pytest tests/billing/ -v -s --log-cli-level=DEBUG
```

---

## TEST DOSYALARI — Ne Test Ediyor?

### `test_mock_provider.py` — 9 Test

Mock provider'ın tüm adımlarını test eder. **Ağ bağlantısı gerekmez.**

| Test | Kontrol ettiği şey |
|------|-------------------|
| `test_find_or_create_customer_returns_string` | Müşteri ID'si string ve boş değil mi? |
| `test_create_invoice_success` | Fatura oluşturuldu mu, ID ve numara var mı? |
| `test_publish_invoice_success` | e_document_type doğru mu? |
| `test_get_invoice_pdf_url` | PDF URL https ile mi başlıyor, invoice_id içeriyor mu? |
| `test_cancel_invoice` | True döndü mü? |
| `test_full_invoice_flow` | Tüm alanlar dolu mu, error=None mı? |
| `test_full_invoice_flow_multiple_items` | Çoklu kalem çalışıyor mu? |
| `test_full_invoice_flow_company_customer` | Şirket tipi çalışıyor mu? |

### `test_webhook_handler.py` — 12 Test

iyzico'nun gönderebileceği farklı payload senaryolarını test eder.

| Test | Senaryo |
|------|---------|
| `test_successful_payment_returns_success` | Normal başarılı ödeme |
| `test_successful_payment_email_sent_flag` | `email_sent: true` döndü mü? |
| `test_successful_payment_email_fail_still_returns_success` | E-posta başarısız olsa da fatura başarılı sayılır |
| `test_failed_payment_returns_error` | `status: FAILURE` → `success: false` |
| `test_pending_payment_returns_error` | `status: PENDING` → `success: false` |
| `test_missing_payment_id_returns_error` | paymentId yoksa hata ver |
| `test_missing_status_returns_error` | status yoksa hata ver |
| `test_missing_buyer_email_returns_error` | E-posta yoksa hata ver |
| `test_empty_basket_uses_single_line_item` | Sepet boşsa tek satır kalemi oluştur |
| `test_multiple_basket_items` | Çoklu sepet kalemi |
| `test_provider_error_returns_false` | Provider hata verirse webhook `success: false` döner |
| `test_unexpected_exception_never_raises` | Exception fırlatmaz, her zaman dict döner |

### `test_birfatura_provider.py` — 15 Test

BirFatura'nın endpoint'leri ve callback mekanizmasını test eder.
`TestClient` ile gerçek HTTP istekleri simüle edilir.

| Test | Kontrol ettiği şey |
|------|-------------------|
| `test_order_status_no_token` | Endpoint 200 döndü, liste mi? |
| `test_orders_empty_store` | Bekleyen sipariş yoksa `[]` döner |
| `test_orders_with_pending_order` | Sipariş ekleyince BirFatura onu görür |
| `test_orders_marks_fetched` | Çekilen sipariş tekrar gelmiyor |
| `test_invoice_link_update_valid` | Callback gelince event tetikleniyor |
| `test_invoice_link_update_unknown_order` | Bilinmeyen order_id → success: false |
| `test_token_validation_rejects_wrong_token` | Yanlış token → 401 |
| `test_token_validation_accepts_correct_token` | Doğru token → 200 |
| `test_full_flow_with_callback` | Thread'de akış + ayrı thread'de callback simülasyonu |
| `test_full_flow_timeout` | Callback gelmezse timeout hatası |
| `test_company_customer_includes_tax_fields` | TaxNo/TaxOffice JSON'da var mı? |
| `test_multiple_items_in_order` | OrderDetails doğru sayıda kalem içeriyor mu? |

### `test_email_service.py` — 11 Test

E-posta gövdesi oluşturma ve gönderim mantığını test eder.
**Gerçek SMTP bağlantısı açılmaz**, `smtplib` mock'lanır.

| Test | Kontrol ettiği şey |
|------|-------------------|
| `test_html_body_contains_customer_name` | HTML'de müşteri adı var mı? |
| `test_html_body_contains_invoice_number` | Fatura numarası görünüyor mu? |
| `test_send_returns_false_on_failed_result` | Başarısız fatura → e-posta gönderilmez |
| `test_send_via_smtp_success` | SMTP mock çağrıldı, doğru alıcıya mı? |
| `test_send_via_sendgrid_success` | SendGrid mock çağrıldı mı? |
| `test_pdf_download_error_returns_false` | PDF indirilemezse False döner |
| `test_smtp_send_error_returns_false` | SMTP hatası exception fırlatmaz |

---

## Geliştirme Sırasında Sık Yapılan Hatalar

### 1. "BillingProvider tanımlanmamış" hatası

```
ValueError: Bilinmeyen billing provider: 'parasut'
# ama PARASUT_CLIENT_ID eksik!
```

**Çözüm:** `.env.example` dosyasını `.env` olarak kopyala ve tüm Paraşüt
değişkenlerini doldur.

### 2. BirFatura siparişleri görmüyor

Kontrol listesi:
- [ ] `main.py`'de `birfatura_router` aktif mi?
- [ ] Sunucu public erişilebilir URL'ye sahip mi? (localhost'u göremez)
- [ ] BirFatura panelinde URL ve token doğru girildi mi?
- [ ] `BIRFATURA_API_TOKEN` `.env`'de tanımlı mı?

### 3. Webhook handler'dan exception fırlatılıyor

Bu **olmamalı**. `handle_iyzico_webhook` her durumda dict döner.
Exception fırlatıyorsa, içinde `try/except` olmayan yeni bir kod
eklenmiş demektir. Fonksiyon içindeki tüm exception'lar yakalanıp
`{"success": False, "error": "..."}` olarak dönmelidir.

### 4. Test geçiyor ama production'da fatura kesilmiyor

- Mock provider'ı production'a almış olabilirsin. `BILLING_PROVIDER=mock`
  değerini kontrol et.
- E-posta backend'i de kontrol et: `EMAIL_BACKEND=smtp` ama
  `SMTP_PASSWORD` tanımlı değilse e-posta gitmez (fatura yine kesilir).

---

## Production Kontrol Listesi

Canlıya almadan önce:

- [ ] `BILLING_PROVIDER` değerini `mock`'tan `parasut` veya `birfatura`'ya çek
- [ ] Paraşüt için: gerçek şirket ID ve OAuth bilgileri girildi mi?
- [ ] BirFatura için: `birfatura_router` `main.py`'de aktif mi?
- [ ] `EMAIL_BACKEND=smtp` ve SMTP kimlik bilgileri doğru mu?
- [ ] İyzico webhook URL'si production sunucusuna yönlendiriliyor mu?
- [ ] Bir test ödemesi yap, logda `"fatura oluşturuldu"` görüyor musun?
- [ ] Test müşterisine e-posta geldi mi?
