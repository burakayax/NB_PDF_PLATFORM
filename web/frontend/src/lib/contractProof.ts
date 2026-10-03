import type { ContractProof } from "../api/contractReview";

/** Doğrulama bilgisinin kullanıcıya görünen tek satırlık hâli (rapor altı / not sayfaları). */
export function proofFooter(proof: ContractProof): string {
  return `Rapor No: ${proof.reportId} · Üretim: ${proof.issuedAt.slice(0, 19).replace("T", " ")} UTC · Doğrulama kodu: ${proof.signature.slice(0, 16).toUpperCase()} · İçerik özeti (SHA-256): ${proof.reportSha256.slice(0, 16)}`;
}

export const PROOF_NOTE =
  "Rapor numarası ve doğrulama kodu, bu raporun PDF PLATFORM tarafından üretildiğini ve içeriğinin dosyaya gömülü kayıtla doğrulanabildiğini gösterir.";
