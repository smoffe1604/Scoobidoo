"""Browse the source CSVs. Portfolio on a policy or claim comes from the asset."""

from __future__ import annotations

import csv
from pathlib import Path

Column = tuple[str, str]

ASSETS: list[Column] = [
    ("asset_id", "Asset"),
    ("portfolio_id", "Portfolio"),
    ("region", "Region"),
    ("asset_type", "Type"),
    ("construction_year", "Built"),
    ("sum_insured_dkk", "Sum insured"),
]
POLICIES: list[Column] = [
    ("policy_id", "Policy"),
    ("asset_id", "Asset"),
    ("portfolio_id", "Portfolio"),
    ("region", "Region"),
    ("asset_type", "Type"),
    ("peril", "Peril"),
    ("peril_group", "Peril, cleaned"),
    ("inception_date", "Inception"),
    ("expiry_date", "Expiry"),
    ("annual_premium", "Premium"),
    ("currency", "Currency"),
]
CLAIMS: list[Column] = [
    ("claim_id", "Claim"),
    ("policy_id", "Policy"),
    ("policy_found", "Policy found"),
    ("portfolio_id", "Portfolio"),
    ("asset_id", "Asset"),
    ("peril_group", "Peril, cleaned"),
    ("loss_date", "Loss date"),
    ("reported_date", "Reported"),
    ("paid_amount", "Paid"),
    ("reserve_amount", "Reserve"),
    ("currency", "Currency"),
    ("status", "Status"),
]
FX: list[Column] = [
    ("month", "Month"),
    ("currency", "Currency"),
    ("rate_dkk_per_unit", "DKK per unit"),
]

SPECS: dict[str, dict[str, object]] = {
    "assets": {
        "label": "Assets",
        "blurb": "Insured properties. Each one belongs to one portfolio.",
        "columns": ASSETS,
        "filters": ["portfolio_id", "region", "asset_type"],
    },
    "policies": {
        "label": "Policies",
        "blurb": "One year of cover on a property, for one peril. Portfolio comes from the asset.",
        "columns": POLICIES,
        "filters": ["portfolio_id", "region", "asset_type", "peril_group", "currency"],
    },
    "claims": {
        "label": "Claims",
        "blurb": "Money paid or reserved against a policy. Policy found = no means the policy id is not in the file.",
        "columns": CLAIMS,
        "filters": ["portfolio_id", "status", "currency", "policy_found", "peril_group"],
    },
    "fx-rates": {
        "label": "Exchange rates",
        "blurb": "Month-end rates into DKK.",
        "columns": FX,
        "filters": ["currency"],
    },
}


def load_tables(data_dir: Path) -> dict[str, list[dict[str, str]]]:
    data_dir = Path(data_dir)
    assets = _read(data_dir / "assets.csv")
    policies = _read(data_dir / "policies.csv")
    claims = _read(data_dir / "claims.csv")
    fx = _read(data_dir / "fx_rates.csv")

    asset_by_id = {row["asset_id"].strip(): row for row in assets if row.get("asset_id")}
    for row in policies:
        asset = asset_by_id.get(row.get("asset_id", "").strip())
        row["portfolio_id"] = asset.get("portfolio_id", "").strip() if asset else ""
        row["region"] = asset.get("region", "").strip() if asset else ""
        row["asset_type"] = asset.get("asset_type", "").strip() if asset else ""
        row["peril_group"] = row.get("peril", "").strip().lower()

    policy_by_id = {row["policy_id"].strip(): row for row in policies if row.get("policy_id")}
    for row in claims:
        policy = policy_by_id.get(row.get("policy_id", "").strip())
        row["policy_found"] = "yes" if policy else "no"
        row["portfolio_id"] = policy.get("portfolio_id", "") if policy else ""
        row["asset_id"] = policy.get("asset_id", "").strip() if policy else ""
        row["peril_group"] = policy.get("peril_group", "") if policy else ""

    return {
        "assets": assets,
        "policies": policies,
        "claims": claims,
        "fx-rates": fx,
    }


def catalog(tables: dict[str, list[dict[str, str]]]) -> list[dict[str, object]]:
    return [
        {
            "name": name,
            "label": spec["label"],
            "blurb": spec["blurb"],
            "count": len(tables.get(name, [])),
        }
        for name, spec in SPECS.items()
    ]


def query_table(
    tables: dict[str, list[dict[str, str]]],
    name: str,
    *,
    q: str = "",
    filters: dict[str, str] | None = None,
    offset: int = 0,
    limit: int = 40,
) -> dict[str, object] | None:
    spec = SPECS.get(name)
    if spec is None or name not in tables:
        return None
    columns: list[Column] = spec["columns"]  # type: ignore[assignment]
    filter_keys: list[str] = spec["filters"]  # type: ignore[assignment]
    rows = tables[name]
    chosen = {key: value for key, value in (filters or {}).items() if value}
    matched = [row for row in rows if _keep(row, columns, q, chosen)]
    page = matched[offset : offset + limit]
    return {
        "name": name,
        "label": spec["label"],
        "blurb": spec["blurb"],
        "total": len(rows),
        "matched": len(matched),
        "offset": offset,
        "limit": limit,
        "columns": [{"key": key, "label": label} for key, label in columns],
        "filters": [
            {
                "key": key,
                "label": _label(columns, key),
                "options": _options(rows, key),
                "value": chosen.get(key, ""),
            }
            for key in filter_keys
        ],
        "rows": [{key: row.get(key, "") for key, _label in columns} for row in page],
    }


def _keep(row: dict[str, str], columns: list[Column], q: str, filters: dict[str, str]) -> bool:
    for key, value in filters.items():
        if row.get(key, "") != value:
            return False
    needle = q.strip().lower()
    if not needle:
        return True
    return any(needle in (row.get(key, "") or "").lower() for key, _label in columns)


def _options(rows: list[dict[str, str]], key: str) -> list[str]:
    return sorted({row.get(key, "") for row in rows if row.get(key, "")})


def _label(columns: list[Column], key: str) -> str:
    for column_key, label in columns:
        if column_key == key:
            return label
    return key


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return [dict(row) for row in csv.DictReader(handle)]
