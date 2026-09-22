"""Print the book totals and how much the judgement calls move them.

Run from backend/:  python check_book.py
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from loss import compare_portfolios, load_book

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def main() -> None:
    book = load_book(DATA_DIR)
    quality = book.quality
    earned = sum((policy.premium_dkk for policy in book.policies), Decimal(0))
    claims = [claim for rows in book.claims_by_policy.values() for claim in rows]
    incurred = sum((claim.incurred_dkk for claim in claims), Decimal(0))
    flipped = sum((claim.incurred_dkk for claim in claims if claim.sign_flipped), Decimal(0))
    moved = sum((claim.incurred_dkk for claim in claims if claim.moved_from_policy_id), Decimal(0))
    reserve = sum((claim.ignored_reserve_dkk for claim in claims), Decimal(0))
    outside = quality.outside_term_incurred_dkk

    print(f"policies {quality.policies_included}  claims {quality.claims_included}")
    print(f"overall earned {earned:.2f}  incurred {incurred:.2f}  ratio {_ratio(incurred, earned)}")
    print("how much each judgement call moves the book:")
    print(f"  negative paid as recoveries, not sign errors   ratio {_ratio(incurred - 2 * flipped, earned)}  (flipped {flipped:.2f})")
    print(f"  keep every out-of-term claim on its own policy  ratio {_ratio(incurred + outside, earned)}  (excluded {outside:.2f}, moved {moved:.2f})")
    print(f"  add reserves on settled claims                  ratio {_ratio(incurred + reserve, earned)}  (reserve {reserve:.2f})")
    print(f"orphan paid excluded {_dkk(quality.orphan_paid_dkk)}  ({quality.orphan_paid_dkk / (incurred + quality.orphan_paid_dkk):.1%} of all paid we could see)")
    print(f"overlapping pairs {quality.overlapping_cover_pairs}")
    print()
    by_peril: dict[str, list[Decimal]] = {}
    for policy in book.policies:
        cell = by_peril.setdefault(policy.peril, [Decimal(0), Decimal(0)])
        cell[0] += policy.premium_dkk
        cell[1] += sum((c.incurred_dkk for c in book.claims_by_policy.get(policy.policy_id, [])), Decimal(0))
    print("by peril across the book (fire is the figure to question):")
    for peril, (peril_earned, peril_incurred) in sorted(by_peril.items(), key=lambda item: -item[1][1] / item[1][0]):
        print(f"  {peril:12} earned {peril_earned:14.2f}  incurred {peril_incurred:14.2f}  ratio {_ratio(peril_incurred, peril_earned):>7}")
    print()
    for portfolio_id, bucket in compare_portfolios(book):
        largest = bucket.largest_claim_dkk or Decimal(0)
        print(
            f"{portfolio_id}  policies {bucket.policy_count:5}  "
            f"earned {bucket.earned_premium_dkk:15.2f}  "
            f"incurred {bucket.incurred_loss_dkk:15.2f}  "
            f"ratio {_ratio(bucket.incurred_loss_dkk, bucket.earned_premium_dkk):>8}  "
            f"claims {bucket.claim_count:5}  largest {largest:12.2f}"
        )
    print()
    for note in book.quality.notes:
        print(f"- {note}")


def _ratio(incurred: Decimal, earned: Decimal) -> str:
    if earned == 0:
        return "n/a"
    return f"{(incurred / earned):.1%}"


def _dkk(amount: Decimal) -> str:
    return f"{amount:,.2f} DKK"


if __name__ == "__main__":
    main()
