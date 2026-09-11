/**
 * İşlem öncesi kontroller — kullanıcı "başlat" dediğinde ne engellenir.
 *
 * Bu kontroller kullanıcının gördüğü ilk savunma hattı. Biri sessizce atlanırsa
 * ya boş bir belge üretilir ya da sunucuya anlamsız bir istek gider. Her
 * kuralın hâlâ yerinde olduğu burada sabitlenmiştir.
 */
import { describe, it, expect } from "vitest";
import {
  checkToolSubmission,
  type ToolSubmissionInput,
} from "../lib/toolSubmissionCheck";

function base(over: Partial<ToolSubmissionInput> = {}): ToolSubmissionInput {
  return {
    featureId: "compress",
    uploads: [{ pageCount: 10, encrypted: false }],
    pagesText: "",
    deletePagesText: "",
    password: "",
    unlockOpenPassword: "",
    inputPassword: "",
    outputPassword: "",
    showSplitPasswordField: false,
    showEncryptSourcePasswordField: false,
    showUnlockPasswordField: false,
    mergeHasMissingPasswords: false,
    hasAccessToken: true,
    excelConfirmed: true,
    language: "tr",
    ...over,
  };
}

describe("checkToolSubmission", () => {
  it("dosya seçilmediğinde durdurur", () => {
    const r = checkToolSubmission(base({ uploads: [] }));
    expect(r.ok).toBe(false);
    expect(r.toast?.title).toBe("Dosya seçilmedi");
  });

  it("adresten PDF üretmede dosya istemez", () => {
    expect(
      checkToolSubmission(base({ featureId: "html-to-pdf", uploads: [] })).ok,
    ).toBe(true);
  });

  it("birleştirmede dosya listesi boşken bu kontrol devreye girmez", () => {
    expect(checkToolSubmission(base({ featureId: "merge", uploads: [] })).ok).toBe(
      true,
    );
  });

  it("ayırmada sayfa numarası zorunlu", () => {
    const r = checkToolSubmission(base({ featureId: "split", pagesText: "  " }));
    expect(r.ok).toBe(false);
    expect(r.pagesError).toBeTruthy();
    expect(r.toast?.title).toBe("Sayfa numaraları geçersiz");
  });

  it("ayırmada belgedeki sayfadan fazlasını istemek engellenir", () => {
    const r = checkToolSubmission(
      base({ featureId: "split", pagesText: "1-99" }),
    );
    expect(r.ok).toBe(false);
    expect(r.pagesError).toBeTruthy();
  });

  it("geçerli sayfa listesinde önceki hata temizlenir", () => {
    const r = checkToolSubmission(base({ featureId: "split", pagesText: "1-3" }));
    expect(r.ok).toBe(true);
    expect(r.pagesError).toBe("");
  });

  it("şifreli belgede sayfa sayısı bilinmiyorsa önce parola ister", () => {
    const r = checkToolSubmission(
      base({
        featureId: "split",
        pagesText: "1-3",
        uploads: [{ pageCount: null, encrypted: true }],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.pagesError).toBeTruthy();
  });

  it("tüm sayfaları silmeye izin vermez", () => {
    const r = checkToolSubmission(
      base({
        featureId: "delete-pages",
        deletePagesText: "1-10",
        uploads: [{ pageCount: 10, encrypted: false }],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.toast?.title).toBe("Uyarı");
    expect(r.deletePagesError).toBeTruthy();
  });

  it("bir sayfa kalıyorsa silmeye izin verir", () => {
    const r = checkToolSubmission(
      base({ featureId: "delete-pages", deletePagesText: "1-9" }),
    );
    expect(r.ok).toBe(true);
    expect(r.deletePagesError).toBe("");
  });

  it("zorunlu parola alanları boşken durdurur", () => {
    expect(
      checkToolSubmission(base({ showSplitPasswordField: true })).toast?.title,
    ).toBe("Kaynak PDF şifresi gerekli");
    expect(
      checkToolSubmission(base({ showUnlockPasswordField: true })).toast?.title,
    ).toBe("Parola gerekli");
    expect(
      checkToolSubmission(base({ showEncryptSourcePasswordField: true })).toast
        ?.title,
    ).toBe("Kaynak PDF şifresi gerekli");
  });

  it("şifrelemede yeni parola zorunlu", () => {
    const r = checkToolSubmission(base({ featureId: "encrypt" }));
    expect(r.ok).toBe(false);
    expect(r.toast?.title).toBe("Yeni PDF şifresi gerekli");

    expect(
      checkToolSubmission(base({ featureId: "encrypt", outputPassword: "abc" }))
        .ok,
    ).toBe(true);
  });

  it("birleştirmede doğrulanmamış parola varsa durdurur", () => {
    const r = checkToolSubmission(
      base({ featureId: "merge", mergeHasMissingPasswords: true }),
    );
    expect(r.ok).toBe(false);
    expect(r.toast?.title).toBe("Şifre doğrulaması gerekli");
  });

  it("oturum yoksa durdurur", () => {
    const r = checkToolSubmission(base({ hasAccessToken: false }));
    expect(r.ok).toBe(false);
    expect(r.toast?.title).toBe("Oturum gerekli");
  });

  it("Excel dönüşümünde onay penceresi istenir, hata sayılmaz", () => {
    const r = checkToolSubmission(
      base({ featureId: "pdf-to-excel", excelConfirmed: false }),
    );
    expect(r.ok).toBe(false);
    expect(r.askExcelConfirm).toBe(true);
    expect(r.toast).toBeUndefined();

    expect(
      checkToolSubmission(base({ featureId: "pdf-to-excel", excelConfirmed: true }))
        .ok,
    ).toBe(true);
  });

  it("İngilizce arayüzde metinler çevrilir", () => {
    const r = checkToolSubmission(base({ uploads: [], language: "en" }));
    expect(r.toast?.title).toBe("No file selected");
  });
});
