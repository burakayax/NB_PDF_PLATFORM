import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * GOOGLE İLE YENİ HESAP: Google'dan dönen kişi sistemde YOKSA hesap hemen açılmaz. Önce kullanıcıya
 * Hizmet Şartları/Gizlilik/aydınlatma onayları gösterilir; onay gelince hesap açılır.
 * Bu kısa ömürlü jeton, onay ekranı açıkken Google'dan alınan profil bilgisini taşır (15 dakika).
 */
export type GoogleSignupProfile = {
  email: string;
  googleId: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  avatar: string | null;
  preferredLanguage: "tr" | "en";
};

type Payload = GoogleSignupProfile & { typ: "google_signup" };

export function signGoogleSignupToken(profile: GoogleSignupProfile): string {
  const payload: Payload = { ...profile, typ: "google_signup" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyGoogleSignupToken(token: string): GoogleSignupProfile {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid signup token.");
  }
  const p = decoded as Partial<Payload>;
  if (p.typ !== "google_signup" || typeof p.email !== "string" || typeof p.googleId !== "string") {
    throw new Error("Invalid signup token.");
  }
  return {
    email: p.email,
    googleId: p.googleId,
    name: p.name ?? null,
    givenName: p.givenName ?? null,
    familyName: p.familyName ?? null,
    avatar: p.avatar ?? null,
    preferredLanguage: p.preferredLanguage === "tr" ? "tr" : "en",
  };
}
