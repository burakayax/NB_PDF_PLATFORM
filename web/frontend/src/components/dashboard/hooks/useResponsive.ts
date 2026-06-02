import { useEffect, useState } from "react";

export function useResponsive() {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [is2xl, setIs2xl] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1536 : false
  );

  useEffect(() => {
    const lgMq = window.matchMedia("(min-width: 1024px)");
    const xlMq = window.matchMedia("(min-width: 1536px)");

    const lgHandler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    const xlHandler = (e: MediaQueryListEvent) => setIs2xl(e.matches);

    lgMq.addEventListener("change", lgHandler);
    xlMq.addEventListener("change", xlHandler);
    setIsLg(lgMq.matches);
    setIs2xl(xlMq.matches);

    return () => {
      lgMq.removeEventListener("change", lgHandler);
      xlMq.removeEventListener("change", xlHandler);
    };
  }, []);

  return { isLg, is2xl, isMobileOrTablet: !isLg };
}
