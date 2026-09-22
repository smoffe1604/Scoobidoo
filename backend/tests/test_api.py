import csv
from pathlib import Path

from fastapi.testclient import TestClient

from main import create_app
from tests.sample import ASSETS, CLAIMS, FX, POLICIES


def client(tmp_path: Path) -> TestClient:
    _write(tmp_path / "assets.csv", ASSETS)
    _write(tmp_path / "policies.csv", POLICIES)
    _write(tmp_path / "claims.csv", CLAIMS)
    _write(tmp_path / "fx_rates.csv", FX)
    return TestClient(create_app(tmp_path))


def test_portfolio_endpoint_returns_the_hand_figures(tmp_path: Path):
    with client(tmp_path) as api:
        response = api.get("/portfolios/PF-01/loss-experience")
    assert response.status_code == 200
    body = response.json()
    flood = next(row for row in body["perils"] if row["peril"] == "flood")
    assert flood["earned_premium_dkk"] == 750
    assert flood["incurred_loss_dkk"] == 144
    assert flood["loss_ratio"] == 0.192
    assert flood["largest_claim_dkk"] == 80
    assert flood["claim_count"] == 5
    assert body["totals"]["policy_count"] == 2


def test_unknown_portfolio_and_unknown_region(tmp_path: Path):
    with client(tmp_path) as api:
        missing = api.get("/portfolios/PF-99/loss-experience")
        bad_region = api.get("/portfolios/loss-experience", params={"region": "Jylland"})
    assert missing.status_code == 404
    assert bad_region.status_code == 400


def test_comparison_is_worst_ratio_first(tmp_path: Path):
    with client(tmp_path) as api:
        body = api.get("/portfolios/loss-experience").json()
    assert [row["portfolio_id"] for row in body["portfolios"]] == ["PF-01", "PF-02"]
    assert body["ranked_by"] == "loss_ratio_descending"


def _write(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
