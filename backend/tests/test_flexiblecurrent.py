import gzip
import json
from pathlib import Path

from fastapi.testclient import TestClient

from main import create_app
from tests.test_api import _write
from tests.sample import ASSETS, CLAIMS, FX, POLICIES


def client(tmp_path: Path) -> TestClient:
    data = tmp_path / "data"
    data.mkdir()
    _write(data / "assets.csv", ASSETS)
    _write(data / "policies.csv", POLICIES)
    _write(data / "claims.csv", CLAIMS)
    _write(data / "fx_rates.csv", FX)

    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<div id=root></div>")
    graph = dist / "flexiblecurrent"
    graph.mkdir()
    body = json.dumps({"nodes": [{"n": "Query"}]}).encode()
    (graph / "graph.json").write_bytes(body)
    (graph / "graph.json.gz").write_bytes(gzip.compress(body))
    return TestClient(create_app(data, dist_dir=dist))


def test_page_is_served_by_the_spa(tmp_path: Path):
    with client(tmp_path) as api:
        response = api.get("/flexiblecurrent")
    assert response.status_code == 200
    assert "root" in response.text


def test_graph_is_sent_gzipped_when_the_client_accepts_it(tmp_path: Path):
    with client(tmp_path) as api:
        packed = api.get("/flexiblecurrent/graph.json", headers={"Accept-Encoding": "gzip"})
        plain = api.get("/flexiblecurrent/graph.json", headers={"Accept-Encoding": "identity"})
    assert packed.headers["content-encoding"] == "gzip"
    assert packed.json()["nodes"][0]["n"] == "Query"
    assert "content-encoding" not in plain.headers
    assert plain.json()["nodes"][0]["n"] == "Query"


def test_only_built_graph_files_are_served(tmp_path: Path):
    with client(tmp_path) as api:
        assert api.get("/flexiblecurrent/graph.json.gz").status_code == 404
        assert api.get("/flexiblecurrent/..%2Findex.html").status_code == 404
        assert api.get("/flexiblecurrent/missing.json").status_code == 404
