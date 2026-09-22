"""HTTP API for portfolio loss experience."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from loss import Book, Bucket, compare_portfolios, experience_for_portfolio, load_book
from tables import catalog, load_tables, query_table

MONEY = Decimal("0.01")
RATIO = Decimal("0.000001")


def default_data_dir() -> Path:
    override = os.environ.get("SCOOBIDOO_DATA")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[1] / "data"


def create_app(data_dir: Path | None = None) -> FastAPI:
    source = Path(data_dir) if data_dir is not None else default_data_dir()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        book = load_book(source)
        app.state.book = book
        app.state.tables = load_tables(source)
        quality = book.quality
        print(
            f"Loaded {quality.policies_included} policies and {quality.claims_included} claims. "
            f"Excluded {quality.claims_excluded_unknown_policy} claims with no policy."
        )
        yield

    app = FastAPI(
        title="Loss experience",
        summary="How a book of property policies has performed, in DKK.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    def book() -> Book:
        return app.state.book

    def check_filters(
        underwriting_year: int | None,
        region: str | None,
        asset_type: str | None,
    ) -> None:
        loaded = book()
        if underwriting_year is not None and underwriting_year not in loaded.underwriting_years:
            known = ", ".join(str(year) for year in loaded.underwriting_years)
            raise HTTPException(status_code=400, detail=f"Ukendt tegningsår. Kendte år: {known}.")
        if region is not None and region not in loaded.regions:
            raise HTTPException(status_code=400, detail=f"Ukendt region '{region}'.")
        if asset_type is not None and asset_type not in loaded.asset_types:
            raise HTTPException(status_code=400, detail=f"Ukendt ejendomstype '{asset_type}'.")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/meta")
    def meta() -> dict[str, object]:
        loaded = book()
        return {
            "portfolios": loaded.portfolios,
            "regions": loaded.regions,
            "asset_types": loaded.asset_types,
            "underwriting_years": loaded.underwriting_years,
            "currency": "DKK",
        }

    @app.get("/data-quality")
    def data_quality() -> dict[str, object]:
        quality = book().quality
        return {
            "policies_included": quality.policies_included,
            "claims_included": quality.claims_included,
            "claims_excluded_unknown_policy": quality.claims_excluded_unknown_policy,
            "excluded_unknown_policy_paid_dkk": _money(quality.orphan_paid_dkk),
            "policies_excluded_unknown_asset": quality.policies_excluded_unknown_asset,
            "perils_relabelled": quality.perils_relabelled,
            "claim_loss_dates_dmy": quality.claim_loss_dates_dmy,
            "claims_with_negative_paid": quality.negative_paid_count,
            "negative_paid_dkk": _money(quality.negative_paid_dkk),
            "settled_with_reserve": quality.settled_with_reserve,
            "settled_reserve_ignored_dkk": _money(quality.ignored_reserve_dkk),
            "claims_before_inception": quality.before_inception,
            "claims_after_expiry": quality.after_expiry,
            "overlapping_cover_pairs": quality.overlapping_cover_pairs,
            "nil_claims_with_paid": quality.nil_claims_with_paid,
            "notes": quality.notes,
        }

    @app.get("/portfolios/loss-experience")
    def all_portfolios(
        underwriting_year: int | None = None,
        region: str | None = None,
        asset_type: str | None = None,
    ) -> dict[str, object]:
        check_filters(underwriting_year, region, asset_type)
        rows = compare_portfolios(
            book(),
            underwriting_year=underwriting_year,
            region=region,
            asset_type=asset_type,
        )
        return {
            "currency": "DKK",
            "ranked_by": "loss_ratio_descending",
            "filters": _filters(underwriting_year, region, asset_type),
            "portfolios": [
                {"portfolio_id": portfolio_id, **_json_bucket(bucket)}
                for portfolio_id, bucket in rows
            ],
        }

    @app.get("/portfolios/{portfolio_id}/loss-experience")
    def one_portfolio(
        portfolio_id: str,
        underwriting_year: int | None = None,
        region: str | None = None,
        asset_type: str | None = None,
    ) -> dict[str, object]:
        check_filters(underwriting_year, region, asset_type)
        found = experience_for_portfolio(
            book(),
            portfolio_id,
            underwriting_year=underwriting_year,
            region=region,
            asset_type=asset_type,
        )
        if found is None:
            raise HTTPException(status_code=404, detail=f"Ukendt portefølje '{portfolio_id}'.")
        totals, perils = found
        return {
            "portfolio_id": portfolio_id,
            "currency": "DKK",
            "filters": _filters(underwriting_year, region, asset_type),
            "totals": _json_bucket(totals),
            "perils": [{"peril": peril, **_json_bucket(bucket)} for peril, bucket in perils],
        }

    @app.get("/tables")
    def list_tables() -> dict[str, object]:
        return {"tables": catalog(app.state.tables)}

    @app.get("/tables/{name}")
    def one_table(
        name: str,
        request: Request,
        q: str = "",
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=40, ge=1, le=200),
    ) -> dict[str, object]:
        filters = {
            key: request.query_params[key]
            for key in request.query_params
            if key not in {"q", "offset", "limit"} and request.query_params[key]
        }
        found = query_table(
            app.state.tables,
            name,
            q=q,
            filters=filters,
            offset=offset,
            limit=limit,
        )
        if found is None:
            raise HTTPException(status_code=404, detail=f"Ukendt tabel '{name}'.")
        return found

    dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/")
        @app.get("/kildedata")
        @app.get("/opgavebeskrivelser")
        def index() -> FileResponse:
            return FileResponse(dist / "index.html")

        for name in ("regions.geojson", "countries.geojson"):
            outline = dist / name
            if outline.is_file():
                _mount_outline(app, name, outline)

    return app


def _mount_outline(app: FastAPI, name: str, outline: Path) -> None:
    def outlines() -> FileResponse:
        return FileResponse(outline, media_type="application/geo+json")

    outlines.__name__ = f"outline_{name.replace('.', '_')}"
    app.get(f"/{name}")(outlines)


def _filters(
    underwriting_year: int | None,
    region: str | None,
    asset_type: str | None,
) -> dict[str, object]:
    return {
        "underwriting_year": underwriting_year,
        "region": region,
        "asset_type": asset_type,
    }


def _money(amount: Decimal) -> float:
    return float(amount.quantize(MONEY, rounding=ROUND_HALF_UP))


def _json_bucket(bucket: Bucket) -> dict[str, object]:
    ratio = bucket.loss_ratio
    return {
        "policy_count": bucket.policy_count,
        "earned_premium_dkk": _money(bucket.earned_premium_dkk),
        "incurred_loss_dkk": _money(bucket.incurred_loss_dkk),
        "loss_ratio": None if ratio is None else float(ratio.quantize(RATIO, rounding=ROUND_HALF_UP)),
        "claim_count": bucket.claim_count,
        "largest_claim_dkk": None if bucket.largest_claim_dkk is None else _money(bucket.largest_claim_dkk),
    }


app = create_app()
