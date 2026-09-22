Started: 2026-09-22 18:09 CEST
Stopped: 2026-09-22 18:40 CEST

Started from an empty repository and the FastAPI + Vite split I already use. I did not bring that project's database, workers, or nginx layout.

## What I built

Loss experience for one portfolio and for all of them, ranked by loss ratio with the worst first. Optional filters for underwriting year, region, and asset type. A data-quality report, tests with hand-worked figures, and a second CSV walk that matches every portfolio total on the real book. The CSVs load once at startup. A single page reads the endpoints. Overall loss ratio is 70.1%.

Cursor, with Grok. I profiled the files before deciding what to drop. I rejected flipping negative payments to positive: a settled claim costs the amount paid, and that amount is sometimes negative.

## What I deliberately did not build, and why

A database, pro-rata earning, and the rest of my usual production stack. The files are small, the brief asks for the full annual premium, and that machinery would not change the answer. Docker Compose is only an optional way to start the API. I kept claims dated before inception, and I kept both premiums where two policies overlap. Dropping the early claims moves the book from 70.1% to 64.7%. The 260 claims with no policy are excluded because they cannot be placed; their paid amount is 11.7M DKK.

## What I would do first with another day

Confirm with an underwriter whether out-of-period claims and overlapping terms belong in the ratio. Treating the negative payments as sign errors instead of recoveries would move the book from 70.1% to 75.2%. Those choices matter more than which month's EUR rate is used. The rate only moves about 0.3% across the file.
