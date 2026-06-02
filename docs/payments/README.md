# Ödeme Sistemi Dokümantasyonu — Ana İndeks

> **Acil durumda önce buraya bak.** Bu indeks seni doğru dosyaya yönlendirir.

---

## 🚨 ACİL DURUM KARAR AĞACI

```
Ödeme sorunu var →

"Ödeme yaptım, plan değişmedi"      → runbooks/RB-12-plan-not-upgraded.md
"İki kez para çekildi"              → runbooks/RB-13-refund-chargeback.md
"Callback'ler gelmiyor"             → runbooks/RB-14-webhook-outage.md
"Tüm ödemeler durdu"                → operations/06-payment-incident-response.md
"Kullanıcı chargeback açtı"         → runbooks/RB-13-refund-chargeback.md
"İade yapmam gerekiyor"             → runbooks/RB-13-refund-chargeback.md
```

---

## 📚 Tüm Dosyalar

### /docs/payments/ — Ödeme Sistemi Temelleri
| Dosya | İçerik |
|-------|--------|
| `01-payment-flow.md` | Ödeme akışının tamamı — her adım açıklamalı |
| `02-audit-logging.md` | Neler loglanmalı, DB şemaları, log örnekleri |
| `03-what-not-to-log.md` | PCI — kart verisi, secret, token asla loglanmaz |
| `04-fraud-prevention.md` | Dolandırıcılık önleme, şüpheli aktivite tespiti |

### /docs/runbooks/ — Kriz Anı Prosedürleri
| Dosya | İçerik |
|-------|--------|
| `RB-12-plan-not-upgraded.md` | "Plan değişmedi" tam araştırma ve çözüm |
| `RB-13-refund-chargeback.md` | İade ve chargeback operasyonları |
| `RB-14-webhook-outage.md` | Callback kesintisi müdahalesi |

### /docs/support/ — Müşteri Desteği
| Dosya | İçerik |
|-------|--------|
| `01-support-workflows.md` | Destek iş akışları, şablonlar, öncelikler |

### /docs/audit/ — Denetim Sistemi
| Dosya | İçerik |
|-------|--------|
| `01-audit-system.md` | Audit trail kurulumu, şemalar, yasal saklama |

### /docs/legal/ — Hukuki Koruma
| Dosya | İçerik |
|-------|--------|
| `01-legal-safety.md` | Tüketici hakları, KVKK, delil toplama |

### /docs/operations/ — Operasyon Rehberleri
| Dosya | İçerik |
|-------|--------|
| `06-payment-incident-response.md` | Ödeme olay müdahalesi, P0-P3 seviyeleri |
| `07-solo-founder-payment-reality.md` | Solo kurucu gerçekliği, öncelikler |

---

## 🔑 Kritik Kurallar (Ezber)

```
1. Fiyat ASLA frontend'den gelmiyor — sunucu hardcode
2. Callback'te ASLA sadece callback'e güvenme — iyzico retrieve yap
3. Duplicate callback için idempotency kontrolü şart
4. Her ödeme conversation_id ile loglan
5. Her admin eylemi audit_log'a yazıl
6. Kart verisi ASLA loglanmaz (PCI)
7. IYZICO_SECRET_KEY ASLA loglanmaz
8. Ödeme kayıtları 5 yıl saklan
```

---

## 📊 Günlük Kontrol (5 Dakika)

```bash
# Kopyala-yapıştır:
psql -U postgres nb_pdf_platform -c "
SELECT status, COUNT(*) 
FROM payment_checkouts 
WHERE created_at > NOW() - INTERVAL '24 hours' 
GROUP BY status;"

# PENDING > 2 saat varsa → RB-12 veya RB-14'e git
psql -U postgres nb_pdf_platform -c "
SELECT COUNT(*) as stuck_payments
FROM payment_checkouts
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '2 hours';"
```
