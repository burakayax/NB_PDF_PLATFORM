-- Yapay zekâ isteği başına model ve token kaydı (maliyet ölçümü). Üç sütun da boş olabilir; eski kayıtlar etkilenmez. IF NOT EXISTS: db push ile kurulmus eski veritabaninda sutun zaten olabilir.
ALTER TABLE "ai_request_logs" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "ai_request_logs" ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER;
ALTER TABLE "ai_request_logs" ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER;
