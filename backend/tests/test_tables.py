from pathlib import Path

import pytest

from tables import load_tables, query_table

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def test_search_and_portfolio_filter():
    tables = {
        "assets": [
            {"asset_id": "A1", "portfolio_id": "PF-01", "region": "Hovedstaden", "asset_type": "residential", "construction_year": "1990", "sum_insured_dkk": "1"},
            {"asset_id": "A2", "portfolio_id": "PF-02", "region": "Syddanmark", "asset_type": "commercial", "construction_year": "2000", "sum_insured_dkk": "2"},
        ]
    }
    found = query_table(tables, "assets", q="a1")
    assert found is not None
    assert found["matched"] == 1
    assert found["rows"][0]["asset_id"] == "A1"

    narrowed = query_table(tables, "assets", filters={"portfolio_id": "PF-02"})
    assert narrowed is not None
    assert narrowed["matched"] == 1
    assert narrowed["rows"][0]["region"] == "Syddanmark"
    assert query_table(tables, "nope") is None


@pytest.mark.skipif(not (DATA_DIR / "claims.csv").is_file(), reason="data/ is not unzipped")
def test_real_tables_join_portfolio_onto_claims():
    tables = load_tables(DATA_DIR)
    assert len(tables["assets"]) == 4200
    assert len(tables["policies"]) == 11560
    assert len(tables["claims"]) == 4509
    orphans = [row for row in tables["claims"] if row["policy_found"] == "no"]
    assert len(orphans) == 260
    assert all(row["portfolio_id"] == "" for row in orphans)
    placed = query_table(tables, "claims", filters={"policy_found": "yes", "portfolio_id": "PF-01"}, limit=5)
    assert placed is not None
    assert placed["matched"] > 0
    assert placed["rows"][0]["portfolio_id"] == "PF-01"
