"""``python -m src`` giriş noktası.

Tüm başlatma işini ``entry_desktop.main()`` üstlenir: sys.path kurulumu
(``src/`` ve proje kökü), üretim loglaması + global çökme yakalama, splash
ekranı ve ana pencere. Böylece ``python -m src`` ile ``python src/entry_desktop.py``
birebir aynı yolu kullanır.
"""

from __future__ import annotations


def main() -> None:
    # Paket-içi modül; entry_desktop kendi _ensure_paths()'ini çağırarak
    # ``import pdf_engine`` / ``from modules...`` top-level importlarını çözer.
    from .entry_desktop import main as _entry_main

    _entry_main()


if __name__ == "__main__":
    main()
