Started: 2026-09-22 17:55 CEST
Stopped: 2026-09-22 20:00 CEST

Started from an empty repository and the FastAPI + Vite split I already use. I did not bring that project's database, workers, or nginx layout. The `.cursor/rules` file I used is committed.

## What I built

Loss experience for one portfolio and for all of them, ranked by loss ratio with the worst first. Filters for underwriting year, region, and asset type. A data-quality endpoint that counts every row dropped or changed. Tests on a hand-worked book, and a second CSV walk in `tests/naive_book.py` that matches every portfolio total on the real data. The CSVs load once at startup. One page for a non-technical user, with the source tables searchable behind it. The book runs at 75.1%.

Cursor, with Grok and Claude. I profiled the files before choosing what to drop, and I overturned two of the tool's first answers. It netted the 262 negative payments off as recoveries; they have no reserve and the same size distribution as the positive payments, so they are sign errors and count positive (66.0% otherwise). It kept 310 claims dated before inception on the policy they name; 309 of them were also *reported* before inception, so 83 are moved to the same asset's policy that was on risk that day and 227 that fit no policy are excluded (80.3% otherwise). The figure I chased: fire runs at 172% across the whole book and 200–320% in six portfolios, driven by a few 100k–455k claims against 600–12,000 DKK premiums. It is real in the data, not a bug, and it is the first thing I would show an underwriter.

## What I deliberately did not build, and why

A database, pro-rata earning, and my usual production stack. The files are small, the brief asks for the full annual premium, and none of it changes the answer. The 260 orphan claims (16% of all paid) are excluded rather than guessed at: their policy ids match nothing, even after trimming and case-folding. The 2,006 overlapping terms on the same asset and peril are not de-duplicated: none share an inception date or premium, so I read them as two real policies. A settled claim's leftover reserve is ignored, as the brief defines incurred.

## What I would do first with another day

Ask an underwriter whether fire is underpriced or the synthetic book is skewed, and whether the 227 excluded claims belong to renewals that are missing from `policies.csv`. Then make the judgement calls switchable in the API so the reviewer can see 66%, 75% and 80% side by side instead of reading them here.
