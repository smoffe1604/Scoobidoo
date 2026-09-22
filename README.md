# Loss experience

A small service that reports how a book of property policies has performed. Monetary figures are in DKK.

Public repository: https://github.com/smoffe1604/Scoobidoo

## Data

Do not commit the CSVs. Unzip `envira-loss-data.zip` so these files sit in `data/` at the repository root:

- `data/assets.csv`
- `data/policies.csv`
- `data/claims.csv`
- `data/fx_rates.csv`

## Run

The quickest start, with Docker:

```bash
docker compose up --build
```

The API is then at http://127.0.0.1:8010/docs. The compose file mounts `./data` read-only.

Without Docker, `./dev.sh` starts the API on port 8010 and the page on http://127.0.0.1:5173 (Python 3.12 and Node required).

By hand, from `backend/`, with Python 3.12:

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows
# source .venv/bin/activate     # macOS or Linux
pip install -r requirements.txt
python -m pytest
uvicorn main:app --host 127.0.0.1 --port 8010
```

The API is then at http://127.0.0.1:8010/docs.

```bash
curl http://127.0.0.1:8010/portfolios/PF-01/loss-experience
curl http://127.0.0.1:8010/portfolios/loss-experience
curl "http://127.0.0.1:8010/portfolios/PF-01/loss-experience?underwriting_year=2023&region=Hovedstaden"
curl http://127.0.0.1:8010/data-quality
```

The page, from `frontend/`:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The dev server proxies the API on port 8010.

`npm run build` writes `frontend/dist`. Uvicorn then serves that page at http://127.0.0.1:8010/ as well.

A live copy runs at https://scoobidoo.bils.hair. `deploy.sh` and `deploy/` are the scripts that put it there; they are not needed to run the service.

## Checking the numbers

```bash
cd backend
python -m pytest            # hand-worked book, API, and a reconciliation against data/
python check_book.py        # book totals, and how far each judgement call moves them
```

`tests/naive_book.py` is a second, independent walk over the CSVs. `test_reconcile.py` asserts it lands on the same premium, incurred, policy count and claim count for every portfolio.

## What the numbers mean

Incurred loss is the amount paid for a settled claim, paid plus reserve for an open claim, and zero when the claim was withdrawn or declined. Earned premium is the full annual premium. Premiums use the inception-month exchange rate into DKK; claims use the loss-month rate. Portfolios are ranked by loss ratio, worst first.

Three judgement calls move the result, and `GET /data-quality` counts each of them: negative payments are read as sign errors and count positive; a claim dated outside its policy term is moved to the same asset's policy that was on risk that day, or excluded if none was; claims whose policy id matches nothing are excluded. See `DECISIONS.md` for why, and for the alternative figures.

The brief and scoring guide we were sent are in `docs/`.
