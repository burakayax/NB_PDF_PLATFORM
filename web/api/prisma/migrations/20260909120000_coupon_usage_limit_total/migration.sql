-- Kuponlara toplam kontenjan alanı: kaç kişi/kez yararlanabilir (NULL = sınırsız).
ALTER TABLE "coupons" ADD COLUMN "usage_limit_total" INTEGER;
