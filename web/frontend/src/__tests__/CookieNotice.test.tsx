/**
 * CookieNotice bileşen testleri.
 *
 * Test edilen davranışlar:
 *   1. visible=false olduğunda hiçbir şey render edilmez.
 *   2. visible=true olduğunda çerez bildirimi görünür.
 *   3. "Tümünü Kabul Et" butonu tıklandığında onAcceptAll çağrılır.
 *   4. "Yalnızca Zorunlu" butonu tıklandığında onAcceptNecessaryOnly çağrılır.
 *   5. "Tercihleri Özelleştir" açıldığında analitik/pazarlama checkbox'ları görünür.
 *   6. Özelleştirme ekranında "Tercihleri Kaydet" onSavePreferences'ı çağırır.
 *   7. İngilizce dil desteği çalışır.
 *   8. Dialog ARIA rolleri doğru.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CookieNotice } from "../components/common/CookieNotice";

// legalDocuments mock — gerçek uzun metni kullanmaya gerek yok
vi.mock("../content/legal", () => ({
  legalDocuments: {
    tr: {
      cookieNotice: {
        title: "Çerez Bildirimi",
        description: "Bu site çerez kullanır.",
        accept: "Kabul Et",
        learnMore: "Gizlilik politikası",
      },
    },
    en: {
      cookieNotice: {
        title: "Cookie Notice",
        description: "This site uses cookies.",
        accept: "Accept",
        learnMore: "Privacy policy",
      },
    },
  },
}));

const defaultProps = {
  language: "tr" as const,
  visible: true,
  onAcceptAll: vi.fn(),
  onAcceptNecessaryOnly: vi.fn(),
  onSavePreferences: vi.fn(),
  onOpenPrivacy: vi.fn(),
};

describe("CookieNotice — görünürlük", () => {
  it("visible=false ise hiçbir şey render etmez", () => {
    const { container } = render(<CookieNotice {...defaultProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("visible=true ise bildirimi gösterir", () => {
    render(<CookieNotice {...defaultProps} />);
    expect(screen.getByText("Çerez Bildirimi")).toBeInTheDocument();
  });

  it("açıklama metnini gösterir", () => {
    render(<CookieNotice {...defaultProps} />);
    expect(screen.getByText("Bu site çerez kullanır.")).toBeInTheDocument();
  });
});

describe("CookieNotice — buton tıklamaları", () => {
  it('"Tümünü Kabul Et" tıklanınca onAcceptAll çağrılır', () => {
    const onAcceptAll = vi.fn();
    render(<CookieNotice {...defaultProps} onAcceptAll={onAcceptAll} />);
    fireEvent.click(screen.getByRole("button", { name: /Tümünü Kabul Et/i }));
    expect(onAcceptAll).toHaveBeenCalledOnce();
  });

  it('"Yalnızca Zorunlu" tıklanınca onAcceptNecessaryOnly çağrılır', () => {
    const onAcceptNecessaryOnly = vi.fn();
    render(<CookieNotice {...defaultProps} onAcceptNecessaryOnly={onAcceptNecessaryOnly} />);
    fireEvent.click(screen.getByRole("button", { name: /Yalnızca Zorunlu/i }));
    expect(onAcceptNecessaryOnly).toHaveBeenCalledOnce();
  });

  it('"Gizlilik politikası" tıklanınca onOpenPrivacy çağrılır', () => {
    const onOpenPrivacy = vi.fn();
    render(<CookieNotice {...defaultProps} onOpenPrivacy={onOpenPrivacy} />);
    fireEvent.click(screen.getByRole("button", { name: /Gizlilik politikası/i }));
    expect(onOpenPrivacy).toHaveBeenCalledOnce();
  });
});

describe("CookieNotice — özelleştirme ekranı", () => {
  it('"Tercihleri Özelleştir" tıklanınca özelleştirme görünür', () => {
    render(<CookieNotice {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));
    expect(screen.getByLabelText(/Analitik/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pazarlama/i)).toBeInTheDocument();
  });

  it("Analitik varsayılan olarak işaretli gelir", () => {
    render(<CookieNotice {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));
    const analyticsCheckbox = screen.getByLabelText(/Analitik/i) as HTMLInputElement;
    expect(analyticsCheckbox.checked).toBe(true);
  });

  it("Pazarlama varsayılan olarak işaretsiz gelir", () => {
    render(<CookieNotice {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));
    const marketingCheckbox = screen.getByLabelText(/Pazarlama/i) as HTMLInputElement;
    expect(marketingCheckbox.checked).toBe(false);
  });

  it('"Tercihleri Kaydet" onSavePreferences\'i doğru değerlerle çağırır', () => {
    const onSavePreferences = vi.fn();
    render(<CookieNotice {...defaultProps} onSavePreferences={onSavePreferences} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));

    // Pazarlama'yı işaretle (analytics varsayılan true, errorMonitoring varsayılan false)
    fireEvent.click(screen.getByLabelText(/Pazarlama/i));
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Kaydet/i }));

    // Bileşen artık errorMonitoring alanını da gönderiyor
    expect(onSavePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ analytics: true, marketing: true }),
    );
  });

  it("Hata izleme varsayılan olarak işaretsiz gelir", () => {
    render(<CookieNotice {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));
    const sentryCheckbox = screen.getByLabelText(/Hata İzleme|Error Monitoring/i) as HTMLInputElement;
    expect(sentryCheckbox.checked).toBe(false);
  });

  it('"İptal" ana ekrana geri döner', () => {
    render(<CookieNotice {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Tercihleri Özelleştir/i }));
    fireEvent.click(screen.getByRole("button", { name: /İptal/i }));
    // Ana ekrana dönüldüğünde "Tümünü Kabul Et" tekrar görünür
    expect(screen.getByRole("button", { name: /Tümünü Kabul Et/i })).toBeInTheDocument();
  });
});

describe("CookieNotice — erişilebilirlik", () => {
  it("dialog ARIA rolü var", () => {
    render(<CookieNotice {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dialog aria-modal=true", () => {
    render(<CookieNotice {...defaultProps} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("dialog aria-label başlığı içeriyor", () => {
    render(<CookieNotice {...defaultProps} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Çerez Bildirimi");
  });
});

describe("CookieNotice — İngilizce dil desteği", () => {
  it("İngilizce içerik render eder", () => {
    render(<CookieNotice {...defaultProps} language="en" />);
    expect(screen.getByText("Cookie Notice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept All/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Necessary Only/i })).toBeInTheDocument();
  });
});
