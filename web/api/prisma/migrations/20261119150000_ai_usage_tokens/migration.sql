-- Yapay zekâ isteği başına model ve token kaydı (maliyet ölçümü). Üç sütun da boş olabilir; eski kayıtlar etkilenmez.
ALTER TABLE "ai_request_logs" ADD COLUMN "model" TEXT;
ALTER TABLE "ai_request_logs" ADD COLUMN "input_tokens" INTEGER;
ALTER TABLE "ai_request_logs" ADD COLUMN "output_tokens" INTEGER;
