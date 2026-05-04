# MIGRATION NOTES — Subscription System Overhaul

## Keşif Özeti

| Bileşen | Mevcut Durum |
|---|---|
| ORM | Prisma (PostgreSQL / SQLite dev fallback) |
| Auth | Custom JWT — access token (15 min) + HttpOnly refresh cookie (7 days) |
| Payment | iyzico (primary, TRY), Stripe (stub, disabled) |
| Kredi sistemi | `User.credit_balance`, `CreditTransaction`, `CreditPackCheckout`, `UserEntitlement` |
| PDF Tool gating | Python FastAPI → Node `POST /api/entitlement/consume` |
| Admin panel | Email-tabanlı (`nbglobalstudio@gmail.com`), `/api/admin/*` |
| Frontend | React + Vite + Tailwind CSS 4 + Framer Motion |

---

## Faz 1 — Kaldırılan Modeller / Alanlar

### Silinen Prisma Modelleri
- `CreditTransaction`
- `CreditPackCheckout`
- `UserEntitlement`

### User'dan Silinen Alanlar
- `credit_balance`
- `lowCreditNudgeAt`
- `lastExitIntentCreditDiscountAt`
- `stripe_customer_id` (Organization modeline taşındı)

### Silinen API Route'ları
- `POST /api/credit-checkout/preview`
- `POST /api/credit-checkout/start`
- `POST /api/credit-checkout/validate-coupon`
- `POST /api/entitlement/consume` (quota tabanlı yeni versiyonla değiştirildi)
- `GET /api/entitlement/balance`
- `GET /api/entitlement/transactions`

### Silinen Frontend Dosyaları
- `web/frontend/src/lib/creditPacks.ts` (yeni plan config ile değiştirildi)
- `web/frontend/src/components/dashboard/CheckoutPackSelectionCards.tsx` (kredi paketi seçim ekranı)

---

## Faz 2 — Eklenen Modeller

- `Organization` — multi-tenant ana model
- `PlanConfig` — admin-configurable plan limits (seeded)
- `OperationLog` — tüm PDF işlem logları
- `Invitation` — Business plan davet sistemi

---

## Faz 3 — Güncellenen Modeller

### User
- `organizationId` eklendi (FK → Organization)
- `orgRole` eklendi: `OWNER | ADMIN | MEMBER`
- `timezone` eklendi (e.g. "Europe/Istanbul")
- Plan artık Organization üzerinde (User.plan cache olarak tutuldu)

### Plan Enum
- `PLUS` eklendi: `FREE | PLUS | PRO | BUSINESS`

---

## Faz 4 — Yeni Backend Dosyaları

- `web/api/src/lib/quota.ts` — checkQuota() / incrementQuota()
- `web/api/src/lib/rbac.ts` — can() / requirePermission()
- `web/api/src/lib/org-guard.ts` — requireOrg() middleware
- `web/api/src/modules/organization/` — org CRUD + invite system
- `web/api/src/modules/billing/` — Stripe checkout + webhook
- `web/api/prisma/seed.ts` — PlanConfig seeder

---

## Faz 5 — Güncellenen API Route'ları

### Entitlement (quota tabanlı yeniden yazıldı)
- `POST /api/entitlement/check` → artık quota kontrolü yapıyor (credit değil)
- `POST /api/entitlement/consume` → artık OperationLog yazıyor, quota artırıyor

### Yeni Routes
- `POST /api/org/invite`
- `GET /api/org/invite/accept/:token`
- `DELETE /api/org/members/:userId`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`
- `GET /api/admin/stats`
- `GET /api/admin/members`
- `GET /api/admin/reports`

---

## Migration Komutu

```bash
cd web/api
npx prisma migrate dev --name subscription_overhaul
npx prisma db seed
```

---

## Breaking Changes

1. **JWT Claims**: `organizationId` ve `orgRole` eklendi. Mevcut token'lar plan yenilenmesinde güncellenir.
2. **Python backend**: `entitlement_check()` artık quota-tabanlı cevap döndürüyor.
3. **Frontend**: `creditPacks.ts` kaldırıldı; `planConfig.ts` ile değiştirildi.

---

## Dosyalar Değiştirilen

- `web/api/prisma/schema.prisma` ✓
- `web/api/prisma/seed.ts` ✓
- `web/api/src/lib/quota.ts` ✓
- `web/api/src/lib/rbac.ts` ✓
- `web/api/src/lib/org-guard.ts` ✓
- `web/api/src/modules/organization/` ✓
- `web/api/src/modules/billing/` ✓
- `web/api/src/modules/entitlement/entitlement.service.ts` ✓
- `web/api/src/modules/auth/auth.service.ts` (org creation on register) ✓
- `web/frontend/src/lib/planConfig.ts` ✓
- `web/frontend/src/components/ui/pricing-section.tsx` ✓
- `web/frontend/src/components/ui/quota-countdown.tsx` ✓
- `web/frontend/src/components/dashboard/QuotaWidget.tsx` ✓
