# PDF Platform PWA — beyaz PDF dosya ikonu düzeltme (Windows)
# ------------------------------------------------------------
# Chrome, PWA'yı .pdf işleyici olarak kaydederken dosya-ilişkilendirme ikonunu
# (DefaultIcon) bazen boş bırakır ("<yok>,0") -> PDF dosyaları BEYAZ görünür.
# Bu script, PDF Platform PWA'sının ProgID'sini otomatik bulur ve DefaultIcon'u
# Chrome'un zaten ürettiği geçerli uygulama ikonuna (.ico) yönlendirir.
#
# Kullanım: Bu dosyaya SAĞ TIK -> "PowerShell ile çalıştır"
#   (veya PowerShell aç, çalıştır:  powershell -ExecutionPolicy Bypass -File .\fix-pwa-pdf-icon.ps1)

$ErrorActionPreference = "SilentlyContinue"
$fixed = 0

Get-ChildItem "HKCU:\Software\Classes" |
  Where-Object { $_.PSChildName -like "Chrome.*" } |
  ForEach-Object {
    $progid = $_.PSChildName
    $appKey = "HKCU:\Software\Classes\$progid\Application"
    if (Test-Path $appKey) {
      $appName = (Get-Item $appKey).GetValue("ApplicationName")
      $appIcon = (Get-Item $appKey).GetValue("ApplicationIcon")   # ör: "...\PDF PLATFORM.ico,0"
      # PDF Platform (veya PDF ile ilgili) PWA'yı yakala
      if ($appName -match "PDF" -and $appIcon) {
        $diKey = "HKCU:\Software\Classes\$progid\DefaultIcon"
        if (-not (Test-Path $diKey)) { New-Item -Path $diKey -Force | Out-Null }
        $current = (Get-Item $diKey).GetValue("")
        Set-ItemProperty -Path $diKey -Name "(default)" -Value $appIcon
        Write-Host "Duzeltildi: $appName" -ForegroundColor Green
        Write-Host "   ProgID : $progid"
        Write-Host "   Eski   : $current"
        Write-Host "   Yeni   : $appIcon"
        $fixed++
      }
    }
  }

if ($fixed -gt 0) {
  # Windows'a "iliskilendirme degisti" bildir + ikon onbellegini tazele
  Add-Type -Namespace Win32 -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);'
  [Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
  Start-Process "ie4uinit.exe" -ArgumentList "-show" -NoNewWindow
  Write-Host ""
  Write-Host "TAMAM. $fixed iliskilendirme duzeltildi." -ForegroundColor Cyan
  Write-Host "Bir PDF klasorunu acip F5 ile yenileyin; ikonlar markali gelmeli."
} else {
  Write-Host "PDF Platform PWA bulunamadi." -ForegroundColor Yellow
  Write-Host "Once web sitesinden 'Uygulamayi yukle' ile PWA'yi kurup PDF varsayilanini ona ayarlayin, sonra bu scripti calistirin."
}

Write-Host ""
Write-Host "Kapatmak icin Enter'a basin..."
[void][System.Console]::ReadLine()
