/**
 * Facebook: yorum yanıt taslakları ve haftalık rapor.
 *
 * YORUMLAR OTOMATİK YANITLANMAZ: Gerçek soru/yorumlar için taslak hazırlanır, admin onaylayınca
 * gönderilir (ilk haftalar için istenen kural). Başka sayfaların gönderilerine yorum YAZILMAZ;
 * yalnızca kendi sayfamızdaki gönderiler okunur.
 *
 * RAPOR: Graph API ölçümleri sık değişiyor; her ölçüm ayrı denenir, alınamayan atlanır ve
 * raporda "ölçülemedi" diye belirtilir. Uydurma sayı yazılmaz.
 */

import { logger } from "../../lib/file-log.js";
import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { callClaude, isAiConfigured } from "../ai/ai.service.js";
import { requestJson } from "./platforms/common.js";
import { facebookSecrets } from "./social.service.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = "https://pdfplatform.app";
const MAX_DRAFTS_PER_RUN = 5;
const MAX_STORED = 300;

// ─── Yorum yanıt taslakları ───────────────────────────────────────────────────

export type ReplyDraft = {
  /** Yorumun Facebook kimliği (yanıt buna yazılır). */
  id: string;
  postId: string;
  comment: string;
  reply: string;
  status: "pending" | "sent" | "rejected";
  createdAt: string;
  error?: string;
};

type DraftStore = { drafts: ReplyDraft[]; seen: string[] };

async function readStore(): Promise<DraftStore> {
  const raw = await getSettingWithFallback<Partial<DraftStore>>(SITE_SETTING_KEYS.FACEBOOK_REPLY_DRAFTS, {});
  return { drafts: Array.isArray(raw.drafts) ? raw.drafts : [], seen: Array.isArray(raw.seen) ? raw.seen : [] };
}

async function writeStore(store: DraftStore): Promise<void> {
  await setSetting(SITE_SETTING_KEYS.FACEBOOK_REPLY_DRAFTS, {
    drafts: store.drafts.slice(-MAX_STORED),
    seen: store.seen.slice(-MAX_STORED * 3),
  });
}

const SPAM = /https?:\/\/|www\.|whatsapp|telegram|t\.me|bit\.ly|kazan(?:ç|c)|bahis|casino|dm\s*at|mesaj\s*at/i;

/** Yanıt gerektiren gerçek soru ya da yorum mu? Emoji/tek kelime/spam elenir. */
export function isReplyWorthy(text: string): boolean {
  const t = text.trim();
  if (SPAM.test(t)) return false;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < 10) return false;
  return t.split(/\s+/).length >= 3;
}

const WANTS_LINK = /nasıl yapılır|nasıl yapıyorum|nerede|nereden|hangi site|adres|\blink\b|nereye gir/i;

const REPLY_SYSTEM = `Sen PDF Platform Facebook sayfasının sosyal medya sorumlususun. Gelen yoruma kısa, samimi, kişiye özel Türkçe yanıt yaz.
- 1-2 cümle; yorumdaki asıl noktaya doğrudan cevap ver.
- Kopyala-yapıştır gibi durma; "Teşekkürler" ile başlayıp geçme, somut konuş.
- Link, etiket ya da reklam cümlesi YAZMA. Emoji en fazla bir tane.
- Bilmediğin bir şeyi uydurma; emin değilsen "Bunu inceleyip dönelim" de.
Yalnızca yanıt metnini yaz.`;

