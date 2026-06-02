import { prisma } from "../../lib/prisma.js";
import { encryptField, decryptField, maskTcNo } from "../../lib/encryption.js";

export interface BillingInfoInput {
  invoiceType: "individual" | "corporate";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tcKimlikNo?: string;
  taxId?: string;
  taxOffice?: string;
  billingAddressLine?: string;
  city?: string;
  billingCountryCode?: string;
  billingPostalCode?: string;
  phone?: string;
  distanceSalesConsented: boolean;
  withdrawalWaived: boolean;
}

export interface BillingInfoOutput {
  invoiceType: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  tcKimlikNoMasked: string | null;
  taxId: string | null;
  taxOffice: string | null;
  billingAddressLine: string | null;
  city: string | null;
  billingCountryCode: string | null;
  billingPostalCode: string | null;
  phone: string | null;
  distanceSalesConsentedAt: Date | null;
  withdrawalWaivedAt: Date | null;
}

export async function saveBillingInfo(userId: string, input: BillingInfoInput): Promise<void> {
  if (input.tcKimlikNo?.trim()) {
    const tc = input.tcKimlikNo.trim();
    if (!/^\d{11}$/.test(tc) || tc[0] === "0") {
      throw new Error("Geçersiz TC Kimlik No formatı. 11 haneli olmalı ve 0 ile başlamamalıdır.");
    }
  }

  if (input.invoiceType === "corporate" && input.taxId?.trim()) {
    if (!/^\d{10}$/.test(input.taxId.trim())) {
      throw new Error("Geçersiz Vergi Kimlik No formatı. 10 haneli olmalıdır.");
    }
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    invoiceType: input.invoiceType,
    billingAddressLine: input.billingAddressLine?.trim()
      ? encryptField(input.billingAddressLine.trim())
      : null,
    city: input.city?.trim() || null,
    billingCountryCode: input.billingCountryCode?.trim().toUpperCase() || "TR",
    billingPostalCode: input.billingPostalCode?.trim() || null,
    phone: input.phone?.trim() ? encryptField(input.phone.trim()) : null,
    isKvkkConsented: true,
    kvkkConsentedAt: now,
  };

  if (input.invoiceType === "individual") {
    updateData.firstName = input.firstName?.trim() || null;
    updateData.lastName = input.lastName?.trim() || null;
    updateData.companyName = null;
    updateData.taxId = null;
    updateData.taxOffice = null;
    if (input.tcKimlikNo?.trim()) {
      // TC No asla plaintext saklanmaz
      updateData.tcKimlikNo = encryptField(input.tcKimlikNo.trim());
    }
  } else {
    updateData.companyName = input.companyName?.trim() || null;
    updateData.taxId = input.taxId?.trim() ? encryptField(input.taxId.trim()) : null;
    updateData.taxOffice = input.taxOffice?.trim() || null;
    updateData.firstName = input.firstName?.trim() || null;
    updateData.lastName = input.lastName?.trim() || null;
    updateData.tcKimlikNo = null;
  }

  if (input.distanceSalesConsented) {
    updateData.distanceSalesConsentedAt = now;
  }
  if (input.withdrawalWaived) {
    updateData.withdrawalWaivedAt = now;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function getBillingInfo(userId: string): Promise<BillingInfoOutput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      invoiceType: true,
      firstName: true,
      lastName: true,
      companyName: true,
      tcKimlikNo: true,
      taxId: true,
      taxOffice: true,
      billingAddressLine: true,
      city: true,
      billingCountryCode: true,
      billingPostalCode: true,
      phone: true,
      distanceSalesConsentedAt: true,
      withdrawalWaivedAt: true,
    },
  });

  if (!user) throw new Error("User not found");

  let tcMasked: string | null = null;
  if (user.tcKimlikNo) {
    try {
      const plain = decryptField(user.tcKimlikNo);
      tcMasked = maskTcNo(plain);
    } catch {
      tcMasked = "***********";
    }
  }

  function safeDecrypt(value: string | null): string | null {
    if (!value) return null;
    try { return decryptField(value); } catch { return null; }
  }

  return {
    invoiceType: user.invoiceType,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    tcKimlikNoMasked: tcMasked,
    taxId: safeDecrypt(user.taxId),
    taxOffice: user.taxOffice,
    billingAddressLine: safeDecrypt(user.billingAddressLine),
    city: user.city,
    billingCountryCode: user.billingCountryCode,
    billingPostalCode: user.billingPostalCode,
    phone: safeDecrypt(user.phone),
    distanceSalesConsentedAt: user.distanceSalesConsentedAt,
    withdrawalWaivedAt: user.withdrawalWaivedAt,
  };
}
