// Tip deklarasyonu: aboutContent.mjs (Hakkımızda metninin tek kaynağı) için.
export interface AboutCopy {
  title: string;
  subtitle: string;
  story: { title: string; paragraphs: string[] };
  purpose: { title: string; items: { label: string; text: string }[] };
  principles: { title: string; items: { name: string; description: string }[] };
  offer: { title: string; items: { name: string; description: string }[] };
  contact: {
    title: string;
    description: string;
    email: string;
    legalLead: string;
    links: { href: string; label: string }[];
  };
  orgDescription: string;
}
export const aboutCopy: { tr: AboutCopy; en: AboutCopy };
