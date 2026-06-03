/** Icon Showcase — Demo component for all tool icons */

import {
  MergeIcon,
  SplitIcon,
  CompressIcon,
  ConvertIcon,
  WatermarkIcon,
  EncryptIcon,
  RotateIcon,
  DeleteIcon,
  ExtractIcon,
  SettingsIcon,
  PDFIcon,
} from "./index";

export const IconShowcase = () => {
  const tools = [
    { name: "Merge PDF", Icon: MergeIcon, description: "Birleştir" },
    { name: "Split PDF", Icon: SplitIcon, description: "Böl" },
    { name: "Compress", Icon: CompressIcon, description: "Sıkıştır" },
    { name: "Convert to Word", Icon: ConvertIcon, description: "Dönüştür" },
    { name: "Watermark", Icon: WatermarkIcon, description: "Filigran" },
    { name: "Encrypt", Icon: EncryptIcon, description: "Şifrele" },
    { name: "Rotate", Icon: RotateIcon, description: "Döndür" },
    { name: "Delete Pages", Icon: DeleteIcon, description: "Sil" },
    { name: "Extract", Icon: ExtractIcon, description: "Çıkar" },
    { name: "Settings", Icon: SettingsIcon, description: "Ayarlar" },
    { name: "PDF", Icon: PDFIcon, description: "PDF" },
  ];

  return (
    <div className="bg-nb-bg-elevated rounded-lg p-8">
      <h2 className="text-2xl font-bold text-nb-heading mb-6">Tool Icons</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {tools.map(({ name, Icon, description }) => (
          <div
            key={name}
            className="flex flex-col items-center gap-3 p-4 rounded-lg
                     bg-nb-panel hover:bg-nb-panel-alt transition-colors"
          >
            <div
              className="w-10 h-10 flex items-center justify-center
                        text-nb-primary hover:text-nb-accent transition-colors"
            >
              <Icon className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-nb-text">{name}</p>
              <p className="text-[10px] text-nb-muted">{description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive demo */}
      <div className="mt-8 border-t border-nb-border pt-8">
        <h3 className="text-lg font-semibold text-nb-heading mb-4">
          Interactive Demo (Hover effects)
        </h3>
        <div className="flex justify-center">
          <button
            className="logo-container flex items-center gap-3
                     hover:shadow-lg transition-all duration-300"
          >
            <SplitIcon className="w-6 h-6" />
            <span>Hover me!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconShowcase;
