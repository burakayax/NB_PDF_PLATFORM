/**
 * Görseli/videoyu doğrudan dosya olarak indirir.
 *
 * NEDEN FETCH: `<a download>` başka bir alan adından gelen dosyada yok sayılır, tarayıcı
 * dosyayı tam ekran açar. Dosyayı blob olarak çekip yerel adresle indirmek bunu aşar.
 * Çekme engellenirse (CORS vb.) eski davranışa, yeni sekmede açmaya, düşer.
 */
export async function downloadMedia(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
