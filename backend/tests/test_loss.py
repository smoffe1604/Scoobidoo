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
    assert flood.incurred_loss_dkk == Decimal("180")
    assert flood.claim_count == 5
    assert flood.largest_claim_dkk == Decimal("80")
    assert flood.loss_ratio == Decimal("0.24")


def test_negative_paid_is_read_as_a_sign_error():
    loaded = book()
    flipped = [claim for claims in loaded.claims_by_policy.values() for claim in claims if claim.sign_flipped]
    assert [claim.claim_id for claim in flipped] == ["C5"]
    assert flipped[0].incurred_dkk == Decimal("20")


def test_a_claim_reported_before_its_policy_existed_is_excluded():
    fire = peril("PF-01", "fire")
    assert fire.earned_premium_dkk == Decimal("1000")
    assert fire.incurred_loss_dkk == Decimal("0")
    assert fire.claim_count == 0
    assert fire.largest_claim_dkk is None
    assert fire.loss_ratio == Decimal("0")
    quality = book().quality
    assert quality.before_inception == 1
    assert quality.claims_excluded_outside_term == 1
    assert quality.claims_moved_to_covering_policy == 0
    assert quality.outside_term_incurred_dkk == Decimal("100")


def test_quality_report_matches_the_hand_count():
    quality = book().quality
    assert quality.perils_relabelled == 1
    assert quality.claim_loss_dates_dmy == 2
    assert quality.claims_excluded_unknown_policy == 1
    assert quality.orphan_paid_dkk == Decimal("1000")
    assert quality.negative_paid_count == 1
    assert quality.negative_paid_dkk == Decimal("20")
    assert quality.settled_with_reserve == 1
    assert quality.ignored_reserve_dkk == Decimal("7992")
    assert quality.after_expiry == 0
    assert quality.nil_claims_with_paid == 1
    assert quality.duplicate_policy_ids == 0
    assert quality.duplicate_claim_ids == 0
    assert quality.claims_included == 5
    assert any("udeladt" in note for note in quality.notes)
    assert any("unikke" in note for note in quality.notes)


