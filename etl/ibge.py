"""ETL IBGE — população (estimativas anuais + Censo 2022).

Uso:
  python etl/ibge.py --ano 2026
  python etl/ibge.py --ano 2028 --localidades "Brasil:N1:1,Manaus:N6:1302603"

Gera POPULACAO.yml (Brasil) e POPULACAO_<LOCAL>.yml por localidade.
Fonte: API de Agregados do IBGE (https://servicodados.ibge.gov.br/api/v3/).
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import json
import os
import sys
import urllib.request

import yaml

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://servicodados.ibge.gov.br/api/v3/agregados"

# Agregado 6579 / variável 9324 = População residente estimada (anual).
ESTIMATIVA = ("6579", "9324")
# Agregado 4714 / variável 93 = População residente (Censo 2022).
CENSO = ("4714", "93", 2022)

LOCALIDADES_PADRAO = [
    {"nome": "Brasil", "nivel": "N1", "id": "1", "arquivo": "POPULACAO.yml"},
    {"nome": "Manaus", "nivel": "N6", "id": "1302603", "arquivo": "POPULACAO_MANAUS.yml"},
]


def buscar(agregado: str, variavel: str, periodo: str, nivel: str, local_id: str) -> dict:
    url = (
        f"{BASE}/{agregado}/periodos/{periodo}/variaveis/{variavel}"
        f"?localidades={nivel}[{local_id}]"
    )
    with urllib.request.urlopen(url) as resp:
        bruto = resp.read()
    if bruto[:2] == b"\x1f\x8b":
        bruto = gzip.decompress(bruto)
    dados = json.loads(bruto)
    serie = dados[0]["resultados"][0]["series"][0]["serie"]
    return {int(ano): int(valor) for ano, valor in serie.items()}


def montar_localidade(ano: int, loc: dict) -> dict:
    estimativa = buscar(*ESTIMATIVA, "-1", loc["nivel"], loc["id"])
    ano_estimativa = max(estimativa)
    censo = buscar(CENSO[0], CENSO[1], str(CENSO[2]), loc["nivel"], loc["id"])

    fonte_est = (
        f"{BASE}/{ESTIMATIVA[0]}/periodos/-1/variaveis/{ESTIMATIVA[1]}"
        f"?localidades={loc['nivel']}[{loc['id']}]"
    )
    fonte_censo = (
        f"{BASE}/{CENSO[0]}/periodos/{CENSO[2]}/variaveis/{CENSO[1]}"
        f"?localidades={loc['nivel']}[{loc['id']}]"
    )

    return {
        "ano": ano,
        "escopo": loc["nome"],
        "fonte": "IBGE — https://servicodados.ibge.gov.br/api/v3/",
        "censo": CENSO[2],
        "atualizado_em": datetime.date.today().isoformat(),
        "dados": [
            {
                "localidade": loc["nome"],
                "codigo_ibge": loc["id"],
                "ano": CENSO[2],
                "populacao": censo[CENSO[2]],
                "fonte": fonte_censo,
            },
            {
                "localidade": loc["nome"],
                "codigo_ibge": loc["id"],
                "ano": ano_estimativa,
                "populacao": estimativa[ano_estimativa],
                "fonte": fonte_est,
            },
        ],
    }


def parse_localidades(texto: str | None) -> list[dict]:
    if not texto:
        return LOCALIDADES_PADRAO
    locs = []
    for item in texto.split(","):
        nome, nivel, local_id = item.split(":")
        arquivo = "POPULACAO.yml" if nome.lower() == "brasil" else f"POPULACAO_{nome.upper()}.yml"
        locs.append({"nome": nome, "nivel": nivel, "id": local_id, "arquivo": arquivo})
    return locs


def main() -> None:
    p = argparse.ArgumentParser(description="ETL de população do IBGE.")
    p.add_argument("--ano", type=int, required=True, help="ano da eleição")
    p.add_argument("--localidades", default=None, help='ex.: "Brasil:N1:1,Manaus:N6:1302603"')
    args = p.parse_args()

    for loc in parse_localidades(args.localidades):
        doc = montar_localidade(args.ano, loc)
        destino = os.path.join(ROOT, str(args.ano), loc["arquivo"])
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "w", encoding="utf-8", newline="\n") as f:
            yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
        pop = doc["dados"][-1]
        print(f"{loc['arquivo']}: {loc['nome']} {pop['ano']} = {pop['populacao']}")


if __name__ == "__main__":
    main()
