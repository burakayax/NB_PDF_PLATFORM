# Cloudflare ajan tetikleyici (pdfplatform-ajan-tetik)

GitHub'ın zamanlanmış işleri saatlerce gecikiyor. Bu Worker, "durum" ve "özet" ajanlarını zamanında başlatır.

- Kod: `cloudflare/ajan-tetik-worker.mjs` (Cloudflare'a bu dosyanın içeriği yapıştırılır).
- Cron (UTC): `45 4 * * *` → durum (07:45 TR), `25 5 * * *` → özet (08:25 TR). İki cron da Worker → Settings → Trigger events'te olmalı.
- Gizli değişken: `GH_TOKEN` (fine-grained, yalnız bu depo, yalnız "Actions: Read and write"). Değer sohbete/depoya yazılmaz.
- Bu iki ajanın GitHub zamanlaması `ajanlar.yml`'den kaldırıldı (çift çalışma olmasın). Diğer ajanlar GitHub'da kalır.
- Doğrulama: ertesi sabah Actions'ta "Manually run" durum (≈04:45 UTC) ve özet (≈05:25 UTC) görünmeli; e-posta ~08:30 TR'ye kadar gelmeli.
- Geri alma: `ajanlar.yml`'e iki eski cron satırı (`37 4 * * *`, `19 5 * * *`) ve case satırları geri eklenir.
