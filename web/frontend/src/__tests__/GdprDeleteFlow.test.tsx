/**
 * GDPR Hesap Silme Akışı testleri (UserProfilePanel Danger Zone).
 *
 * Test edilen davranışlar:
 *   1. "Hesabımı kalıcı olarak sil" butonu başlangıçta görünür, form görünmez.
 *   2. Butona tıklayınca onay formu açılır.
 *   3. Onay metni yanlışken sil butonu disabled olur.
 *   4. Onay metni doğruyken sil butonu aktifleşir.
 *   5. Başarılı silme işleminde onLogout çağrılır.
 *   6. Hata durumunda toast hata mesajı gösterilir.
 *   7. "İptal" butonu formu kapatır.
 *   8. Google hesabı için şifre alanı gösterilmez.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserProfilePanel } from "../components/dashboard/UserProfilePanel";
import type { AuthUser } from "../api/auth";

// ── Mock'lar ──────────────────────────────────────────────────────────────────

vi.mock("../api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/auth")>();
  return {
    ...original,
    deleteMyAccount: vi.fn(),
    userEffectiveHasPassword: vi.fn(() => true),
  };
});

vi.mock("../lib/passwordPolicy", () => ({
  validateNewPasswordPolicy: vi.fn(() => ({ ok: true, issues: [] })),
}));

vi.mock("../i18n/plans", () => ({
  localizedPlanDisplayName: vi.fn(() => "Ücretsiz"),
}));

vi.mock("../api/saasBase", () => ({
  getSaasApiBase: vi.fn(() => "http://localhost:4000"),
}));

// ── Test yardımcıları ─────────────────────────────────────────────────────────

const baseUser: AuthUser = {
  id: "user-test-1",
  email: "test@example.com",
  firstName: "Test",
  lastName: "Kullanıcı",
  plan: "FREE",
  preferredLanguage: "tr",
  authProvider: "local",
  createdAt: new Date().toISOString(),
  isVerified: true,
};

const defaultProps = {
  user: baseUser,
  language: "tr" as const,
  updateProfile: vi.fn(async () => null),
  showToast: vi.fn(),
  onOpenChangePassword: vi.fn(),
  setInitialPassword: vi.fn(async () => null),
  onLogout: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("nbpdf-access-token", "fake-token-for-test");
});

// ── Testler ───────────────────────────────────────────────────────────────────

describe("GDPR Danger Zone — başlangıç durumu", () => {
  it("Danger Zone bölümü sayfada görünür", () => {
    render(<UserProfilePanel {...defaultProps} />);
    expect(screen.getByText(/Tehlikeli Alan/i)).toBeInTheDocument();
  });

  it('"Hesabımı kalıcı olarak sil" butonu görünür', () => {
    render(<UserProfilePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i })).toBeInTheDocument();
  });

  it("Başlangıçta onay formu görünmez", () => {
    render(<UserProfilePanel {...defaultProps} />);
    expect(screen.queryByLabelText(/Hesap şifrenizi girin/i)).not.toBeInTheDocument();
  });
});

describe("GDPR Danger Zone — form açma/kapama", () => {
  it("Sil butonuna tıklayınca onay formu açılır", async () => {
    render(<UserProfilePanel {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));
    expect(screen.getByLabelText(/Hesap şifrenizi girin/i)).toBeInTheDocument();
  });

  it('"İptal" tıklayınca form kapanır', async () => {
    render(<UserProfilePanel {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));
    // İptal butonunu bul (Delete Account bölümündeki İptal)
    const cancelButtons = screen.getAllByRole("button", { name: /İptal/i });
    await userEvent.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByLabelText(/Hesap şifrenizi girin/i)).not.toBeInTheDocument();
  });
});

describe("GDPR Danger Zone — onay doğrulama", () => {
  it("Onay metni yanlışken sil butonu disabled", async () => {
    render(<UserProfilePanel {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));

    const submitBtn = screen.getByRole("button", { name: /^Hesabı sil$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("Onay metni doğruyken sil butonu aktif", async () => {
    render(<UserProfilePanel {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));

    // Onay metnini yaz
    const confirmInput = screen.getByPlaceholderText(/hesabımı sil/i);
    await userEvent.type(confirmInput, "hesabımı sil");

    const submitBtn = screen.getByRole("button", { name: /^Hesabı sil$/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("Yarım onay metni butonu disabled bırakır", async () => {
    render(<UserProfilePanel {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));

    const confirmInput = screen.getByPlaceholderText(/hesabımı sil/i);
    await userEvent.type(confirmInput, "hesabımı");

    const submitBtn = screen.getByRole("button", { name: /^Hesabı sil$/i });
    expect(submitBtn).toBeDisabled();
  });
});

describe("GDPR Danger Zone — silme işlemi", () => {
  it("Başarılı silmede onLogout çağrılır", async () => {
    const { deleteMyAccount } = await import("../api/auth");
    vi.mocked(deleteMyAccount).mockResolvedValueOnce(undefined);

    const onLogout = vi.fn();
    render(<UserProfilePanel {...defaultProps} onLogout={onLogout} />);

    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));

    // Şifre gir
    const pwdInput = screen.getByLabelText(/Hesap şifrenizi girin/i);
    await userEvent.type(pwdInput, "mypassword123");

    // Onay metni gir
    const confirmInput = screen.getByPlaceholderText(/hesabımı sil/i);
    await userEvent.type(confirmInput, "hesabımı sil");

    await userEvent.click(screen.getByRole("button", { name: /^Hesabı sil$/i }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledOnce();
    });
  });

  it("Başarılı silmede success toast gösterilir", async () => {
    const { deleteMyAccount } = await import("../api/auth");
    vi.mocked(deleteMyAccount).mockResolvedValueOnce(undefined);

    const showToast = vi.fn();
    render(<UserProfilePanel {...defaultProps} showToast={showToast} />);

    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));
    await userEvent.type(screen.getByLabelText(/Hesap şifrenizi girin/i), "pass");
    await userEvent.type(screen.getByPlaceholderText(/hesabımı sil/i), "hesabımı sil");
    await userEvent.click(screen.getByRole("button", { name: /^Hesabı sil$/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("success", expect.any(String), expect.any(String));
    });
  });

  it("Hata durumunda error toast gösterilir", async () => {
    const { deleteMyAccount } = await import("../api/auth");
    vi.mocked(deleteMyAccount).mockRejectedValueOnce(new Error("Invalid password"));

    const showToast = vi.fn();
    render(<UserProfilePanel {...defaultProps} showToast={showToast} />);

    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));
    await userEvent.type(screen.getByLabelText(/Hesap şifrenizi girin/i), "wrong");
    await userEvent.type(screen.getByPlaceholderText(/hesabımı sil/i), "hesabımı sil");
    await userEvent.click(screen.getByRole("button", { name: /^Hesabı sil$/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("error", expect.any(String), expect.any(String));
    });
  });
});

describe("GDPR Danger Zone — Google hesabı", () => {
  it("Google hesabı için şifre alanı gösterilmez", async () => {
    render(
      <UserProfilePanel
        {...defaultProps}
        user={{ ...baseUser, authProvider: "google" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Hesabımı kalıcı olarak sil/i }));
    expect(screen.queryByLabelText(/Hesap şifrenizi girin/i)).not.toBeInTheDocument();
    // Ama onay metni alanı hâlâ var
    expect(screen.getByPlaceholderText(/hesabımı sil/i)).toBeInTheDocument();
  });
});
