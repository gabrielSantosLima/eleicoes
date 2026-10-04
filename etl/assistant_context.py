"""Gera o contexto único do assistente de IA: `assistant/candidates.json`.

Contém, para cada candidato: cargo, nome, número e (quando existir) os resumos
das propostas por área. É enviado inteiro como contexto para o modelo.

Uso:
  python etl/assistant_context.py --ano 2026
  python etl/assistant_context.py --ano 2026 --out assistant/candidates.json
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def propostas_por_id(ano: int) -> dict[str, list[dict]]:
    mapa: dict[str, list[dict]] = {}
    for caminho in glob.glob(os.path.join(ROOT, str(ano), "analise", "*.yml")):
        with open(caminho, encoding="utf-8") as arquivo:
            dossie = yaml.safe_load(arquivo) or {}
        resumos = [
            {"area": proposta.get("area"), "resumo": proposta.get("resumo")}
            for proposta in (dossie.get("propostas_governo") or [])
        ]
        if resumos:
            mapa[dossie["id"]] = resumos
    return mapa


def coletar(ano: int) -> list[dict]:
    resumos = propostas_por_id(ano)
    itens: list[dict] = []
    for caminho in sorted(glob.glob(os.path.join(ROOT, str(ano), "*.yml"))):
        with open(caminho, encoding="utf-8") as arquivo:
            documento = yaml.safe_load(arquivo) or {}
        if "candidatos" not in documento:
            continue
        cargo = documento.get("cargo")
        for candidato in documento["candidatos"]:
            item = {
                "cargo": cargo,
                "nome": candidato.get("nome_urna") or candidato.get("nome_completo"),
                "numero": candidato.get("numero"),
            }
            if candidato["id"] in resumos:
                item["propostas"] = resumos[candidato["id"]]
            itens.append(item)
    return itens


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera assistant/candidates.json.")
    parser.add_argument("--ano", type=int, required=True)
    parser.add_argument("--out", default="assistant/candidates.json")
    args = parser.parse_args()

    itens = coletar(args.ano)
    destino = os.path.join(ROOT, args.out)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8", newline="\n") as arquivo:
        json.dump(itens, arquivo, ensure_ascii=False, separators=(",", ":"))

    tamanho = os.path.getsize(destino)
    print(f"{args.out}: {len(itens)} candidatos, {tamanho} bytes (~{tamanho // 3.5:.0f} tokens)")


if __name__ == "__main__":
    main()
