"""/api/health/deps için Gotenberg kontrolü: yalnız up/down/not_configured; sızıntı yok; önbellek çalışır."""

from __future__ import annotations

from app.core import dep_health


def _reset():
    dep_health._cache["at"] = -1e9
    dep_health._cache["value"] = None


def test_not_configured_when_url_missing(monkeypatch):
    monkeypatch.delenv("GOTENBERG_URL", raising=False)
    assert dep_health.gotenberg_status(use_cache=False) == "not_configured"
    assert dep_health.gotenberg_status("   ", use_cache=False) == "not_configured"


def test_up_when_health_returns_200():
    calls = []

    def getter(url, timeout):
        calls.append((url, timeout))
        return 200

    assert dep_health.gotenberg_status("http://gotenberg:3000/", getter=getter, use_cache=False) == "up"
    assert calls == [("http://gotenberg:3000/health", 2.5)]


def test_down_on_non_200_or_exception():
    assert dep_health.gotenberg_status("http://x", getter=lambda u, t: 503, use_cache=False) == "down"

    def boom(url, timeout):
        raise TimeoutError("secret-internal-detail")

    assert dep_health.gotenberg_status("http://x", getter=boom, use_cache=False) == "down"


def test_result_is_cached_briefly():
    _reset()
    n = {"c": 0}

    def getter(url, timeout):
        n["c"] += 1
        return 200

    clock = {"t": 100.0}
    now = lambda: clock["t"]
    assert dep_health.gotenberg_status("http://x", getter=getter, now=now) == "up"
    clock["t"] += 5
    assert dep_health.gotenberg_status("http://x", getter=getter, now=now) == "up"
    assert n["c"] == 1  # 10 sn içinde ikinci istek gitmedi
    clock["t"] += 6
    assert dep_health.gotenberg_status("http://x", getter=getter, now=now) == "up"
    assert n["c"] == 2
    _reset()


def test_semasiz_adres_http_ile_denenir():
    """Render 'host:port' verir; şema eklenmeden istek atılırsa hep 'down' çıkardı."""
    from app.core import dep_health

    gorulen = []

    def sahte(url, timeout):
        gorulen.append(url)
        return 200

    assert dep_health.gotenberg_status("nb-gotenberg:3000", getter=sahte, use_cache=False) == "up"
    assert gorulen == ["http://nb-gotenberg:3000/health"]
