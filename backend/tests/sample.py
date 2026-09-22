"""A book small enough to total by hand.

PF-01 flood premium is 100 EUR at the January 2023 rate of 7.5, so 750 DKK.
Its claims are converted at the March 2024 rate of 8:

- settled paid 10 EUR, reserve 999 EUR -> 80 DKK (reserve ignored)
- open paid 5 EUR plus reserve 5 EUR -> 80 DKK
- declined paid 50 EUR -> 0
- withdrawn -> 0
- settled paid -2.5 EUR -> read as a sign error, 20 DKK

Incurred loss is 180 DKK, ratio 0.24. The largest claim is 80 DKK, not the
ignored reserve.

PF-01 fire (P2) incepts 2023-06-01. Its only claim C7 is dated and reported
in February 2023, and no other fire policy on A1 covers that day, so C7 is
excluded: fire has 0 claims and 1000 DKK premium.
"""

ASSETS = [
    {
        "asset_id": "A1",
        "portfolio_id": "PF-01",
        "region": "Hovedstaden",
        "asset_type": "residential",
        "construction_year": "1990",
        "sum_insured_dkk": "1000000",
    },
    {
        "asset_id": "A2",
        "portfolio_id": "PF-02",
        "region": "Syddanmark",
        "asset_type": "commercial",
        "construction_year": "2000",
        "sum_insured_dkk": "2000000",
    },
]

POLICIES = [
    {
        "policy_id": "P1",
        "asset_id": "A1",
        "peril": " Flood ",
        "inception_date": "2023-01-15",
        "expiry_date": "2024-06-30",
        "annual_premium": "100",
        "currency": "EUR",
    },
    {
        "policy_id": "P2",
        "asset_id": "A1",
        "peril": "fire",
        "inception_date": "2023-06-01",
        "expiry_date": "2024-05-31",
        "annual_premium": "1000",
        "currency": "DKK",
    },
    {
        "policy_id": "P3",
        "asset_id": "A2",
        "peril": "storm",
        "inception_date": "2022-01-01",
        "expiry_date": "2022-12-31",
        "annual_premium": "500",
        "currency": "DKK",
    },
]

CLAIMS = [
    {
        "claim_id": "C1",
        "policy_id": "P1",
        "loss_date": "2024-03-15",
        "reported_date": "2024-03-20",
        "paid_amount": "10",
        "reserve_amount": "999",
        "currency": "EUR",
        "status": "settled",
    },
    {
        "claim_id": "C2",
        "policy_id": "P1",
        "loss_date": "15-03-2024",
        "reported_date": "20-03-2024",
        "paid_amount": "5",
        "reserve_amount": "5",
        "currency": "EUR",
        "status": "open",
    },
    {
        "claim_id": "C3",
        "policy_id": "P1",
        "loss_date": "2024-03-01",
        "reported_date": "2024-03-02",
        "paid_amount": "50",
        "reserve_amount": "50",
        "currency": "EUR",
        "status": "declined",
    },
    {
        "claim_id": "C4",
        "policy_id": "P1",
        "loss_date": "2024-03-02",
        "reported_date": "2024-03-03",
        "paid_amount": "0",
        "reserve_amount": "0",
        "currency": "DKK",
        "status": "withdrawn",
    },
    {
        "claim_id": "C5",
        "policy_id": "P1",
        "loss_date": "2024-03-10",
        "reported_date": "2024-03-11",
        "paid_amount": "-2.5",
        "reserve_amount": "0",
        "currency": "EUR",
        "status": "settled",
    },
    {
        "claim_id": "C6",
        "policy_id": "MISSING",
        "loss_date": "2024-03-15",
        "reported_date": "2024-03-16",
        "paid_amount": "1000",
        "reserve_amount": "0",
        "currency": "DKK",
        "status": "settled",
    },
    {
        "claim_id": "C7",
        "policy_id": "P2",
        "loss_date": "01-02-2023",
        "reported_date": "15-02-2023",
        "paid_amount": "100",
        "reserve_amount": "40",
        "currency": "DKK",
        "status": "settled",
    },
]

FX = [
    {"month": "2022-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
    {"month": "2023-01", "currency": "DKK", "rate_dkk_per_unit": "1"},
    {"month": "2023-01", "currency": "EUR", "rate_dkk_per_unit": "7.5"},
    {"month": "2023-02", "currency": "DKK", "rate_dkk_per_unit": "1"},
    {"month": "2023-06", "currency": "DKK", "rate_dkk_per_unit": "1"},
    {"month": "2024-03", "currency": "DKK", "rate_dkk_per_unit": "1"},
    {"month": "2024-03", "currency": "EUR", "rate_dkk_per_unit": "8"},
]
