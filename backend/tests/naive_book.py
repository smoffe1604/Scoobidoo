"""A straight CSV walk, separate from loss.py, used to check the real book.

Same policy, written again from the brief without looking at loss.py:
full annual premium, settled = paid, open = paid + reserve, withdrawn and
declined = 0, inception-month rate for premium, loss-month rate for claims,
unknown policies left out, perils stripped and lowercased, negative paid
read as positive, and a claim dated outside its term moved to the policy on
the same asset and peril that was on risk that day, or dropped if none was.
"""

from __future__ import annotations

import csv
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


def portfolio_totals(data_dir: Path) -> dict[str, tuple[Decimal, Decimal, int, int]]:
    assets = _rows(data_dir / "assets.csv")
    policies = _rows(data_dir / "policies.csv")
    claims = _rows(data_dir / "claims.csv")
    fx = _rows(data_dir / "fx_rates.csv")
    asset_by_id = {row["asset_id"]: row for row in assets}
    rates = {
        (row["month"], row["currency"]): Decimal(row["rate_dkk_per_unit"])
        for row in fx
    }

    earned: dict[str, Decimal] = {}
    incurred: dict[str, Decimal] = {}
    policy_count: dict[str, int] = {}
    claim_count: dict[str, int] = {}
    policy_portfolio: dict[str, str] = {}
    term: dict[str, tuple[date, date]] = {}
    cover: dict[tuple[str, str], list[str]] = {}

    for row in policies:
        asset = asset_by_id[row["asset_id"]]
        portfolio_id = asset["portfolio_id"]
        inception = datetime.strptime(row["inception_date"], "%Y-%m-%d").date()
        expiry = datetime.strptime(row["expiry_date"], "%Y-%m-%d").date()
        premium = Decimal(row["annual_premium"]) * rates[(f"{inception:%Y-%m}", row["currency"])]
        earned[portfolio_id] = earned.get(portfolio_id, Decimal(0)) + premium
        policy_count[portfolio_id] = policy_count.get(portfolio_id, 0) + 1
        policy_portfolio[row["policy_id"]] = portfolio_id
        term[row["policy_id"]] = (inception, expiry)
        cover.setdefault((row["asset_id"], row["peril"].strip().lower()), []).append(row["policy_id"])
    policy_asset_peril = {
        row["policy_id"]: (row["asset_id"], row["peril"].strip().lower()) for row in policies
    }

    for row in claims:
        policy_id = row["policy_id"]
        if policy_id not in policy_portfolio:
            continue
        loss_date = _parse_date(row["loss_date"])
        start, end = term[policy_id]
        if not (start <= loss_date <= end):
            on_risk = [
                other
                for other in cover[policy_asset_peril[policy_id]]
                if term[other][0] <= loss_date <= term[other][1]
            ]
            if not on_risk:
                continue
            policy_id = max(on_risk, key=lambda other: (term[other][0], other))
        portfolio_id = policy_portfolio[policy_id]
        paid = abs(Decimal(row["paid_amount"]))
        reserve = Decimal(row["reserve_amount"])
        status = row["status"]
        if status in {"withdrawn", "declined"}:
            amount = Decimal(0)
        elif status == "settled":
            amount = paid
        else:
            amount = paid + reserve
        amount *= rates[(f"{loss_date:%Y-%m}", row["currency"])]
        incurred[portfolio_id] = incurred.get(portfolio_id, Decimal(0)) + amount
        claim_count[portfolio_id] = claim_count.get(portfolio_id, 0) + 1

    return {
        portfolio_id: (
            earned.get(portfolio_id, Decimal(0)),
            incurred.get(portfolio_id, Decimal(0)),
            policy_count.get(portfolio_id, 0),
            claim_count.get(portfolio_id, 0),
        )
        for portfolio_id in earned
    }


def _parse_date(value: str) -> date:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(value)


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))
