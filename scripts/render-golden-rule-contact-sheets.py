#!/usr/bin/env python3
"""Render first-page contact sheets for Golden Rule PDFs."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import textwrap
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PDFTOPPM = "/Users/david_huff/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm"


def load_records(jsonl_path: Path) -> list[dict]:
    records = []
    with jsonl_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                records.append(json.loads(line))
    return sorted(records, key=lambda item: item["id"])


def render_first_page(zf: zipfile.ZipFile, record: dict, tmp_dir: Path, timeout: int) -> Path | None:
    pdf_path = tmp_dir / f"{record['id']:03d}.pdf"
    out_prefix = tmp_dir / f"{record['id']:03d}"
    png_path = tmp_dir / f"{record['id']:03d}.png"
    pdf_path.write_bytes(zf.read(record["zip_name"]))
    try:
        result = subprocess.run(
            [
                PDFTOPPM,
                "-q",
                "-f",
                "1",
                "-l",
                "1",
                "-singlefile",
                "-png",
                "-scale-to",
                "260",
                str(pdf_path),
                str(out_prefix),
            ],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return None
    if result.returncode != 0 or not png_path.exists():
        return None
    return png_path


def build_sheets(records: list[dict], rendered: dict[int, Path], out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    cols = 5
    rows = 4
    cell_w = 270
    cell_h = 360
    margin = 24
    gap = 18
    per_sheet = cols * rows
    paths: list[Path] = []

    for sheet_idx, start in enumerate(range(0, len(records), per_sheet), start=1):
        chunk = records[start : start + per_sheet]
        sheet_w = margin * 2 + cols * cell_w + (cols - 1) * gap
        sheet_h = margin * 2 + rows * cell_h + (rows - 1) * gap
        sheet = Image.new("RGB", (sheet_w, sheet_h), "white")
        draw = ImageDraw.Draw(sheet)
        for idx, record in enumerate(chunk):
            col = idx % cols
            row = idx // cols
            x = margin + col * (cell_w + gap)
            y = margin + row * (cell_h + gap)
            draw.rectangle((x, y, x + cell_w, y + cell_h), outline="#CBD5E1", width=1)
            image_path = rendered.get(record["id"])
            if image_path:
                img = Image.open(image_path).convert("RGB")
                img.thumbnail((cell_w - 20, 250))
                img_x = x + (cell_w - img.width) // 2
                img_y = y + 10
                sheet.paste(img, (img_x, img_y))
            label = f"{record['id']:03d} {record['product']} | {record['language']}"
            title = record["title"]
            lines = [label] + textwrap.wrap(title, width=34)[:3]
            text_y = y + 270
            for line in lines:
                draw.text((x + 10, text_y), line, fill="#0F1A2E", font=font)
                text_y += 16
        path = out_dir / f"contact-sheet-{sheet_idx:02d}.png"
        sheet.save(path, optimize=True)
        paths.append(path)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--jsonl", type=Path, default=Path("data/golden-rule/documents.jsonl"))
    parser.add_argument("--out-dir", type=Path, default=Path("data/golden-rule/contact-sheets"))
    parser.add_argument("--timeout", type=int, default=12)
    args = parser.parse_args()

    records = load_records(args.jsonl)
    rendered: dict[int, Path] = {}
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        with zipfile.ZipFile(args.zip_path) as zf:
            for record in records:
                path = render_first_page(zf, record, tmp_dir, args.timeout)
                if path:
                    rendered[record["id"]] = path
                else:
                    failures.append(record["saved_file"])
                if record["id"] % 20 == 0:
                    print(f"Rendered {len(rendered)} of {record['id']} records...", flush=True)
            sheet_paths = build_sheets(records, rendered, args.out_dir)
    print(json.dumps({"records": len(records), "rendered": len(rendered), "failures": failures, "sheets": [str(p) for p in sheet_paths]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
