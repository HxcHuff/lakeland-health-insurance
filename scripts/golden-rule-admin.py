#!/usr/bin/env python3
"""Local web admin for the UHC / Golden Rule brochure database."""

from __future__ import annotations

import argparse
import html
import json
import mimetypes
import re
import sqlite3
import sys
import urllib.parse
import zipfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable


DEFAULT_DB = Path("data/golden-rule/golden_rule_brochures.sqlite")
PAGE_SIZE = 25


def h(value: object) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def fts_query(raw: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9]+", raw)
    return " AND ".join(f"{token}*" for token in tokens)


def query_params(path: str) -> tuple[str, dict[str, list[str]]]:
    parsed = urllib.parse.urlparse(path)
    return parsed.path, urllib.parse.parse_qs(parsed.query)


def first(params: dict[str, list[str]], key: str, default: str = "") -> str:
    return params.get(key, [default])[0]


def options(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row["name"] for row in conn.execute(f"SELECT name FROM {table} ORDER BY name")]


def base_css() -> str:
    return """
    :root { color-scheme: light; --navy:#0f1a2e; --blue:#1f5f99; --gold:#c9952f; --line:#d8dee8; --muted:#5b6577; --bg:#f6f8fb; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--navy); background: var(--bg); }
    header { background: #fff; border-bottom: 1px solid var(--line); padding: 18px 24px; position: sticky; top: 0; z-index: 5; }
    main { max-width: 1220px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0; font-size: 24px; line-height: 1.2; }
    h2 { margin: 24px 0 12px; font-size: 18px; }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    form.search { display: grid; grid-template-columns: minmax(220px, 1.7fr) repeat(4, minmax(140px, 1fr)) auto; gap: 10px; align-items: end; margin: 0 0 18px; }
    label { display: grid; gap: 5px; font-size: 12px; color: var(--muted); font-weight: 650; }
    input, select { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 10px; font-size: 14px; background: #fff; color: var(--navy); }
    button, .button { border: 1px solid var(--blue); border-radius: 6px; padding: 10px 13px; background: var(--blue); color: #fff; font-size: 14px; cursor: pointer; display: inline-block; }
    .button.secondary { color: var(--blue); background: #fff; }
    .stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
    .pill { border: 1px solid var(--line); border-radius: 999px; background: #fff; padding: 6px 10px; font-size: 12px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { border-bottom: 1px solid var(--line); padding: 11px 12px; vertical-align: top; text-align: left; font-size: 14px; }
    th { background: #f0f4f9; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    tr:last-child td { border-bottom: 0; }
    .muted { color: var(--muted); }
    .title { font-weight: 750; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .tag { border-radius: 999px; background: #edf3f9; color: #284e75; padding: 3px 8px; font-size: 12px; }
    .detail { display: grid; grid-template-columns: minmax(260px, 360px) 1fr; gap: 18px; align-items: start; }
    .panel { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .kv { display: grid; grid-template-columns: 132px 1fr; gap: 8px 12px; font-size: 14px; overflow-wrap: anywhere; }
    .kv div:nth-child(odd) { color: var(--muted); font-weight: 650; }
    pre { white-space: pre-wrap; word-break: break-word; background: #0f1a2e; color: #f8fafc; border-radius: 8px; padding: 16px; max-height: 620px; overflow: auto; font-size: 13px; line-height: 1.45; }
    .pager { display: flex; justify-content: space-between; gap: 12px; margin: 16px 0; }
    .links { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    @media (max-width: 980px) { form.search { grid-template-columns: 1fr 1fr; } .detail { grid-template-columns: 1fr; } }
    @media (max-width: 620px) { form.search { grid-template-columns: 1fr; } main { padding: 16px; } table { display: block; overflow-x: auto; } }
    """


def page(title: str, body: str) -> bytes:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{h(title)}</title>
  <style>{base_css()}</style>
</head>
<body>
  <header><h1><a href="/">UHC / Golden Rule Brochure Database</a></h1></header>
  <main>{body}</main>
