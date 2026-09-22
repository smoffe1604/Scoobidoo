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
    assert flood["incurred_loss_dkk"] == 180
    assert flood["loss_ratio"] == 0.24
    assert flood["largest_claim_dkk"] == 80
    assert flood["claim_count"] == 5
    assert body["totals"]["policy_count"] == 2
    assert body["totals"]["earned_premium_dkk"] == 1750
    assert body["totals"]["incurred_loss_dkk"] == 180


def test_unknown_portfolio_and_unknown_region(tmp_path: Path):
    with client(tmp_path) as api:
        missing = api.get("/portfolios/PF-99/loss-experience")
        bad_region = api.get("/portfolios/loss-experience", params={"region": "Jylland"})
    assert missing.status_code == 404
    assert bad_region.status_code == 400


def test_comparison_is_worst_ratio_first_and_carries_the_book_total(tmp_path: Path):
    with client(tmp_path) as api:
        body = api.get("/portfolios/loss-experience").json()
        filtered = api.get("/portfolios/loss-experience", params={"underwriting_year": 2022}).json()
    assert [row["portfolio_id"] for row in body["portfolios"]] == ["PF-01", "PF-02"]
    assert body["ranked_by"] == "loss_ratio_descending"
    assert body["totals"]["earned_premium_dkk"] == 2250
    assert body["totals"]["incurred_loss_dkk"] == 180
    assert body["totals"]["policy_count"] == 3
    assert body["totals"]["loss_ratio"] == 0.08
    assert [row["portfolio_id"] for row in filtered["portfolios"]] == ["PF-02"]
    assert filtered["totals"]["earned_premium_dkk"] == 500


def test_data_quality_reports_every_exclusion(tmp_path: Path):
    with client(tmp_path) as api:
        body = api.get("/data-quality").json()
    assert body["claims_included"] == 5
    assert body["claims_excluded_unknown_policy"] == 1
    assert body["excluded_unknown_policy_paid_dkk"] == 1000
    assert body["claims_excluded_outside_term"] == 1
    assert body["excluded_outside_term_incurred_dkk"] == 100
    assert body["claims_with_negative_paid_flipped"] == 1
    assert body["negative_paid_flipped_dkk"] == 20
    assert body["duplicate_policy_ids"] == 0
    assert body["duplicate_claim_ids"] == 0
    assert isinstance(body["notes"], list) and body["notes"]


def _write(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
