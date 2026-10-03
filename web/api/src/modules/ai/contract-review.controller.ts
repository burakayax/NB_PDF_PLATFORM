import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { logApiFailure } from "../../lib/app-logger.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import {
  getAiQuota,
  reserveAiQuota,
  refundAiQuota,
  reservePurchasedCredits,
  refundPurchasedCredits,
} from "./ai.quota.js";
import { contractAuditCredits, quickScanCredits } from "../../lib/plan-catalogue.js";
import {
  prescanContract,
  runContractReview,
  runQuickScan,
  STAGES,
  QUICK_STAGES,
  type ContractMap,
  type PrescanResult,
} from "./contract-review.service.js";
import {
  CONSENT_VERSION,
  REFUND_ABUSE_LIMIT_24H,
  claimRefund,
  createLog,
  markDone,
  recentRefunds,
  sha256Hex,
  signReport,
  type ProofRecord,
} from "./contract-review.ledger.js";
import type {
  ContractJobView,
  ContractMode,
  ContractReport,
  ContractReviewInput,
  ContractRole,
} from "./contract-review.types.js";

/**
 * Sözleşme analizi dakikalar sürer; bu yüzden istek bir İŞ olarak başlatılır ve
 * istemci durumu yoklar. Belge metni yalnızca bellekte tutulur: diske/veritabanına
 * yazılmaz, günlüğe girmez, iş bitince (ve en geç 30 dk sonra) silinir.
 *
 * ÖDEME KURALLARI (kullanıcıya ekranda aynen gösterilir):
 *  1. Kullanıcı bedeli ve koşulları AÇIKÇA onaylamadan hiçbir işlem başlamaz (sunucu zorunlu kılar).
 *  2. Hak/kredi işlem BAŞLAMADAN düşülür; sonuç indirilsin ya da indirilmesin geri verilmez.
 *  3. Yalnızca BİZİM tarafımızdaki bir hatada (sonuç üretilemedi, sunucu yeniden başladı…) iade edilir.
 *  4. Her adım contract_review_logs defterine yazılır (onay, bedel, sonuç, iade, indirme).
 */

const MAX_TEXT = 240_000;
const MIN_TEXT = 400;
const JOB_TTL_MS = 30 * 60_000;

/** Hak bedeli ve maliyet modeli: `lib/plan-catalogue.ts` (tek kaynak). */
export function contractReviewCost(chars: number): number {
  return contractAuditCredits(chars);
}

/** Hızlı tarama bedeli (hak/kredi). */
export function quickScanCost(chars: number): number {
  return quickScanCredits(chars);
}

type Job = {
  id: string;
  userId: string;
  plan?: string;
  role?: string;
  mode: ContractMode;
  units: number;
  status: "running" | "done" | "error";
  stageIndex: number;
  stageLabel: string;
  progressNote: string;
  report?: ContractReport;
  proof?: ProofRecord;
  error?: string;
  createdAt: number;
};

const jobs = new Map<string, Job>();

/** Ön tarama sonuçları (harita + sorular) — analiz başlarken yeniden kullanılır. Yalnızca bellekte. */
const prescans = new Map<string, { userId: string; map: ContractMap; createdAt: number }>();
const prescanBusy = new Set<string>();
/** Kullanıcı başına ön tarama sayıları (kötüye kullanım/maliyet koruması; ücretsiz ama sınırlı). */
const prescanLog = new Map<string, number[]>();
const MAX_PRESCANS_PER_HOUR = 5;
const MAX_PRESCANS_PER_DAY = 15;

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.createdAt > JOB_TTL_MS) jobs.delete(id);
  for (const [id, p] of prescans) if (now - p.createdAt > JOB_TTL_MS) prescans.delete(id);
}, 60_000);
sweeper.unref();

const ROLES: ContractRole[] = [
  "alici", "satici", "hizmet_alan", "hizmet_veren", "kiraci", "kiraya_veren",
  "isveren", "isci", "istekli", "idare", "diger",
];

function stageLabelsOf(mode: ContractMode): string[] {
  return mode === "quick" ? [...QUICK_STAGES] : [...STAGES];
}

