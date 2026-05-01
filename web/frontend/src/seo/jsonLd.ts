export type JsonLdNode = Record<string, unknown>;

type SchemaInput = {
  language: "tr" | "en";
  canonicalUrl: string;
  pageTitle: string;
  pageDescription: string;
  includeProduct?: boolean;
  includeFaq?: Array<{ question: string; answer: string }>;
  breadcrumb?: Array<{ name: string; url: string }>;
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function origin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

// ─── WebSite ─────────────────────────────────────────────────────────────────
function buildWebSite(input: SchemaInput): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin(input.canonicalUrl)}/#website`,
    name: "NB PDF PLATFORM",
    url: origin(input.canonicalUrl),
    inLanguage: input.language === "tr" ? "tr-TR" : "en-US",
    description: input.pageDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin(input.canonicalUrl)}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─── Organization (richer for E-E-A-T) ───────────────────────────────────────
function buildOrganization(input: SchemaInput): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin(input.canonicalUrl)}/#organization`,
    name: "NB PDF PLATFORM",
    url: origin(input.canonicalUrl),
    logo: {
      "@type": "ImageObject",
      url: `${origin(input.canonicalUrl)}/logo.png`,
      width: 192,
      height: 192,
    },
    description:
      input.language === "tr"
        ? "Profesyonel PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme platformu — iş süreçleri için tasarlandı."
        : "Professional PDF merge, convert, compress, and edit platform — built for business document workflows.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["Turkish", "English"],
    },
    // Update sameAs if/when social profiles are created
    sameAs: [],
  };
}

// ─── SoftwareApplication (replaces bare Product for software) ────────────────
function buildSoftwareApplication(input: SchemaInput): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NB PDF PLATFORM",
    url: input.canonicalUrl,
    description: input.pageDescription,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows 10, Windows 11",
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Edge, Safari.",
    inLanguage: [
      { "@type": "Language", name: "Turkish" },
      { "@type": "Language", name: "English" },
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: input.language === "tr" ? "TRY" : "USD",
      availability: "https://schema.org/InStock",
      description:
        input.language === "tr"
          ? "Ücretsiz plan mevcut. Kredi paketi ve aylık abonelik seçenekleri sunulmaktadır."
          : "Free plan available. Credit packs and monthly subscription plans offered.",
    },
    brand: {
      "@type": "Brand",
      name: "NB PDF PLATFORM",
    },
    publisher: {
      "@id": `${origin(input.canonicalUrl)}/#organization`,
    },
    featureList:
      input.language === "tr"
        ? [
            "PDF birleştirme",
            "PDF ayırma",
            "PDF dönüştürme",
            "PDF sıkıştırma",
            "PDF şifreleme",
            "PDF imzalama",
            "PDF'i Word'e dönüştürme",
            "PDF'i Excel'e dönüştürme",
          ]
        : [
            "Merge PDF",
            "Split PDF",
            "PDF converter",
            "Compress PDF",
            "PDF encryption",
            "PDF sign",
            "PDF to Word",
            "PDF to Excel",
          ],
  };
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────
function buildBreadcrumb(
  items: Array<{ name: string; url: string }>,
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────
function buildFaqPage(
  items: Array<{ question: string; answer: string }>,
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function buildBaseStructuredData(input: SchemaInput): JsonLdNode[] {
  const result: JsonLdNode[] = [
    buildWebSite(input),
    buildOrganization(input),
  ];

  if (input.includeProduct) {
    result.push(buildSoftwareApplication(input));
  }

  if (input.breadcrumb && input.breadcrumb.length > 0) {
    result.push(buildBreadcrumb(input.breadcrumb));
  }

  if (input.includeFaq && input.includeFaq.length > 0) {
    result.push(buildFaqPage(input.includeFaq));
  }

  return result;
}