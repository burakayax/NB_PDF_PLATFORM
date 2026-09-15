import type { SocialPlatform } from "@prisma/client";
import type { Publisher } from "./common.js";
import { publishToX } from "./x.platform.js";
import { publishToLinkedIn } from "./linkedin.platform.js";
import { publishToFacebook, publishToInstagram } from "./meta.platform.js";
import { publishToPinterest } from "./pinterest.platform.js";

/** Platform → yayıncı eşlemesi. Yeni ağ eklerken tek dokunulacak yer burası. */
export const PUBLISHERS: Record<SocialPlatform, Publisher> = {
  X: publishToX,
  LINKEDIN: publishToLinkedIn,
  FACEBOOK: publishToFacebook,
  INSTAGRAM: publishToInstagram,
  PINTEREST: publishToPinterest,
};

export type { Publisher, PublishInput } from "./common.js";
