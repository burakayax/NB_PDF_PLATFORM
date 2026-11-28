# Araç tanıtım videoları

"Reels videosu hazırla" dendiğinde ve otomatik üretimde **tek biçim budur**: elle yazılmış, hareketli
animasyon sahnesi. Eski biçim (ekran kaydı + alt panelde "ADIM n/N") kaldırıldı.

```bash
# web/frontend klasöründe
node scripts/tool-reels/run.mjs --tool udf-to-pdf --stills                 # denetim kareleri (serit.png)
node scripts/tool-reels/run.mjs --tool udf-to-pdf --out /tmp/video.mp4     # üç sürüm MP4
```

Üç sürüm: `Bağlantı profilde` (Instagram, TikTok), `Bağlantı açıklamada` (YouTube),
`Bağlantı yorumlarda` (Facebook). Repoda `.mp4` bırakılmaz.

## Yeni araç videosu eklemek

1. `scenes/<araç-kimliği>.html` yaz. Sözleşme: `window.META = { sure, kontrol: [10 an] }`, belirlenimci
   `window.render(sn)`, `/*FONTLAR*/` ve `__EMBLEM__` yer tutucuları; son 5,5 saniye kapanış vitrini
   (`window.ARAC_SAYISI` sayacı, `window.BAGLANTI` satırı).
2. `scenes/sounds.mjs` içine aynı kimlikle müzik ekle.
3. `scenes/index.mjs` (`SCENES`) ve `web/api/src/modules/social/tool-reel-scenes.ts` listelerine ekle.
4. Katalogda metni (`tool-reel-catalog.ts`) ve kapağı (`cover-specs.mjs`) olmalı.
5. Denetim karelerine gözle bak, videoyu üret.

Sahnesi olmayan araç için video istenmez; sıra yalnız sahnesi olanlar arasında döner.

## BAĞLAYICI kurallar

### Senaryo ve marka
- Senaryo gerçek hayattan: kişinin o işte nerede takıldığı araştırılır, sonda çözüm verilir. Varsayımsa söylenir.
- Her video özgündür (görsel dil, biçim, müzik); bir sahne kopyalanıp yazısı değiştirilmez.
- Kurumsal marka dili; oyun/oyuncak havası yok. Animasyon canlı ve hareketli, durgun sahne yok.
- Süre hikâyeye yetecek kadar; 60 saniyenin altında.

### Ses
- Rahatsız edici ses yok (kalem/yazı cızırtısı gibi). Sıcak ve hareketlendiren: tel, elektrikli piyano,
  marimba, bas, davul. Düz sentez tonları "soğuk" kalır.

### Ekrandaki bilgi
- Dosya boyutu sınırı gösterilmez.
- İzleyicide "niye?" sorusu uyandıran teknik ayrıntı yazılmaz (örn. saklama süresi).
- Dosya adları gerçek hayattaki gibi özgündür ("birlesmis.pdf" gibi adlar kullanılmaz).
- Her cümle teknik bilgisi olmayan birine ilk bakışta anlaşılır. "Silinir" denirse NEREDEN silindiği söylenir.

### Güvenlik / gizlilik
- Hikâyenin parçasıdır: akışı kesen ayrı tam ekran bölüm ya da donan sahne yok.
- Biçim: küçük yeşil hap etiketler (yaylanarak gelir, süzülür, içeriği kapatmaz).
- Her zaman cihazda çalışan araç: "Cihazından çıkmaz", "Kontrol sende", "Sadece sende kalır".
- Sunucuda çalışan araç: "PDF'in bizden silinir", "Sendeki dosya kalır".
- Kullanılmaz: "Sunucumuza yüklenmiyor", "Bize gelmiyor", "Biz bile göremeyiz", "Kimse göremez",
  "%100 güvenli", saklama süresi. (`BANNED_PHRASES`, testte denetlenir.)
- Koşullu olarak cihazda çalışan araçta (büyük/parolalı dosyada sunucu) koşulsuz "cihazından çıkmaz" denmez.

### Kapanış
- Araç kartından sonra ~5,5 sn vitrin, **her videoda farklı biçimde** (var olanlar: yörünge, akan şerit,
  belge destesi, hesap tablosu): araç sayısı sayacı, gerçek araç adları, paylaş ya da kaydet çağrısı,
  yazılarak gelen pdfplatform.app.
- Alt ~340 piksel Instagram arayüzünün altında kalır: önemli yazı y≈1700'ün altına inmez.
