import { Component } from "react";
import type { ReactNode } from "react";

const STRINGS = {
  tr: { message: "PDF görüntülenirken bir hata oluştu.", retry: "Yeniden Dene" },
  en: { message: "An error occurred while displaying the PDF.", retry: "Try Again" },
} as const;

function getLang(): "tr" | "en" {
  try {
    const stored = window.localStorage.getItem("nbpdf-language");
    if (stored === "tr" || stored === "en") return stored;
  } catch {
    // localStorage erişimi engellenmiş olabilir
  }
  return "tr";
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class PdfErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[PdfErrorBoundary]", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const t = STRINGS[getLang()];
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 p-8 text-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm text-slate-500">{t.message}</p>
          <button
            onClick={this.handleRetry}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 active:bg-slate-300"
            aria-label={t.retry}
          >
            {t.retry}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
