from decimal import Decimal
from pathlib import Path

import pytest

from loss import experience_for_portfolio, load_book
from tests.naive_book import portfolio_totals

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


pytestmark = pytest.mark.skipif(
    not (DATA_DIR / "policies.csv").is_file(),
    reason="Unzip the exercise data into data/ to reconcile the full book.",
)


def test_each_portfolio_matches_an_independent_csv_walk():
    book = load_book(DATA_DIR)
    naive = portfolio_totals(DATA_DIR)
    assert set(naive) == set(book.portfolios)
    for portfolio_id, (earned, incurred, policies, claims) in naive.items():
        found = experience_for_portfolio(book, portfolio_id)
        assert found is not None
        totals, _perils = found
        assert totals.earned_premium_dkk == earned
        assert totals.incurred_loss_dkk == incurred
        assert totals.policy_count == policies
        assert totals.claim_count == claims


def test_every_dropped_row_is_accounted_for():
    book = load_book(DATA_DIR)
    quality = book.quality
    assert quality.policies_included == 11560
    assert quality.policies_excluded_unknown_asset == 0
    assert quality.policies_excluded_bad_row == 0
    assert quality.duplicate_policy_ids == 0
    assert quality.duplicate_claim_ids == 0
    assert quality.claims_excluded_bad_row == 0
    assert quality.claims_excluded_unknown_policy == 260
    assert quality.before_inception == 310
    assert quality.after_expiry == 0
    assert quality.claims_moved_to_covering_policy == 83
    assert quality.claims_excluded_outside_term == 227
    assert quality.claims_included == 4509 - 260 - 227
    assert quality.negative_paid_count == 249


def test_the_book_ratio_is_where_the_hand_check_put_it():
    book = load_book(DATA_DIR)
    earned = sum((p.premium_dkk for p in book.policies), Decimal(0))
    incurred = sum((c.incurred_dkk for cs in book.claims_by_policy.values() for c in cs), Decimal(0))
    assert (incurred / earned).quantize(Decimal("0.001")) == Decimal("0.751")
