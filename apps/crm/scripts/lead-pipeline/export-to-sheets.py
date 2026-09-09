#!/usr/bin/env python3
"""Export lead-pipeline CSV data to a formatted Google Sheet through ``gws``.

Normal runs require the owner to complete ``gws auth login`` first.  ``--dry-run``
builds and prints the exact requests without contacting Google, which makes the
exporter testable offline and never bypasses authentication.
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import re
from datetime import date
from pathlib import Path
from typing import Any

SETUP_DOC = "docs/pesquisa/google-sheets-integracao-2026-09-02.md"
LEAD_HEADERS = [
    "Nome do Negócio", "Telefone", "WhatsApp", "Site", "Instagram", "Facebook", "Endereço", "Nicho",
    "Cidade", "Fonte", "Data Encontrado", "Status", "Data do Contato", "Última Atualização", "Notas",
]
CLIENT_HEADERS = [
    "Nome do Cliente", "Telefone", "WhatsApp", "Nicho", "Cidade", "Data de Início",
    "Plano/Produto", "Status", "Notas",
]
ALIASES = {
    "Nome do Negócio": ("title", "name", "nome", "business_name"),
    "Telefone": ("phone", "telefone"),
    "WhatsApp": ("whatsapp", "whatsapp_url"),
    "Site": ("website", "site", "web_site"),
    "Instagram": ("instagram", "instagram_url"),
    "Facebook": ("facebook", "facebook_url"),
    "Endereço": ("address", "endereco", "endereço"),
    "Nicho": ("nicho", "niche"),
    "Cidade": ("cidade", "city"),
    "Fonte": ("source", "fonte", "link"),
    "Data Encontrado": ("date_found", "data_encontrado", "found_at"),
    "Status": ("status",),
    "Data do Contato": ("contact_date", "data_do_contato", "data_contato"),
    "Última Atualização": ("last_updated", "ultima_atualizacao", "última_atualização"),
    "Notas": ("notes", "notas"),
}


def gws(*args: str, body: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> Any:
    cmd = ["gws", *args]
    if params is not None:
        cmd += ["--params", json.dumps(params, ensure_ascii=False)]
    if body is not None:
        cmd += ["--json", json.dumps(body, ensure_ascii=False)]
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError((proc.stderr or proc.stdout).strip() or f"gws failed ({proc.returncode})")
    try:
        return json.loads(proc.stdout) if proc.stdout.strip() else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gws retornou JSON inválido: {exc}") from exc


def auth_is_ready() -> bool:
    proc = subprocess.run(["gws", "auth", "status"], text=True, capture_output=True)
    try:
        status = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return False
    return bool(status.get("token_cache_exists") or status.get("encrypted_credentials_exists") or status.get("auth_method") not in (None, "none"))


def phone_key(value: str) -> str:
    """Stable comparison key for phone numbers with formatting differences."""
    return re.sub(r"\D", "", value or "")


def existing_lead_keys(spreadsheet_id: str, sheet: str) -> set[tuple[str, str]]:
    """Read the existing lead table before an append (header row is ignored)."""
    result = gws("sheets", "spreadsheets", "get", params={
        "spreadsheetId": spreadsheet_id,
        "includeGridData": "true",
        "fields": "sheets(properties(title),data.rowData.values.effectiveValue)",
    })
    values = []
    for item in result.get("sheets", []):
        if item.get("properties", {}).get("title") != sheet:
            continue
        for row in item.get("data", [{}])[0].get("rowData", []):
            cells = row.get("values", [])
            def cell_text(index: int) -> str:
                value = cells[index].get("effectiveValue", {}) if index < len(cells) else {}
                return str(next(iter(value.values()), ""))
            values.append([cell_text(0), cell_text(1)])
        break
    return {
        (str(row[0]).strip().casefold(), phone_key(str(row[1])))
        for row in values[1:]
        if len(row) >= 2 and str(row[0]).strip() and phone_key(str(row[1]))
    }


def ensure_sheet(spreadsheet_id: str, sheet: str) -> int:
    """Return the numeric tab id, creating the dated tab when necessary."""
    result = gws("sheets", "spreadsheets", "get", params={
        "spreadsheetId": spreadsheet_id,
        "fields": "sheets.properties(sheetId,title)",
    })
    for item in result.get("sheets", []):
        properties = item.get("properties", {})
        if properties.get("title") == sheet:
            return int(properties.get("sheetId", 0))
    created = gws("sheets", "spreadsheets", "batchUpdate", params={"spreadsheetId": spreadsheet_id}, body={
        "requests": [{"addSheet": {"properties": {"title": sheet}}}],
    })
    replies = created.get("replies", [])
    if replies:
        return int(replies[0].get("addSheet", {}).get("properties", {}).get("sheetId", 0))
    raise RuntimeError(f"gws não retornou o ID da aba {sheet!r}")


def classify_establishment(row: list[str]) -> str:
    """Classify the consolidated PT/BR research rows without changing source data."""
    name = row[0].casefold() if row else ""
    return "BR" if any(token in name for token in ("brasil", "brasileir", "brasilia", "brésilien", "bresilien")) else "PT"


def append_cells_request(sheet_id: int, values: list[list[str]]) -> dict[str, Any]:
    return {"appendCells": {"sheetId": sheet_id, "fields": "userEnteredValue", "rows": [
        {"values": [{"userEnteredValue": {"stringValue": str(value)}} for value in row]}
        for row in values
    ]}}


def read_rows(path: Path, niche: str, city: str, found_date: str, headers: list[str] = LEAD_HEADERS) -> list[list[str]]:
    with path.open(newline="", encoding="utf-8-sig") as stream:
        records = csv.DictReader(stream)
        rows: list[list[str]] = []
        for record in records:
            values = []
            for header in headers:
                aliases = ALIASES.get(header, (header,))
                value = next((record.get(key, "") for key in aliases if record.get(key, "") not in (None, "")), "")
                if header == "Nicho": value = value or niche
                if header == "Cidade": value = value or city
                if header == "Data Encontrado": value = value or found_date
                if header == "Status": value = value or ("Não contatado" if headers is LEAD_HEADERS else "")
                values.append(str(value))
            rows.append(values)
    return rows


def build_requests(rows: list[list[str]], title: str, sheet: str, sheet_id: int, headers: list[str]) -> dict[str, Any]:
    br_rows = [row for row in rows if classify_establishment(row) == "BR"]
    pt_rows = [row for row in rows if classify_establishment(row) == "PT"]
    section_rows = [["Estabelecimento BR"], headers, *br_rows, ["Estabelecimento PT"], headers, *pt_rows]
    end_row = len(section_rows)
    end_col = len(headers)
    end_col_letter = chr(ord("A") + end_col - 1)
    # gws currently sends the A1 path segment literally; its API adapter rejects
    # a tab-qualified ``Sheet1!A1`` range. An unqualified range targets the first
    # grid tab (the tab created by spreadsheets.create and the usual target for
    # an existing spreadsheet).
    a1_sheet = ""
    return {
        # spreadsheets.create accepts SpreadsheetProperties.title; Google adds
        # the first grid tab as Sheet1. Existing tabs remain selectable via
        # --sheet and --sheet-id.
        "create": {"properties": {"title": title}},
        "values": {"range": f"{a1_sheet}A1:{end_col_letter}{end_row}", "valueInputOption": "USER_ENTERED", "body": {"majorDimension": "ROWS", "values": section_rows}},
        "format": {"requests": [
            {"updateSheetProperties": {"properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 0}}, "fields": "gridProperties.frozenRowCount"}},
            *({"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": index, "endRowIndex": index + 1}, "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.18, "green": 0.35, "blue": 0.28}, "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}}}}, "fields": "userEnteredFormat(backgroundColor,textFormat)"}} for index in (0, len(br_rows) + 1, len(br_rows) + 2)),
            *({"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": index, "endRowIndex": index + 1}, "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}}, "fields": "userEnteredFormat.textFormat.bold"}} for index in (0, len(br_rows) + 1, len(br_rows) + 2)),
            {"updateDimensionProperties": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": end_col}, "properties": {"pixelSize": 160}, "fields": "pixelSize"}},
        ]},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, nargs="?", help="CSV produzido pelo lead_pipeline.py (omitido com --clients)")
    parser.add_argument("--clients", action="store_true", help="Cria a planilha Clientes apenas com o cabeçalho")
    parser.add_argument("--spreadsheet-id", help="ID existente; sem este argumento cria uma planilha nova")
    parser.add_argument("--title", help="Nome da planilha nova")
    parser.add_argument("--sheet", help="Nome da aba; por padrão, a data da rodada em D/MM (ex.: 3/09)")
    parser.add_argument("--sheet-id", type=int, default=0, help="ID numérico da aba existente (default: 0)")
    parser.add_argument("--nicho", default="", help="Preenche a coluna Nicho quando ausente no CSV")
    parser.add_argument("--cidade", default="", help="Preenche a coluna Cidade quando ausente no CSV")
    parser.add_argument("--data", dest="found_date", default=date.today().isoformat(), help="Data Encontrado (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Não chama Google; imprime o plano JSON")
    parser.add_argument("--no-dedup", action="store_true", help="Não checa duplicidade (uso excepcional)")
    args = parser.parse_args()
    if args.clients and args.csv:
        parser.error("--clients não aceita CSV")
    if not args.clients and (not args.csv or not args.csv.is_file()):
        print(f"CSV não encontrado: {args.csv}", file=sys.stderr); return 2
    headers = CLIENT_HEADERS if args.clients else LEAD_HEADERS
    if not args.sheet:
        args.sheet = date.fromisoformat(args.found_date).strftime("%-d/%m")
    title = args.title or ("Clientes" if args.clients else f"Leads - {args.nicho or 'pipeline'} - {args.found_date}")
    rows = [] if args.clients else read_rows(args.csv, args.nicho, args.cidade, args.found_date, headers)
    skipped_duplicates = 0
    if args.spreadsheet_id and not args.clients and not args.no_dedup and not args.dry_run:
        known = existing_lead_keys(args.spreadsheet_id, args.sheet)
        unique_rows = []
        seen = set(known)
        for row in rows:
            key = (row[0].strip().casefold(), phone_key(row[1]))
            if key in seen:
                skipped_duplicates += 1
                continue
            unique_rows.append(row)
            if key[0] and key[1]:
                seen.add(key)
        rows = unique_rows
    plan = build_requests(rows, title, args.sheet, args.sheet_id, headers)
    if args.dry_run:
        print(json.dumps(plan, ensure_ascii=False, indent=2)); return 0
    if not auth_is_ready():
        print(f"gws não está autenticado. Execute o OAuth humano conforme {SETUP_DOC} e confirme com `gws auth status`.", file=sys.stderr)
        return 2
    if args.spreadsheet_id:
        spreadsheet_id = args.spreadsheet_id
    else:
        created = gws("sheets", "spreadsheets", "create", body=plan["create"])
        spreadsheet_id = created.get("spreadsheetId")
        if not spreadsheet_id: raise RuntimeError("gws não retornou spreadsheetId")
    if args.spreadsheet_id:
        args.sheet_id = ensure_sheet(spreadsheet_id, args.sheet)
        plan = build_requests(rows, title, args.sheet, args.sheet_id, headers)
        if rows:
            br_rows = [row for row in rows if classify_establishment(row) == "BR"]
            pt_rows = [row for row in rows if classify_establishment(row) == "PT"]
            payload = [["Estabelecimento BR"], headers, *br_rows, ["Estabelecimento PT"], headers, *pt_rows]
            gws("sheets", "spreadsheets", "batchUpdate", params={"spreadsheetId": spreadsheet_id}, body={"requests": [append_cells_request(args.sheet_id, payload)]})
    else:
        gws("sheets", "spreadsheets", "values", "update", params={"spreadsheetId": spreadsheet_id, "range": plan["values"]["range"], "valueInputOption": plan["values"]["valueInputOption"]}, body=plan["values"]["body"])
    gws("sheets", "spreadsheets", "batchUpdate", params={"spreadsheetId": spreadsheet_id}, body=plan["format"])
    print(f"Planilha exportada: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit leads_novos={len(rows)} duplicatas_puladas={skipped_duplicates}")
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except RuntimeError as exc: print(f"Erro no exportador: {exc}", file=sys.stderr); raise SystemExit(1)
