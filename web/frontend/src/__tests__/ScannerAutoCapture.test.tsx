/**
 * BELGE TARAYICI — otomatik çekimin plana göre ayrılması.
 *
 * Kural: otomatik çekim (telefonu tutunca kendiliğinden fotoğraf çekme) ÜCRETLİ
 * plana özeldir. Ücretsiz planda kullanıcı deklanşöre basar; kenarlar çekimden
 * sonra bulunur. Bu ayrım hem ürün vaadi hem dönüşüm için kritik olduğundan
 * testle sabitlenmiştir.
 *
 * Test edilenler:
 *   1. Ücretsiz planda "Otomatik" aç/kapa düğmesi YOKTUR; yerine Pro çağrısı vardır.
 *   2. Ücretli planda "Otomatik" aç/kapa düğmesi vardır, Pro çağrısı yoktur.
 *   3. Ücretsiz plandaki Pro çağrısına tıklayınca yükseltme paneli açılır ve
 *      ilk fayda olarak otomatik çekimi anlatır.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentScanner } from "../components/tools/DocumentScanner";

// Kamera ve ağır yollar testte çalışmasın.
vi.mock("../lib/documentScan", () => ({
  detectDocumentQuad: vi.fn(async () => null),
  // Canlı döngü artık klasik + sinir ağı karışımını kullanıyor; ısıtma da eklendi.
  olcumAl: vi.fn(async () => null),
  isitScanner: vi.fn(async () => undefined),
  warpDocument: vi.fn(async (c: unknown) => c),
  cropQuadFallback: vi.fn((c: unknown) => c),
  canvasToJpegBlob: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
  fullFrameQuad: (w: number, h: number) => [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
}));
vi.mock("../lib/clientPdfWorker", () => ({
  imagesToPdf: vi.fn(async () => new Uint8Array([1])),
  pdfBytesToBlob: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
}));
vi.mock("../lib/clientPdf", () => ({ imagesToSearchablePdf: vi.fn() }));
vi.mock("../lib/ocr", () => ({ ocrImagesToWords: vi.fn() }));
vi.mock("../api/scans", () => ({ uploadScanToLibrary: vi.fn() }));

function fakeCamera() {
  const track = { stop: vi.fn() };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      // Telefon benzetimi: açılan parça ARKA kamera olduğunu bildirir.
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [track],
        getVideoTracks: () => [{ ...track, getSettings: () => ({ facingMode: "environment" }) }],
      })),
      // Kamera taraması artık ekran genişliğine değil ARKA KAMERA varlığına
      // bakıyor; sahte cihaz listesi olmadan bileşen "kamera yok" ekranını açar.
      enumerateDevices: vi.fn(async () => [
        { kind: "videoinput", deviceId: "arka", label: "back camera" },
      ]),
    },
  });
  // jsdom'da video.play() yok.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn(async () => undefined),
  });
}

const baseProps = {
  open: true,
  language: "tr" as const,
  onClose: vi.fn(),
  isDesktop: false,
};

beforeEach(() => {
  fakeCamera();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("Belge Tarayıcı — otomatik çekim plan ayrımı", () => {
  it("ücretsiz planda otomatik çekim düğmesi yok, Pro çağrısı var", async () => {
    render(<DocumentScanner {...baseProps} isPro={false} />);
    await waitFor(() => expect(screen.getByText(/Otomatik çekim: Pro/)).toBeInTheDocument());
    expect(screen.queryByText(/Otomatik Açık/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Otomatik Kapalı/)).not.toBeInTheDocument();
  });

  it("ücretli planda otomatik çekim düğmesi var, Pro çağrısı yok", async () => {
    render(<DocumentScanner {...baseProps} isPro />);
    await waitFor(() => expect(screen.getByText(/Otomatik Açık/)).toBeInTheDocument());
    expect(screen.queryByText(/Otomatik çekim: Pro/)).not.toBeInTheDocument();
  });

  it("ücretsiz planda Pro çağrısı yükseltme panelini açar", async () => {
    render(<DocumentScanner {...baseProps} isPro={false} />);
    const chip = await screen.findByText(/Otomatik çekim: Pro/);
    fireEvent.click(chip);
    expect(await screen.findByText(/Otomatik Çekim — Pro/)).toBeInTheDocument();
    expect(screen.getByText(/kenarları canlı bulur/)).toBeInTheDocument();
  });
});

describe("kamera taraması cihaz yeteneğine göre açılır", () => {
  it("arka kamera yoksa kamera ekranı yerine yükleme ekranı gösterilir", async () => {
    // Dizüstü bilgisayar: yalnız ön kamera → arka kamera isteği reddedilir.
    // Dizüstü: kamera açılır ama ÖN kameradır ve cihaz dokunmatik değildir.
    const t = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [t],
          getVideoTracks: () => [{ ...t, getSettings: () => ({ facingMode: "user" }) }],
        })),
      },
    });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });

    render(<DocumentScanner {...baseProps} isPro isDesktop={false} onUpgrade={vi.fn()} />);

    // Ekran genişliğinden bağımsız: ön kamerayla belge taranmaz, telefona yönlendirilir.
    expect(await screen.findByText(/telefonda kullanılır/i)).toBeTruthy();
  });
});
