import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { purgeLegacyCvStorage, useCvDraft } from "../components/tools/cv/useCvDraft";
import { EMPTY_CV, normalizeCv } from "../components/tools/cv/cvModel";

describe("CV taslağı hiçbir yere kaydedilmez", () => {
  beforeEach(() => localStorage.clear());
  it("bilgi girilince tarayıcı depolamasına yazılmaz", async () => {
    const r = renderHook(() => useCvDraft("tr"));
    act(() => r.result.current.setData(normalizeCv({ ...EMPTY_CV, name: "Ayşe A", phone: "5320000000" })));
    await new Promise((res) => setTimeout(res, 700));
    expect(localStorage.length).toBe(0);
    r.unmount();
    const again = renderHook(() => useCvDraft("tr"));
    expect(again.result.current.data.name).toBe("");
  });
  it("eski sürümün bıraktığı CV kayıtları silinir", () => {
    localStorage.setItem("nb_cv_store_v2:user-a", "{}");
    localStorage.setItem("nb_cv_draft_v1", "{}");
    localStorage.setItem("baska", "kalir");
    purgeLegacyCvStorage();
    expect(localStorage.getItem("nb_cv_store_v2:user-a")).toBeNull();
    expect(localStorage.getItem("nb_cv_draft_v1")).toBeNull();
    expect(localStorage.getItem("baska")).toBe("kalir");
  });
});
