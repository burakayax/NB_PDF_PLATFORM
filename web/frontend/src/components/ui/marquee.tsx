import { landingTranslations, type Language } from "../../i18n/landing";

type MarqueeProps = {
  language: Language;
};

export function Marquee({ language }: MarqueeProps) {
  const copy = landingTranslations[language];

  if (!copy?.marqueeItems) {
    return null;
  }

  const text = copy.marqueeItems.items.join(" · ") + " · ";

  return (
    <div className="w-full overflow-hidden py-6 -mt-16">
      <div className="flex whitespace-nowrap">
        <div className="animate-marquee flex min-w-max">
          <span className="text-xl font-semibold tracking-[0.25em] text-white/40">
            {text.repeat(20)}
          </span>
        </div>

        <div className="animate-marquee flex min-w-max">
          <span className="text-xl font-semibold tracking-[0.25em] text-white/40">
            {text.repeat(20)}
          </span>
        </div>
      </div>
    </div>
  );
}