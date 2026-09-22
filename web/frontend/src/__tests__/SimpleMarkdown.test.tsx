import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimpleMarkdown } from "../components/common/SimpleMarkdown";

/**
 * Yapay zekâ özetleri kalemleri markdown tablosu olarak yazıyor. Bu satırlar
 * ham hâlde ekrana basıldığında ("| Kalem | Adet |" ve "|----|----|") özet
 * profesyonel görünmüyordu; canlı testte bu şekilde görüldü.
 */
describe("SimpleMarkdown — tablo", () => {
  it("markdown tablosunu gerçek tabloya çevirir", () => {
    render(
      <SimpleMarkdown
        text={[
          "| Kalem | Adet | Tutar |",
          "|-------|------|-------|",
          "| Lisans | 2 | 7.000,00 TL |",
          "| Eğitim | 1 | 4.250,75 TL |",
        ].join("\n")}
      />,
    );

    const tablo = screen.getByRole("table");
    expect(tablo).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Kalem",
      "Adet",
      "Tutar",
    ]);
    // 2 veri satırı + 1 başlık satırı
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("7.000,00 TL")).toBeTruthy();
  });

  it("ayraç satırını ekrana basmaz", () => {
    const { container } = render(
      <SimpleMarkdown text={["| A | B |", "|---|---|", "| 1 | 2 |"].join("\n")} />,
    );
    expect(container.textContent).not.toContain("---");
  });

  it("tek satırlık boru işaretli metni tabloya çevirmez", () => {
    const { container } = render(<SimpleMarkdown text="| yalnız bir satır |" />);
    expect(container.querySelector("table")).toBeNull();
  });
});
