# Siz bilgisayar başında değilken çalışma seçenekleri (karşılaştırma; hiçbiri kurulmadı)

Amaç: Siz yokken yapay zekâ görevlerinin ya da zamanlanmış işlerin çalışabilmesi. Çalışma kuralları değişmez: her değişiklik ayrı dalda PR, birleştirme ve canlıya çıkış yalnızca sizin onayınızla, ek masraf onaysız başlatılmaz.

Not: Daha önce "gece çalışan yapay zekâ ajanı" fikri, Claude kullanım limiti nedeniyle iptal edilmişti. Aşağıdaki seçeneklerde bu kısıt maliyet/güvenilirlik satırlarında dikkate alındı.

## a) Kendi bilgisayarınızı 7/24 açık bırakmak

**Kurulum:**
- Uyku/ekran: Güç ayarlarında "uyku: hiçbir zaman"; ekranın kapanması sorun değil.
- Otomatik güncelleme: Windows Update'in kullanıcı açıkken zorla yeniden başlatmasını engelleyin (etkin saatler / "oturum açıkken otomatik yeniden başlatma yok" ilkesi). Yeniden başlama kaçınılmazsa: oturumun kendiliğinden açılması ve görevin başlangıçta otomatik başlaması gerekir.
- Elektrik/internet kesintisi: BIOS'ta "elektrik gelince otomatik aç" ayarı; görev, bilgisayar açılınca kendiliğinden devam edecek biçimde zamanlanmış görev olarak kurulmalı. Kesintide süren iş kaybolur, bu yüzden işler "kaldığı yerden devam edebilir" yazılmalı. UPS (küçük kesintisiz güç kaynağı) önerilir.
- Proje klasörü OneDrive içinde duruyor; eşzamanlama çakışmaları uzun süren işlerde sorun çıkarabilir.

**Güvenlik riski:** Bilgisayar sürekli açık ve içinde anahtarlar/oturumlar var. Çalınma, kötü yazılım ya da uzaktan erişim hepsini tehlikeye atar.
**Azaltma yolları:** Disk şifreleme (BitLocker), ayrı Windows kullanıcısı, uzaktan erişimi kapatmak, canlı anahtarları bu bilgisayarda tutmamak (yalnız salt okunur anahtarlar), güvenlik duvarı.

| | |
|---|---|
| Maliyet | Elektrik (yaklaşık 60 W → ayda birkaç dolar); yazılım ücreti yok |
| Güvenilirlik | **Düşük–orta** (güncelleme, kesinti, bilgisayarın kapanması) |
| Güvenlik | **En zayıf**: anahtarların durduğu makine sürekli açık |

## b) Bulutta çalışan Claude Code oturumu / zamanlanmış görevler

- İşler Anthropic'in bulutunda çalışır; bilgisayarınız kapalı olabilir.
- Depoya GitHub üzerinden erişir; PR açar. Canlı anahtarları bilgisayarınızda tutmanız gerekmez; **canlı anahtar bulut ortamına da vermemek** esastır (yalnız gecelik özet belgesi okunur).
- Sınır: Claude kullanım limiti. Zamanlanmış görevler limitinizden düşer; daha önce limit yüzünden bir gece ajanı iptal edilmişti. Ek ücret çıkıp çıkmayacağı planınıza bağlıdır, kurmadan önce teyit edilmeli.

| | |
|---|---|
| Maliyet | Aboneliğin kullanım limitinden düşer; ek ücret planınıza bağlı (teyit gerekli) |
| Güvenilirlik | **Yüksek** (bilgisayarınıza bağlı değil); limit dolarsa iş çalışmaz |
| Güvenlik | **İyi** eğer yalnız depo erişimi + salt okunur özet verilirse |

## c) GitHub Actions ile zamanlanmış işler

- Depo herkese açık olduğu için standart çalıştırıcılar ücretsiz (GitHub resmî sayfası).
- Güvenilir ve kayıtlıdır; her çalışmanın günlüğü görünür. Anahtarlar "GitHub Secrets" içinde saklanır.
- Sınırlar: Zamanlanmış çalışmalar birkaç dakika gecikebilir; GitHub, uzun süre hareketsiz depolarda zamanlanmış işleri durdurabilir (bilinen kural, teyit edilmeli). Yapay zekâ yorumu gerekiyorsa o API çağrısı ücretlidir (kullanım başına).
- **Açık depo riski:** Gizli anahtarı kullanan işler yalnızca zamanlanmış/`main` çalışmalarında olmalı; dışarıdan gelen PR'lara anahtar verilmemeli (GitHub varsayılan olarak vermez).
- Veritabanına erişemez (Render içi); bu yüzden gecelik özet **Render'da** üretilir (bkz. gecelik özet tasarımı), Actions yalnızca dışarıdan kontrol/doğrulama için kullanılır.

| | |
|---|---|
| Maliyet | **0** (açık depo) |
| Güvenilirlik | **Yüksek**, küçük gecikmeler |
| Güvenlik | **İyi**, anahtarlar Secrets'ta; açık depo olduğu için dikkat gerekir |

## Karşılaştırma

| | a) Kendi PC | b) Bulut Claude Code | c) GitHub Actions |
|---|---|---|---|
| Maliyet | düşük (elektrik) | limitten düşer | 0 |
| Güvenilirlik | düşük–orta | yüksek | yüksek |
| Güvenlik | zayıf | iyi | iyi |
| Yapay zekâ yorumu | evet | evet | yalnız ücretli API ile |
| Kurulum yükü | yüksek | düşük | düşük |

## Öneri
1. **Bilgisayarı 7/24 açık bırakmayın** (a). En zayıf güvenlik, en düşük güvenilirlik.
2. **Sabit, yapay zekâ gerektirmeyen işler (c):** UptimeRobot dışı kontroller, sayı doğrulama raporları, bağlantı kontrolleri: GitHub Actions + Render içindeki gecelik iş. Ücretsiz.
3. **Yorum/inceleme gerektiren işler (b):** Gecelik özet belgesini okuyup sabah "bugün bakılacaklar" listesi çıkaran ve gerekirse yalnızca PR açan bulut görevi. Önce haftada birkaç kez deneyip limit etkisini ölçün.
4. Hiçbir otomatik görev birleştirme/canlıya çıkış yapmaz; PR açar, siz onaylarsınız.
