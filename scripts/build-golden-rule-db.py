#!/usr/bin/env python3
"""Build a local searchable database from UHC / Golden Rule PDFs.

The importer is manifest-driven and rerunnable. It reads the catalog CSV,
extracts PDF text from either a zip archive or a PDF directory, and upserts
records by catalog index without duplicating documents.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sqlite3
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


DEFAULT_OUT_DIR = Path("data/golden-rule")
DEFAULT_DB_NAME = "golden_rule_brochures.sqlite"
MANIFEST_NAME = "UHC Golden Rule PDF Catalog.csv"

KEY_TERMS = [
    "short term",
    "triterm",
    "health protectorguard",
    "fixed indemnity",
    "not health insurance",
    "not major medical",
    "pre-existing",
    "underwriting",
    "maternity",
    "prescription",
    "mental health",
    "telehealth",
    "accident",
    "hospital",
    "cancer",
    "critical illness",
    "dental",
    "vision",
    "term life",
    "guaranteed issue",
    "florida",
    "eligible expense",
    "exclusions",
    "benefit",
]

PRODUCT_RULES = [
    ("TriTerm Medical", ["triterm"]),
    ("Short Term Medical", ["short term medical", "short term brochure", "short term plans", "short term prescription"]),
    ("Health ProtectorGuard", ["health protectorguard", "healthprotector guard", "enhanced health protector"]),
    ("Hospital SafeGuard GI", ["hospital safeguard", "hospital safeguard gi"]),
    ("HospitalWise", ["hospitalwise"]),
    ("AdvantageGuard", ["advantageguard"]),
    ("Accident ExpenseGuard", ["accident expenseguard"]),
    ("Accident Pro", ["accident pro", "accidentpro", "progap", "proguard"]),
    ("AccidentWise", ["accidentwise"]),
    ("CriticalGuard", ["criticalguard", "critical illness", "heartstroke", "heart/stroke"]),
    ("DentalWise", ["dentalwise"]),
    ("VisionWise", ["visionwise"]),
    ("Mind Your Health", ["mind your health"]),
    ("HealthiestYou", ["healthiestyou"]),
    ("New Benefits", ["new benefits"]),
    ("Term Life", ["term life", "life insurance"]),
]

MATERIAL_RULES = [
    ("Availability Grid", ["availability grid"]),
    ("Underwriting Guide", ["underwriting cheat sheet"]),
    ("Compliance/Policy", ["social media policy", "mental health parity"]),
    ("Claim Examples Guide", ["claim examples guide"]),
    ("Claim Form", ["claim form", "claimant statement", "details questionnaire"]),
    ("Authorization/Admin", ["authorization", "direct deposit"]),
    ("Prescription Drug List", ["prescription drug list", "pdl"]),
    ("Build Chart", ["height and weight", "build chart"]),
    ("Sample Application Questions", ["sample application questions"]),
    ("Sample Benefits/Exclusions", ["sample benefits", "exclusions", "rx rider"]),
    ("Sample Policy", ["sample policy", "sample policycertificate", "policy/certificate"]),
    ("Consumer Flyer", ["consumer flyer"]),
    ("Flyer", ["flyer"]),
    ("Brochure", ["brochure"]),
]


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_filename(value: str) -> str:
    return Path(value.strip()).name


def detect_product(title: str, source_filename: str, drive_filename: str) -> str:
    haystack = f"{title} {source_filename} {drive_filename}".lower()
    for product, needles in PRODUCT_RULES:
        if any(needle in haystack for needle in needles):
            return product
    return "General/Admin"


def detect_material_type(section: str, title: str, source_filename: str, drive_filename: str) -> str:
    haystack = f"{section} {title} {source_filename} {drive_filename}".lower()
    for material_type, needles in MATERIAL_RULES:
        if any(needle in haystack for needle in needles):
            return material_type
    if section.lower() == "brochures":
        return "Brochure"
    return section or "Document"


def detect_language(title: str, source_filename: str, drive_filename: str) -> str:
    haystack = f"{title} {source_filename} {drive_filename}".lower()
    if "spanish" in haystack or re.search(r"\bsp[-_.]?", haystack) or re.search(r"sp-g\d{6}", haystack):
        return "Spanish"
    return "English"


def detect_publication_code(source_filename: str, drive_filename: str) -> str:
    haystack = f"{source_filename} {drive_filename}"
    matches = re.findall(r"(?:[A-Z]{1,3}|UL)\d{6}", haystack)
    if matches:
        return matches[-1]
    pdl_match = re.search(r"pdl-[a-z0-9-]+-(\d{4})", haystack, flags=re.IGNORECASE)
    if pdl_match:
        return pdl_match.group(1)
    return ""


def material_code(source_filename: str) -> str:
    return Path(source_filename).stem


def term_counts(text: str) -> dict[str, int]:
    lower = text.lower()
    counts: dict[str, int] = {}
    for term in KEY_TERMS:
        hits = lower.count(term)
        if hits:
            counts[term] = hits
    return counts


def extract_pages(pdf_bytes: bytes) -> tuple[list[str], str | None]:
    pages: list[str] = []
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            pages.append(normalize_space(page.extract_text() or ""))
        return pages, None
    except Exception as exc:  # pragma: no cover - depends on source PDFs
        return pages, f"{type(exc).__name__}: {exc}"


def read_manifest(args: argparse.Namespace) -> list[dict[str, str]]:
    if args.manifest:
        raw = args.manifest.read_text(encoding="utf-8-sig")
    elif args.zip_path:
        with zipfile.ZipFile(args.zip_path) as zf:
            name = next((n for n in zf.namelist() if n.endswith(MANIFEST_NAME)), None)
            if not name:
                raise FileNotFoundError(f"{MANIFEST_NAME} not found in {args.zip_path}")
            raw = zf.read(name).decode("utf-8-sig", errors="replace")
    else:
        raise ValueError("Provide --manifest or --zip")

    rows = []
    for row in csv.DictReader(io.StringIO(raw)):
        clean = {k.strip(): (v or "").strip() for k, v in row.items()}
        if clean.get("saved_file"):
            rows.append(clean)
    return rows


def read_drive_metadata(path: Path | None) -> dict[str, dict[str, str]]:
    if not path:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload.get("files") or payload.get("results") or payload
    if not isinstance(items, list):
        raise ValueError("Drive metadata JSON must be a list or contain files/results")
    metadata: dict[str, dict[str, str]] = {}
    for item in items:
        title = item.get("title") or item.get("name") or item.get("display_title")
        if not title:
            continue
        metadata[normalize_filename(title)] = {
            "drive_file_id": item.get("id") or "",
            "drive_file_url": item.get("url") or item.get("display_url") or "",
            "drive_mime_type": item.get("mime_type") or "",
            "drive_size": str(item.get("size") or ""),
            "drive_created_at": item.get("created_time") or item.get("created_at") or "",
            "drive_modified_at": item.get("modified_time") or item.get("updated_at") or "",
        }
    return metadata


def pdf_bytes_from_zip(zip_path: Path) -> dict[str, tuple[str, bytes]]:
    pdfs: dict[str, tuple[str, bytes]] = {}
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.namelist():
            if member.lower().endswith(".pdf"):
                pdfs[normalize_filename(member)] = (member, zf.read(member))
    return pdfs


def pdf_bytes_from_dir(pdf_dir: Path) -> dict[str, tuple[str, bytes]]:
    pdfs: dict[str, tuple[str, bytes]] = {}
    for path in pdf_dir.rglob("*.pdf"):
        pdfs[path.name] = (str(path), path.read_bytes())
    return pdfs


def get_source_pdfs(args: argparse.Namespace) -> dict[str, tuple[str, bytes]]:
    if args.zip_path:
        return pdf_bytes_from_zip(args.zip_path)
    if args.pdf_dir:
        return pdf_bytes_from_dir(args.pdf_dir)
    raise ValueError("Provide --zip or --pdf-dir")


def connect_db(path: Path, rebuild: bool) -> sqlite3.Connection:
    if rebuild and path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS sections (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS languages (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS material_types (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS import_runs (
          id INTEGER PRIMARY KEY,
          started_at TEXT NOT NULL,
          source_kind TEXT NOT NULL,
          source_path TEXT NOT NULL,
          manifest_path TEXT,
          drive_folder_url TEXT,
          document_count INTEGER DEFAULT 0,
          missing_count INTEGER DEFAULT 0,
          extract_error_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY,
          catalog_index INTEGER NOT NULL UNIQUE,
          section_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          language_id INTEGER NOT NULL,
          material_type_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          source_filename TEXT NOT NULL,
          drive_filename TEXT NOT NULL,
          source_url TEXT,
          drive_file_url TEXT,
          drive_file_id TEXT,
          drive_folder_url TEXT,
          archive_member TEXT,
          archive_path TEXT,
          material_code TEXT,
          publication_code TEXT,
          file_size INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT,
          page_count INTEGER NOT NULL DEFAULT 0,
          char_count INTEGER NOT NULL DEFAULT 0,
          extract_error TEXT,
          imported_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (section_id) REFERENCES sections(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (language_id) REFERENCES languages(id),
          FOREIGN KEY (material_type_id) REFERENCES material_types(id)
        );

        CREATE TABLE IF NOT EXISTS document_text (
          document_id INTEGER PRIMARY KEY,
          extracted_text TEXT NOT NULL,
          summary TEXT,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pages (
          document_id INTEGER NOT NULL,
          page_number INTEGER NOT NULL,
          text TEXT NOT NULL,
          char_count INTEGER NOT NULL,
          PRIMARY KEY (document_id, page_number),
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS term_hits (
          document_id INTEGER NOT NULL,
          term TEXT NOT NULL,
          hits INTEGER NOT NULL,
          PRIMARY KEY (document_id, term),
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS search_terms (
          term TEXT PRIMARY KEY
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5(
          title,
          section,
          product,
          language,
          material_type,
          source_filename,
          drive_filename,
          extracted_text,
          content=''
        );

        CREATE INDEX IF NOT EXISTS idx_documents_catalog_index ON documents(catalog_index);
        CREATE INDEX IF NOT EXISTS idx_documents_section ON documents(section_id);
        CREATE INDEX IF NOT EXISTS idx_documents_product ON documents(product_id);
        CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language_id);
        CREATE INDEX IF NOT EXISTS idx_documents_material_type ON documents(material_type_id);
        """
    )
    conn.execute("PRAGMA user_version=2")
    conn.executemany(
        "INSERT OR IGNORE INTO search_terms (term) VALUES (?)",
        [(term,) for term in KEY_TERMS],
    )


