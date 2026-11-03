declare const AntaliaText: {
  version: string;
  SYMBOLS: string[];
  SYMBOL_TO_ID: Record<string, number>;
  setData(d: { foreign: unknown; parts: unknown; known: unknown; englishI: unknown }): void;
  toModelText(raw: string): string;
  encode(modelText: string): number[];
};
export default AntaliaText;
