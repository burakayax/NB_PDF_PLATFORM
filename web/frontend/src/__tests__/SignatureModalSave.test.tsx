import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SignatureModal } from "../components/tools/PdfSign";

const noop = () => {};

describe("SignatureModal — imzayı kaydetme (üyeye özel)", () => {
  it("üyede kaydet kutusu var ve varsayılan işaretli", () => {
    render(<SignatureModal tr canSave onClose={noop} onDone={noop} onDoneText={noop} />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText(/yalnız bu cihazda saklanır/)).toBeTruthy();
  });

  it("misafirde kutu yok; ücretsiz hesap açma bağlantısı var", () => {
    render(<SignatureModal tr canSave={false} onClose={noop} onDone={noop} onDoneText={noop} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const link = screen.getByRole("link", { name: /ücretsiz hesap aç/ });
    expect(link.getAttribute("href")).toBe("/register");
  });

  it("yaz sekmesinde kaydetme satırı gösterilmez (metin imzası görsel değildir)", () => {
    const { container } = render(<SignatureModal tr canSave onClose={vi.fn()} onDone={noop} onDoneText={noop} />);
    // Başlangıç sekmesi "Çiz": kutu görünür. Yaz sekmesine geçince kaybolur.
    fireEvent.click(screen.getByRole("button", { name: /Yaz/ }));
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
