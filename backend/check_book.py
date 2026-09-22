"""Print the book totals and how much the judgement calls move them.

Run from backend/:  python check_book.py
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from loss import load_book

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def main() -> None:
    book = load_book(DATA_DIR)
    earned = sum((policy.premium_dkk for policy in book.policies), Decimal(0))
    claims = [claim for rows in book.claims_by_policy.values() for claim in rows]
    incurred = sum((claim.incurred_dkk for claim in claims), Decimal(0))
    before = sum((claim.incurred_dkk for claim in claims if claim.before_inception), Decimal(0))
    negative = sum((claim.incurred_dkk for claim in claims if claim.incurred_dkk < 0), Decimal(0))
    reserve = sum((claim.ignored_reserve_dkk for claim in claims), Decimal(0))

    print(f"policies {book.quality.policies_included}  claims {book.quality.claims_included}")
    print(f"overall earned {earned:.2f}  incurred {incurred:.2f}  ratio {_ratio(incurred, earned)}")
    print(f"without pre-inception losses  ratio {_ratio(incurred - before, earned)}  (those losses {before:.2f})")
    print(f"without negative claims       ratio {_ratio(incurred - negative, earned)}  (those claims {negative:.2f})")
    print(f"if settled reserves were added ratio {_ratio(incurred + reserve, earned)}  (reserve {reserve:.2f})")
    print(f"orphan paid excluded {_dkk(book.quality.orphan_paid_dkk)}")
    print(f"overlapping pairs {book.quality.overlapping_cover_pairs}")
    print()
    from loss import compare_portfolios

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