</body>
</html>""".encode("utf-8")


def where_filters(params: dict[str, list[str]]) -> tuple[list[str], list[object]]:
    clauses: list[str] = []
    values: list[object] = []
    mapping = {
        "section": "s.name",
        "product": "p.name",
        "language": "l.name",
        "material_type": "m.name",
    }
    for key, column in mapping.items():
        value = first(params, key)
        if value:
            clauses.append(f"{column} = ?")
            values.append(value)
    return clauses, values


def search_rows(conn: sqlite3.Connection, params: dict[str, list[str]]) -> tuple[list[sqlite3.Row], int]:
    q = first(params, "q").strip()
    page_num = max(1, int(first(params, "page", "1") or "1"))
    offset = (page_num - 1) * PAGE_SIZE
    clauses, values = where_filters(params)
    joins = """
      FROM documents d
      JOIN sections s ON s.id = d.section_id
      JOIN products p ON p.id = d.product_id
      JOIN languages l ON l.id = d.language_id
      JOIN material_types m ON m.id = d.material_type_id
      JOIN document_text dt ON dt.document_id = d.id
    """
    order = "d.catalog_index"
    if q:
        fts = fts_query(q)
        if fts:
            joins += " JOIN document_search fts ON fts.rowid = d.id"
            clauses.append("document_search MATCH ?")
            values.append(fts)
            order = "bm25(document_search), d.catalog_index"
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    count_sql = f"SELECT COUNT(*) AS count {joins} {where}"
    total = int(conn.execute(count_sql, values).fetchone()["count"])
    rows_sql = f"""
      SELECT d.catalog_index, d.title, d.source_filename, d.drive_filename,
             d.source_url, d.drive_file_url, d.publication_code, d.page_count,
             d.char_count, d.extract_error, s.name AS section, p.name AS product,
             l.name AS language, m.name AS material_type, dt.summary
      {joins}
      {where}
      ORDER BY {order}
      LIMIT ? OFFSET ?
    """
    rows = conn.execute(rows_sql, [*values, PAGE_SIZE, offset]).fetchall()
    return rows, total


def select_html(name: str, label: str, choices: Iterable[str], selected: str) -> str:
    opts = [f'<option value="">All</option>']
    for choice in choices:
        mark = " selected" if choice == selected else ""
        opts.append(f'<option value="{h(choice)}"{mark}>{h(choice)}</option>')
    return f'<label>{h(label)}<select name="{h(name)}">{"".join(opts)}</select></label>'


def index_html(conn: sqlite3.Connection, params: dict[str, list[str]]) -> bytes:
    rows, total = search_rows(conn, params)
    q = first(params, "q")
    page_num = max(1, int(first(params, "page", "1") or "1"))
    controls = f"""
    <form class="search" method="get" action="/">
      <label>Search
        <input name="q" value="{h(q)}" placeholder="short term, Health ProtectorGuard, pre-existing, prescription">
      </label>
      {select_html("section", "Section", options(conn, "sections"), first(params, "section"))}
      {select_html("product", "Product", options(conn, "products"), first(params, "product"))}
      {select_html("language", "Language", options(conn, "languages"), first(params, "language"))}
      {select_html("material_type", "Material Type", options(conn, "material_types"), first(params, "material_type"))}
      <button type="submit">Search</button>
    </form>
    """
    stats = f"""
    <div class="stats">
      <span class="pill">{total} matching documents</span>
      <span class="pill">Full-text search covers title, product, type, filenames, and extracted PDF text</span>
    </div>
    """
    row_html = []
    for row in rows:
        warning = '<span class="tag">extract issue</span>' if row["extract_error"] else ""
        row_html.append(
            f"""
            <tr>
              <td>{row["catalog_index"]:03d}</td>
              <td>
                <div class="title"><a href="/document/{row["catalog_index"]}">{h(row["title"])}</a></div>
                <div class="muted">{h(row["drive_filename"])}</div>
                <div class="meta">
                  <span class="tag">{h(row["product"])}</span>
                  <span class="tag">{h(row["material_type"])}</span>
                  <span class="tag">{h(row["language"])}</span>
                  {warning}
                </div>
              </td>
              <td>{h(row["section"])}</td>
              <td>{h(row["publication_code"])}</td>
              <td>{row["page_count"]}</td>
              <td>{row["char_count"]:,}</td>
            </tr>
            """
        )
    table = f"""
    <table>
      <thead><tr><th>Index</th><th>Document</th><th>Section</th><th>Date Code</th><th>Pages</th><th>Chars</th></tr></thead>
      <tbody>{"".join(row_html) if row_html else '<tr><td colspan="6">No matches.</td></tr>'}</tbody>
    </table>
    """
    params_no_page = {k: v for k, v in params.items() if k != "page"}
    prev_params = urllib.parse.urlencode({**{k: v[0] for k, v in params_no_page.items()}, "page": max(1, page_num - 1)})
    next_params = urllib.parse.urlencode({**{k: v[0] for k, v in params_no_page.items()}, "page": page_num + 1})
    pager = f"""
    <div class="pager">
      <div>{'<a class="button secondary" href="/?' + prev_params + '">Previous</a>' if page_num > 1 else ''}</div>
      <div>{'<a class="button secondary" href="/?' + next_params + '">Next</a>' if page_num * PAGE_SIZE < total else ''}</div>
    </div>
    """
    return page("Golden Rule Search", controls + stats + table + pager)


def document_row(conn: sqlite3.Connection, catalog_index: int) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT d.*, s.name AS section, p.name AS product, l.name AS language,
               m.name AS material_type, dt.extracted_text, dt.summary
        FROM documents d
        JOIN sections s ON s.id = d.section_id
        JOIN products p ON p.id = d.product_id
        JOIN languages l ON l.id = d.language_id
        JOIN material_types m ON m.id = d.material_type_id
        JOIN document_text dt ON dt.document_id = d.id
        WHERE d.catalog_index = ?
        """,
        (catalog_index,),
    ).fetchone()


