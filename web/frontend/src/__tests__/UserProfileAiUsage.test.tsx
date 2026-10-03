/**
 * UserProfilePanel — "AI Kullanımı" bölümü (AI erişimli planlar).
 * Bu bölüm mobil kullanıcının kalan AI hakkını profilden görmesini sağlar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserProfilePanel } from "../components/dashboard/UserProfilePanel";
import type { AuthUser } from "../api/auth";
import { writeAccessToken } from "../lib/accessTokenStore";

vi.mock("../api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/auth")>();
  return { ...original, deleteMyAccount: vi.fn(), userEffectiveHasPassword: vi.fn(() => true) };
});
vi.mock("../lib/passwordPolicy", () => ({
  validateNewPasswordPolicy: vi.fn(() => ({ ok: true, issues: [] })),
}));
vi.mock("../i18n/plans", () => ({ localizedPlanDisplayName: vi.fn(() => "Pro") }));
vi.mock("../api/saasBase", () => ({ getSaasApiBase: vi.fn(() => "http://localhost:4000") }));
vi.mock("../api/ai", () => ({
  fetchAiQuota: vi.fn(async () => ({
    used: 40,
    limit: 50,
    remaining: 10,
    bonus: 5,
    unlimited: false,
    resetAt: "2026-08-01T00:00:00Z",
  })),
}));

const proUser: AuthUser = {
  id: "u-pro",
  email: "pro@example.com",
  firstName: "Pro",
  lastName: "User",
  plan: "PRO",
  preferredLanguage: "tr",
  authProvider: "local",
  createdAt: new Date().toISOString(),
  isVerified: true,
};

const freeUser: AuthUser = { ...proUser, id: "u-free", plan: "FREE" };

const baseProps = {
  language: "tr" as const,
  updateProfile: vi.fn(async () => null),
  showToast: vi.fn(),
  onOpenChangePassword: vi.fn(),
  setInitialPassword: vi.fn(async () => null),
  onLogout: vi.fn(),
  accessToken: "jwt",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Erişim anahtarı artık tarayıcı deposunda değil bellekte tutuluyor
  // (güvenlik: depodaki anahtarı sayfadaki herhangi bir betik okuyabiliyordu).
  writeAccessToken("fake-token-for-test");
});

describe("UserProfilePanel — AI Kullanımı", () => {
  it("AI erişimli planda kalan/limit, kullanılan ve Ek AI butonu gösterir", async () => {
    render(<UserProfilePanel {...baseProps} user={proUser} />);
    expect(screen.getByText(/AI Kullanımı/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ek AI Kredisi Al/ })).toBeInTheDocument();
    // Kota yüklendikten sonra kullanım ayrıntıları
    expect(await screen.findByText(/Kullanılan: 40\/50/)).toBeInTheDocument();
    // İki cüzdan: aylık hak (10/50 kaldı) ve satın alınan kredi (5) AYRI gösterilir.
    expect(screen.getByText(/Aylık hak \(bu ay kalan\)/)).toBeInTheDocument();
    expect(screen.getByText(/Kredi \(satın alınan, süresi dolmaz\)/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("aylık hak ve kredi satırlarının ayrı \"?\" düğmeleri kendi açıklamalarını açar", async () => {
    render(<UserProfilePanel {...baseProps} user={proUser} />);
    await screen.findByText(/Kullanılan: 40\/50/);
    fireEvent.click(screen.getByRole("button", { name: /Aylık hak nedir/ }));
    expect(screen.getByText(/Her ay başında yenilenir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Kredi nedir/ }));
    expect(screen.getByText(/yalnızca krediden düşer/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sözleşme Denetçisi/).length).toBeGreaterThan(0);
  });

  it("AI erişimi olmayan (FREE) planda AI Kullanımı bölümü gösterilmez", () => {
    render(<UserProfilePanel {...baseProps} user={freeUser} />);
    expect(screen.queryByText(/AI Kullanımı/)).not.toBeInTheDocument();
  });
});
