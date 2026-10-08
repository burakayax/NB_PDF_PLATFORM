"""Misafir PDF Sıkıştır: günde 1 hak, hata olunca iade, jetonla sahiplik, toplam kapasite."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.core import guest_daily_limit as gdl


@pytest.fixture()
def client(tmp_path, monkeypatch):
    gdl.reset_for_tests(str(tmp_path / "guest.db"))
    monkeypatch.setenv("GUEST_COMPRESS_DAILY_LIMIT", "1")
    monkeypatch.setenv("GUEST_COMPRESS_GLOBAL_DAILY_LIMIT", "400")
    monkeypatch.setenv("GUEST_COMPRESS_MAX_MB", "20")
    # Köprü varsayılan KAPALI (yerel yedek) — köprü testleri kendi sırrını ayarlar.
    monkeypatch.delenv("INTERNAL_SERVICE_SECRET", raising=False)
    gdl.clear_config_cache()
    from app.limiter import limiter
    from app.main import app

    # Dakikalık istek sınırı canlıda açık kalır; testte yalnızca bu dosyanın çok sayıda
    # isteği sınıra takılmasın diye kapatılır.
    was_enabled = limiter.enabled
    limiter.enabled = False
    try:
        yield TestClient(app)
    finally:
        limiter.enabled = was_enabled


def _pdf_bytes(pages: int = 1) -> bytes:
    import fitz

    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Deneme sayfasi {i + 1}", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def _start(client, *, ip="203.0.113.7", pdf=None, **form):
    return client.post(
        "/api/guest-compress/start",
        files={"file": ("rapor.pdf", pdf if pdf is not None else _pdf_bytes(), "application/pdf")},
        data=form,
        headers={"x-forwarded-for": ip},
    )


def _wait_done(client, job_id, dl, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        st = client.get(f"/api/guest-compress/jobs/{job_id}", params={"dl": dl}).json()
        if st["status"] in ("completed", "failed", "cancelled"):
            return st
        time.sleep(0.2)
    raise AssertionError("iş zamanında bitmedi")


def test_allowance_starts_full(client):
    r = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "198.51.100.1"})
    assert r.status_code == 200
    body = r.json()
    assert (body["used"], body["limit"], body["remaining"]) == (0, 1, 1)
    assert body["maxMB"] == 20


def test_first_run_works_and_second_is_blocked(client):
    r = _start(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["allowance"]["remaining"] == 0
    st = _wait_done(client, body["job_id"], body["dl"])
    assert st["status"] == "completed", st
    dlr = client.get(f"/api/guest-compress/result/{st['result_id']}/download", params={"dl": body["dl"]})
    assert dlr.status_code == 200
    assert dlr.content.startswith(b"%PDF-")

    again = _start(client)
    assert again.status_code == 429
    j = again.json()
    assert j["error"] == "daily_limit" and j["remaining"] == 0 and j["limit"] == 1


def test_different_visitor_has_own_allowance(client):
    assert _start(client, ip="203.0.113.10").status_code == 200
    assert _start(client, ip="203.0.113.11").status_code == 200


def test_spoofed_leading_forwarded_for_entries_do_not_bypass_the_limit(client):
    # Gerçek IP listenin SONUNDA (ara sunucu ekler); istemci başa istediğini yazabilir.
    def go(fake):
        return client.post(
            "/api/guest-compress/start",
            files={"file": ("a.pdf", _pdf_bytes(), "application/pdf")},
            headers={"x-forwarded-for": f"{fake}, 192.0.2.50"},
        )

    assert go("1.1.1.1").status_code == 200
    assert go("2.2.2.2").status_code == 429  # aynı gerçek IP → başlık taklidi hakkı yenilemez


def test_cloudflare_header_is_ignored_unless_explicitly_trusted(client, monkeypatch):
    def go(cf):
        return client.post(
            "/api/guest-compress/start",
            files={"file": ("a.pdf", _pdf_bytes(), "application/pdf")},
            headers={"cf-connecting-ip": cf, "x-forwarded-for": "192.0.2.77"},
        )

    # Varsayılan: CF başlığına güvenilmez (istemci yazabilir) → aynı gerçek IP, ikinci istek engellenir.
    assert go("9.9.9.1").status_code == 200
    assert go("9.9.9.2").status_code == 429
    # Açıkça güvenilirse (Cloudflare gerçekten önde): CF başlığı kimliği belirler.
    monkeypatch.setenv("GUEST_TRUST_CF_HEADER", "1")
    assert go("9.9.9.3").status_code == 200


def test_two_trusted_hops_picks_the_client_entry(client, monkeypatch):
    monkeypatch.setenv("GUEST_TRUSTED_PROXY_HOPS", "2")
    # "taklit, gerçek-istemci, cloudflare-ucu" → sağdan 2. girdi gerçek istemcidir.
    def go(cdn):
        return client.post(
            "/api/guest-compress/start",
            files={"file": ("a.pdf", _pdf_bytes(), "application/pdf")},
            headers={"x-forwarded-for": f"6.6.6.6, 192.0.2.88, {cdn}"},
        )

    assert go("172.70.1.1").status_code == 200
    assert go("172.70.9.9").status_code == 429  # ucu IP'si değişse de aynı istemci


def test_invalid_upload_does_not_burn_the_allowance(client):
    bad = client.post(
        "/api/guest-compress/start",
        files={"file": ("x.pdf", b"bu bir pdf degil", "application/pdf")},
        headers={"x-forwarded-for": "203.0.113.20"},
    )
    assert bad.status_code >= 400
    left = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.20"}).json()
    assert left["remaining"] == 1


def test_bad_target_is_rejected_before_counting(client):
    r = _start(client, ip="203.0.113.21", target_kb="5")
    assert r.status_code == 400
    left = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.21"}).json()
    assert left["remaining"] == 1


def test_oversize_upload_is_rejected_and_refunded(client, monkeypatch):
    monkeypatch.setenv("GUEST_COMPRESS_MAX_MB", "0")  # 0 MB: her dosya büyük sayılır
    r = _start(client, ip="203.0.113.22")
    assert r.status_code >= 400
    monkeypatch.setenv("GUEST_COMPRESS_MAX_MB", "20")
    left = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.22"}).json()
    assert left["remaining"] == 1


def test_result_belongs_to_the_starter_only(client):
    body = _start(client, ip="203.0.113.30").json()
    st = _wait_done(client, body["job_id"], body["dl"])
    assert st["status"] == "completed"
    # Başkasının jetonu: iş durumu da, indirme de reddedilir.
    assert client.get(f"/api/guest-compress/jobs/{body['job_id']}", params={"dl": "baskasi"}).status_code in (403, 404)
    assert client.get(f"/api/guest-compress/result/{st['result_id']}/download", params={"dl": "baskasi"}).status_code in (403, 404)
    assert client.get(f"/api/guest-compress/result/{st['result_id']}/download").status_code == 400


def test_global_capacity_is_enforced_and_refunds_the_person(client, monkeypatch):
    monkeypatch.setenv("GUEST_COMPRESS_GLOBAL_DAILY_LIMIT", "1")
    assert _start(client, ip="203.0.113.40").status_code == 200
    r = _start(client, ip="203.0.113.41")
    assert r.status_code == 429
    assert r.json()["error"] == "capacity"
    # İkinci kişinin kişisel hakkı yanmamalı.
    left = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.41"}).json()
    assert left["remaining"] == 1


def test_ip_is_never_stored_in_clear():
    key = gdl.guest_key("203.0.113.99")
    assert "203.0.113.99" not in key
    assert key.startswith("g:") and len(key) == 34


def test_kill_switch_zero_means_closed_not_unlimited(client, monkeypatch):
    monkeypatch.setenv("GUEST_COMPRESS_DAILY_LIMIT", "0")
    r = _start(client, ip="203.0.113.60")
    assert r.status_code == 429
    assert r.json()["error"] == "daily_limit"
    allowance = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.60"}).json()
    assert allowance["remaining"] == 0


def test_global_zero_closes_guest_use(client, monkeypatch):
    monkeypatch.setenv("GUEST_COMPRESS_GLOBAL_DAILY_LIMIT", "0")
    r = _start(client, ip="203.0.113.61")
    assert r.status_code == 429
    assert r.json()["error"] == "capacity"


# ── Köprü: ayar + sayaç Node/Postgres'te (panelden yönetilir) ──────────────────────────────────


class FakeNode:
    """Node köprüsünün davranışını taklit eder: panel ayarı + atomik, limit-sahibi sayaç."""

    def __init__(self, **cfg):
        self.cfg = {"enabled": True, "dailyLimit": 1, "globalDailyLimit": 400, "maxMB": 20, **cfg}
        self.counts: dict[str, int] = {}
        self.calls: list[tuple] = []
        self.down = False

    def get(self, path):
        self.calls.append(("GET", path))
        if self.down:
            return None
        c = self.cfg
        return {**c, "closed": (not c["enabled"]) or c["dailyLimit"] <= 0 or c["globalDailyLimit"] <= 0}

    def post(self, path, body):
        self.calls.append(("POST", body["action"], body["scope"], body.get("key")))
        if self.down:
            return None
        key = "global" if body["scope"] == "global" else body["key"]
        limit = self.cfg["globalDailyLimit"] if body["scope"] == "global" else self.cfg["dailyLimit"]
        if not self.cfg["enabled"]:
            limit = 0
        if body["action"] == "consume":
            used = self.counts.get(key, 0)
            if limit <= 0 or used >= limit:
                return {"allowed": False, "used": used, "limit": limit}
            self.counts[key] = used + 1
            return {"allowed": True, "used": used + 1, "limit": limit}
        if body["action"] == "refund":
            self.counts[key] = max(0, self.counts.get(key, 0) - 1)
            return {"ok": True}
        return {"used": self.counts.get(key, 0), "limit": limit}


@pytest.fixture()
def node(client, monkeypatch):
    fake = FakeNode()
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "test-secret")
    monkeypatch.setattr(gdl, "_bridge_get", fake.get)
    monkeypatch.setattr(gdl, "_bridge_post", fake.post)
    gdl.clear_config_cache()
    return fake


def test_bridge_counts_in_database_not_in_local_file(client, node):
    r = _start(client, ip="203.0.113.70")
    assert r.status_code == 200, r.text
    assert any(c[:3] == ("POST", "consume", "person") for c in node.calls)
    assert any(c[:3] == ("POST", "consume", "global") for c in node.calls)
    assert node.counts.get("global") == 1
    # İkinci istek Node sayacında engellenir.
    assert _start(client, ip="203.0.113.70").status_code == 429
    assert gdl.counter_source() == "database"


def test_panel_limit_wins_over_environment(client, node, monkeypatch):
    monkeypatch.setenv("GUEST_COMPRESS_DAILY_LIMIT", "1")  # ortam 1 der
    node.cfg["dailyLimit"] = 2  # panel 2 der → panel kazanır
    gdl.clear_config_cache()
    assert _start(client, ip="203.0.113.71").status_code == 200
    assert _start(client, ip="203.0.113.71").status_code == 200
    assert _start(client, ip="203.0.113.71").status_code == 429


def test_panel_switch_off_closes_the_door_immediately(client, node):
    node.cfg["enabled"] = False
    gdl.clear_config_cache()
    r = _start(client, ip="203.0.113.72")
    assert r.status_code == 429 and r.json()["error"] == "daily_limit"
    assert r.json()["remaining"] == 0
    allowance = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.72"}).json()
    assert allowance["limit"] == 0 and allowance["remaining"] == 0
    assert node.counts == {}  # kapalıyken sayaç hiç artmaz


def test_panel_max_mb_is_used_for_uploads_and_shown(client, node):
    node.cfg["maxMB"] = 7
    gdl.clear_config_cache()
    allowance = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.73"}).json()
    assert allowance["maxMB"] == 7


def test_config_is_cached_so_each_request_does_not_hit_node(client, node):
    for _ in range(3):
        client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.74"})
    assert len([c for c in node.calls if c[0] == "GET"]) == 1


def test_last_known_panel_config_survives_a_node_outage(client, node):
    node.cfg["enabled"] = False  # yönetici kapıyı kapattı
    gdl.clear_config_cache()
    assert gdl.get_config().closed is True
    node.down = True
    # Önbelleği silmeden süreyi geçir: Node erişilemezken bile son bilinen (kapalı) değer korunmalı.
    import time as _t
    gdl._cfg_cache = (_t.monotonic() - 3600, gdl._cfg_cache[1])
    assert gdl.get_config().closed is True  # kapı yeniden AÇILMAZ
    assert _start(client, ip="203.0.113.75").status_code == 429


def test_falls_back_to_local_counter_when_node_is_unreachable(client, node):
    node.down = True
    gdl.clear_config_cache()
    assert _start(client, ip="203.0.113.76").status_code == 200  # kesinti yok
    assert _start(client, ip="203.0.113.76").status_code == 429  # yerel sayaç yine korur


def test_refund_goes_to_the_database_too(client, node):
    bad = client.post(
        "/api/guest-compress/start",
        files={"file": ("x.pdf", b"bu bir pdf degil", "application/pdf")},
        headers={"x-forwarded-for": "203.0.113.77"},
    )
    assert bad.status_code >= 400
    assert any(c[:3] == ("POST", "refund", "person") for c in node.calls)
    assert node.counts.get("global", 0) == 0
    left = client.get("/api/guest-compress/allowance", headers={"x-forwarded-for": "203.0.113.77"}).json()
    assert left["remaining"] == 1


def test_counter_source_is_local_without_secret(client):
    assert gdl.counter_source() == "local"
