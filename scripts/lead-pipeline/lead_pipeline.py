#!/usr/bin/env python3
"""Small, repeatable local-business lead pipeline.

The scraper binary is deliberately supplied by --scraper-bin so this script
never installs Docker, Go, or a browser. Context research is best-effort and
is saved separately from the lead data.
"""
from __future__ import annotations

import argparse, csv, json, os, re, subprocess, sys, tempfile
from pathlib import Path
from urllib.request import Request, urlopen


def run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scraper-bin", required=True)
    ap.add_argument("--query", default="clínica dentária em Lisboa")
    ap.add_argument("--out-dir", default="docs/pesquisa/lead-pipeline-run")
    ap.add_argument("--last30days-skill", default="/Users/david/.agents/skills/last30days")
    args = ap.parse_args()
    out = Path(args.out_dir).resolve(); out.mkdir(parents=True, exist_ok=True)
    qfile = out / "queries.txt"; raw = out / "gosom-results.json"
    qfile.write_text(args.query + "\n", encoding="utf-8")
    env = os.environ.copy(); env["DISABLE_TELEMETRY"] = "1"
    p = run([args.scraper_bin, "-input", str(qfile), "-results", str(raw), "-json", "-depth", "1", "-c", "1", "-exit-on-inactivity", "45s"], 600)
    (out / "gosom.log").write_text(p.stdout + p.stderr, encoding="utf-8")
    if p.returncode: print(p.stderr, file=sys.stderr); return p.returncode
    rows = [json.loads(line) for line in raw.read_text().splitlines() if line.strip()]
    # ScrapeGraphAI is optional: do not call it without a configured LLM key.
    llm = any(os.environ.get(k) for k in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY"))
    for row in rows:
        row["whatsapp"] = ""
        site = row.get("website") or row.get("web_site") or ""
        row["website"] = site
        if site.startswith("http"):
            try:
                body = urlopen(Request(site, headers={"User-Agent": "lead-pipeline/1.0"}), timeout=10).read().decode("utf-8", "ignore")
                hits = re.findall(r"(?:https?://)?wa\.me/[0-9+]+|(?:https?://)?api\.whatsapp\.com/send\?phone=[0-9+]+", body, re.I)
                row["whatsapp"] = hits[0] if hits else ""
            except Exception as exc: row["enrichment_error"] = type(exc).__name__
    fields = ["title", "phone", "website", "whatsapp", "address", "review_rating", "review_count", "link"]
    with (out / "leads.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
    # Agent Reach route: Exa search, no credentials copied or persisted.
    context = out / "agent-reach-context.txt"
    lines = []
    for row in rows[:2]:
        cp = run(["mcporter", "call", "exa.web_search_exa", f"query={row.get('title','')} Lisbon WhatsApp review appointment", "numResults=3"], 60)
        lines.append(f"### {row.get('title')}\n{cp.stdout or cp.stderr}")
    context.write_text("\n\n".join(lines), encoding="utf-8")
    # last30days validation is intentionally delegated to its installed skill.
    plan = out / "last30days-plan.json"
    plan.write_text(json.dumps({"intent":"factual","freshness_mode":"balanced_recent","cluster_mode":"none","subqueries":[{"label":"primary","search_query":"Lisbon dental clinic WhatsApp appointment customer service","ranking_query":"What recent signals show pain or demand around WhatsApp appointment handling for Lisbon dental clinics?","sources":["reddit","x","youtube","tiktok","instagram","hackernews","polymarket"],"weight":1.0}]}, ensure_ascii=False), encoding="utf-8")
    l30 = run([sys.executable, str(Path(args.last30days_skill)/"scripts/last30days.py"), "dental clinics Lisbon WhatsApp customer service", "--plan", str(plan), "--emit=compact", "--save-dir", str(out/"last30days")], 600)
    (out / "last30days.log").write_text(l30.stdout + l30.stderr, encoding="utf-8")
    (out / "pipeline-status.json").write_text(json.dumps({"gosom_rows":len(rows),"scrapegraphai":"available-key" if llm else "skipped-no-OPENAI_API_KEY-or-ANTHROPIC_API_KEY","agent_reach":"completed","last30days_returncode":l30.returncode}, indent=2), encoding="utf-8")
    print(f"leads={len(rows)} output={out / 'leads.csv'}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
