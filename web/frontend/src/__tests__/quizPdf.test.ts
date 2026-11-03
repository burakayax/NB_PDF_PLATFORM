import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { quizToPdf } from "../lib/quizPdf";
import type { QuizQuestion } from "../api/ai";

const ev = "Güneş Sistemi, yaklaşık 4,6 milyar yıl önce dev bir gaz ve toz bulutunun çökmesiyle oluşmuştur.";
const qs: QuizQuestion[] = [
  { type: "mcq", q: "Belgeye göre Güneş Sistemi yaklaşık kaç yıl önce oluşmuştur?", options: ["4,6 milyar yıl önce", "150 milyon yıl önce", "465 milyon yıl önce", "8,2 milyar yıl önce"], answer: 0, explanation: "Belge, sistemin yaklaşık 4,6 milyar yıl önce oluştuğunu belirtir.", evidence: ev },
  { type: "mcq", q: "Aşağıdakilerden hangisi belgeye göre bir dış gezegendir?", options: ["Mars", "Venüs", "Uranüs", "Merkür"], answer: 2, explanation: "Belgede Jüpiter, Satürn, Uranüs ve Neptün dış gezegenler olarak sayılır.", evidence: "Jüpiter, Satürn, Uranüs ve Neptün ise büyük kütleli ve gazlardan oluşan dış gezegenlerdir." },
  { type: "mcq", q: "Belgeye göre Mars neden Kızıl Gezegen olarak adlandırılır ve bu ad ilk kez hangi gözlemle ilişkilendirilmiştir, yüzeyindeki hangi madde bunu sağlar?", options: ["Atmosferindeki karbondioksit nedeniyle ve çok uzun süren toz fırtınaları yüzünden", "Yüzeyindeki demir oksit nedeniyle", "Güneş'e çok yakın olduğu için", "Halkalarındaki buz ve kaya nedeniyle"], answer: 1, explanation: "Mars yüzeyindeki demir oksit nedeniyle kızıl görünür.", evidence: "Mars, yüzeyindeki demir oksit nedeniyle kızıl göründüğünden Kızıl Gezegen olarak adlandırılır." },
  { type: "tf", q: "Merkür, Güneş'in çevresindeki turunu yaklaşık 88 günde tamamlar.", answer: true, explanation: "Belge Merkür'ün turunu yaklaşık 88 günde tamamladığını belirtir.", evidence: "Merkür, Güneş'e en yakın gezegendir ve Güneş'in çevresindeki turunu yaklaşık 88 günde tamamlar." },
  { type: "tf", q: "Plüton, 2006 yılında Uluslararası Astronomi Birliği tarafından asteroit sınıfına alınmıştır.", answer: false, explanation: "Plüton asteroit değil, cüce gezegen sınıfına alınmıştır.", evidence: "Plüton, 2006 yılında Uluslararası Astronomi Birliği tarafından gezegen tanımına uymadığı gerekçesiyle cüce gezegen sınıfına alınmıştır." },
  { type: "fill", q: "Mars, yüzeyindeki ____ nedeniyle kızıl göründüğünden Kızıl Gezegen olarak adlandırılır.", answer: "demir oksit", explanation: "Belgede böyle geçiyor.", evidence: "Mars, yüzeyindeki demir oksit nedeniyle kızıl göründüğünden Kızıl Gezegen olarak adlandırılır." },
  { type: "fill", q: "Güneş'ten çıkan ışık Dünya'ya yaklaşık ____ ulaşır.", answer: "8 dakika 20 saniyede", explanation: "", evidence: "Güneş'ten çıkan ışık Dünya'ya yaklaşık 8 dakika 20 saniyede ulaşır." },
  { type: "open", q: "Belgeye göre Uranüs'ün Güneş'in çevresinde yuvarlanıyormuş gibi dönmesinin nedeni nedir?", answer: "Uranüs'ün ekseni neredeyse yan yattığı için Güneş'in çevresinde yuvarlanıyormuş gibi döner.", explanation: "Belge bu dönüş biçimini eksenin neredeyse yan yatmasına bağlar.", evidence: "Uranüs, ekseni neredeyse yan yattığı için Güneş'in çevresinde yuvarlanıyormuş gibi döner." },
  { type: "open", q: "Belgeye göre Jüpiter'i diğer gezegenlerden ayıran kütle özelliği nedir?", answer: "Jüpiter en büyük gezegendir ve diğer tüm gezegenlerin toplam kütlesinden daha fazla kütleye sahiptir.", explanation: "", evidence: "Jüpiter, Güneş Sistemi'nin en büyük gezegenidir ve diğer tüm gezegenlerin toplam kütlesinden daha fazla kütleye sahiptir." },
];

describe("quizToPdf", () => {
  it("soru kâğıdı ve cevap anahtarlı PDF üretir (anahtarlı sürüm daha uzun)", async () => {
    vi.stubGlobal("fetch", async (u: string) => ({ arrayBuffer: async () => Uint8Array.from(readFileSync("public" + u)).buffer }));
    const base = { title: "Güneş Sistemi — Test", subtitle: "9 soru · Orta zorluk · 3.11.2026" };
    const sheet = await quizToPdf(qs, "tr", { ...base, withAnswers: false, studentInfo: true });
    const key = await quizToPdf(qs, "tr", { ...base, withAnswers: true });
    const sheetPages = (await PDFDocument.load(sheet)).getPageCount();
    const keyPages = (await PDFDocument.load(key)).getPageCount();
    expect(sheetPages).toBeGreaterThanOrEqual(1);
    expect(keyPages).toBeGreaterThan(sheetPages);
    // İsteğe bağlı gözle kontrol: QUIZ_PDF_OUT=klasör/ ile dosyalar yazılır.
    const out = process.env.QUIZ_PDF_OUT;
    if (out) {
      writeFileSync(out + "test-kagidi.pdf", sheet);
      writeFileSync(out + "test-cevapli.pdf", key);
    }
  });

  it("boş soru listesinde bile çökmeden tek sayfa üretir", async () => {
    vi.stubGlobal("fetch", async (u: string) => ({ arrayBuffer: async () => Uint8Array.from(readFileSync("public" + u)).buffer }));
    const bytes = await quizToPdf([], "tr", { title: "T", subtitle: "0 soru", withAnswers: false });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
