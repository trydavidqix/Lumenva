#!/usr/bin/env python3
"""Import "Não contatado" Prospector Sheet rows into one Lumenva CRM org.

The script reads every tab through ``gws`` and uses the Supabase REST API with
``SUPABASE_SERVICE_ROLE_KEY`` from ``.env.local``.  ``--dry-run`` still reads
Google and CRM state, but never writes.  No messaging or existing-lead updates
are performed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SPREADSHEET_ID = "1sH5rK8RbY3QqgoHbPrje5z0loZzuYKgkXe9t8mDJzKM"
ORG_ID = "2e51006a-b264-48d1-8011-a33aecbdb311"
PIPELINE_ID = "592a6c6e-0dd9-4847-a326-550317de151d"
STAGE_ID = "efc5174b-76cb-4572-a2d5-3a58d682199b"
HEADERS = ["Nome do Negócio", "Telefone", "WhatsApp", "Site", "Instagram", "Facebook", "Endereço", "Nicho", "Cidade", "Fonte", "Data Encontrado", "Status", "Data do Contato", "Última Atualização", "Notas"]


def gws(*args: str, params: dict[str, Any] | None = None) -> Any:
    command = ["gws", *args]
    if params is not None:
        command += ["--params", json.dumps(params, ensure_ascii=False)]
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip() or f"gws failed ({result.returncode})")
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gws retornou JSON inválido: {exc}") from exc


def load_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env.local"
    if not env_path.is_file():
        raise RuntimeError(f"Arquivo ausente: {env_path}")
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def supabase_request(method: str, table: str, *, query: str = "", body: Any = None) -> list[dict[str, Any]]:
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes")
    url = f"{base}/rest/v1/{table}{query}"
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "application/json"}
    if method == "POST":
        headers["Prefer"] = "return=representation"
    request = Request(url, method=method, headers=headers, data=(json.dumps(body, ensure_ascii=False).encode() if body is not None else None))
    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
    except (HTTPError, URLError) as exc:
        detail = exc.read().decode("utf-8", errors="replace") if isinstance(exc, HTTPError) else str(exc)
        raise RuntimeError(f"Supabase {method} {table} falhou: {detail}") from exc
    return json.loads(payload) if payload else []


def normalize_phone(raw: str, country_hint: str) -> str | None:
    text = (raw or "").strip()
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if text.startswith("+"):
        return f"+{digits}" if 8 <= len(digits) <= 15 else None
    if digits.startswith("00"):
        digits = digits[2:]
        return f"+{digits}" if 8 <= len(digits) <= 15 else None
    if country_hint == "BR" and len(digits) in (10, 11):
        return f"+55{digits}"
    if country_hint == "PT" and len(digits) == 9:
        return f"+351{digits}"
    return None


def read_rows() -> list[dict[str, str]]:
    meta = gws("sheets", "spreadsheets", "get", params={"spreadsheetId": SPREADSHEET_ID, "fields": "sheets.properties(title)"})
    rows: list[dict[str, str]] = []
    for sheet in meta.get("sheets", []):
        title = str(sheet.get("properties", {}).get("title", ""))
        result = gws("sheets", "spreadsheets", "values", "get", params={"spreadsheetId": SPREADSHEET_ID, "range": f"'{title.replace(chr(39), chr(39) + chr(39))}'!A:O", "majorDimension": "ROWS"})
        section = "BR"
        for values in result.get("values", []):
            if not values:
                continue
            marker = str(values[0]).strip()
            if marker == "Estabelecimento BR": section = "BR"; continue
            if marker == "Estabelecimento PT": section = "PT"; continue
            if marker == HEADERS[0]: continue
            cells = [str(values[i]).strip() if i < len(values) else "" for i in range(len(HEADERS))]
            record = dict(zip(HEADERS, cells))
            if record.get("Status") == "Não contatado":
                record["aba_origem"] = title
                record["pais_bloco"] = section
                rows.append(record)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Lê e contabiliza, sem escrever")
    args = parser.parse_args()
    load_env()
    source_rows = read_rows()
    existing = supabase_request("GET", "contacts", query=f"?organization_id=eq.{ORG_ID}&is_merged_into=is.null&select=phone_number")
    existing_phones = {item.get("phone_number") for item in existing if item.get("phone_number")}
    candidates: list[dict[str, Any]] = []
    stats = {"status_nao_contatado": len(source_rows), "sem_telefone_valido": 0, "duplicados": 0, "seriam_criados": 0, "criados": 0}
    seen = set(existing_phones)
    for row in source_rows:
        phone = normalize_phone(row.get("Telefone", ""), row.get("pais_bloco", ""))
        if not phone:
            stats["sem_telefone_valido"] += 1
            continue
        if phone in seen:
            stats["duplicados"] += 1
            continue
        seen.add(phone)
        candidates.append({"row": row, "phone": phone})
    stats["seriam_criados"] = len(candidates)
    if not args.dry_run:
        for item in candidates:
            row, phone = item["row"], item["phone"]
            contact = supabase_request("POST", "contacts", body={"organization_id": ORG_ID, "name": row.get("Nome do Negócio", ""), "phone_number": phone, "source": "prospector_sheets", "source_metadata": {"instagram": row.get("Instagram", ""), "facebook": row.get("Facebook", ""), "site": row.get("Site", ""), "endereco": row.get("Endereço", ""), "nicho": row.get("Nicho", ""), "cidade": row.get("Cidade", ""), "fonte": row.get("Fonte", ""), "aba_origem": row.get("aba_origem", "")}})
            if not contact or not contact[0].get("id"):
                raise RuntimeError(f"CRM não retornou contact_id para {row.get('Nome do Negócio', '')!r}")
            supabase_request("POST", "crm_leads", body={"organization_id": ORG_ID, "pipeline_id": PIPELINE_ID, "stage_id": STAGE_ID, "contact_id": contact[0]["id"], "title": row.get("Nome do Negócio", ""), "source": "prospector_sheets", "external_id": phone, "custom_fields": {"nicho": row.get("Nicho", ""), "cidade": row.get("Cidade", ""), "fonte": row.get("Fonte", ""), "aba_origem": row.get("aba_origem", "")}})
            stats["criados"] += 1
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"Erro no importador: {exc}", file=sys.stderr)
        raise SystemExit(1)