def require_schema(conn: sqlite3.Connection) -> None:
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
    if columns and "catalog_index" not in columns:
        raise RuntimeError(
            "Existing database uses the old schema. Rerun with --rebuild once, then future imports can upsert."
        )


def lookup_id(conn: sqlite3.Connection, table: str, name: str) -> int:
    conn.execute(f"INSERT OR IGNORE INTO {table} (name) VALUES (?)", (name,))
    row = conn.execute(f"SELECT id FROM {table} WHERE name = ?", (name,)).fetchone()
    if row is None:
        raise RuntimeError(f"Lookup insert failed for {table}: {name}")
    return int(row["id"])


def short_summary(title: str, product: str, material_type: str, text: str) -> str:
    clean = normalize_space(text)
    if not clean:
        return f"{title}: no extractable text found."
    return f"{product} {material_type}: {clean[:500]}"


def upsert_document(
    conn: sqlite3.Connection,
    *,
    row: dict[str, str],
    pdf_source: tuple[str, bytes] | None,
    drive_meta: dict[str, str],
    drive_folder_url: str,
    archive_path: str,
) -> tuple[dict[str, object], bool]:
    now = datetime.now(timezone.utc).isoformat()
    catalog_index = int(row["index"])
    section = row.get("section") or "Unsectioned"
    title = row.get("title") or row.get("saved_file") or f"Catalog {catalog_index}"
    source_filename = normalize_filename(row.get("source_file") or "")
    drive_filename = normalize_filename(row.get("saved_file") or source_filename)
    source_url = row.get("source_url") or ""

    product = detect_product(title, source_filename, drive_filename)
    material_type = detect_material_type(section, title, source_filename, drive_filename)
    language = detect_language(title, source_filename, drive_filename)
    pub_code = detect_publication_code(source_filename, drive_filename)

    pdf_bytes = b""
    archive_member = ""
    pages: list[str] = []
    extract_error: str | None = None
    if pdf_source:
        archive_member, pdf_bytes = pdf_source
        pages, extract_error = extract_pages(pdf_bytes)
    else:
        extract_error = "PDF missing from source archive/directory"

    full_text = "\n\n".join(pages)
    digest = hashlib.sha256(pdf_bytes).hexdigest() if pdf_bytes else ""
    section_id = lookup_id(conn, "sections", section)
    product_id = lookup_id(conn, "products", product)
    language_id = lookup_id(conn, "languages", language)
    material_type_id = lookup_id(conn, "material_types", material_type)

    existing = conn.execute(
        "SELECT id, imported_at FROM documents WHERE catalog_index = ?",
        (catalog_index,),
    ).fetchone()
    imported_at = existing["imported_at"] if existing else now

    conn.execute(
        """
        INSERT INTO documents (
          catalog_index, section_id, product_id, language_id, material_type_id,
          title, source_filename, drive_filename, source_url, drive_file_url,
          drive_file_id, drive_folder_url, archive_member, archive_path,
          material_code, publication_code, file_size, sha256, page_count,
          char_count, extract_error, imported_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(catalog_index) DO UPDATE SET
          section_id=excluded.section_id,
          product_id=excluded.product_id,
          language_id=excluded.language_id,
          material_type_id=excluded.material_type_id,
          title=excluded.title,
          source_filename=excluded.source_filename,
          drive_filename=excluded.drive_filename,
          source_url=excluded.source_url,
          drive_file_url=excluded.drive_file_url,
          drive_file_id=excluded.drive_file_id,
          drive_folder_url=excluded.drive_folder_url,
          archive_member=excluded.archive_member,
          archive_path=excluded.archive_path,
          material_code=excluded.material_code,
          publication_code=excluded.publication_code,
          file_size=excluded.file_size,
          sha256=excluded.sha256,
          page_count=excluded.page_count,
          char_count=excluded.char_count,
          extract_error=excluded.extract_error,
          updated_at=excluded.updated_at
        """,
        (
            catalog_index,
            section_id,
            product_id,
            language_id,
            material_type_id,
            title,
            source_filename,
            drive_filename,
            source_url,
            drive_meta.get("drive_file_url", ""),
            drive_meta.get("drive_file_id", ""),
            drive_folder_url,
            archive_member,
            archive_path,
            material_code(source_filename),
            pub_code,
            len(pdf_bytes),
            digest,
            len(pages),
            len(full_text),
            extract_error,
            imported_at,
            now,
        ),
    )
    doc = conn.execute("SELECT id FROM documents WHERE catalog_index = ?", (catalog_index,)).fetchone()
    doc_id = int(doc["id"])

    conn.execute("DELETE FROM document_text WHERE document_id = ?", (doc_id,))
    conn.execute("DELETE FROM pages WHERE document_id = ?", (doc_id,))
    conn.execute("DELETE FROM term_hits WHERE document_id = ?", (doc_id,))
    conn.execute("DELETE FROM document_search WHERE rowid = ?", (doc_id,))

    conn.execute(
        "INSERT INTO document_text (document_id, extracted_text, summary) VALUES (?, ?, ?)",
        (doc_id, full_text, short_summary(title, product, material_type, full_text)),
    )
    conn.executemany(
        "INSERT INTO pages (document_id, page_number, text, char_count) VALUES (?, ?, ?, ?)",
        [(doc_id, idx, page_text, len(page_text)) for idx, page_text in enumerate(pages, start=1)],
    )
    terms = term_counts(full_text)
    conn.executemany(
        "INSERT INTO term_hits (document_id, term, hits) VALUES (?, ?, ?)",
        [(doc_id, term, hits) for term, hits in terms.items()],
    )
    conn.execute(
        """
        INSERT INTO document_search (
          rowid, title, section, product, language, material_type,
          source_filename, drive_filename, extracted_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (doc_id, title, section, product, language, material_type, source_filename, drive_filename, full_text),
    )

    record: dict[str, object] = {
        "id": doc_id,
        "catalog_index": catalog_index,
        "section": section,
        "title": title,
        "source_filename": source_filename,
        "drive_filename": drive_filename,
        "source_url": source_url,
        "drive_file_url": drive_meta.get("drive_file_url", ""),
        "drive_file_id": drive_meta.get("drive_file_id", ""),
        "drive_folder_url": drive_folder_url,
        "archive_member": archive_member,
        "product": product,
        "language": language,
        "material_type": material_type,
        "material_code": material_code(source_filename),
        "publication_code": pub_code,
        "file_size": len(pdf_bytes),
        "sha256": digest,
        "page_count": len(pages),
        "char_count": len(full_text),
        "extract_error": extract_error,
        "summary": short_summary(title, product, material_type, full_text),
        "term_hits": terms,
    }
    return record, pdf_source is None


def write_exports(out_dir: Path, records: list[dict[str, object]], summary: dict[str, object]) -> None:
    jsonl_path = out_dir / "documents.jsonl"
    summary_path = out_dir / "summary.json"
    with jsonl_path.open("w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


def sorted_counts(counter: Counter[str]) -> dict[str, int]:
    return dict(sorted(counter.items(), key=lambda item: (-item[1], item[0])))


def build_summary(
    *,
    args: argparse.Namespace,
    db_path: Path,
    records: list[dict[str, object]],
    missing: list[str],
    extract_errors: list[dict[str, str]],
) -> dict[str, object]:
    products = Counter(str(record["product"]) for record in records)
    sections = Counter(str(record["section"]) for record in records)
    material_types = Counter(str(record["material_type"]) for record in records)
    languages = Counter(str(record["language"]) for record in records)
    product_documents: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in records:
        product_documents[str(record["product"])].append(
            {
                "catalog_index": record["catalog_index"],
                "title": record["title"],
                "material_type": record["material_type"],
                "language": record["language"],
                "drive_filename": record["drive_filename"],
                "source_filename": record["source_filename"],
                "publication_code": record["publication_code"],
                "source_url": record["source_url"],
                "drive_file_url": record["drive_file_url"],
            }
        )

    source_kind = "zip" if args.zip_path else "directory"
    source_path = str(args.zip_path or args.pdf_dir or "")
    return {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "source_kind": source_kind,
        "source_path": source_path,
        "manifest_path": str(args.manifest or ""),
        "drive_folder_url": args.drive_folder_url,
        "document_count": len(records),
        "missing_count": len(missing),
        "missing_pdfs": missing,
        "extract_error_count": len(extract_errors),
        "extract_errors": extract_errors,
        "products": sorted_counts(products),
        "sections": sorted_counts(sections),
        "material_types": sorted_counts(material_types),
        "languages": sorted_counts(languages),
        "outputs": {
            "sqlite": str(db_path),
            "documents_jsonl": str(args.out_dir / "documents.jsonl"),
            "summary_json": str(args.out_dir / "summary.json"),
        },
        "product_documents": dict(sorted(product_documents.items())),
    }


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("legacy_zip_path", nargs="?", type=Path, help="Deprecated positional zip path")
    parser.add_argument("--zip", dest="zip_path", type=Path, help="Zip archive containing PDFs and manifest")
    parser.add_argument("--pdf-dir", type=Path, help="Directory containing PDFs")
    parser.add_argument("--manifest", type=Path, help="Catalog CSV. Defaults to the manifest inside --zip")
    parser.add_argument("--drive-folder-url", default="", help="Google Drive folder URL for provenance")
    parser.add_argument("--drive-metadata-json", type=Path, help="Optional JSON list from Drive folder metadata")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--rebuild", action="store_true", help="Recreate the database before importing")
    args = parser.parse_args(list(argv))
    if args.legacy_zip_path and not args.zip_path:
        args.zip_path = args.legacy_zip_path
    if not args.zip_path and not args.pdf_dir:
        parser.error("Provide --zip or --pdf-dir")
    return args


def main(argv: Iterable[str] = sys.argv[1:]) -> int:
    args = parse_args(argv)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    db_path = args.out_dir / args.db_name
    conn = connect_db(db_path, args.rebuild)
    try:
        require_schema(conn)
        init_db(conn)

        manifest_rows = read_manifest(args)
        source_pdfs = get_source_pdfs(args)
        drive_metadata = read_drive_metadata(args.drive_metadata_json)
        source_kind = "zip" if args.zip_path else "directory"
        source_path = str(args.zip_path or args.pdf_dir or "")

        run = conn.execute(
            """
            INSERT INTO import_runs (
              started_at, source_kind, source_path, manifest_path, drive_folder_url
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                source_kind,
                source_path,
                str(args.manifest or ""),
                args.drive_folder_url,
            ),
        )
        run_id = int(run.lastrowid)

        records: list[dict[str, object]] = []
        missing: list[str] = []
        extract_errors: list[dict[str, str]] = []
        for manifest_row in sorted(manifest_rows, key=lambda item: int(item["index"])):
            drive_filename = normalize_filename(manifest_row["saved_file"])
            pdf_source = source_pdfs.get(drive_filename)
            drive_meta = drive_metadata.get(drive_filename, {})
            record, is_missing = upsert_document(
                conn,
                row=manifest_row,
                pdf_source=pdf_source,
                drive_meta=drive_meta,
                drive_folder_url=args.drive_folder_url,
                archive_path=source_path,
            )
            records.append(record)
            if is_missing:
                missing.append(drive_filename)
            if record.get("extract_error") and not is_missing:
                extract_errors.append({"drive_filename": drive_filename, "error": str(record["extract_error"])})

        conn.execute(
            """
            UPDATE import_runs
            SET document_count = ?, missing_count = ?, extract_error_count = ?
            WHERE id = ?
            """,
            (len(records), len(missing), len(extract_errors), run_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    summary = build_summary(
        args=args,
        db_path=db_path,
        records=records,
        missing=missing,
        extract_errors=extract_errors,
    )
    write_exports(args.out_dir, records, summary)
    print(
        json.dumps(
            {
                "document_count": summary["document_count"],
                "missing_count": summary["missing_count"],
                "extract_error_count": summary["extract_error_count"],
                "products": summary["products"],
                "material_types": summary["material_types"],
                "languages": summary["languages"],
                "sqlite": str(db_path),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
