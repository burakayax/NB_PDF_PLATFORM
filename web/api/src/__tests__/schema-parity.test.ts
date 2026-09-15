/**
 * İki Prisma şeması AYNI modelleri tanımlamalı.
 *
 * NEDEN: Yerel geliştirme `schema.prisma` (SQLite), üretim derlemesi
 * `schema.postgres.prisma` (Render/PostgreSQL) kullanıyor. Yeni bir model
 * yalnızca birine eklendiğinde yerelde her şey yeşil görünür ama ÜRETİM
 * DERLEMESİ kırılır: Prisma istemcisi o tabloyu üretmez ve TypeScript
 * `prisma.<model>` erişimlerini tanımaz.
 *
 * Bu test o sessiz ayrışmayı yerelde, push'tan önce yakalar.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prisma");

function read(file: string): string {
  return readFileSync(join(prismaDir, file), "utf8");
}

/** Şemadaki blok adlarını ("model X" / "enum Y") sıralı olarak çıkarır. */
function declarations(schema: string, keyword: "model" | "enum"): string[] {
  const re = new RegExp(`^${keyword}\\s+(\\w+)\\s*\\{`, "gm");
  const names: string[] = [];
  let m = re.exec(schema);
  while (m) {
    if (m[1]) names.push(m[1]);
    m = re.exec(schema);
  }
  return names.sort();
}

/** Bir bloğun içindeki alan adları — tip ve öznitelikler yok sayılır. */
function fieldsOf(schema: string, keyword: "model" | "enum", name: string): string[] {
  const block = new RegExp(`^${keyword}\\s+${name}\\s*\\{([\\s\\S]*?)^\\}`, "m").exec(schema);
  if (!block?.[1]) return [];
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("///") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0] ?? "")
    .filter(Boolean)
    .sort();
}

describe("Prisma şema eşitliği (SQLite ↔ PostgreSQL)", () => {
  const dev = read("schema.prisma");
  const prod = read("schema.postgres.prisma");

  it("iki şema aynı modelleri tanımlar", () => {
    expect(declarations(prod, "model")).toEqual(declarations(dev, "model"));
  });

  it("iki şema aynı enum'ları tanımlar", () => {
    expect(declarations(prod, "enum")).toEqual(declarations(dev, "enum"));
  });

  it("her modelin alanları iki şemada da aynı", () => {
    for (const model of declarations(dev, "model")) {
      expect({ model, fields: fieldsOf(prod, "model", model) }).toEqual({
        model,
        fields: fieldsOf(dev, "model", model),
      });
    }
  });

  it("her enum'ın değerleri iki şemada da aynı", () => {
    for (const name of declarations(dev, "enum")) {
      expect({ name, values: fieldsOf(prod, "enum", name) }).toEqual({
        name,
        values: fieldsOf(dev, "enum", name),
      });
    }
  });
});
