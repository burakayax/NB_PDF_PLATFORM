import { beforeEach, describe, expect, it, vi } from "vitest";

/** Hesap silinince ilişkiyle bağlı OLMAYAN kişisel veriler (taramalar, ekip üyeliği) de silinmeli. */
const m = vi.hoisted(() => ({ scans: vi.fn(), members: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({
  prisma: { scannedDocument: { deleteMany: m.scans }, teamMember: { deleteMany: m.members } },
}));

import { purgeUserDataBeforeDelete } from "../lib/account-purge.js";

beforeEach(() => vi.clearAllMocks());

describe("purgeUserDataBeforeDelete", () => {
  it("yalnız o kullanıcının taramalarını ve ekip üyeliğini siler", async () => {
    m.scans.mockResolvedValue({ count: 3 });
    m.members.mockResolvedValue({ count: 1 });
    const r = await purgeUserDataBeforeDelete("u1");
    expect(m.scans).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(m.members).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(r).toEqual({ scans: 3, teamMemberships: 1 });
  });

  it("silme başarısızsa hata fırlatır (hesap silinmemeli)", async () => {
    m.scans.mockRejectedValue(new Error("db down"));
    m.members.mockResolvedValue({ count: 0 });
    await expect(purgeUserDataBeforeDelete("u1")).rejects.toThrow("db down");
  });
});
