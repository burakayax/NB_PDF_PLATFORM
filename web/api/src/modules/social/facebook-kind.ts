/**
 * Facebook içerik biçimleri. Arka arkaya iki gönderi AYNI biçimde olmasın diye döngüde
 * komşu iki eleman hiçbir zaman aynı değildir (döngü başa dönerken de).
 * Demo türü araç videolarıdır (ayrı akış).
 */
export type FacebookKind = "tip" | "list" | "beforeafter" | "mistake" | "story";

/** 5'lik döngü: her biçim birer kez; sıra sabit olduğundan komşular farklıdır. */
const FB_CYCLE: FacebookKind[] = ["tip", "list", "beforeafter", "mistake", "story"];

export function facebookKindFor(count: number): FacebookKind {
  return FB_CYCLE[((count % FB_CYCLE.length) + FB_CYCLE.length) % FB_CYCLE.length] ?? "tip";
}

/** Metindeki yönlendirme satırı; bu satır varsa yayından sonra ilk yoruma bağlantı eklenir. */
export const FACEBOOK_LINK_HINT = "Link ilk yorumda 👇";

/** Bağlantı ("Link ilk yorumda") dört gönderiden yalnız birinde kullanılır. */
export const FACEBOOK_LINK_EVERY = 4;

/** `count`: bu güne kadarki Facebook blog gönderisi sayısı. Her 4. gönderi bağlantı taşır. */
export function facebookWithLink(count: number): boolean {
  return ((count % FACEBOOK_LINK_EVERY) + FACEBOOK_LINK_EVERY) % FACEBOOK_LINK_EVERY === FACEBOOK_LINK_EVERY - 1;
}
