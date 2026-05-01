export type JsonLdNode = Record<string, unknown>;

type SchemaInput = {
  language: "tr" | "en";
  canonicalUrl: string;
  pageTitle: string;
  pageDescription: string;
  includeProduct?: boolean;
  includeFaq?: Array<{ question: string; answer: string }>;
};

export function buildBaseStructuredData(input: SchemaInput): JsonLdNode[] {
  const orgName = "NB PDF PLATFORM";
  const websiteName = "NB PDF PLATFORM";
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: websiteName,
    url: input.canonicalUrl,
    inLanguage: input.language,
    potentialAction: {
      "@type": "SearchAction",
      target: `${input.canonicalUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: orgName,
    url: input.canonicalUrl,
    logo: `${new URL(input.canonicalUrl).origin}/logo.png`,
  };

  const result: JsonLdNode[] = [website, organization];

  if (input.includeProduct) {
    result.push({
      "@context": "https://schema.org",
      "@type": "Product",
      name: input.pageTitle,
      description: input.pageDescription,
      brand: {
        "@type": "Brand",
        name: orgName,
      },
      category: "PDF software",
      url: input.canonicalUrl,
    });
  }

  if (input.includeFaq && input.includeFaq.length > 0) {
    result.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: input.includeFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return result;
}