def test_an_out_of_term_claim_moves_to_the_policy_on_risk_that_day():
    assets = [_asset("A1", "PF-01")]
    fx = [
        {"month": "2022-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2022-09", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
    ]
    policies = [
        _policy("OLD", "2022-01-01", "2022-12-31", "100"),
        _policy("NEW", "2023-01-01", "2023-12-31", "300"),
    ]
    claims = [_claim("C1", "NEW", "2022-09-10", "50", "0", "settled")]
    loaded = build_book(assets, policies, claims, fx)
    assert loaded.quality.before_inception == 1
    assert loaded.quality.claims_moved_to_covering_policy == 1
    assert loaded.quality.claims_excluded_outside_term == 0
    assert [claim.claim_id for claim in loaded.claims_by_policy["OLD"]] == ["C1"]
    assert loaded.claims_by_policy["OLD"][0].moved_from_policy_id == "NEW"
    assert "NEW" not in loaded.claims_by_policy
    rows = compare_portfolios(loaded, underwriting_year=2022)
    assert rows[0][1].incurred_loss_dkk == Decimal("50")
    assert rows[0][1].earned_premium_dkk == Decimal("100")


def test_a_repeated_id_keeps_the_first_row_and_is_reported():
    assets = [_asset("A1", "PF-01")]
    fx = [
        {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2023-02", "currency": "DKK", "rate_dkk_per_unit": "1"},
    ]
    policies = [
        _policy("P1", "2023-01-01", "2023-12-31", "100"),
        _policy("P1", "2023-01-01", "2023-12-31", "999"),
    ]
    claims = [
        _claim("C1", "P1", "2023-02-01", "10", "0", "settled"),
        _claim("C1", "P1", "2023-02-01", "999", "0", "settled"),
    ]
    loaded = build_book(assets, policies, claims, fx)
    assert loaded.quality.duplicate_policy_ids == 1
    assert loaded.quality.duplicate_claim_ids == 1
    found = experience_for_portfolio(loaded, "PF-01")
    assert found is not None
    assert found[0].earned_premium_dkk == Decimal("100")
    assert found[0].incurred_loss_dkk == Decimal("10")
    assert any("går igen" in note and "første forekomst" in note for note in loaded.quality.notes)


def test_filters_combine_and_a_claim_after_expiry_is_handled_like_one_before():
    assets = [_asset("A1", "PF-01", region="Hovedstaden", asset_type="residential"),
              _asset("A2", "PF-01", region="Hovedstaden", asset_type="commercial")]
    fx = [
        {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2024-03", "currency": "DKK", "rate_dkk_per_unit": "1"},
    ]
    policies = [
        _policy("P1", "2023-01-01", "2023-12-31", "100", asset_id="A1"),
        _policy("P2", "2023-01-01", "2023-12-31", "200", asset_id="A2"),
    ]
    claims = [_claim("LATE", "P1", "2024-03-01", "40", "0", "settled")]
    loaded = build_book(assets, policies, claims, fx)
    assert loaded.quality.after_expiry == 1
    assert loaded.quality.claims_excluded_outside_term == 1
    found = experience_for_portfolio(loaded, "PF-01", region="Hovedstaden", asset_type="commercial")
    assert found is not None
    assert found[0].policy_count == 1
    assert found[0].earned_premium_dkk == Decimal("200")
    found = experience_for_portfolio(loaded, "PF-01", region="Syddanmark", asset_type="commercial")
    assert found is not None
    assert found[0].policy_count == 0


def test_largest_claim_ignores_nil_claims():
    assets = [_asset("A1", "PF-01")]
    fx = [
        {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
        {"month": "2023-02", "currency": "DKK", "rate_dkk_per_unit": "1"},
    ]
    policies = [_policy("P1", "2023-01-01", "2023-12-31", "100")]
    claims = [_claim("C1", "P1", "2023-02-01", "500", "0", "declined")]
    loaded = build_book(assets, policies, claims, fx)
    found = experience_for_portfolio(loaded, "PF-01")
    assert found is not None
    assert found[0].claim_count == 1
    assert found[0].largest_claim_dkk is None


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
    assets = [_asset("A1", "PF-01")]
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
    assets = [_asset("A1", "PF-01")]
    policies = [
        _policy("P1", "2023-01-01", "2023-12-31", "100"),
        _policy("P-missing-asset", "2023-01-01", "2023-12-31", "999", asset_id="NOPE"),
        _policy("", "2023-01-01", "2023-12-31", "999"),
    ]
    claims = [
        _claim("C-bad-date", "P1", "not-a-date", "10", "0", "settled"),
        _claim("", "P1", "2023-02-01", "10", "0", "settled"),
        _claim("C-ok", "P1", "2023-02-01", "10", "0", "settled"),
    ]
    fx = [{"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
          {"month": "2023-02", "currency": "DKK", "rate_dkk_per_unit": "1"}]
    loaded = build_book(assets, policies, claims, fx)
    assert loaded.quality.policies_excluded_unknown_asset == 1
    assert loaded.quality.policies_excluded_bad_row == 1
    assert loaded.quality.claims_excluded_bad_row == 2
    assert loaded.quality.duplicate_policy_ids == 0
    assert loaded.quality.duplicate_claim_ids == 0
    assert loaded.quality.claims_included == 1


def _asset(asset_id: str, portfolio_id: str, *, region: str = "Hovedstaden", asset_type: str = "residential") -> dict[str, str]:
    return {
        "asset_id": asset_id,
        "portfolio_id": portfolio_id,
        "region": region,
        "asset_type": asset_type,
        "construction_year": "1990",
        "sum_insured_dkk": "1",
    }


def _policy(policy_id: str, inception: str, expiry: str, premium: str, *, asset_id: str = "A1") -> dict[str, str]:
    return {
        "policy_id": policy_id,
        "asset_id": asset_id,
        "peril": "storm",
        "inception_date": inception,
        "expiry_date": expiry,
        "annual_premium": premium,
        "currency": "DKK",
    }


def _claim(claim_id: str, policy_id: str, loss_date: str, paid: str, reserve: str, status: str) -> dict[str, str]:
    return {
        "claim_id": claim_id,
        "policy_id": policy_id,
        "loss_date": loss_date,
        "reported_date": loss_date,
        "paid_amount": paid,
        "reserve_amount": reserve,
        "currency": "DKK",
        "status": status,
    }
