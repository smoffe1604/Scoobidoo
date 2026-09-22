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


def test_the_book_excludes_only_the_orphan_claims():
    book = load_book(DATA_DIR)
    assert book.quality.policies_included == 11560
    assert book.quality.claims_excluded_unknown_policy == 260
    assert book.quality.claims_included == 4509 - 260
    assert book.quality.policies_excluded_unknown_asset == 0
    assert book.quality.claims_excluded_bad_row == 0
    assert book.quality.before_inception == 310
    assert book.quality.after_expiry == 0
