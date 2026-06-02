import { Component, createRef, type ErrorInfo, type ReactNode } from "react";
import { reportErrorToSentry } from "../../lib/sentry";

interface Props {
  children: ReactNode;
  language?: "tr" | "en";
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, eventId: null };

  /** Hata kapsayıcısına odaklanmak için ref — ekran okuyucular için erişilebilirlik. */
  private containerRef = createRef<HTMLDivElement>();

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportErrorToSentry(error, {
      componentStack: info.componentStack ?? undefined,
    });
    // Sadece geliştirme ortamında konsola yaz; üretimde Sentry zaten yakalar
    if (import.meta.env.DEV) {
      console.error("[GlobalErrorBoundary]", error, info);
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    // Hata yeni oluştuysa kapsayıcıya odaklan — ekran okuyucu bildirim alır
    if (!prevState.hasError && this.state.hasError) {
      this.containerRef.current?.focus();
    }
  }

  render() {
    const lang = this.props.language ?? "tr";

    if (!this.state.hasError) return this.props.children;

    const copy =
      lang === "tr"
        ? {
            badge: "PDF PLATFORM",
            title: "Beklenmedik bir hata oluştu",
            body: "Bir şeyler ters gitti. Sayfayı yenileyerek tekrar deneyin. Sorun devam ederse lütfen bizimle iletişime geçin.",
            reload: "Sayfayı Yenile",
          }
        : {
            badge: "PDF PLATFORM",
            title: "Something went wrong",
            body: "An unexpected error occurred. Please reload the page to try again. If the issue persists, feel free to contact us.",
            reload: "Reload Page",
          };

    return (
      <div
        ref={this.containerRef}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-[#05080f] px-6 py-12 font-sans text-nb-text antialiased outline-none"
      >
        <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] border border-white/[0.08] bg-nb-panel/55 px-10 py-16 text-center shadow-[0_50px_100px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            {copy.badge}
          </p>
          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
            <svg
              className="h-7 w-7 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-white">
            {copy.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-nb-muted">{copy.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-8 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {copy.reload}
          </button>
        </div>
      </div>
    );
  }
}