/** Yeni yorumlar için taslak üretir. Hata durumunda sessizce çıkar (cron durmasın). */
export async function collectReplyDrafts(): Promise<number> {
  const secrets = await facebookSecrets();
  if (!secrets || !isAiConfigured()) return 0;
  const pageId = secrets.pageId ?? "";
  const token = secrets.pageAccessToken ?? "";
  if (!pageId || !token) return 0;

  type Comment = { id: string; message?: string; from?: { id?: string } };
  type PostNode = { id: string; comments?: { data?: Comment[] } };
  const fields = "id,comments.limit(25){id,message,from}";
  const nodes: PostNode[] = [];
  for (const edge of [`posts?fields=${fields}&limit=10`, `video_reels?fields=${fields}&limit=5`]) {
    try {
      const json = await requestJson(
        "Facebook",
        `${GRAPH}/${pageId}/${edge}&access_token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      nodes.push(...((json.data as PostNode[] | undefined) ?? []));
    } catch (err) {
      logger.warn("social", `Facebook yorumları okunamadı (${edge.split("?")[0]}): ${String(err)}`);
    }
  }

  const store = await readStore();
  let created = 0;
  for (const node of nodes) {
    for (const c of node.comments?.data ?? []) {
      if (created >= MAX_DRAFTS_PER_RUN) break;
      if (store.seen.includes(c.id)) continue;
      store.seen.push(c.id);
      const text = c.message ?? "";
      if (c.from?.id === pageId || !isReplyWorthy(text)) continue;
      try {
        let reply = (await callClaude(REPLY_SYSTEM, [{ role: "user", content: `Yorum: ${text}` }], 300)).trim();
        if (!reply) continue;
        // Yalnızca soru açıkça "nasıl yapılır / nerede" ise bağlantı eklenir.
        if (WANTS_LINK.test(text)) reply += `\n${SITE}`;
        store.drafts.push({ id: c.id, postId: node.id, comment: text, reply, status: "pending", createdAt: new Date().toISOString() });
        created++;
      } catch (err) {
        logger.warn("social", `Yanıt taslağı yazılamadı: ${String(err)}`);
      }
    }
  }
  await writeStore(store);
  return created;
}

export async function listReplyDrafts(): Promise<ReplyDraft[]> {
  return (await readStore()).drafts.filter((d) => d.status === "pending").reverse();
}

/** Onaylanan taslağı yorumun altına gönderir; `text` verilirse düzenlenmiş hâli gider. */
export async function approveReplyDraft(id: string, text?: string): Promise<{ ok: boolean; error: string | null }> {
  const secrets = await facebookSecrets();
  if (!secrets) return { ok: false, error: "Facebook hesabı bağlı değil" };
  const store = await readStore();
  const draft = store.drafts.find((d) => d.id === id && d.status === "pending");
  if (!draft) return { ok: false, error: "Taslak bulunamadı" };
  const message = (text ?? draft.reply).trim();
  if (!message) return { ok: false, error: "Yanıt metni boş" };
  try {
    const params = new URLSearchParams();
    params.set("access_token", secrets.pageAccessToken ?? "");
    params.set("message", message);
    await requestJson("Facebook", `${GRAPH}/${id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    draft.status = "sent";
    draft.reply = message;
    await writeStore(store);
    return { ok: true, error: null };
  } catch (err) {
    draft.error = err instanceof Error ? err.message.slice(0, 300) : String(err);
    await writeStore(store);
    return { ok: false, error: draft.error };
  }
}

export async function rejectReplyDraft(id: string): Promise<void> {
  const store = await readStore();
  const draft = store.drafts.find((d) => d.id === id && d.status === "pending");
  if (draft) draft.status = "rejected";
  await writeStore(store);
}

// ─── Haftalık rapor ───────────────────────────────────────────────────────────

type ReportStore = {
  weekKey: string;
  text: string;
  createdAt: string;
  followers: { date: string; count: number }[];
};

export async function readWeeklyReport(): Promise<ReportStore | null> {
  const raw = await getSettingWithFallback<Partial<ReportStore>>(SITE_SETTING_KEYS.FACEBOOK_WEEKLY_REPORT, {});
  return raw.text
    ? { weekKey: raw.weekKey ?? "", text: raw.text, createdAt: raw.createdAt ?? "", followers: raw.followers ?? [] }
    : null;
}

/** Haftanın kimliği: o haftanın Pazartesi günü (UTC tarih). */
export function weekKeyOf(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

type PostStat = {
  id: string;
  kind: "Reels" | "Gönderi";
  title: string;
  createdTime: string;
  reach: number | null;
  views: number | null;
  avgWatchSec: number | null;
  reactions: number;
  comments: number;
  shares: number;
};

/** Bir ölçümü dener; alınamazsa null (Graph API ölçüm adları sık değişiyor). */
async function metric(objectId: string, token: string, names: string[], edge = "insights"): Promise<number | null> {
  for (const name of names) {
    try {
      const json = await requestJson(
        "Facebook",
        `${GRAPH}/${objectId}/${edge}?metric=${name}&access_token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      const value = (json.data as { values?: { value?: unknown }[] }[] | undefined)?.[0]?.values?.[0]?.value;
      if (typeof value === "number") return value;
    } catch {
      /* sıradaki ölçüm adı denenir */
    }
  }
  return null;
}

async function collectStats(pageId: string, token: string, sinceSec: number): Promise<PostStat[]> {
  type Node = {
    id: string;
    message?: string;
    description?: string;
    created_time?: string;
    shares?: { count?: number };
    reactions?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
  };
  const stats: PostStat[] = [];
  const f = "id,message,created_time,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)";
  const rf = "id,description,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0)";
  const edges = [
    [`posts?fields=${f}`, "Gönderi"],
    [`video_reels?fields=${rf}`, "Reels"],
  ] as const;
  for (const [edge, kind] of edges) {
    let nodes: Node[] = [];
    try {
      const json = await requestJson(
        "Facebook",
        `${GRAPH}/${pageId}/${edge}&since=${sinceSec}&limit=50&access_token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      nodes = (json.data as Node[] | undefined) ?? [];
    } catch (err) {
      logger.warn("social", `Facebook rapor verisi okunamadı (${kind}): ${String(err)}`);
    }
    for (const n of nodes) {
      const isReel = kind === "Reels";
      const watchMs = isReel ? await metric(n.id, token, ["post_video_avg_time_watched"], "video_insights") : null;
      stats.push({
        id: n.id,
        kind,
        title: (n.message ?? n.description ?? "").split("\n")[0]?.slice(0, 70) ?? "",
        createdTime: n.created_time ?? "",
        reach: await metric(n.id, token, isReel ? ["post_impressions_unique"] : ["post_impressions_unique", "post_media_view"]),
        views: isReel ? await metric(n.id, token, ["blue_reels_play_count", "post_video_views"], "video_insights") : null,
        avgWatchSec: watchMs == null ? null : Math.round(watchMs / 1000),
        reactions: n.reactions?.summary?.total_count ?? 0,
        comments: n.comments?.summary?.total_count ?? 0,
        shares: n.shares?.count ?? 0,
      });
    }
  }
  return stats;
}

function plainSummary(stats: PostStat[], followerNote: string): string {
  if (stats.length === 0) return `Son 7 günde veri alınabilen gönderi yok. ${followerNote}`;
  const score = (s: PostStat) => s.reach ?? s.views ?? s.reactions + s.comments * 3 + s.shares * 5;
  const sorted = [...stats].sort((a, b) => score(b) - score(a));
  const line = (s: PostStat) =>
    `- ${s.kind}: "${s.title}" · erişim ${s.reach ?? "ölçülemedi"}${s.views != null ? ` · oynatma ${s.views}` : ""}${
      s.avgWatchSec != null ? ` · ort. izlenme ${s.avgWatchSec} sn` : ""
    } · ${s.comments} yorum · ${s.shares} paylaşım`;
  return [
    followerNote,
    "",
    "En iyi 3:",
    ...sorted.slice(0, 3).map(line),
    "",
    "En zayıf 3:",
    ...sorted.slice(-3).reverse().map(line),
  ].join("\n");
}

const REPORT_SYSTEM = `Sen bir sosyal medya analistisin. Verilen Facebook sayfası verilerinden, programlama bilmeyen bir işletme sahibine Türkçe, sade bir haftalık rapor yaz.
- Kısa başlıklar: Genel durum, En iyi 3, En zayıf 3, Ne işe yaradı (konu/format/saat), Gelecek hafta için içerik dağılımı önerisi.
- Yalnızca verilen sayıları kullan; "ölçülemedi" yazan yerde tahmin yürütme. Az veriyle kesin hüküm verme.
- Teknik terim kullanma (reach yerine "erişim").`;

/** Son 7 günün raporunu üretir ve saklar. */
export async function generateWeeklyReport(now: Date = new Date()): Promise<string | null> {
  const secrets = await facebookSecrets();
  const pageId = secrets?.pageId ?? "";
  const token = secrets?.pageAccessToken ?? "";
  if (!pageId || !token) return null;

  const previous = await readWeeklyReport();
  const followers = previous?.followers ?? [];
  let followerNote = "Takipçi sayısı alınamadı.";
  try {
    const json = await requestJson(
      "Facebook",
      `${GRAPH}/${pageId}?fields=followers_count&access_token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const count = json.followers_count;
    if (typeof count === "number") {
      const last = followers[followers.length - 1];
      followerNote = last
        ? `Takipçi: ${count} (geçen hafta ${last.count}, değişim ${count - last.count >= 0 ? "+" : ""}${count - last.count}).`
        : `Takipçi: ${count} (karşılaştırma için ilk ölçüm).`;
      followers.push({ date: now.toISOString().slice(0, 10), count });
    }
  } catch (err) {
    logger.warn("social", `Takipçi sayısı okunamadı: ${String(err)}`);
  }

  const stats = await collectStats(pageId, token, Math.floor(now.getTime() / 1000) - 7 * 86_400);
  let text = plainSummary(stats, followerNote);
  if (isAiConfigured() && stats.length > 0) {
    try {
      const written = await callClaude(
        REPORT_SYSTEM,
        [{ role: "user", content: `${followerNote}\n\n${JSON.stringify(stats)}` }],
        1500,
      );
      if (written.trim()) text = written.trim();
    } catch (err) {
      logger.warn("social", `Haftalık rapor yazılamadı, düz özet kullanılıyor: ${String(err)}`);
    }
  }

  await setSetting(SITE_SETTING_KEYS.FACEBOOK_WEEKLY_REPORT, {
    weekKey: weekKeyOf(now),
    text,
    createdAt: now.toISOString(),
    followers: followers.slice(-60),
  });
  return text;
}

/** Bu hafta rapor henüz çıkmadıysa üretir (Pazartesi sabahı cron'u çağırır). */
export async function maybeGenerateWeeklyReport(now: Date = new Date()): Promise<boolean> {
  const last = await readWeeklyReport();
  if (last?.weekKey === weekKeyOf(now)) return false;
  return (await generateWeeklyReport(now)) != null;
}
