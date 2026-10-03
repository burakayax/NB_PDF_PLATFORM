import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * SÖZLEŞME DENETÇİSİ — kullanıcıyı yanıltmama/zora sokmama kuralları:
 *  • taraf SESSİZCE seçilmez; seçilmeden hiçbir analiz başlamaz,
 *  • iki seçenek (hızlı / detaylı) kapsamı, süresi ve bedeliyle açıkça gösterilir,
 *  • kredi/hak yetmiyorsa "başlat" yerine "kredi al" gösterilir (boşa tıklatmaz),
 *  • yönetici hesabı hiçbir kredi uyarısı görmez.
 */

const TEXT = ("<<<SAYFA 1>>>\n" + "Bu sözleşme metni, testin gerektirdiği uzunluğa ulaşsın diye tekrarlanır ve başka anlamı yoktur. ".repeat(12)).trim();

vi.mock("../lib/contractPdf", () => ({
  CONTRACT_MAX_CHARS: 240_000,
  extractPdfTextPaged: vi.fn(async () => ({ text: TEXT, pageCount: 1, likelyScanned: false })),
  annotateContractPdf: vi.fn(),
  contractReportToMarkdown: vi.fn(() => ""),
}));
vi.mock("../lib/ocr", () => ({ ocrPdfToText: vi.fn() }));
vi.mock("../lib/summaryPdf", () => ({ summaryToPdf: vi.fn() }));
vi.mock("../components/common/ToolRating", () => ({ ToolRating: () => null }));
vi.mock("../components/tools/TopUpModal", () => ({ TopUpModal: () => <div data-testid="topup-open" /> }));

const quotaUser = { used: 10, limit: 40, remaining: 30, monthlyRemaining: 30, bonus: 0, unlimited: false, resetAt: "2026-11-01T00:00:00Z" };
const fetchAiQuota = vi.fn();
vi.mock("../api/ai", () => ({ fetchAiQuota: (...a: unknown[]) => fetchAiQuota(...a) }));

const prescanContract = vi.fn();
const startContractReview = vi.fn();
vi.mock("../api/contractReview", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../api/contractReview")>();
  return {
    ...orig,
    prescanContract: (...a: unknown[]) => prescanContract(...a),
    startContractReview: (...a: unknown[]) => startContractReview(...a),
    getContractReview: vi.fn(async () => ({ id: "j1", status: "running", mode: "quick", stageIndex: 0, stageCount: 2, stageLabel: "x", stageLabels: ["Belge taranıyor", "Alıntılar doğrulanıyor"], progressNote: "" })),
    deleteContractReview: vi.fn(),
  };
});

import { ContractReviewTool } from "../components/tools/ContractReviewTool";

const scan = {
  prescanId: "p1",
  docType: "Mal tedarik sözleşmesi",
  parties: [{ name: "Alfa A.Ş.", role: "ALICI" }, { name: "Beta Ltd.", role: "SATICI" }],
  sectorGuess: "ozel" as const,
  valueInDoc: "2.400.000 TL",
  pageCount: 1,
  questions: [{ id: "q1", question: "Sözleşme imzalandı mı?", why: "Müzakere mümkün mü?", options: ["Henüz imzalanmadı", "İmzalandı"] }],
  units: 90,
  quickUnits: 9,
};

async function uploadAndWaitForForm() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["%PDF"], "sozlesme.pdf", { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(/Belgeyi şöyle tanıdım/);
}

/** Onay penceresini aç → kutuyu işaretle → "Onayla ve başlat". */
async function confirmDialog() {
  await screen.findByRole("dialog", { name: /İşlemi onaylayın/ });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Onayla ve başlat" }));
}

