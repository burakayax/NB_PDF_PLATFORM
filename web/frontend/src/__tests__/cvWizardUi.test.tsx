import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CvWizard } from "../components/tools/cv/CvWizard";
import { CvForm } from "../components/tools/cv/CvForm";
import { CvLiveScore } from "../components/tools/cv/CvLiveScore";
import { CvFormCopy } from "../components/tools/cv/CvFormCopy";
import { EMPTY_CV, normalizeCv, sampleCv, type CvData } from "../components/tools/cv/cvModel";
import { getTemplate } from "../components/tools/cv/cvTemplates";
import { cefrSteps } from "../components/tools/cv/cvTemplates";

const tpl = getTemplate("sade");

function Harness({ initial, form }: { initial: CvData; form?: boolean }) {
  const [d, setD] = useState(initial);
  return form ? <CvForm data={d} onChange={setD} tpl={tpl} disabled={false} tr /> : (
    <>
      <CvWizard data={d} onChange={setD} tpl={tpl} tr disabled={false} onFullForm={() => {}} onDownload={() => {}} onOpenLinkedin={() => {}} onOpenDesign={() => {}} />
      <output data-testid="json">{JSON.stringify({ title: d.title, skills: d.skills.map((s) => s.name), summary: d.summary, exp: d.experience.map((e) => e.desc) })}</output>
    </>
  );
}

