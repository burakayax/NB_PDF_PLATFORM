/**
 * EKİP ETKİNLİK KAYDI — bir ekip üyesi işlem tamamladığında ekip yöneticisinin
 * listesine düşen satır.
 *
 * Ana uygulama dosyasında iki ayrı yerde, biri 24 satırlık elle yazılmış bir
 * araç adı listesiyle birlikte duruyordu. O liste iki soruna yol açıyordu:
 * yeni eklenen araçlar listede olmadığı için kayda teknik kimlikleriyle
 * düşüyordu ("extract-images" gibi), ve liste yalnızca Türkçe olduğu için
 * İngilizce kullanan ekipler de Türkçe ad görüyordu.
 *
 * Artık ad, arayüzün her yerinde kullanılan araç adları kaynağından alınıyor.
 *
 * Kayıt gönderimi kullanıcıyı bekletmez ve başarısız olursa sessiz kalır:
 * işlem zaten tamamlanmıştır, kayıt tutulamadı diye kullanıcıya hata
 * göstermek yanıltıcı olur.
 */
import { sidebarToolLabel } from "../i18n/workspace";
import type { FeatureKey } from "../api/subscription";
import type { Language } from "../i18n/landing";

/**
 * Aracın kullanıcıya gösterilen adı. Kayıtlı olmayan bir kimlik gelirse
 * (henüz listeye eklenmemiş yeni araç) kimliğin kendisine düşer — kayıt
 * tutulamamasındansa teknik ad daha iyidir.
 */
export function toolDisplayName(toolId: string, language: Language): string {
  try {
    return sidebarToolLabel(toolId as FeatureKey, language) || toolId;
  } catch {
    return toolId;
  }
}

export type TeamActivityInput = {
  accessToken: string;
  toolId: string;
  language: Language;
  /** İşlenen sayfa sayısı; bilinmiyorsa boş bırakılır. */
  pageCount?: number | null;
};

export function reportTeamActivity({
  accessToken,
  toolId,
  language,
  pageCount = null,
}: TeamActivityInput): void {
  void fetch("/api/team/activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      toolId,
      toolName: toolDisplayName(toolId, language),
      status: "SUCCESS",
      pageCount,
    }),
  }).catch(() => {
    /* Kayıt tutulamadı; kullanıcının işi zaten bitti, sessiz geç. */
  });
}
