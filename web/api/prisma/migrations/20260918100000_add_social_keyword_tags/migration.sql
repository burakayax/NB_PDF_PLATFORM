-- Sosyal medya: arama TERİMLERİ ile ETİKETLER artık ayrı saklanıyor.
-- Terimler gönderi metninde geçer; etiketler "#" satırını kurar. Eski
-- kayıtlarda etiket bulunmadığı için sütunlar NULL kabul ediyor.
ALTER TABLE "social_keyword_cache" ADD COLUMN "tr_tags_json" TEXT;
ALTER TABLE "social_keyword_cache" ADD COLUMN "en_tags_json" TEXT;