function view(j: Job): ContractJobView {
  return {
    id: j.id,
    status: j.status,
    mode: j.mode,
    stageIndex: j.stageIndex,
    stageCount: stageLabelsOf(j.mode).length,
    stageLabels: stageLabelsOf(j.mode),
    stageLabel: j.stageLabel,
    progressNote: j.progressNote,
    report: j.status === "done" ? j.report : undefined,
    proof: j.status === "done" ? j.proof : undefined,
    error: j.status === "error" ? j.error : undefined,
  };
}

function userMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  const refund = "Harcanan hak/kredi iade edildi.";
  if (m === "AI_REFUSED") return `Belge yapay zekâ güvenlik denetimine takıldı ve analiz edilemedi. ${refund}`;
  if (m === "AI_TRUNCATED") return `Belge analiz için fazla uzun ya da karmaşık çıktı. Belgeyi bölümlere ayırıp tekrar deneyin. ${refund}`;
  if (m === "AI_JSON_PARSE") return `Analiz sonucu okunamadı. ${refund} Lütfen tekrar deneyin.`;
  if (m.includes("zaman aşımı")) return `Analiz zaman aşımına uğradı. ${refund} Lütfen tekrar deneyin.`;
  return `Analiz tamamlanamadı. ${refund} Lütfen tekrar deneyin.`;
}

function checkText(text: string): void {
  if (text.trim().length < MIN_TEXT) {
    throw new HttpError(400, "Belgeden yeterli metin okunamadı. Taranmış bir belgeyse önce metne çevrilmesi gerekir.");
  }
  if (text.length > MAX_TEXT) {
    throw new HttpError(
      413,
      `Belge tek seferde analiz edilemeyecek kadar uzun (${Math.round(text.length / 1000)} bin karakter; üst sınır ${Math.round(MAX_TEXT / 1000)} bin). Belgeyi bölümlere ayırıp tekrar deneyin.`,
    );
  }
}

function clientIpFromRequest(request: Request): string | null {
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0]?.trim() ?? null;
  const raw = request.ip || request.socket?.remoteAddress;
  return typeof raw === "string" ? raw : null;
}

/** Düşülen hak/krediyi geri yükler (aylık hak → kredi sırası `refundAiQuota` içinde). */
async function giveBack(userId: string, mode: string, units: number): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } });
  if (mode === "quick") await refundAiQuota(userId, String(u?.plan ?? ""), String(u?.role ?? ""), units);
  else await refundPurchasedCredits(userId, String(u?.role ?? ""), units);
}

/** İşi başarısız işaretle ve (yalnızca bir kez) iade et. Hata iade sırasında olsa bile işlem sürer. */
async function failAndRefund(jobId: string, reason: string): Promise<void> {
  try {
    const claim = await claimRefund(jobId, reason);
    if (claim) await giveBack(claim.userId, claim.mode, claim.units);
  } catch (e) {
    logApiFailure({ service: "contract-review", operation: "refund-failed", message: `${jobId}: ${e instanceof Error ? e.message.slice(0, 160) : "unknown"}` });
  }
}

/**
 * Sunucu yeniden başlarsa bellekteki işler kaybolur: kullanıcı sonuç alamaz ama hakkı düşmüştür.
 * Bu tarama, "RUNNING" kalmış ve artık canlı olmayan her işi bulur ve iade eder.
 * Açılışta ve düzenli aralıklarla çalıştırılır (bkz. jobs/contractReviewJobs.ts).
 */
export async function recoverContractReviewJobs(): Promise<number> {
  const stuck = await prisma.contractReviewLog.findMany({ where: { status: "RUNNING" }, select: { id: true } });
  let n = 0;
  for (const row of stuck) {
    if (jobs.get(row.id)?.status === "running") continue; // hâlâ çalışıyor
    await failAndRefund(row.id, "İşlem yarıda kaldı (sunucu yeniden başladı ya da zaman aşımı)");
    n++;
  }
  return n;
}

/**
 * POST /api/ai/contract-review/prescan — { text } → belgeyi tanır, analizden ÖNCE sorulacak
 * soruları üretir. Hak düşmez (kısa ve ucuz) ama saatlik/günlük sınırı vardır.
 */
