"""ETL de notícias via Google News RSS (fonte não oficial; citar URL).

Uso:
  python etl/noticias.py --ano 2026 --cargo PRESIDENTE --uf AM
  python etl/noticias.py --ano 2026 --cargo PRESIDENTE --uf AM --limite 5

Atualiza o campo `noticias` de <ano>/analise/<id>.yml.
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import yaml

import tse

sys.stdout.reconfigure(encoding="utf-8")

ROOT = tse.ROOT
RSS = "https://news.google.com/rss/search"
JANELA_ANOS = 5


def sem_acento(texto: str) -> str:
    n = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in n if not unicodedata.combining(c)).lower()


def tokens(nome: str) -> list[str]:
    return [t for t in re.split(r"\W+", sem_acento(nome)) if len(t) >= 4]


def buscar(nome: str) -> list[dict]:
    query = urllib.parse.urlencode(
        {"q": f'"{nome}"', "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
    )
    url = f"{RSS}?{query}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        bruto = resp.read()
    raiz = ET.fromstring(bruto)
    return [
        {
            "titulo": item.findtext("title") or "",
            "link": item.findtext("link") or "",
            "pub": item.findtext("pubDate") or "",
        }
        for item in raiz.findall(".//item")
    ]


def selecionar(nome: str, itens: list[dict], ano: int, limite: int) -> list[dict]:
    chaves = set(tokens(nome))
    corte = datetime.date(ano, 1, 1) - datetime.timedelta(days=365 * JANELA_ANOS)
    vistos: set[str] = set()
    saida = []
    for it in itens:
        titulo = it["titulo"]
        if chaves and not (chaves & set(tokens(titulo))):
            continue
        try:
            data = parsedate_to_datetime(it["pub"]).date()
        except (TypeError, ValueError):
            continue
        if data < corte:
            continue
        base = re.sub(r"\s+", " ", titulo).strip()
        if base in vistos:
            continue
        vistos.add(base)
        veiculo = titulo.rsplit(" - ", 1)[1] if " - " in titulo else None
        titulo_limpo = titulo.rsplit(" - ", 1)[0] if " - " in titulo else titulo
        saida.append(
            {
                "titulo": titulo_limpo,
                "veiculo": veiculo,
                "data": data.isoformat(),
                "url": it["link"],
            }
        )
        if len(saida) >= limite:
            break
    return saida


def main() -> None:
    p = argparse.ArgumentParser(description="ETL de notícias (Google News RSS).")
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--cargo", required=True)
    p.add_argument("--uf", default=None)
    p.add_argument("--limite", type=int, default=5)
    p.add_argument("--force", action="store_true")
    args = p.parse_args()

    por_cargo, _ = tse.coletar(args.ano, args.uf, None)
    candidatos = por_cargo.get(args.cargo.upper(), [])
    if not candidatos:
        raise SystemExit(f"cargo '{args.cargo}' não encontrado")

    hoje = datetime.date.today().isoformat()
    for c in candidatos:
        caminho = os.path.join(ROOT, str(args.ano), "analise", f"{c['id']}.yml")
        if not os.path.exists(caminho):
            print(f"sem dossiê: {c['id']} (rode etl/dossie.py)")
            continue
        with open(caminho, encoding="utf-8") as f:
            doc = yaml.safe_load(f) or {}
        if doc.get("noticias") and not args.force:
            print(f"pulado (já tem notícias): {c['id']}")
            continue
        itens = selecionar(c["nome_urna"], buscar(c["nome_urna"]), args.ano, args.limite)
        doc["noticias"] = itens
        doc["atualizado_em"] = hoje
        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
        print(f"{c['id']}: {len(itens)} notícias")


if __name__ == "__main__":
    main()
