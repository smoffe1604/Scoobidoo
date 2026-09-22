"""Loss experience for one book of property policies.

Rules, matching the brief:

- Incurred loss is the amount paid for a settled claim, paid plus reserve for
  an open claim, and zero when the claim was withdrawn or declined.
- Earned premium is the full annual premium. There is no pro-rata.
- Money is converted to DKK at the month-end rate: the inception month for a
  premium, the loss month for a claim.
- A claim stays in the result when its policy id exists, even if the loss
  date falls outside the policy term.
- Peril labels are stripped and lowercased before policies are grouped.

Rows that cannot be attached to a portfolio are counted on the quality
report and left out of the ratios.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

KNOWN_STATUSES = {"settled", "open", "withdrawn", "declined"}
NIL_STATUSES = {"withdrawn", "declined"}


@dataclass(frozen=True)
class Policy:
    policy_id: str
    asset_id: str
    portfolio_id: str
    region: str
    asset_type: str
    peril: str
    inception: date
    expiry: date
    premium_dkk: Decimal


@dataclass(frozen=True)
class Claim:
    claim_id: str
    policy_id: str
    incurred_dkk: Decimal
    before_inception: bool
    after_expiry: bool
    ignored_reserve_dkk: Decimal


@dataclass
class Quality:
    policies_included: int = 0
    claims_included: int = 0
    policies_excluded_unknown_asset: int = 0
    policies_excluded_bad_row: int = 0
    duplicate_policy_ids: int = 0
    claims_excluded_unknown_policy: int = 0
    claims_excluded_bad_row: int = 0
    duplicate_claim_ids: int = 0
    orphan_paid_dkk: Decimal = Decimal(0)
    perils_relabelled: int = 0
    claim_loss_dates_dmy: int = 0
    negative_paid_count: int = 0
    negative_paid_dkk: Decimal = Decimal(0)
    settled_with_reserve: int = 0
    ignored_reserve_dkk: Decimal = Decimal(0)
    before_inception: int = 0
    after_expiry: int = 0
    overlapping_cover_pairs: int = 0
    nil_claims_with_paid: int = 0
    notes: list[str] = field(default_factory=list)


@dataclass
class Bucket:
    policy_count: int
    earned_premium_dkk: Decimal
    incurred_loss_dkk: Decimal
    claim_count: int
    largest_claim_dkk: Decimal | None

    @property
    def loss_ratio(self) -> Decimal | None:
        if self.earned_premium_dkk == 0:
            return None
        return self.incurred_loss_dkk / self.earned_premium_dkk


@dataclass
class Book:
    policies: list[Policy]
    claims_by_policy: dict[str, list[Claim]]
    quality: Quality
    portfolios: list[str]
    regions: list[str]
    asset_types: list[str]
    underwriting_years: list[int]


def incurred_amount(status: str, paid: Decimal, reserve: Decimal) -> Decimal:
    """What one claim has cost so far, in its original currency."""
    if status in NIL_STATUSES:
        return Decimal(0)
    if status == "settled":
        return paid
    if status == "open":
        return paid + reserve
    raise ValueError(f"Unexpected status {status!r}")


def parse_date(value: str) -> tuple[date, str]:
    text = value.strip()
    for fmt, kind in (("%Y-%m-%d", "iso"), ("%d-%m-%Y", "dmy")):
        try:
            return datetime.strptime(text, fmt).date(), kind
        except ValueError:
            continue
    raise ValueError(text)


def month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def load_book(data_dir: Path) -> Book:
    data_dir = Path(data_dir)
    required = ("assets.csv", "policies.csv", "claims.csv", "fx_rates.csv")
    missing = [name for name in required if not (data_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Missing {', '.join(missing)} in {data_dir}. "
            "Unzip envira-loss-data.zip so the CSVs sit in the data/ directory."
        )
    return build_book(
        _read_csv(data_dir / "assets.csv"),
        _read_csv(data_dir / "policies.csv"),
        _read_csv(data_dir / "claims.csv"),
        _read_csv(data_dir / "fx_rates.csv"),
    )


def build_book(
    assets: list[dict[str, str]],
    policies: list[dict[str, str]],
    claims: list[dict[str, str]],
    fx_rows: list[dict[str, str]],
) -> Book:
    quality = Quality()
    asset_by_id: dict[str, dict[str, str]] = {}
    for row in assets:
        asset_id = _cell(row, "asset_id")
        if not asset_id or asset_id in asset_by_id:
            continue
        asset_by_id[asset_id] = row

    rates: dict[tuple[str, str], Decimal] = {}
    for row in fx_rows:
        month = _cell(row, "month")
        currency = _cell(row, "currency").upper()
        rates[(month, currency)] = Decimal(_cell(row, "rate_dkk_per_unit"))

    loaded_policies: list[Policy] = []
    seen_policy_ids: set[str] = set()
    for row in policies:
        policy = _policy_from_row(row, asset_by_id, rates, seen_policy_ids, quality)
        if policy is not None:
            loaded_policies.append(policy)
            if row["peril"].strip().lower() != row["peril"]:
                quality.perils_relabelled += 1

    policy_by_id = {policy.policy_id: policy for policy in loaded_policies}
    claims_by_policy: dict[str, list[Claim]] = defaultdict(list)
    seen_claim_ids: set[str] = set()
    for row in claims:
        claim = _claim_from_row(row, policy_by_id, rates, seen_claim_ids, quality)
        if claim is not None:
            claims_by_policy[claim.policy_id].append(claim)

    quality.policies_included = len(loaded_policies)
    quality.claims_included = sum(len(items) for items in claims_by_policy.values())
    quality.overlapping_cover_pairs = _overlapping_pairs(loaded_policies)
    quality.notes = _notes(quality)

    years = sorted({policy.inception.year for policy in loaded_policies})
    return Book(
        policies=loaded_policies,
        claims_by_policy=dict(claims_by_policy),
        quality=quality,
        portfolios=sorted({_cell(row, "portfolio_id") for row in assets if _cell(row, "portfolio_id")}),
        regions=sorted({_cell(row, "region") for row in assets if _cell(row, "region")}),
        asset_types=sorted({_cell(row, "asset_type") for row in assets if _cell(row, "asset_type")}),
        underwriting_years=years,
    )


def experience_for_portfolio(
    book: Book,
    portfolio_id: str,
    *,
    underwriting_year: int | None = None,
    region: str | None = None,
    asset_type: str | None = None,
) -> tuple[Bucket, list[tuple[str, Bucket]]] | None:
    if portfolio_id not in book.portfolios:
        return None
    selected = _select_policies(
        book,
        portfolio_id=portfolio_id,
        underwriting_year=underwriting_year,
        region=region,
        asset_type=asset_type,
    )
    grouped: dict[str, list[Policy]] = defaultdict(list)
    for policy in selected:
        grouped[policy.peril].append(policy)
    perils = [
        (peril, _bucket(policies, book.claims_by_policy))
        for peril, policies in grouped.items()
    ]
    perils.sort(key=_worst_first)
    return _bucket(selected, book.claims_by_policy), perils


def compare_portfolios(
    book: Book,
    *,
    underwriting_year: int | None = None,
    region: str | None = None,
    asset_type: str | None = None,
) -> list[tuple[str, Bucket]]:
    grouped: dict[str, list[Policy]] = defaultdict(list)
    for policy in _select_policies(
        book,
        portfolio_id=None,
        underwriting_year=underwriting_year,
        region=region,
        asset_type=asset_type,
    ):
        grouped[policy.portfolio_id].append(policy)
    rows = [
        (portfolio_id, _bucket(policies, book.claims_by_policy))
        for portfolio_id, policies in grouped.items()
    ]
    rows.sort(key=_worst_first)
    return rows


def _select_policies(
    book: Book,
    *,
    portfolio_id: str | None,
    underwriting_year: int | None,
    region: str | None,
    asset_type: str | None,
) -> list[Policy]:
    selected = []
    for policy in book.policies:
        if portfolio_id is not None and policy.portfolio_id != portfolio_id:
            continue
        if underwriting_year is not None and policy.inception.year != underwriting_year:
            continue
        if region is not None and policy.region != region:
            continue
        if asset_type is not None and policy.asset_type != asset_type:
            continue
        selected.append(policy)
    return selected


def _bucket(policies: list[Policy], claims_by_policy: dict[str, list[Claim]]) -> Bucket:
    earned = Decimal(0)
    incurred = Decimal(0)
    claim_count = 0
    largest: Decimal | None = None
    for policy in policies:
        earned += policy.premium_dkk
        for claim in claims_by_policy.get(policy.policy_id, ()):
            claim_count += 1
            incurred += claim.incurred_dkk
            if largest is None or claim.incurred_dkk > largest:
                largest = claim.incurred_dkk
    return Bucket(
        policy_count=len(policies),
        earned_premium_dkk=earned,
        incurred_loss_dkk=incurred,
        claim_count=claim_count,
        largest_claim_dkk=largest,
    )


def _worst_first(item: tuple[str, Bucket]) -> tuple[int, Decimal, str]:
    """Highest loss ratio first. A book with no premium sorts last."""
    name, bucket = item
    ratio = bucket.loss_ratio
    if ratio is None:
        return (1, Decimal(0), name)
    return (0, -ratio, name)


def _policy_from_row(
    row: dict[str, str],
    asset_by_id: dict[str, dict[str, str]],
    rates: dict[tuple[str, str], Decimal],
    seen_policy_ids: set[str],
    quality: Quality,
) -> Policy | None:
    policy_id = _cell(row, "policy_id")
    if not policy_id or policy_id in seen_policy_ids:
        quality.duplicate_policy_ids += 1
        return None
    asset = asset_by_id.get(_cell(row, "asset_id"))
    if asset is None:
        quality.policies_excluded_unknown_asset += 1
        return None
    try:
        inception, _kind = parse_date(row["inception_date"])
        expiry, _kind = parse_date(row["expiry_date"])
        premium = Decimal(_cell(row, "annual_premium"))
    except (KeyError, ValueError, ArithmeticError):
        quality.policies_excluded_bad_row += 1
        return None
    if premium < 0:
        quality.policies_excluded_bad_row += 1
        return None
    peril = row.get("peril", "").strip().lower()
    if not peril:
        quality.policies_excluded_bad_row += 1
        return None
    currency = _cell(row, "currency").upper()
    rate = rates.get((month_key(inception), currency))
    if rate is None:
        quality.policies_excluded_bad_row += 1
        return None
    seen_policy_ids.add(policy_id)
    return Policy(
        policy_id=policy_id,
        asset_id=_cell(row, "asset_id"),
        portfolio_id=_cell(asset, "portfolio_id"),
        region=_cell(asset, "region"),
        asset_type=_cell(asset, "asset_type"),
        peril=peril,
        inception=inception,
        expiry=expiry,
        premium_dkk=premium * rate,
    )


def _claim_from_row(
    row: dict[str, str],
    policy_by_id: dict[str, Policy],
    rates: dict[tuple[str, str], Decimal],
    seen_claim_ids: set[str],
    quality: Quality,
) -> Claim | None:
    claim_id = _cell(row, "claim_id")
    if not claim_id or claim_id in seen_claim_ids:
        quality.duplicate_claim_ids += 1
        return None
    policy = policy_by_id.get(_cell(row, "policy_id"))
    if policy is None:
        quality.claims_excluded_unknown_policy += 1
        paid = _optional_decimal(_cell(row, "paid_amount"))
        loss_date = _optional_date(_cell(row, "loss_date"))
        currency = _cell(row, "currency").upper()
        if paid is not None and loss_date is not None:
            rate = rates.get((month_key(loss_date), currency))
            if rate is not None:
                quality.orphan_paid_dkk += paid * rate
        return None
    try:
        loss_date, loss_kind = parse_date(row["loss_date"])
        paid = Decimal(_cell(row, "paid_amount"))
        reserve = Decimal(_cell(row, "reserve_amount"))
    except (KeyError, ValueError, ArithmeticError):
        quality.claims_excluded_bad_row += 1
        return None
    status = _cell(row, "status").lower()
    if status not in KNOWN_STATUSES:
        quality.claims_excluded_bad_row += 1
        return None
    currency = _cell(row, "currency").upper()
    rate = rates.get((month_key(loss_date), currency))
    if rate is None:
        quality.claims_excluded_bad_row += 1
        return None

    seen_claim_ids.add(claim_id)
    if loss_kind == "dmy":
        quality.claim_loss_dates_dmy += 1
    if status == "settled" and paid < 0:
        quality.negative_paid_count += 1
        quality.negative_paid_dkk += paid * rate
    if status in NIL_STATUSES and paid != 0:
        quality.nil_claims_with_paid += 1
    ignored = Decimal(0)
    if status == "settled" and reserve != 0:
        quality.settled_with_reserve += 1
        ignored = reserve * rate
        quality.ignored_reserve_dkk += ignored
    before = loss_date < policy.inception
    after = loss_date > policy.expiry
    if before:
        quality.before_inception += 1
    if after:
        quality.after_expiry += 1
    return Claim(
        claim_id=claim_id,
        policy_id=policy.policy_id,
        incurred_dkk=incurred_amount(status, paid, reserve) * rate,
        before_inception=before,
        after_expiry=after,
        ignored_reserve_dkk=ignored,
    )


def _overlapping_pairs(policies: list[Policy]) -> int:
    """Pairs on the same asset and peril whose terms overlap.

    A renewal that starts on the previous expiry date shares a boundary day
    and is not counted. Both premiums are still earned either way.
    """
    groups: dict[tuple[str, str], list[tuple[date, date]]] = defaultdict(list)
    for policy in policies:
        groups[(policy.asset_id, policy.peril)].append((policy.inception, policy.expiry))
    pairs = 0
    for intervals in groups.values():
        intervals.sort()
        for index, (_start, end) in enumerate(intervals):
            for other_start, _other_end in intervals[index + 1 :]:
                if other_start >= end:
                    break
                pairs += 1
    return pairs


def _notes(quality: Quality) -> list[str]:
    notes = [
        (
            f"{quality.perils_relabelled} policy rows had a peril label with odd case or spaces. "
            "They are grouped under the cleaned name and kept in the figures."
        ),
        (
            f"{quality.claim_loss_dates_dmy} loss dates on claims we kept were DD-MM-YYYY rather than YYYY-MM-DD. "
            "They are parsed and kept."
        ),
        (
            f"{quality.claims_excluded_unknown_policy} claims point at a policy that is not in the file. "
            f"They are excluded. Paid amount converted where possible: {_dkk(quality.orphan_paid_dkk)}."
        ),
        (
            f"{quality.negative_paid_count} settled claims have a negative paid amount. "
            f"Treated as recoveries, which lowers incurred loss by {_dkk(abs(quality.negative_paid_dkk))}."
        ),
        (
            f"{quality.settled_with_reserve} settled claims still carry a reserve. "
            f"That reserve is not incurred loss ({_dkk(quality.ignored_reserve_dkk)} left out)."
        ),
        (
            f"{quality.before_inception} claims are dated before inception and "
            f"{quality.after_expiry} are dated after expiry. "
            "They stay in, because the claim is booked to that policy."
        ),
        (
            f"{quality.overlapping_cover_pairs} pairs of policies cover the same asset and peril "
            "on overlapping dates. Both annual premiums are counted. This exercise does not pro-rate."
        ),
        "Premiums use the inception-month exchange rate. Claims use the loss-month rate. Figures are in DKK.",
    ]
    dropped = quality.policies_excluded_bad_row + quality.claims_excluded_bad_row
    if dropped:
        notes.append(
            f"{dropped} rows were excluded because a date, amount, status, or exchange rate "
            "was missing or invalid."
        )
    if quality.nil_claims_with_paid:
        notes.append(
            f"{quality.nil_claims_with_paid} withdrawn or declined claims had a non-zero paid amount. "
            "Their incurred loss is still zero."
        )
    if quality.policies_excluded_unknown_asset:
        notes.append(
            f"{quality.policies_excluded_unknown_asset} policies point at an asset that is not in the file. "
            "They are excluded."
        )
    return notes


def _dkk(amount: Decimal) -> str:
    quantized = amount.quantize(Decimal("0.01"))
    sign = "-" if quantized < 0 else ""
    whole, fraction = f"{abs(quantized):.2f}".split(".")
    groups: list[str] = []
    while whole:
        groups.append(whole[-3:])
        whole = whole[:-3]
    return f"{sign}{','.join(reversed(groups))}.{fraction} DKK"


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _cell(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def _optional_decimal(value: str) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(value)
    except ArithmeticError:
        return None


def _optional_date(value: str) -> date | None:
    if not value:
        return None
    try:
        parsed, _kind = parse_date(value)
    except ValueError:
        return None
    return parsed
