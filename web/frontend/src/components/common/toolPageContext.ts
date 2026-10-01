import { createContext, useContext } from "react";

/**
 * "Bu araç zaten anlatılmış bir sayfanın içinde mi?"
 *
 * Misafir araç sayfaları (GuestSeoToolPage) aracın ne yaptığını başlıkta, nasıl
 * çalıştığını "Nasıl çalışır?" kartında ve gizlilik sözünü kendi güven şeridinde
 * zaten anlatır. Yükleme paneli bir de kendi üç fayda kutusunu çizince aynı şey
 * ekranda üç kez söyleniyordu.
 *
 * Panel bu bağlamı okur ve böyle bir sayfanın içindeyse fayda kutularını
 * göstermez. Çalışma alanında ve ana sayfada bağlam yoktur → kutular görünür.
 *
 * `showBenefitsAnyway`: Hero'nun (ana sayfa) "kendi sayfasında açılır" araçları
 * için eklendi — Hero'nun tanıtım şeridi yalnız AD+AÇIKLAMAYI tekrar ediyordu
 * (başlık gizlenmeli), ama üç fayda kutusunun bir eşleniği YOK (Birleştir gibi
 * diğer araçlarda bu kutular Hero'da zaten görünür kalıyor). `describesTool`
 * true iken bu `true` verilirse fayda kutuları yine de gösterilir.
 */
export const ToolPageContext = createContext<{ describesTool: boolean; showBenefitsAnyway?: boolean }>({
  describesTool: false,
});

export function useToolPageContext() {
  return useContext(ToolPageContext);
}
