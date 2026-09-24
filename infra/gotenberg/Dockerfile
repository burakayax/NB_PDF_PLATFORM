# Office (Word/Excel/PowerPoint) → PDF için Gotenberg servisi.
#
# NEDEN AYRI BİR İMAJ: Resmi gotenberg/gotenberg:8 imajını olduğu gibi
# kullanıyoruz — kendi bir dönüştürme mantığımız yok, hâlâ aynı LibreOffice
# motoru çalışıyor. Tek amaç: varsayılan --api-timeout (30 sn) büyük Word/
# Excel/PPT dosyaları için yetersiz kalabiliyor; nb-pdf-api'deki
# NB_PDF_TOOL_TIMEOUT_SEC (varsayılan 300 sn) ile eşleştiriyoruz.
FROM gotenberg/gotenberg:8

EXPOSE 3000

CMD ["gotenberg", "--api-timeout=300s"]
