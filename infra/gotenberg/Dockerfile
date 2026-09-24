# Office (Word/Excel/PowerPoint) → PDF için Gotenberg servisi.
#
# NEDEN AYRI BİR İMAJ: Resmi gotenberg/gotenberg:8 imajını olduğu gibi
# kullanıyoruz — kendi bir dönüştürme mantığımız yok, hâlâ aynı LibreOffice
# motoru çalışıyor. Tek amaç: varsayılan --api-timeout (30 sn) büyük Word/
# Excel/PPT dosyaları için yetersiz kalabiliyor; nb-pdf-api'deki
# NB_PDF_TOOL_TIMEOUT_SEC (varsayılan 300 sn) ile eşleştiriyoruz.
FROM gotenberg/gotenberg:8

EXPOSE 3000

# Render'daki en küçük plan (starter) 512MB — Gotenberg'in kendisi bunu
# aşırdı (bkz. "exceeded its memory limit" uyarısı), otomatik restart oldu.
# Ücretli plana geçmeden önce BEDAVA bellek tasarrufu:
#   --chromium-disable-routes    → hiç kullanmadığımız Chromium modülünü
#                                   (HTML→PDF motoru olarak Playwright'ı
#                                   kullanıyoruz) tamamen kapatır, o process
#                                   hiç ayağa kalkmaz.
#   --libreoffice-idle-shutdown-timeout=5m → office dönüşümleri arada bir
#                                   yapılıyor (sürekli değil); 5 dk boşta
#                                   kalınca LibreOffice kapanıp belleği
#                                   serbest bırakır, bir sonraki istekte
#                                   yeniden açılır (birkaç saniye gecikme).
#   --libreoffice-restart-after=5  → sızıntı birikmesin diye her 5
#                                   dönüşümde bir LibreOffice'i tazele
#                                   (varsayılan 10'du, yarıya indirildi).
CMD ["gotenberg", "--api-timeout=300s", "--chromium-disable-routes=true", "--libreoffice-idle-shutdown-timeout=5m", "--libreoffice-restart-after=5"]
