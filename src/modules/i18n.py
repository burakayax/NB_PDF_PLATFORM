from __future__ import annotations

import json
import locale
import os
from pathlib import Path

SUPPORTED_LANGUAGES = frozenset({"tr", "en"})
_LOCALES_DIR = Path(__file__).resolve().parent.parent / "locales"
_TRANSLATIONS_CACHE: dict[str, dict] = {}


def _load_locale(lang: str) -> dict:
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    if lang not in _TRANSLATIONS_CACHE:
        path = _LOCALES_DIR / f"{lang}.json"
        if path.is_file():
            raw = json.loads(path.read_text(encoding="utf-8"))
            _TRANSLATIONS_CACHE[lang] = raw if isinstance(raw, dict) else {}
        else:
            _TRANSLATIONS_CACHE[lang] = {}
    return _TRANSLATIONS_CACHE[lang]


def reload_translation_files() -> None:
    """Bellekteki çeviri önbelleğini temizler; diskteki JSON düzenlendikten sonra yeniden yüklemek içindir.
    Aksi halde eski metinler uygulama yeniden başlatılana kadar görünür kalır.
    Çağrı unutulursa dil dosyası değişiklikleri canlı yansımaz."""
    _TRANSLATIONS_CACHE.clear()


def detect_system_language() -> str:
    """Kullanıcının sistem/arayüz dilini tespit eder: Türkçe ise ``tr``, aksi halde ``en``.

    Türkiye/Türkçe kurulumlu cihazlar Türkçe; diğer tüm bölgeler İngilizce başlar.
    Öncelik sırası (en güvenilirden en zayıfa):
      1. Windows kullanıcı varsayılan locale adı (``GetUserDefaultLocaleName`` → ``tr-TR``).
      2. POSIX ortam değişkenleri (``LANGUAGE``/``LC_ALL``/``LC_MESSAGES``/``LANG``) — Linux/macOS.
      3. ``locale.getlocale()`` / ``getdefaultlocale()`` — son çare (3.15'te kalkacak; uyarı bastırılır).
    Hiçbir kaynak Türkçe demiyorsa güvenli varsayılan ``en``.
    """
    candidates: list[str] = []

    # 1) Windows: kullanıcının seçtiği bölge (en güvenilir; deprecation'dan etkilenmez).
    try:
        import ctypes

        if hasattr(ctypes, "windll"):
            buf = ctypes.create_unicode_buffer(85)  # LOCALE_NAME_MAX_LENGTH
            if ctypes.windll.kernel32.GetUserDefaultLocaleName(buf, 85):
                candidates.append(buf.value)
    except Exception:
        pass

    # 2) POSIX ortam değişkenleri (Windows dışı sistemler).
    for var in ("LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"):
        val = os.environ.get(var)
        if val:
            candidates.append(val)

    # 3) Python locale API — son çare; getdefaultlocale 3.15'te kalkacağı için uyarı bastırılır.
    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            loc = locale.getlocale()[0] or ""
            if loc:
                candidates.append(loc)
            try:
                dl = locale.getdefaultlocale()[0] or ""
            except Exception:
                dl = ""
            if dl:
                candidates.append(dl)
    except Exception:
        pass

    for c in candidates:
        cl = c.strip().lower()
        # 'tr', 'tr-TR', 'tr_TR' ve Windows'ın 'Turkish_Türkiye' biçimini de yakalar.
        if cl.startswith("tr") or cl.startswith("turkish"):
            return "tr"
    return "en"


def _preferences_path() -> Path:
    appdata_root = Path(os.environ.get("APPDATA") or Path.cwd())
    return appdata_root / "PDF PLATFORM" / "desktop_preferences.json"


class LanguageManager:
    def __init__(self) -> None:
        self._language = self._load_initial()

    def _load_initial(self) -> str:
        path = _preferences_path()
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                language = str(data.get("language") or "").strip().lower()
                if language in SUPPORTED_LANGUAGES:
                    return language
            except Exception:
                pass
        return detect_system_language()

    def get(self) -> str:
        return self._language

    def set(self, language: str) -> None:
        if language not in SUPPORTED_LANGUAGES:
            language = "en"
        self._language = language
        path = _preferences_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"language": self._language}, ensure_ascii=False, indent=2), encoding="utf-8")


_manager = LanguageManager()


def get_language() -> str:
    return _manager.get()


def set_language(language: str) -> None:
    _manager.set(language)


def t(key: str, **kwargs) -> str:
    """
    Noktalı çeviri anahtarını (ör. main.login_title) etkin dil için çözümler.
    Eksik anahtarda İngilizceye, o da yoksa ham anahtar metnine düşer.
    Anahtar sözleşmesi bozulursa arayüzde ham anahtarlar görünebilir.
    """
    parts = key.split(".")

    def lookup(lang_code: str):
        tree = _load_locale(lang_code)
        value: object = tree
        for part in parts:
            if not isinstance(value, dict):
                return None
            value = value.get(part)
        return value

    lang = get_language()
    value = lookup(lang) or lookup("en") or key
    if isinstance(value, str) and kwargs:
        try:
            return value.format(**kwargs)
        except (KeyError, ValueError):
            return value
    return str(value)
