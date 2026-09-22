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

Locally, same shape as the other service:

```bash
./dev.sh
```

That starts the API on port 8010 and the page on http://127.0.0.1:5173.

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

To put it on the Hetzner box:

```bash
./deploy.sh
```

That syncs `origin/main` to `hetzner_bils`, copies the local CSVs, and reloads nginx for https://scoobidoo.bils.hair.

Docker is optional, and only runs the API:

```bash
docker compose up --build
```

## What the numbers mean

Incurred loss is the amount paid for a settled claim, paid plus reserve for an open claim, and zero when the claim was withdrawn or declined. Earned premium is the full annual premium. Premiums use the inception-month exchange rate into DKK. Claims use the loss-month rate. Portfolios are ranked by loss ratio, worst first.

`GET /data-quality` lists what was relabelled, what was excluded, and the two judgement calls that move the result: claims dated outside the policy term stay in, and overlapping cover is not pro-rated. See `DECISIONS.md`.
