import type { SocialPlatform } from "@prisma/client";
import type { Publisher, Verifier } from "./common.js";
import { publishToX, verifyX } from "./x.platform.js";
import { publishToLinkedIn } from "./linkedin.platform.js";
import { publishToFacebook, publishToInstagram, verifyFacebook, verifyInstagram } from "./meta.platform.js";
import { publishToPinterest, verifyPinterest } from "./pinterest.platform.js";

/** Platform → yayıncı eşlemesi. Yeni ağ eklerken tek dokunulacak yer burası. */
export const PUBLISHERS: Record<SocialPlatform, Publisher> = {
  X: publishToX,
  LINKEDIN: publishToLinkedIn,
  FACEBOOK: publishToFacebook,
  INSTAGRAM: publishToInstagram,
  PINTEREST: publishToPinterest,
};

/**
 * Platform → bağlantı sınayıcı. Eksik olan ağ için panel "sınama yok" der;
 * yanlışlıkla "sorun yok" demez.
 */
export const VERIFIERS: Partial<Record<SocialPlatform, Verifier>> = {
  X: verifyX,
  FACEBOOK: verifyFacebook,
  INSTAGRAM: verifyInstagram,
  PINTEREST: verifyPinterest,
};

export type { Publisher, PublishInput, Verifier } from "./common.js";