def detail_html(conn: sqlite3.Connection, catalog_index: int) -> bytes:
    row = document_row(conn, catalog_index)
    if not row:
        return page("Not found", "<p>Document not found.</p>")
    source_link = f'<a class="button secondary" href="{h(row["source_url"])}" target="_blank" rel="noreferrer">Open UHC source</a>' if row["source_url"] else ""
    drive_link = f'<a class="button secondary" href="{h(row["drive_file_url"])}" target="_blank" rel="noreferrer">Open Drive file</a>' if row["drive_file_url"] else ""
    folder_link = f'<a class="button secondary" href="{h(row["drive_folder_url"])}" target="_blank" rel="noreferrer">Open Drive folder</a>' if row["drive_folder_url"] else ""
    local_open = f'<a class="button" href="/pdf/{row["catalog_index"]}" target="_blank">Open local PDF</a>' if row["archive_member"] else ""
    local_download = f'<a class="button secondary" href="/download/{row["catalog_index"]}">Download local PDF</a>' if row["archive_member"] else ""
    text_preview = row["extracted_text"][:25000]
    if len(row["extracted_text"]) > len(text_preview):
        text_preview += "\n\n[Text preview truncated in browser. Full text is in SQLite.]"
    body = f"""
    <p><a href="/">&larr; Back to search</a></p>
    <div class="detail">
      <section class="panel">
        <h2>{row["catalog_index"]:03d} - {h(row["title"])}</h2>
        <div class="links">{local_open}{local_download}{source_link}{drive_link}{folder_link}</div>
        <h2>Metadata</h2>
        <div class="kv">
          <div>Section</div><div>{h(row["section"])}</div>
          <div>Product</div><div>{h(row["product"])}</div>
          <div>Language</div><div>{h(row["language"])}</div>
          <div>Material Type</div><div>{h(row["material_type"])}</div>
          <div>Source File</div><div>{h(row["source_filename"])}</div>
          <div>Drive File</div><div>{h(row["drive_filename"])}</div>
          <div>Material Code</div><div>{h(row["material_code"])}</div>
          <div>Date Code</div><div>{h(row["publication_code"])}</div>
          <div>Pages</div><div>{row["page_count"]}</div>
          <div>Characters</div><div>{row["char_count"]:,}</div>
          <div>SHA256</div><div>{h(row["sha256"])}</div>
          <div>Extract Issue</div><div>{h(row["extract_error"])}</div>
        </div>
      </section>
      <section class="panel">
        <h2>Extracted Text</h2>
        <pre>{h(text_preview)}</pre>
      </section>
    </div>
    """
    return page(str(row["title"]), body)


class Handler(BaseHTTPRequestHandler):
    db_path: Path
    zip_path: Path | None

    def send_bytes(self, content: bytes, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path, params = query_params(self.path)
        with connect(self.db_path) as conn:
            if path == "/":
                self.send_bytes(index_html(conn, params))
                return
            if path.startswith("/document/"):
                try:
                    catalog_index = int(path.rsplit("/", 1)[-1])
                except ValueError:
                    self.send_bytes(page("Bad request", "<p>Invalid document id.</p>"), status=400)
                    return
                self.send_bytes(detail_html(conn, catalog_index))
                return
            if path.startswith("/pdf/") or path.startswith("/download/"):
                try:
                    catalog_index = int(path.rsplit("/", 1)[-1])
                except ValueError:
                    self.send_bytes(b"Invalid document id", "text/plain", status=400)
                    return
                self.serve_pdf(conn, catalog_index, download=path.startswith("/download/"))
                return
            if path == "/api/search":
                rows, total = search_rows(conn, params)
                payload = {"total": total, "results": [dict(row) for row in rows]}
                self.send_bytes(json.dumps(payload, indent=2).encode("utf-8"), "application/json")
                return
        self.send_bytes(page("Not found", "<p>Not found.</p>"), status=404)

    def serve_pdf(self, conn: sqlite3.Connection, catalog_index: int, download: bool) -> None:
        row = document_row(conn, catalog_index)
        if not row or not row["archive_member"]:
            self.send_bytes(b"PDF not available from local source", "text/plain", status=404)
            return
        zip_path = self.zip_path or Path(row["archive_path"] or "")
        if not zip_path.exists():
            self.send_bytes(b"Zip archive not found. Restart server with --zip.", "text/plain", status=404)
            return
        with zipfile.ZipFile(zip_path) as zf:
            pdf = zf.read(row["archive_member"])
        name = row["drive_filename"]
        content_type = mimetypes.guess_type(name)[0] or "application/pdf"
        disposition = "attachment" if download else "inline"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("Content-Disposition", f'{disposition}; filename="{name}"')
        self.end_headers()
        self.wfile.write(pdf)

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--zip", dest="zip_path", type=Path, help="Zip archive for local PDF open/download")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8055)
    return parser.parse_args(list(argv))


def main(argv: Iterable[str] = sys.argv[1:]) -> int:
    args = parse_args(argv)
    if not args.db.exists():
        print(f"Database not found: {args.db}", file=sys.stderr)
        return 1
    Handler.db_path = args.db
    Handler.zip_path = args.zip_path
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Serving Golden Rule admin at {url}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