describe("sihirbaz", () => {
  it("meslek seç → ileri → tüm adımlar hatasız açılır", () => {
    render(<Harness initial={normalizeCv(EMPTY_CV)} />);
    fireEvent.click(screen.getByText("Satış / Satış Danışmanı"));
    expect(JSON.parse(screen.getByTestId("json").textContent!).title).toBe("Satış Danışmanı");
    const next = () => fireEvent.click(screen.getByText("Devam"));
    next(); // you
    expect(screen.getByText("Sizi tanıyalım")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ad soyad"), { target: { value: "Test Kişi" } });
    next(); // work
    fireEvent.click(screen.getByText("İş deneyimi ekle"));
    fireEvent.click(screen.getByText("Hazır cümleler"));
    fireEvent.click(screen.getByText("Aylık satış hedefini ortalama %[X] oranında aştı"));
    expect(JSON.parse(screen.getByTestId("json").textContent!).exp[0]).toContain("Aylık satış hedefini");
    next(); // edu
    next(); // skills
    fireEvent.click(screen.getByText("Beceri önerileri"));
    fireEvent.click(screen.getByText("Satış Raporlama"));
    expect(JSON.parse(screen.getByTestId("json").textContent!).skills).toContain("Satış Raporlama");
    next(); // summary
    fireEvent.click(screen.getByText("Özet taslakları"));
    fireEvent.click(screen.getByText(/Müşteri ihtiyaçlarını doğru analiz eden/));
    expect(JSON.parse(screen.getByTestId("json").textContent!).summary).toContain("satış profesyoneli");
    next(); // done
    expect(screen.getByText("CV'niz hazır!")).toBeTruthy();
  });

  it("örnek CV'yi açar ve bitiş adımına geçer", () => {
    render(<Harness initial={normalizeCv(EMPTY_CV)} />);
    fireEvent.click(screen.getByText("Muhasebe / Finans"));
    fireEvent.click(screen.getByText("Bu mesleğin örnek CV'sini aç"));
    expect(screen.getByText("CV'niz hazır!")).toBeTruthy();
  });
});

describe("tam form", () => {
  it("e-posta uyarısı ve fotoğraf alanı görünür", () => {
    const d = { ...normalizeCv(EMPTY_CV), email: "abc" };
    render(<Harness initial={d} form />);
    expect(screen.getByText(/E-posta adresi eksik/)).toBeTruthy();
    expect(screen.getByText("Fotoğraf ekle")).toBeTruthy();
  });
});

describe("canlı puan ve kopyalama", () => {
  it("boş CV'de teşvik, dolu CV'de puan", () => {
    const { rerender } = render(<CvLiveScore data={normalizeCv(EMPTY_CV)} tr onDetails={() => {}} />);
    expect(screen.getByText(/canlı olarak yükselir/)).toBeTruthy();
    rerender(<CvLiveScore data={sampleCv("tr")} tr onDetails={() => {}} />);
    expect(screen.getByRole("img", { name: /CV gücü yüzde/ })).toBeTruthy();
  });
  it("forma kopyala modalı alanları listeler", () => {
    render(<CvFormCopy data={sampleCv("tr")} tr onClose={vi.fn()} />);
    expect(screen.getByText("Elif Yılmaz")).toBeTruthy();
  });
  it("dil seviyesi kademeleri", () => {
    expect(cefrSteps("İleri (C1–C2)")).toBe(6);
    expect(cefrSteps("Orta-üstü (B2)")).toBe(4);
    expect(cefrSteps("Ana dil")).toBe(6);
    expect(cefrSteps("Başlangıç (A1–A2)")).toBe(2);
    expect(cefrSteps("iyi")).toBe(0);
  });
});

import { CvDesignPanel } from "../components/tools/cv/CvDesignPanel";

describe("tasarım paneli: etkin seçenek görünür", () => {
  it("varsayılan yazı tipi, başlık biçimi ve fotoğraf biçimi işaretli gelir; 'Şablonun…' seçeneği yok", () => {
    const sade = getTemplate("sade"); // arial, rule, rect
    const { container } = render(<CvDesignPanel data={normalizeCv(EMPTY_CV)} onChange={() => {}} disabled={false} tr tpl={sade} />);
    expect(screen.getByRole("radio", { name: "Arial" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Carlito" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: "Alt çizgi" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Dikdörtgen" }).getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).not.toMatch(/Şablonun yazı tipi|Şablonun rengi|Şablonun\b/);
    expect(container.querySelector('[aria-pressed="true"]')).toBeTruthy(); // etkin renk
  });
  it("şablonun kendi yazı tipini seçmek varsayılana döner (null)", () => {
    const sade = getTemplate("sade");
    const spy = vi.fn();
    render(<CvDesignPanel data={{ ...normalizeCv(EMPTY_CV), settings: { ...normalizeCv(EMPTY_CV).settings, font: "times" } }} onChange={spy} disabled={false} tr tpl={sade} />);
    fireEvent.click(screen.getByRole("radio", { name: "Arial" }));
    expect(spy.mock.calls[0][0].settings.font).toBeNull();
  });
});

import { CvSectionManager } from "../components/tools/cv/CvSectionManager";
import { GRADUATE_ORDER } from "../components/tools/cv/CvForm";
import { CvPage } from "../components/tools/cv/cvTemplates";
import { buildModel } from "../components/tools/cv/cvModel";

describe("bölüm yöneticisi", () => {
  it("anahtar bölümü gizler/gösterir, klavye ile sıra değişir", () => {
    const spy = vi.fn();
    const d = normalizeCv(EMPTY_CV);
    render(<CvSectionManager data={d} onChange={spy} tr graduateOrder={GRADUATE_ORDER} />);
    fireEvent.click(screen.getByRole("switch", { name: /Profil: gizle/ }));
    expect(spy.mock.calls[0][0].settings.hidden).toContain("summary");
    const handle = screen.getByRole("button", { name: /Profil sırasını değiştir/ });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(spy.mock.calls[1][0].settings.order[0]).toBe("experience");
    expect(spy.mock.calls[1][0].settings.order[1]).toBe("summary");
  });
});

describe("özel bölüm görünümleri", () => {
  it("dört görünüm de hatasız çizilir ve metni içerir", () => {
    for (const style of ["detailed", "list", "tags", "cards"] as const) {
      const d = normalizeCv({ ...sampleCv("tr"), customSections: [{ id: "c1", title: "Ödüller", style, items: [{ id: "i1", title: "Yılın Çalışanı", subtitle: "Anadolu A.Ş.", date: "2022-05", desc: "Satışta birincilik" }] }] });
      const { container, unmount } = render(<CvPage m={buildModel(d, "export")} tpl={getTemplate("net")} size="m" accent={null} />);
      expect(container.textContent, style).toContain("Yılın Çalışanı");
      unmount();
    }
  });
});

describe("yeni mezun akışı", () => {
  it("yeni mezun seçilince eğitimden sonra 'Projeler' adımı gelir", () => {
    render(<Harness initial={normalizeCv(EMPTY_CV)} />);
    expect(screen.getByText(/Adım 1 \/ 7/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Yeni mezunum/));
    expect(screen.getByText(/Adım 1 \/ 8/)).toBeTruthy();
    fireEvent.click(screen.getByText("Satış / Satış Danışmanı"));
    const next = () => fireEvent.click(screen.getByText("Devam"));
    next();
    fireEvent.change(screen.getByLabelText("Ad soyad"), { target: { value: "Test Kişi" } });
    next(); // work
    next(); // edu
    next(); // projects
    expect(screen.getByText("Hangi projelerde yer aldınız?")).toBeTruthy();
    fireEvent.click(screen.getByText("Proje ekle"));
    expect(screen.getByLabelText("Proje adı")).toBeTruthy();
  });
});
