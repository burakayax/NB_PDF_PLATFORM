type L2<T> = { tr: T; en: T };
export type Profession = {
  id: string;
  label: L2<string>;
  kw: string[];
  title: L2<string>;
  summary: L2<string[]>;
  bullets: L2<string[]>;
  skills: L2<string[]>;
};
export const PROFESSIONS: Profession[];
