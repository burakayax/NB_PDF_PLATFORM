# 14 — Günlük hak havuzu, yapay zekâ hediyesi ve model

Son güncelleme: 2026-10-14

## 1. Günlük hak havuzu
- Sunucuda işlenen araçlar (sıkıştır, Word/Excel dönüşümleri vb.) **ortak bir günlük havuzdan** harcar. Havuzun büyüklüğü plana göre değişir: ücretsiz 3, Başlangıç 25, Plus/Pro/Business günlük sınırsız.
- **Cihazda çalışan araçlar** (birleştir, böl, döndür, sil, sırala, görsel→PDF) havuzdan **düşmez**.
- Çoğu işlem 1 hak sayar. Sunucuyu uzun süre meşgul edenler daha çok sayar:
  PDF→JPG **2**, PDF→PowerPoint **3** (canlıda 30 sayfalık örnekle ölçüldü: ~41 sn ve ~100 sn; Word→PDF 5–7 sn, sıkıştır 4 sn).
- Kural: havuzda en az 1 hak varsa işlem başlar; düşüm ağırlık kadardır (sayaç limiti en fazla ağırlık−1 aşabilir).
- Ağırlıkları değiştirmek: `web/api/src/lib/quota.ts` → `OPERATION_WEIGHTS` **ve** `web/frontend/src/lib/operationWeights.ts` (test ayrışmayı yakalar).
- Ücretsiz planın günlük sayısı ve açık araç listesi **yönetim panelinden** (Paket & fiyat → FREE) değiştirilir; kodda değil.
- Üst çubuktaki rozet ("Bugün 3/4 hak") sunucunun verdiği `daily` değerini gösterir; limit yoksa görünmez.

## 2. Yapay zekâ hoş geldin hediyesi
- Yeni (e-postası doğrulanan ya da Google ile açılan) her hesaba **tek seferlik** `AI_TRIAL_CREDITS` kadar (varsayılan 1) ücretsiz yapay zekâ işlemi verilir. Kayıt anında bir kez yazılır; tekrar verilmez.
- Basit araçlarda geçer (özetle, veri çıkar, sohbet…). Çok kredi isteyen ağır araçlar (Sözleşme Denetçisi) 1 krediyle çalışmaz.
- Kapatmak: Render ortam değişkeni `AI_TRIAL_CREDITS=0`. Artırmak için sayıyı yükselt (en fazla 10).
- Kredi bitince araç "Pro / Business özelliği" der; mesajda plan başına aylık AI hakkı yazar (kaynak: `web/frontend/src/lib/aiCredits.ts`, test katalogla eşler).

## 3. Yapay zekâ modeli
- Varsayılan model **Claude Haiku 5.5** (`claude-haiku-5-5`). Eskisi Haiku 4.5'ti; fiyat 10 kat düştü (milyon token: 0,10 $ girdi / 0,50 $ çıktı; 100 bin token üstü istemde daha pahalı).
- Haiku 5.5 varsayılan olarak "düşünür" ve düşünme jetonları çıktı sayılır; 1500 jetonluk sınırın tamamı düşünmeye gidip **metin hiç dönmeyebilir**. Bu yüzden kodda Haiku 5 için düşünme kapalı + düşük efor gönderilir (`ai.service.ts`).
- Türkçe fatura/kira örneğinde özet, veri çıkarma (14 alan) ve hassas veri tespiti (12 öğe) Haiku 4.5 ile aynı çıktı; bir örnekte maliyet ~6 kat düştü (ölçüm: 509 girdi + 1196 çıktı jetonu ≈ 0,0007 $).
- **DİKKAT:** Render'da `AI_MODEL` ortam değişkeni elle girilmişse kod varsayılanı geçersizdir. Render panelinde `AI_MODEL` değerine bak; eski modeli gösteriyorsa `claude-haiku-5-5` yap ya da değişkeni sil.
- Sözleşme Denetçisi (`CONTRACT_REVIEW_MODEL`, Opus) ve CV asistanı (`AI_CV_MODEL`, Sonnet) ayrı modellerdir; bu değişiklikten etkilenmez.
- `AI_COST_PER_CREDIT_USD` (0,035) bilerek DEĞİŞTİRİLMEDİ: katalog marj testi onu en kötü durum olarak kullanır. Gerçek maliyet Haiku 5.5 ile çok daha düşük; aylık AI hakları bu fırsatla artırılabilir (ayrı karar).
