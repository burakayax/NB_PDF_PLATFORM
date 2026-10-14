import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCvStore } from "../components/tools/cv/useCvStore";
import { EMPTY_CV, normalizeCv } from "../components/tools/cv/cvModel";

describe("CV taslağı kullanıcıya özel", () => {
  beforeEach(() => localStorage.clear());
  it("A'nın CV'si B'ye görünmez", async () => {
    const a = renderHook(() => useCvStore("tr", true, "user-a"));
    act(() => a.result.current.setData(normalizeCv({ ...EMPTY_CV, name: "Ayşe A" })));
    await new Promise((r) => setTimeout(r, 700));
    a.unmount();
    const a2 = renderHook(() => useCvStore("tr", true, "user-a"));
    expect(a2.result.current.data.name).toBe("Ayşe A");
    const b = renderHook(() => useCvStore("tr", true, "user-b"));
    expect(b.result.current.data.name).toBe("");
  });
  it("eski hesapsız kayıt hiç kimseye yüklenmez", () => {
    localStorage.setItem("nb_cv_store_v2", JSON.stringify({ v: 2, currentId: "x", cvs: [{ id: "x", name: "CV 1", data: { name: "Eski Kişi" }, templateId: "sade", updatedAt: 1 }] }));
    const r = renderHook(() => useCvStore("tr", true, "user-b"));
    expect(r.result.current.data.name).toBe("");
  });
});
