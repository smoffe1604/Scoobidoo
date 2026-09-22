from decimal import Decimal

from loss import build_book, compare_portfolios, experience_for_portfolio
from tests.sample import ASSETS, CLAIMS, FX, POLICIES


def book():
    return build_book(ASSETS, POLICIES, CLAIMS, FX)


def peril(portfolio_id: str, name: str):
    found = experience_for_portfolio(book(), portfolio_id)
    assert found is not None
    _totals, perils = found
    return next(bucket for peril_name, bucket in perils if peril_name == name)


def test_flood_uses_paid_only_and_the_loss_month_rate():
    flood = peril("PF-01", "flood")
    assert flood.policy_count == 1
    assert flood.earned_premium_dkk == Decimal("750")
    assert flood.incurred_loss_dkk == Decimal("144")
    assert flood.claim_count == 5
    assert flood.largest_claim_dkk == Decimal("80")
    assert flood.loss_ratio == Decimal("0.192")


def test_fire_keeps_a_claim_dated_before_inception_and_drops_its_reserve():
    fire = peril("PF-01", "fire")
    assert fire.earned_premium_dkk == Decimal("1000")
    assert fire.incurred_loss_dkk == Decimal("100")
    assert fire.claim_count == 1
    assert fire.largest_claim_dkk == Decimal("100")
    assert fire.loss_ratio == Decimal("0.1")


def test_quality_report_matches_the_hand_count():
    quality = book().quality
    assert quality.perils_relabelled == 1
    assert quality.claim_loss_dates_dmy == 2
    assert quality.claims_excluded_unknown_policy == 1
    assert quality.orphan_paid_dkk == Decimal("1000")
    assert quality.negative_paid_count == 1
    assert quality.negative_paid_dkk == Decimal("-16")
    assert quality.settled_with_reserve == 2
    assert quality.ignored_reserve_dkk == Decimal("8032")
    assert quality.before_inception == 1
    assert quality.after_expiry == 0
    assert quality.nil_claims_with_paid == 1
    assert quality.claims_included == 6
    assert any("excluded" in note for note in quality.notes)


def test_worst_loss_ratio_is_ranked_first():
    rows = compare_portfolios(book())
    assert [portfolio_id for portfolio_id, _bucket in rows] == ["PF-01", "PF-02"]
    assert rows[1][1].claim_count == 0
    assert rows[1][1].largest_claim_dkk is None
    assert rows[1][1].loss_ratio == Decimal("0")


def test_underwriting_year_filter_drops_other_years():
    rows = compare_portfolios(book(), underwriting_year=2022)
    assert [portfolio_id for portfolio_id, _bucket in rows] == ["PF-02"]
    empty = experience_for_portfolio(book(), "PF-01", underwriting_year=2022)
    assert empty is not None
    totals, perils = empty
    assert totals.policy_count == 0
    assert perils == []
    assert totals.loss_ratio is None


def test_unknown_portfolio_is_missing():
    assert experience_for_portfolio(book(), "PF-99") is None


def test_overlapping_terms_both_count_and_a_shared_expiry_day_does_not():
    assets = [
        {
            "asset_id": "A1",
            "portfolio_id": "PF-01",
            "region": "Hovedstaden",
            "asset_type": "residential",
            "construction_year": "1990",
            "sum_insured_dkk": "1",
        }
    ]
    fx = [
        {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2023-06", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2023-12", "currency": "DKK", "rate_dkk_per_unit": "1"},
    ]
    overlap = build_book(
        assets,
        [
            _policy("P1", "2023-01-01", "2023-12-31", "100"),
            _policy("P2", "2023-06-01", "2024-05-31", "50"),
        ],
        [],
        fx,
    )
    assert overlap.quality.overlapping_cover_pairs == 1
    found = experience_for_portfolio(overlap, "PF-01")
    assert found is not None
    assert found[0].earned_premium_dkk == Decimal("150")

    touching = build_book(
        assets,
        [
            _policy("P1", "2023-01-01", "2023-12-31", "100"),
            _policy("P2", "2023-12-31", "2024-12-30", "50"),
        ],
        [],
        fx,
    )
    assert touching.quality.overlapping_cover_pairs == 0
    found = experience_for_portfolio(touching, "PF-01")
    assert found is not None
    assert found[0].earned_premium_dkk == Decimal("150")


def test_a_bad_row_is_excluded_instead_of_failing_the_load():
    assets = [
        {
            "asset_id": "A1",
            "portfolio_id": "PF-01",
            "region": "Hovedstaden",
            "asset_type": "residential",
            "construction_year": "1990",
            "sum_insured_dkk": "1",
        }
    ]
    policies = [
        _policy("P1", "2023-01-01", "2023-12-31", "100"),
        {
            "policy_id": "P-missing-asset",
            "asset_id": "NOPE",
            "peril": "fire",
            "inception_date": "2023-01-01",
            "expiry_date": "2023-12-31",
            "annual_premium": "999",
            "currency": "DKK",
        },
    ]
    claims = [
        {
            "claim_id": "C-bad-date",
            "policy_id": "P1",
            "loss_date": "not-a-date",
            "reported_date": "2023-02-01",
            "paid_amount": "10",
            "reserve_amount": "0",
            "currency": "DKK",
            "status": "settled",
        },
        {
            "claim_id": "C-ok",
            "policy_id": "P1",
            "loss_date": "2023-02-01",
            "reported_date": "2023-02-02",
            "paid_amount": "10",
            "reserve_amount": "0",
            "currency": "DKK",
            "status": "settled",
        },
    ]
    fx = [{"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
          {"month": "2023-02", "currency": "DKK", "rate_dkk_per_unit": "1"}]
    loaded = build_book(assets, policies, claims, fx)
    assert loaded.quality.policies_excluded_unknown_asset == 1
    assert loaded.quality.claims_excluded_bad_row == 1
    assert loaded.quality.claims_included == 1


def _policy(policy_id: str, inception: str, expiry: str, premium: str) -> dict[str, str]:
    return {
        "policy_id": policy_id,
        "asset_id": "A1",
        "peril": "storm",
        "inception_date": inception,
        "expiry_date": expiry,
        "annual_premium": premium,
        "currency": "DKK",
    }
