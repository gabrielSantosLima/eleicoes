"""ETL de notícias via Google News RSS (fonte não oficial; citar URL).

Uso:
  python etl/noticias.py --ano 2026 --cargo PRESIDENTE --uf AM
  python etl/noticias.py --ano 2026 --cargo PRESIDENTE --uf AM --limite 10

Busca, por ano, as notícias dos últimos 10 anos e grava as 10 mais relevantes
no campo `noticias` de <ano>/analise/<id>.yml.
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
import time
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
JANELA_ANOS = 10
LIMITE_PADRAO = 10

# Veículos usados como sinal de relevância (peso maior na seleção).
VEICULOS_RELEVANTES = {
    "g1", "globo", "o globo", "oglobo", "folha", "estadão", "estadao", "uol",
    "agência brasil", "agencia brasil", "bbc", "reuters", "valor", "poder360",
    "cnn", "metrópoles", "metropoles", "veja", "exame", "nexo", "el país",
    "el pais", "carta capital", "brasil de fato", "agência pública", "apublica",
}


def sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in normalizado if not unicodedata.combining(c)).lower()


def tokens(nome: str) -> list[str]:
    return [token for token in re.split(r"\W+", sem_acento(nome)) if len(token) >= 4]


def consultar(query: str) -> list[dict]:
    params = urllib.parse.urlencode({"q": query, "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"})
    url = f"{RSS}?{params}"
    for _ in range(3):
        try:
            requisicao = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(requisicao, timeout=30) as resposta:
                raiz = ET.fromstring(resposta.read())
            return [
                {
                    "titulo": item.findtext("title") or "",
                    "link": item.findtext("link") or "",
                    "pub": item.findtext("pubDate") or "",
                }
                for item in raiz.findall(".//item")
            ]
        except Exception:
            time.sleep(2)
    return []


def buscar_candidato(nome: str, ano: int) -> list[dict]:
    itens: list[dict] = []
    for ano_janela in range(ano - JANELA_ANOS + 1, ano + 1):
        query = f'"{nome}" after:{ano_janela}-01-01 before:{ano_janela}-12-31'
        itens.extend(consultar(query))
        time.sleep(0.8)
    return itens


def pontuar(titulo: str, veiculo: str | None, nome: str) -> int:
    pontuacao = 0
    if veiculo and veiculo.strip().lower() in VEICULOS_RELEVANTES:
        pontuacao += 2
    if sem_acento(nome) in sem_acento(titulo):
        pontuacao += 1
    return pontuacao


def selecionar(nome: str, itens: list[dict], ano: int, limite: int) -> list[dict]:
    chaves = set(tokens(nome))
    inicio = datetime.date(ano - JANELA_ANOS + 1, 1, 1)
    vistos: set[str] = set()
    coletados: list[dict] = []

    for item in itens:
        titulo = item["titulo"]
        if chaves and not (chaves & set(tokens(titulo))):
            continue
        try:
            data = parsedate_to_datetime(item["pub"]).date()
        except (TypeError, ValueError):
            continue
        if data < inicio:
            continue
        chave = re.sub(r"\s+", " ", titulo).strip()
        if chave in vistos:
            continue
        vistos.add(chave)

        veiculo = titulo.rsplit(" - ", 1)[1] if " - " in titulo else None
        titulo_limpo = titulo.rsplit(" - ", 1)[0] if " - " in titulo else titulo
        coletados.append(
            {
                "titulo": titulo_limpo,
                "veiculo": veiculo,
                "data": data.isoformat(),
                "url": item["link"],
                "score": pontuar(titulo, veiculo, nome),
                "_date": data,
            }
        )

    # Diversidade por ano: no máximo 2 por ano, priorizando relevância.
    por_ano: dict[int, list[dict]] = {}
    for item in coletados:
        por_ano.setdefault(item["_date"].year, []).append(item)

    selecionados: list[dict] = []
    for ano_itens in por_ano.values():
        ano_itens.sort(key=lambda x: (-x["score"], -x["_date"].toordinal()))
        selecionados.extend(ano_itens[:2])

    selecionados.sort(key=lambda x: (-x["score"], -x["_date"].toordinal()))
    selecionados = selecionados[:limite]
    selecionados.sort(key=lambda x: -x["_date"].toordinal())

    return [
        {chave: valor for chave, valor in item.items() if chave not in ("score", "_date")}
        for item in selecionados
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL de notícias (Google News RSS).")
    parser.add_argument("--ano", type=int, required=True)
    parser.add_argument("--cargo", required=True)
    parser.add_argument("--uf", default=None)
    parser.add_argument("--limite", type=int, default=LIMITE_PADRAO)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    por_cargo, _ = tse.coletar(args.ano, args.uf, None)
    candidatos = por_cargo.get(args.cargo.upper(), [])
    if not candidatos:
        raise SystemExit(f"cargo '{args.cargo}' não encontrado")

    hoje = datetime.date.today().isoformat()
    for candidato in candidatos:
        caminho = os.path.join(ROOT, str(args.ano), "analise", f"{candidato['id']}.yml")
        if not os.path.exists(caminho):
            print(f"sem dossiê: {candidato['id']} (rode etl/dossie.py)")
            continue
        with open(caminho, encoding="utf-8") as arquivo:
            doc = yaml.safe_load(arquivo) or {}
        if doc.get("noticias") and not args.force:
            print(f"pulado (já tem notícias): {candidato['id']}")
            continue
        itens = selecionar(candidato["nome_urna"], buscar_candidato(candidato["nome_urna"], args.ano), args.ano, args.limite)
        doc["noticias"] = itens
        doc["atualizado_em"] = hoje
        with open(caminho, "w", encoding="utf-8", newline="\n") as arquivo:
            yaml.safe_dump(doc, arquivo, allow_unicode=True, sort_keys=False, width=1000)
        print(f"{candidato['id']}: {len(itens)} notícias")


if __name__ == "__main__":
    main()
