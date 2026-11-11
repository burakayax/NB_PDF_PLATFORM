import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const h = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), query: vi.fn(), open: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({ prisma: { paymentCheckout: { findUnique: h.findUnique, update: h.update } } }));
vi.mock("../modules/payment/paytr/paytr.service.js", () => ({ getPaytrCredentials: () => ({ merchantId: "1" }) }));
vi.mock("../modules/payment/paytr/paytr.client.js", () => ({ queryPaytrStatus: h.query }));
vi.mock("../lib/feature-switches.js", () => ({ exportExemptionOpen: h.open }));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

process.env.BILLING_ENCRYPTION_KEY = "k".repeat(64);
const { lookupBinCountry, resetBinCountryCache } = await import("../lib/bin-country.js");
const { captureCardEvidence, readCardEvidence, verdictFromCountry, isTurkishOnlyBrand } = await import(
  "../modules/payment/card-evidence.service.js"
);
const { decryptField, encryptField } = await import("../lib/encryption.js");

const CO = { id: "c1", conversationId: "oid-1", paymentCurrency: "USD", iyzicoPaymentId: "paytr:abc" };
let dir: string;

function useList(content: string) {
  dir = mkdtempSync(path.join(tmpdir(), "bin-"));
  const f = path.join(dir, "l.csv");
  writeFileSync(f, content);
  process.env.BIN_COUNTRY_LIST_PATH = f;
  resetBinCountryCache();
}
function cleanList() {
  delete process.env.BIN_COUNTRY_LIST_PATH;
  resetBinCountryCache();
  rmSync(dir, { recursive: true, force: true });
}

describe("lookupBinCountry (yerel liste)", () => {
  beforeEach(() => useList("# yorum\n454360,TR\n411111,US\n41111122,DE\nbozuk\n"));
  afterEach(cleanList);

  it("listedeki BIN'in ülkesini, en uzun öneki tercih ederek bulur", () => {
    expect(lookupBinCountry("454360")).toBe("TR");
    expect(lookupBinCountry("411111")).toBe("US");
    expect(lookupBinCountry("41111122")).toBe("DE");
  });
  it("listede olmayan/kısa BIN ve boş girdi → null (bilinmiyor)", () => {
    expect(lookupBinCountry("999999")).toBeNull();
    expect(lookupBinCountry("4543")).toBeNull();
    expect(lookupBinCountry(null)).toBeNull();
  });
  it("liste dosyası yoksa her şey bilinmiyor", () => {
    process.env.BIN_COUNTRY_LIST_PATH = path.join(dir, "yok.csv");
    resetBinCountryCache();
    expect(lookupBinCountry("454360")).toBeNull();
  });
});

describe("captureCardEvidence", () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset());
    h.open.mockResolvedValue(true);
    h.findUnique.mockResolvedValue({ cardCountry: null });
    h.update.mockResolvedValue({});
    useList("454360,TR\n411111,US\n");
  });
  afterEach(cleanList);

  it("yabancı kart: BIN şifreli yazılır, ülke kaydedilir, düz BIN kayıtta yoktur", async () => {
    h.query.mockResolvedValue({ ok: true, raw: { masked_pan: "411111AAAAAA1234", kart_marka: "VISA" } });
    expect(await captureCardEvidence(CO)).toBe("FOREIGN");
    const data = h.update.mock.calls[0][0].data;
    expect(data.cardCountry).toBe("US");
    expect(data.cardBin).not.toContain("411111");
    expect(decryptField(data.cardBin)).toBe("411111");
    expect(JSON.stringify(data)).not.toContain("1234");
  });
  it("Türk-özel marka, BIN yabancı görünse bile TR sayar (güvenli taraf)", async () => {
    h.query.mockResolvedValue({ ok: true, raw: { masked_pan: "411111AAAAAA1234", kart_marka: "BONUS" } });
    expect(await captureCardEvidence(CO)).toBe("TR");
    expect(h.update.mock.calls[0][0].data.cardCountry).toBe("TR");
  });
  it("BIN listede yoksa bilinmiyor (??) yazılır", async () => {
    h.query.mockResolvedValue({ ok: true, raw: { masked_pan: "999999AAAAAA1234", kart_marka: "MASTERCARD" } });
    expect(await captureCardEvidence(CO)).toBe("UNKNOWN");
    expect(h.update.mock.calls[0][0].data.cardCountry).toBe("??");
  });
  it("PayTR kart bilgisi vermezse (test modu) bilinmiyor; BIN yazılmaz", async () => {
    h.query.mockResolvedValue({ ok: true, raw: {} });
    expect(await captureCardEvidence(CO)).toBe("UNKNOWN");
    expect(h.update.mock.calls[0][0].data).toEqual({ cardCountry: "??", cardBin: null });
  });
  it("istisna anahtarı kapalıyken, TRY'de ve PayTR dışı ödemede hiçbir şey yapmaz", async () => {
    h.open.mockResolvedValue(false);
    expect(await captureCardEvidence(CO)).toBeNull();
    h.open.mockResolvedValue(true);
    expect(await captureCardEvidence({ ...CO, paymentCurrency: "TRY" })).toBeNull();
    expect(await captureCardEvidence({ ...CO, iyzicoPaymentId: "12345" })).toBeNull();
    expect(h.query).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });
  it("PayTR hatasında fırlatmaz, null döner", async () => {
    h.query.mockRejectedValue(new Error("timeout"));
    expect(await captureCardEvidence(CO)).toBeNull();
  });
  it("zaten kaydı olan ödemede PayTR'a tekrar sormaz", async () => {
    h.findUnique.mockResolvedValue({ cardCountry: "DE" });
    expect(await captureCardEvidence(CO)).toBe("FOREIGN");
    expect(h.query).not.toHaveBeenCalled();
  });
});

describe("readCardEvidence / yardımcılar", () => {
  beforeEach(() => h.findUnique.mockReset());

  it("şifreli BIN'i çözer; eski düz 6 haneyi olduğu gibi okur; kayıt yoksa null", async () => {
    h.findUnique.mockResolvedValue({ cardBin: encryptField("454360"), cardCountry: "TR" });
    expect(await readCardEvidence("oid-1")).toEqual({ bin: "454360", country: "TR", verdict: "TR" });
    h.findUnique.mockResolvedValue({ cardBin: "411111", cardCountry: "US" });
    expect(await readCardEvidence("oid-1")).toMatchObject({ bin: "411111", verdict: "FOREIGN" });
    h.findUnique.mockResolvedValue({ cardBin: null, cardCountry: null });
    expect(await readCardEvidence("oid-1")).toBeNull();
  });
  it("karar ve marka kuralları", () => {
    expect(verdictFromCountry("TURKEY")).toBe("TR");
    expect(verdictFromCountry("??")).toBe("UNKNOWN");
    expect(verdictFromCountry(null)).toBe("UNKNOWN");
    expect(verdictFromCountry("DE")).toBe("FOREIGN");
    expect(isTurkishOnlyBrand("Bonus")).toBe(true);
    expect(isTurkishOnlyBrand("VISA")).toBe(false);
  });
});
