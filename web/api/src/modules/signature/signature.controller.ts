/** İmza isteği uçları — gönderen tarafı kimlik doğrular, imzalayan tarafı bağlantıyla gelir. */
import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import {
  imzaIstegiOlustur,
  imzaIstekleriniListele,
  imzaIstegiDetayi,
  imzaIstegiIptal,
  imzaBelgesiniIndir,
  imzaSayfasiniAc,
  imzayiUygula,
  imzayiReddet,
  imzalayanKopyasi,
  imzaKontenjani,
} from "./signature.service.js";

function bilgi(request: Request) {
  const ua = request.get("user-agent");
  return {
    ip: request.ip || request.socket?.remoteAddress,
    userAgent: typeof ua === "string" ? ua : undefined,
  };
}

function kullanici(request: Request): string {
  const id = request.authUser?.id;
  if (!id) throw new HttpError(401, "Authentication is required.");
  return id;
}

function pdfGonder(response: Response, filename: string, data: Buffer) {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );
  response.send(data);
}

export async function createSignatureRequestController(request: Request, response: Response) {
  const ownerId = kullanici(request);
  const dosya = (request as Request & { file?: { buffer: Buffer; originalname?: string } }).file;
  if (!dosya?.buffer) throw new HttpError(400, "Belge gerekli.");
  const govde = request.body as Record<string, string>;
  const sonuc = await imzaIstegiOlustur(
    ownerId,
    {
      belge: dosya.buffer,
      filename: dosya.originalname || "belge.pdf",
      title: govde.title || dosya.originalname || "Belge",
      signerEmail: govde.signerEmail || "",
      signerName: govde.signerName,
      message: govde.message,
    },
    bilgi(request),
  );
  response.status(201).json({ id: sonuc.id });
}

export async function listSignatureRequestsController(request: Request, response: Response) {
  const id = kullanici(request);
  const [requests, kontenjan] = await Promise.all([
    imzaIstekleriniListele(id),
    imzaKontenjani(id),
  ]);
  response.json({ requests, quota: kontenjan });
}

export async function signatureRequestDetailController(request: Request, response: Response) {
  response.json(await imzaIstegiDetayi(kullanici(request), String(request.params.id)));
}

export async function cancelSignatureRequestController(request: Request, response: Response) {
  await imzaIstegiIptal(kullanici(request), String(request.params.id), bilgi(request));
  response.status(204).send();
}

export async function downloadSignatureDocumentController(request: Request, response: Response) {
  const { filename, data } = await imzaBelgesiniIndir(
    kullanici(request),
    String(request.params.id),
    bilgi(request),
  );
  pdfGonder(response, filename, data);
}

/* ── İmzalayan tarafı (kimlik doğrulaması yok; bağlantı anahtarı yeterlidir) ── */

export async function openSignPageController(request: Request, response: Response) {
  response.json(await imzaSayfasiniAc(String(request.params.token), bilgi(request)));
}

export async function submitSignatureController(request: Request, response: Response) {
  const govde = request.body as {
    signaturePng?: string;
    signerName?: string;
    consent?: boolean;
    placement?: { sayfa?: number; xOran?: number; yOran?: number; genislikOran?: number };
  };
  const y = govde.placement ?? {};
  const sonuc = await imzayiUygula(
    String(request.params.token),
    {
      imzaPngBase64: govde.signaturePng || "",
      imzalayanAd: govde.signerName || "",
      riza: Boolean(govde.consent),
      yerlesim: {
        sayfa: Number(y.sayfa) || 1,
        xOran: Number.isFinite(Number(y.xOran)) ? Number(y.xOran) : 0.6,
        yOran: Number.isFinite(Number(y.yOran)) ? Number(y.yOran) : 0.8,
        genislikOran: Math.min(0.6, Math.max(0.1, Number(y.genislikOran) || 0.25)),
      },
    },
    bilgi(request),
  );
  response.json(sonuc);
}

export async function declineSignatureController(request: Request, response: Response) {
  const govde = request.body as { reason?: string };
  await imzayiReddet(String(request.params.token), govde.reason || "", bilgi(request));
  response.status(204).send();
}

export async function downloadSignerCopyController(request: Request, response: Response) {
  const { filename, data } = await imzalayanKopyasi(String(request.params.token));
  pdfGonder(response, filename, data);
}
