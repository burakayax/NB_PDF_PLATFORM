; Inno Setup 6 — compile after PyInstaller produces dist\NB_PDF_TOOLS.exe
; Install: https://jrsoftware.org/isinfo.php
; Command-line: "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\NB_PDF_TOOLS.iss

#define MyAppName "PDF PLATFORM"
#define MyAppVersion "1.0.0"
#define MyPublisher "NB Global Studio"
#define MyExeName "NB_PDF_TOOLS.exe"

[Setup]
AppId={{B5F3A2C1-9D8E-4F7A-B6C5-D4E3F2A1B0C9}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist_installer
OutputBaseFilename=NB_PDF_TOOLS_Setup_{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
SetupIconFile=..\assets\nb_pdf_TOOLS_icon.ico
UninstallDisplayIcon={app}\{#MyExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\{#MyExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Dosya-ilişkilendirme ikonu (PDF dosyaları bunu gösterir).
Source: "..\assets\nb_pdf_tools_icon.ico"; DestDir: "{app}"; DestName: "nb_pdf_tools_icon.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyExeName}"; Tasks: desktopicon

; ─── Dosya ilişkilendirme (.pdf) + DefaultIcon ─────────────────────────────────
; PrivilegesRequired=lowest → HKA, kullanıcı bazında (HKCU\Software\Classes).
; Kendi ProgID'imizi kaydediyoruz; kullanıcı "varsayılan yap" derse Windows bu
; ikonu kullanır. Ayrıca Applications\exe altına DefaultIcon: elle "birlikte aç →
; her zaman" ilişkilendirmesinde de PDF'ler beyaz değil markalı ikon gösterir.
[Registry]
Root: HKA; Subkey: "Software\Classes\NBPDFPlatform.pdf"; ValueType: string; ValueData: "PDF Platform Belgesi"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\NBPDFPlatform.pdf\DefaultIcon"; ValueType: string; ValueData: "{app}\nb_pdf_tools_icon.ico,0"
Root: HKA; Subkey: "Software\Classes\NBPDFPlatform.pdf\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyExeName}"" ""%1"""
Root: HKA; Subkey: "Software\Classes\.pdf\OpenWithProgids"; ValueType: string; ValueName: "NBPDFPlatform.pdf"; ValueData: ""; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\Applications\{#MyExeName}"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\Applications\{#MyExeName}\DefaultIcon"; ValueType: string; ValueData: "{app}\nb_pdf_tools_icon.ico,0"
Root: HKA; Subkey: "Software\Classes\Applications\{#MyExeName}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyExeName}"" ""%1"""
Root: HKA; Subkey: "Software\Classes\Applications\{#MyExeName}\SupportedTypes"; ValueType: string; ValueName: ".pdf"; ValueData: ""

[Run]
Filename: "{app}\{#MyExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

; ─── Kurulum sonrası: Windows'a ilişkilendirme değişti bildir (ikon önbelleği tazele) ──
[Code]
procedure SHChangeNotify(wEventId: Integer; uFlags: Cardinal; dwItem1, dwItem2: Cardinal);
  external 'SHChangeNotify@shell32.dll stdcall';

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    // SHCNE_ASSOCCHANGED ($08000000), SHCNF_IDLIST (0)
    SHChangeNotify($08000000, $0000, 0, 0);
end;
