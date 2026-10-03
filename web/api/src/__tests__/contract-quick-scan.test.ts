import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HIZLI TARAMA — güven kuralları:
 *  • tek model çağrısı (mevzuat araması / eleştirmen adımı YOK),
 *  • alıntısı belgede bulunamayan bulgu rapora girmez,
 *  • rapor "hızlı tarama" olarak işaretlenir, mevzuat kontrolü yapılmadığı AÇIKÇA yazılır,
 *  • hiçbir bulguya hukuki dayanak (kanun maddesi) eklenmez.
 */

vi.mock("../config/env.js", () => ({
  env: { ANTHROPIC_API_KEY: "test-key", CONTRACT_REVIEW_MODEL: "test-model" },
}));
vi.mock("../lib/app-logger.js", () => ({ logApiFailure: vi.fn() }));

const { runQuickScan, indexDocument, locateQuote } = await import("../modules/ai/contract-review.service.js");

const DOC = [
  "<<<SAYFA 1>>>",
  "MADDE 5 – GECİKME CEZASI Teslimatın gecikmesi halinde SATICI, gecikilen her gün için sözleşme bedelinin %1'i oranında cezai şart öder. Cezai şartın üst sınırı yoktur.",
  "<<<SAYFA 2>>>",
  "MADDE 7 – FESİH ALICI, herhangi bir gerekçe göstermeksizin sözleşmeyi 3 gün önceden yazılı bildirimle feshedebilir ve SATICI hiçbir bedel talep edemez.",
  "Bu belge, testin gerektirdiği en az karakter sayısına ulaşsın diye biraz daha metin içerir ve başka bir önemi yoktur. ".repeat(6),
].join("\n");

function sse(json: unknown): Response {
  const text = JSON.stringify(json);
  const ev = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  const body =
    ev({ type: "message_start", message: { usage: { input_tokens: 100, cache_read_input_tokens: 0 } } }) +
    ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
    ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }) +
    ev({ type: "content_block_stop", index: 0 }) +
    ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 50 } });
  return new Response(body, { status: 200 });
}

const input = {
  text: DOC,
  role: "satici" as const,
  sector: "ozel" as const,
  contractValue: "2.400.000 TL",
};

beforeEach(() => vi.restoreAllMocks());

describe("runQuickScan", () => {
  it("tek çağrı yapar; doğrulanamayan alıntıyı eler; mevzuat iddiası taşımaz", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sse({
        summary: "Cezanız tavansız, fesih tek taraflı.",
        riskLevel: "kritik",
        findings: [
          {
            id: "F1", severity: "kritik", category: "ceza", title: "Tavansız ceza", clause: "Madde 5",
            quote: "gecikilen her gün için sözleşme bedelinin %1'i oranında cezai şart öder. Cezai şartın üst sınırı yoktur.",
            whyRisky: "Tavan yok.", impact: "Günde 24.000 TL.", recommendation: "Tavan koyun.", suggestedText: "UYDURMA ÖNERİ",
            legalChecks: ["TBK ne diyor?"], confidence: "yuksek",
          },
          {
            id: "F2", severity: "yuksek", category: "diger", title: "Belgede olmayan alıntı", clause: "Madde 99",
            quote: "bu cümle belgede hiç geçmiyor ve bulunmamalı çünkü uydurma",
            whyRisky: "x", impact: "y", recommendation: "z", legalChecks: [], confidence: "orta",
          },
        ],
        missingClauses: [{ title: "Mücbir sebep", why: "Yok.", suggestedText: "Uzun öneri" }],
        questions: ["Ekler elinizde mi?"],
        assumptions: [],
      }),
    );

    const progress = vi.fn();
    const report = await runQuickScan(input, progress);

    // Yalnızca BİR model çağrısı (arama/eleştirmen yok)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).tools).toBeUndefined();

    expect(report.meta.mode).toBe("quick");
    expect(report.meta.lawCheck.performed).toBe(false);
    expect(report.meta.lawCheck.note).toMatch(/Hızlı taramada mevzuat kontrolü yapılmaz/);

    // Doğrulanamayan bulgu elendi ve bu şeffafça yazıldı
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]!.title).toBe("Tavansız ceza");
    expect(report.findings[0]!.page).toBe(1);
    expect(report.assumptions.join(" ")).toMatch(/alıntısı belge metninde doğrulanamadığı/);

    // Hukuki dayanak ve önerilen madde metni YOK (model uydurmuş olsa bile)
    expect(report.findings[0]!.legalReferences).toEqual([]);
    expect(report.findings[0]!.legalStatus).toBe("dogrulanamadi");
    expect(report.findings[0]!.suggestedText).toBe("");
    expect(report.missingClauses[0]!.suggestedText).toBe("");

    // Hızlı taramanın kapsamı kullanıcıya açıkça söylenir
    expect(report.assumptions.join(" ")).toMatch(/Hızlı tarama yapıldı/);
    expect(report.concernResponses).toEqual([]);
    expect(report.priorities).toEqual([]);
    expect(report.headline).toMatch(/hızlı tarama/);
    expect(progress).toHaveBeenCalledWith(0, expect.any(String), "");
    expect(progress).toHaveBeenCalledWith(1, expect.any(String), expect.any(String));
  });

  it("model riskLevel/özet vermezse bulgulardan türetir", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sse({
        findings: [
          {
            id: "F1", severity: "orta", category: "fesih", title: "Tek taraflı fesih",
            quote: "ALICI, herhangi bir gerekçe göstermeksizin sözleşmeyi 3 gün önceden yazılı bildirimle feshedebilir",
            whyRisky: "a", impact: "b", recommendation: "c", confidence: "orta",
          },
        ],
      }),
    );
    const report = await runQuickScan(input, vi.fn());
    expect(report.riskLevel).toBe("orta");
    expect(report.findings[0]!.page).toBe(2);
  });
});

describe("alıntı doğrulama (hızlı taramanın dayandığı)", () => {
  it("boşluk/satır farkına dayanıklı; olmayan metni 'none' döner", () => {
    const idx = indexDocument(DOC);
    expect(locateQuote(idx, "SATICI,   gecikilen her gün   için sözleşme bedelinin %1'i oranında cezai şart öder").match).toBe("exact");
    expect(locateQuote(idx, "tamamen alakasız ve belgede bulunmayan uzun bir cümle").match).toBe("none");
  });
});