function renderTool() {
  return render(<ContractReviewTool language="tr" accessToken="jwt" onLogin={vi.fn()} onUpgrade={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchAiQuota.mockResolvedValue(quotaUser);
  prescanContract.mockResolvedValue(scan);
  startContractReview.mockResolvedValue({ jobId: "j1", units: 9, mode: "quick", quota: quotaUser });
});

describe("ContractReviewTool — iki seçenek ve açık bilgilendirme", () => {
  it("taraf seçilmeden hiçbir düğme çalışmaz; seçilince başlar (hızlı tarama: mode=quick)", async () => {
    fetchAiQuota.mockResolvedValue({ ...quotaUser, bonus: 125, remaining: 155 }); // iki düğme de görünsün
    renderTool();
    await uploadAndWaitForForm();

    // Taraf varsayılan SEÇİLİ DEĞİL ve zorunlu olduğu söyleniyor
    expect(screen.getByText(/zorunlu — riskler sizin açınızdan/)).toBeInTheDocument();
    const quickBtn = screen.getByRole("button", { name: "Hızlı tara" });
    const fullBtn = screen.getByRole("button", { name: /Detaylı denetle/ });
    expect(quickBtn).toBeDisabled();
    expect(fullBtn).toBeDisabled();
    expect(screen.getByText(/Başlamadan önce yukarıda hangi tarafta olduğunuzu seçin/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    expect(quickBtn).toBeEnabled();
    fireEvent.click(quickBtn);

    // Onay penceresi açılır; kutu işaretlenmeden "başlat" kapalıdır ve hiçbir istek gitmez.
    await screen.findByRole("dialog", { name: /İşlemi onaylayın/ });
    expect(screen.getByRole("button", { name: "Onayla ve başlat" })).toBeDisabled();
    expect(startContractReview).not.toHaveBeenCalled();
    await confirmDialog();

    await waitFor(() => expect(startContractReview).toHaveBeenCalledTimes(1));
    const body = startContractReview.mock.calls[0]![0] as Record<string, unknown>;
    // Onay, sunucuya açıkça iletilir (sürüm + ekranda gösterilen bedel)
    expect(body.consent).toMatchObject({ accepted: true, units: 9 });
    expect((body.consent as { version: string }).version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.mode).toBe("quick");
    expect(body.role).toBe("satici");
    expect(body.prescanId).toBe("p1");
    // Ön sorunun cevabı (cevaplanmadıysa boş) da gönderilir
    expect(body.answers).toEqual([{ question: "Sözleşme imzalandı mı?", answer: "" }]);
  });

  it("iki seçeneğin kapsamı, süresi ve bedeli açıkça gösterilir", async () => {
    renderTool();
    await uploadAndWaitForForm();
    expect(screen.getByText(/yaklaşık 1-2 dakika · 9 hak/)).toBeInTheDocument();
    expect(screen.getByText(/yaklaşık 6-12 dakika · 90 kredi/)).toBeInTheDocument();
    // Hızlı taramanın EKSİKLERİ açıkça yazılır
    expect(screen.getByText(/Güncel mevzuat kontrolü yok/)).toBeInTheDocument();
    expect(screen.getByText(/Önerilen yeni madde metni yok/)).toBeInTheDocument();
    expect(screen.getByText(/Notlarınıza tek tek yanıt yazmaz/)).toBeInTheDocument();
    // Hangi cüzdandan düştüğü
    expect(screen.getByText(/Önce aylık hakkınızdan, hakkınız bitince krediden düşer/)).toBeInTheDocument();
    expect(screen.getByText(/Yalnızca satın alınan krediden düşer/)).toBeInTheDocument();
    // Başarısızlıkta iade, sonucun sayfada kalması, hukuki uyarı
    expect(screen.getByText(/başarısız olursa harcanan hak\/kredi iade edilir/)).toBeInTheDocument();
    expect(screen.getByText(/sayfayı kapatırsanız sonuç kaybolur/)).toBeInTheDocument();
    expect(screen.getByText(/hukuki danışmanlık değildir/)).toBeInTheDocument();
  });

  it("kredisi yetmeyen kullanıcıya detaylı denetimde 'Detaylı denetle' yerine kredi al gösterilir; hızlı tarama aylık haktan çalışır", async () => {
    renderTool(); // quotaUser: aylık 30, kredi 0 → detaylı (90 kredi) yetmez, hızlı (9 hak) yeter
    await uploadAndWaitForForm();
    expect(screen.getByRole("button", { name: /Krediniz yetmiyor — kredi paketlerini gör/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Detaylı denetle/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hızlı tara" })).toBeInTheDocument();
  });

  it("aylık hakkı ve kredisi hızlı taramaya da yetmiyorsa o düğme de 'kredi al' olur", async () => {
    fetchAiQuota.mockResolvedValue({ ...quotaUser, used: 40, remaining: 0, monthlyRemaining: 0, bonus: 0 });
    renderTool();
    await uploadAndWaitForForm();
    expect(screen.getByRole("button", { name: /Hakkınız yetmiyor — kredi paketlerini gör/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hızlı tara" })).not.toBeInTheDocument();
  });

  it("yeterli kredisi olan kullanıcı detaylı denetimi başlatabilir (mode=full)", async () => {
    fetchAiQuota.mockResolvedValue({ ...quotaUser, bonus: 125, remaining: 155 });
    startContractReview.mockResolvedValue({ jobId: "j2", units: 90, mode: "full", quota: quotaUser });
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "alici" } });
    fireEvent.click(screen.getByRole("button", { name: /Detaylı denetle/ }));
    await confirmDialog();
    await waitFor(() => expect(startContractReview).toHaveBeenCalled());
    const body = startContractReview.mock.calls[0]![0] as Record<string, unknown>;
    expect(body.mode).toBe("full");
    expect(body.consent).toMatchObject({ accepted: true, units: 90 });
  });

  it("YÖNETİCİ (sınırsız) hesapta kredi uyarısı çıkmaz, iki düğme de açık", async () => {
    fetchAiQuota.mockResolvedValue({ used: 0, limit: null, remaining: null, monthlyRemaining: null, bonus: 0, unlimited: true, resetAt: "" });
    renderTool();
    await uploadAndWaitForForm();
    expect(screen.queryByText(/yetmiyor/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    expect(screen.getByRole("button", { name: "Hızlı tara" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Detaylı denetle/ })).toBeEnabled();
  });

  it("belgeden okunan bedel ve otomatik tanınan tür kullanıcıya belirtilir (kontrol etsin)", async () => {
    renderTool();
    await uploadAndWaitForForm();
    expect(screen.getByDisplayValue("2.400.000 TL")).toBeInTheDocument();
    expect(screen.getByText(/belgeden okundu, lütfen kontrol edin/)).toBeInTheDocument();
    expect(screen.getByText(/belgeden otomatik tanındı — yanlışsa değiştirin/)).toBeInTheDocument();
  });

  it("kredi yetmezken seçilen düğme kredi penceresini açar", async () => {
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.click(screen.getByRole("button", { name: /Krediniz yetmiyor — kredi paketlerini gör/ }));
    expect(await screen.findByTestId("topup-open")).toBeInTheDocument();
  });

  it("onay penceresi bedeli, nereden düşeceğini, iade kuralını ve bakiyeyi açıkça gösterir", async () => {
    fetchAiQuota.mockResolvedValue({ ...quotaUser, bonus: 125, remaining: 155 }); // aylık 30, kredi 125
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    fireEvent.click(screen.getByRole("button", { name: /Detaylı denetle/ }));
    const dlg = await screen.findByRole("dialog", { name: /İşlemi onaylayın/ });
    const t = dlg.textContent ?? "";
    expect(t).toMatch(/Detaylı denetim/);
    expect(t).toMatch(/90 kredi/);
    expect(t).toMatch(/Yalnızca satın alınmış krediden \(aylık hakkınızdan düşmez\)/);
    expect(t).toMatch(/aylık hak 30 · kredi 125/); // şu an
    expect(t).toMatch(/aylık hak 30 · kredi 35/); // işlemden sonra (125 - 90)
    expect(t).toMatch(/Bedel, işlem başlar başlamaz düşülür/);
    expect(t).toMatch(/iade edilmez/);
    expect(t).toMatch(/otomatik iade edilir/);
    expect(t).toMatch(/hemen indirin/);
    expect(t).toMatch(/hukuki danışmanlık değildir/);
    expect(t).toMatch(/kayıt altına alınır/);
  });

  it("hızlı tarama onayında düşüm sırası (önce aylık hak) ve eksik özellikler yazar", async () => {
    renderTool(); // aylık 30, kredi 0
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    fireEvent.click(screen.getByRole("button", { name: "Hızlı tara" }));
    const t = (await screen.findByRole("dialog", { name: /İşlemi onaylayın/ })).textContent ?? "";
    expect(t).toMatch(/9 hak/);
    expect(t).toMatch(/Önce aylık hakkınızdan, bitince satın alınmış krediden/);
    expect(t).toMatch(/aylık hak 21 · kredi 0/); // 30 - 9
    expect(t).toMatch(/mevzuat kontrolü, önerilen madde metni ve notlarınıza tek tek yanıt yoktur/);
  });

  it("Vazgeç denirse hiçbir istek gitmez ve hak düşmez", async () => {
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    fireEvent.click(screen.getByRole("button", { name: "Hızlı tara" }));
    await screen.findByRole("dialog", { name: /İşlemi onaylayın/ });
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /İşlemi onaylayın/ })).not.toBeInTheDocument());
    expect(startContractReview).not.toHaveBeenCalled();
  });

  it("sunucu farklı bir bedel bildirirse işlem başlamaz, yeni bedel yeniden onaylatılır", async () => {
    startContractReview.mockRejectedValueOnce(Object.assign(new Error("Bedel güncellendi: bu işlem 11 hak harcar."), { status: 409, code: "price_changed", units: 11 }));
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    fireEvent.click(screen.getByRole("button", { name: "Hızlı tara" }));
    await confirmDialog();
    // Yeni bedelle pencere yeniden açılır
    const dlg = await screen.findByRole("dialog", { name: /İşlemi onaylayın/ });
    await waitFor(() => expect(dlg.textContent).toMatch(/11 hak/));
    expect(screen.getByRole("button", { name: "Onayla ve başlat" })).toBeDisabled(); // yeniden onay gerekir
    fireEvent.click(screen.getByRole("checkbox"));
    startContractReview.mockResolvedValueOnce({ jobId: "j9", units: 11, mode: "quick", quota: quotaUser });
    fireEvent.click(screen.getByRole("button", { name: "Onayla ve başlat" }));
    await waitFor(() => expect(startContractReview).toHaveBeenCalledTimes(2));
    expect((startContractReview.mock.calls[1]![0] as { consent: { units: number } }).consent.units).toBe(11);
  });

  it("YÖNETİCİ onay penceresinde 'hiçbir şey düşülmez' görür; iade/kredi uyarısı çıkmaz", async () => {
    fetchAiQuota.mockResolvedValue({ used: 0, limit: null, remaining: null, monthlyRemaining: null, bonus: 0, unlimited: true, resetAt: "" });
    renderTool();
    await uploadAndWaitForForm();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "satici" } });
    fireEvent.click(screen.getByRole("button", { name: /Detaylı denetle/ }));
    const t = (await screen.findByRole("dialog", { name: /İşlemi onaylayın/ })).textContent ?? "";
    expect(t).toMatch(/Yönetici hesabı: hiçbir şey düşülmez/);
    expect(t).not.toMatch(/iade edilmez/);
  });
});
