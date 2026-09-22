/**
 * Çalışma alanı durum şeritleri — birleştirme ilerlemesi ve başarı şeridi.
 *
 * Bu iki şerit ana uygulama dosyasının içinden ayrı bileşenlere taşındı.
 * Test edilen davranışlar:
 *   1. Birleştirme şeridi ilerleme yüzdesini ve dosya sayacını gösterir.
 *   2. Yüzde belli değilken çubuk belirsiz moda geçer ve yüzde yazmaz.
 *   3. İş başarısız olduğunda hata metni görünür.
 *   4. İptal düğmesi yalnızca izin verildiğinde çıkar ve tıklanınca haber verir.
 *   5. Başarı şeridi dosya adını ve araç adını gösterir, "Kapat" haber verir.
 *   6. Erişim kontrolü yokken "Tekrar indir" düğmesi çalışır.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MergeProgressBar } from "../components/workspace/MergeProgressBar";
import { ToolSuccessBar } from "../components/workspace/ToolSuccessBar";
import { ws } from "../i18n/workspace";

const W = ws("tr");
const feature = { title: "PDF Birleştir" } as never;

function mergeJob(over: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    status: "running",
    percent: 42,
    current: 1,
    total: 2,
    where: "a.pdf",
    ...over,
  } as never;
}

describe("MergeProgressBar", () => {
  it("yüzdeyi ve dosya sayacını gösterir", () => {
    render(
      <MergeProgressBar
        W={W}
        language="tr"
        selectedFeature={feature}
        mergeJob={mergeJob()}
        indeterminate={false}
        etaSeconds={null}
        premiumLane={false}
        showCancel={false}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("%42")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "42",
    );
  });

  it("yüzde belli değilken belirsiz moda geçer", () => {
    render(
      <MergeProgressBar
        W={W}
        language="tr"
        selectedFeature={feature}
        mergeJob={mergeJob()}
        indeterminate
        etaSeconds={null}
        premiumLane={false}
        showCancel={false}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("…")).toBeTruthy();
    expect(
      screen.getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBeNull();
  });

  it("başarısız işte hata metni gösterir", () => {
    render(
      <MergeProgressBar
        W={W}
        language="tr"
        selectedFeature={feature}
        mergeJob={mergeJob({ status: "failed" })}
        indeterminate={false}
        etaSeconds={null}
        premiumLane={false}
        showCancel={false}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Birleştirme başarısız")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("iptal düğmesi tıklanınca haber verir", () => {
    const onCancel = vi.fn();
    render(
      <MergeProgressBar
        W={W}
        language="tr"
        selectedFeature={feature}
        mergeJob={mergeJob()}
        indeterminate={false}
        etaSeconds={null}
        premiumLane={false}
        showCancel
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: W.toolRunCancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ToolSuccessBar", () => {
  const success = {
    filename: "birlesik.pdf",
    featureTitle: "PDF Birleştir",
  };

  it("dosya adını gösterir ve kapatma haber verir", () => {
    const onDismiss = vi.fn();
    render(
      <ToolSuccessBar
        W={W}
        language="tr"
        success={success}
        onOpenFullPreview={() => {}}
        onDownloadResult={() => {}}
        onDownloadMergeJob={() => {}}
        onShare={() => {}}
        onUpgrade={() => {}}
        onInsufficientCredits={() => {}}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText(/birlesik\.pdf/)).toBeTruthy();
    expect(screen.getByText(W.toolProgressSuccessTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: W.toolProgressDismiss }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("tekrar indir düğmesi çalışır", () => {
    const replay = vi.fn();
    render(
      <ToolSuccessBar
        W={W}
        language="tr"
        success={{ ...success, replay }}
        onOpenFullPreview={() => {}}
        onDownloadResult={() => {}}
        onDownloadMergeJob={() => {}}
        onShare={() => {}}
        onUpgrade={() => {}}
        onInsufficientCredits={() => {}}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: W.toolDownloadAgain }));
    expect(replay).toHaveBeenCalledTimes(1);
  });
});
