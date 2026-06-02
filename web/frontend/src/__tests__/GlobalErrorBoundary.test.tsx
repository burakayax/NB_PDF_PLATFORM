/**
 * GlobalErrorBoundary bileşen testleri.
 *
 * Test ettiğimiz davranışlar:
 *   1. Hata yokken children'ı olduğu gibi render eder.
 *   2. Child hata fırlattığında fallback UI'yı gösterir.
 *   3. Fallback UI doğru başlık + açıklama içerir (TR ve EN).
 *   4. "Sayfayı Yenile" / "Reload Page" butonu mevcut.
 *   5. Sentry'e hata raporlanır (reportErrorToSentry çağrısı).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlobalErrorBoundary } from "../components/common/GlobalErrorBoundary";

// Sentry mock — gerçek DSN olmadan çalışır
vi.mock("../lib/sentry", () => ({
  reportErrorToSentry: vi.fn(),
}));

// Hata fırlatan yardımcı bileşen
function ErrorThrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error from child");
  return <div data-testid="child-ok">Çocuk bileşen</div>;
}

// Konsol hatalarını testlerde gizle (Error Boundary kasıtlı hata yakalar)
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GlobalErrorBoundary — hata olmadığında", () => {
  it("children'ı render eder", () => {
    render(
      <GlobalErrorBoundary>
        <ErrorThrower shouldThrow={false} />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByTestId("child-ok")).toBeInTheDocument();
  });

  it("fallback UI göstermez", () => {
    render(
      <GlobalErrorBoundary>
        <ErrorThrower shouldThrow={false} />
      </GlobalErrorBoundary>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("GlobalErrorBoundary — Türkçe fallback (varsayılan dil)", () => {
  it("hata sonrası fallback başlığı gösterir", () => {
    render(
      <GlobalErrorBoundary language="tr">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByText("Beklenmedik bir hata oluştu")).toBeInTheDocument();
  });

  it("Türkçe açıklama metni görünür", () => {
    render(
      <GlobalErrorBoundary language="tr">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByText(/Sayfayı yenileyerek tekrar deneyin/i)).toBeInTheDocument();
  });

  it('"Sayfayı Yenile" butonu var', () => {
    render(
      <GlobalErrorBoundary language="tr">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /Sayfayı Yenile/i })).toBeInTheDocument();
  });

  it("badge metni PDF PLATFORM gösterir", () => {
    render(
      <GlobalErrorBoundary language="tr">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByText("PDF PLATFORM")).toBeInTheDocument();
  });
});

describe("GlobalErrorBoundary — İngilizce fallback", () => {
  it('İngilizce başlık "Something went wrong" gösterir', () => {
    render(
      <GlobalErrorBoundary language="en">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it('"Reload Page" butonu var', () => {
    render(
      <GlobalErrorBoundary language="en">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /Reload Page/i })).toBeInTheDocument();
  });
});

describe("GlobalErrorBoundary — Sentry entegrasyonu", () => {
  it("hata yakalandığında reportErrorToSentry çağrılır", async () => {
    const { reportErrorToSentry } = await import("../lib/sentry");
    const spy = vi.mocked(reportErrorToSentry);
    spy.mockClear();

    render(
      <GlobalErrorBoundary language="en">
        <ErrorThrower shouldThrow />
      </GlobalErrorBoundary>,
    );

    expect(spy).toHaveBeenCalledOnce();
    const [capturedError] = spy.mock.calls[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe("Test error from child");
  });
});