/** Araç herkese kapalıyken (CONTRACT_REVIEW_ENABLED=false) yalnızca ADMIN kullanabilir. */
export function isContractReviewOpen(role: string | undefined): boolean {
  return env.CONTRACT_REVIEW_ENABLED || role === "ADMIN";
}
function assertContractReviewOpen(role: string | undefined): void {
  if (!isContractReviewOpen(role)) throw new HttpError(503, "Sözleşme Denetçisi henüz kullanıma açılmadı. Çok yakında.");
}

export async function prescanContractController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  assertContractReviewOpen(u.role);
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  checkText(text);
  if (prescanBusy.has(u.id)) throw new HttpError(409, "Önceki belge hâlâ taranıyor. Lütfen bekleyin.");
  const now = Date.now();
  const recent = (prescanLog.get(u.id) ?? []).filter((t) => now - t < 24 * 3_600_000);
  if (recent.filter((t) => now - t < 3_600_000).length >= MAX_PRESCANS_PER_HOUR || recent.length >= MAX_PRESCANS_PER_DAY) {
    throw new HttpError(429, "Belge tarama sınırına ulaştınız (saatte 5, günde 15). Biraz sonra tekrar deneyin.");
  }
  recent.push(now);
  prescanLog.set(u.id, recent);

  prescanBusy.add(u.id);
  let result: PrescanResult;
  try {
    result = await prescanContract(text);
  } catch (e) {
    logApiFailure({ service: "contract-review", operation: "prescan", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    throw new HttpError(502, "Belge taranamadı. Lütfen tekrar deneyin.");
  } finally {
    prescanBusy.delete(u.id);
  }
  const id = randomUUID();
  prescans.set(id, { userId: u.id, map: result.map, createdAt: Date.now() });
  res.json({
    prescanId: id,
    docType: result.docType,
    parties: result.parties,
    sectorGuess: result.sectorGuess,
    valueInDoc: result.valueInDoc,
    pageCount: result.pageCount,
    questions: result.questions,
    units: contractReviewCost(text.length),
    quickUnits: quickScanCost(text.length),
    consentVersion: CONSENT_VERSION,
  });
}

/** POST /api/ai/contract-review — iş başlatır → { jobId, units, quota } */
export async function startContractReviewController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  assertContractReviewOpen(u.role);

  const text = typeof req.body?.text === "string" ? req.body.text : "";
  checkText(text);
  const mode: ContractMode = req.body?.mode === "quick" ? "quick" : "full";
  const role: ContractRole = ROLES.includes(req.body?.role) ? req.body.role : "diger";

  // 1) AÇIK ONAY — sunucu zorunlu kılar (arayüz atlanamaz). Kullanıcının ekranda gördüğü bedel,
  //    sunucunun hesapladığıyla birebir aynı olmalı; farklıysa hiçbir şey düşülmeden uyarılır.
  const consent = (req.body?.consent ?? {}) as { accepted?: unknown; version?: unknown; units?: unknown };
  if (consent.accepted !== true || typeof consent.version !== "string" || !consent.version) {
    throw new HttpError(400, "İşlemi başlatmak için bedeli ve koşulları onaylamanız gerekir.");
  }
  const units = mode === "quick" ? quickScanCost(text.length) : contractReviewCost(text.length);
  if (Number(consent.units) !== units) {
    res.status(409).json({
      error: "price_changed",
      message: `Bedel güncellendi: bu işlem ${units} ${mode === "quick" ? "hak" : "kredi"} harcar. Lütfen onay penceresindeki yeni bedeli kontrol edip yeniden onaylayın.`,
      units,
    });
    return;
  }

  const input: ContractReviewInput = {
    text,
    role,
    roleNote: typeof req.body?.roleNote === "string" ? req.body.roleNote.slice(0, 300) : undefined,
    sector: req.body?.sector === "kamu" ? "kamu" : "ozel",
    contractValue: typeof req.body?.contractValue === "string" ? req.body.contractValue.slice(0, 80) : undefined,
    playbook: typeof req.body?.playbook === "string" ? req.body.playbook.slice(0, 6000) : undefined,
    concerns: typeof req.body?.concerns === "string" ? req.body.concerns.slice(0, 3000) : undefined,
    answers: Array.isArray(req.body?.answers)
      ? (req.body.answers as unknown[])
          .slice(0, 8)
          .map((a) => {
            const r = (a ?? {}) as { question?: unknown; answer?: unknown };
            return {
              question: typeof r.question === "string" ? r.question.slice(0, 400) : "",
              answer: typeof r.answer === "string" ? r.answer.slice(0, 600) : "",
            };
          })
          .filter((a) => a.question)
      : undefined,
  };
  // Ön tarama yapıldıysa haritayı yeniden kullan (yalnız kendi taramasını).
  const pre = typeof req.body?.prescanId === "string" ? prescans.get(req.body.prescanId) : undefined;
  const priorMap = pre && pre.userId === u.id ? pre.map : undefined;

  // 2) Aynı kullanıcı aynı anda tek analiz çalıştırabilir (maliyet güvenliği).
  for (const j of jobs.values()) {
    if (j.userId === u.id && j.status === "running") {
      throw new HttpError(409, "Devam eden bir sözleşme analiziniz var. Bitmesini bekleyin.");
    }
  }
  // 3) Kötüye kullanım koruması: art arda başarısız (iade edilen) analizlerde otomatik durdur.
  if ((await recentRefunds(u.id)) >= REFUND_ABUSE_LIMIT_24H) {
    throw new HttpError(
      429,
      "Son 24 saatte birden fazla analiziniz tamamlanamadı. Hesabınızı korumak için yeni analizler geçici olarak durduruldu; lütfen destek ile iletişime geçin.",
    );
  }

  // 4) ÖDEME — işlem başlamadan düşülür. HIZLI TARAMA: önce aylık haktan, bitince krediden.
  //    DETAYLI DENETİM: yalnız satın alınmış kredi. Yönetici ikisinde de muaftır.
  const isAdmin = u.role === "ADMIN";
  const reserved =
    mode === "quick"
      ? await reserveAiQuota(u.id, u.plan, u.role, "contract-quick", units)
      : await reservePurchasedCredits(u.id, u.role, "contract-review", units);
  if (!reserved) {
    const quota = await getAiQuota(u.id, u.plan, u.role);
    res.status(429).json({
      error: "quota_exceeded",
      message:
        mode === "quick"
          ? `Hızlı tarama ${units} hak harcar (önce aylık hakkınızdan, bitince krediden). Aylık hakkınız ve krediniz yetmiyor; ek kredi paketi alabilirsiniz.`
          : `Detaylı denetim ${units} KREDİ harcar (belge uzunluğuna göre) ve aylık hakkınızdan düşmez, yalnız satın alınan kredi kullanılır. Krediniz yetmiyor; ek kredi paketi alabilirsiniz.`,
      quota,
      units,
    });
    return;
  }

  const jobId = randomUUID();
  const ua = req.headers["user-agent"];
  // 5) DEFTER — onay + bedel + belge özeti, işe başlamadan yazılır. Yazılamazsa kredi hemen geri verilir.
  try {
    await createLog({
      id: jobId,
      userId: u.id,
      mode,
      units,
      chargeSource: isAdmin ? "admin_exempt" : mode === "quick" ? "monthly_then_credit" : "credit",
      chars: text.length,
      docSha256: sha256Hex(text),
      consentVersion: consent.version.slice(0, 40),
      clientIp: clientIpFromRequest(req),
      userAgent: typeof ua === "string" ? ua.slice(0, 1024) : null,
    });
  } catch (e) {
    await (isAdmin ? Promise.resolve() : giveBack(u.id, mode, units)).catch(() => undefined);
    logApiFailure({ service: "contract-review", operation: "ledger-create", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    throw new HttpError(503, "İşlem kaydı oluşturulamadı; hak/kredi düşülmedi. Lütfen tekrar deneyin.");
  }

  const job: Job = {
    id: jobId,
    userId: u.id,
    plan: u.plan,
    role: u.role,
    mode,
    units,
    status: "running",
    stageIndex: 0,
    stageLabel: stageLabelsOf(mode)[0] ?? "",
    progressNote: "",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  // Arka planda çalıştır; istemci GET ile durumu yoklar.
  void (async () => {
    const usage = { input: 0, output: 0, cacheRead: 0, searches: 0 };
    try {
      const runner = mode === "quick" ? runQuickScan : runContractReview;
      const report = await runner(
        input,
        (stageIndex, label, note) => {
          job.stageIndex = stageIndex;
          job.stageLabel = label;
          job.progressNote = note;
        },
        (uu) => {
          usage.input += uu.input;
          usage.output += uu.output;
          usage.cacheRead += uu.cacheRead;
          usage.searches += uu.searches;
        },
        priorMap,
      );
      const proof = signReport(job.id, report, new Date());
      job.report = report;
      job.proof = proof;
      job.status = "done";
      job.stageIndex = stageLabelsOf(mode).length;
      await markDone(job.id, proof).catch(() => undefined);
      // Kalibrasyon için yalnızca SAYILAR (belge içeriği değil).
      logApiFailure({
        service: "contract-review",
        operation: "usage",
        detail: JSON.stringify({ mode, chars: input.text.length, units, ...usage, ms: Date.now() - job.createdAt }),
      });
    } catch (e) {
      job.status = "error";
      job.error = userMessage(e);
      // Bizim tarafımızdaki hata: sonuç üretilemedi → iade (bir kez, atomik) ve deftere işlenir.
      await failAndRefund(job.id, e instanceof Error ? e.message : "unknown");
      // Belge içeriği ASLA günlüğe yazılmaz; yalnızca hata türü.
      logApiFailure({
        service: "contract-review",
        operation: "run",
        message: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      });
    }
  })();

  const quota = await getAiQuota(u.id, u.plan, u.role);
  res.status(202).json({ jobId: job.id, units, mode, quota });
}

/** GET /api/ai/contract-review/:id — iş durumu (+ bitince rapor). */
export async function contractReviewStatusController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  const job = jobs.get(String(req.params.id));
  if (!job || job.userId !== u.id) {
    throw new HttpError(404, "Analiz bulunamadı (süresi dolmuş olabilir). Lütfen yeniden başlatın.");
  }
  res.json(view(job));
}

/** DELETE /api/ai/contract-review/:id — raporu bellekten hemen sil (kullanıcı "temizle" der). */
export async function deleteContractReviewController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  const job = jobs.get(String(req.params.id));
  if (job && job.userId === u.id && job.status !== "running") jobs.delete(job.id);
  res.json({ ok: true });
}

const DOWNLOAD_KINDS = new Set(["annotated", "report"]);

/**
 * POST /api/ai/contract-review/:id/download — { kind, sha256 }
 * Kullanıcının raporu/boyalı PDF'i İNDİRDİĞİNİ deftere işler (zaman, IP, tarayıcı + indirilen dosyanın
 * SHA-256 özeti). Kayıt, yönetim panelindeki mevcut "indirme kayıtları" listesine düşer ve oradan
 * delil çıktısı alınabilir. Hak/kota DÜŞMEZ (bedel başlangıçta alınmıştır).
 */
export async function contractReviewDownloadController(req: Request, res: Response): Promise<void> {
  const u = req.authUser;
  if (!u) throw new HttpError(401, "Oturum gerekli.");
  const id = String(req.params.id);
  const kind = typeof req.body?.kind === "string" ? req.body.kind : "";
  const sha = typeof req.body?.sha256 === "string" ? req.body.sha256.toLowerCase() : "";
  if (!DOWNLOAD_KINDS.has(kind) || !/^[0-9a-f]{64}$/.test(sha)) throw new HttpError(400, "Geçersiz indirme bildirimi.");
  const log = await prisma.contractReviewLog.findFirst({ where: { id, userId: u.id }, select: { id: true } });
  if (!log) throw new HttpError(404, "Analiz kaydı bulunamadı.");
  const already = await prisma.downloadLog.count({ where: { userId: u.id, toolId: "sozlesme-denetci", resultId: { startsWith: `${id}:` } } });
  if (already >= 20) {
    res.json({ ok: true, throttled: true });
    return;
  }
  const ua = req.headers["user-agent"];
  await prisma.downloadLog.create({
    data: {
      userId: u.id,
      resultId: `${id}:${kind}:${sha}`,
      toolId: "sozlesme-denetci",
      clientIp: clientIpFromRequest(req),
      userAgent: typeof ua === "string" ? ua.slice(0, 1024) : null,
      status: "SUCCESS",
      ackedAt: new Date(),
    },
  });
  res.json({ ok: true });
}
