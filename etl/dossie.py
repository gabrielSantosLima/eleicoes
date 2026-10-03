"""Semeia dossiês em <ano>/analise/<id>.yml a partir dos dados oficiais do TSE.

Uso:
  python etl/dossie.py --ano 2026 --cargo PRESIDENTE --uf AM
  python etl/dossie.py --ano 2026 --cargo PRESIDENTE --uf AM --force

Usa o mesmo `id` de <CARGO>.yml (reprocessa com a mesma UF). Não sobrescreve
dossiês já existentes, salvo com --force.
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

import yaml

import tse

sys.stdout.reconfigure(encoding="utf-8")

ROOT = tse.ROOT


def montar(ano: int, cargo: str, uf: str | None, force: bool) -> None:
    por_cargo, _ = tse.coletar(ano, uf, None)
    candidatos = por_cargo.get(cargo.upper())
    if not candidatos:
        raise SystemExit(
            f"cargo '{cargo}' não encontrado. Disponíveis: {sorted(por_cargo)}"
        )

    destino_dir = os.path.join(ROOT, str(ano), "analise")
    os.makedirs(destino_dir, exist_ok=True)
    hoje = datetime.date.today().isoformat()

    for c in candidatos:
        caminho = os.path.join(destino_dir, f"{c['id']}.yml")
        if os.path.exists(caminho) and not force:
            print(f"pulado (existe) analise/{c['id']}.yml")
            continue
        doc = {
            "id": c["id"],
            "nome_completo": c["nome_completo"],
            "nome_urna": c["nome_urna"],
            "numero": c["numero"],
            "partido": c["partido"],
            "coligacao": c["coligacao"],
            "foto": c.get("foto"),
            "grau_instrucao": c["grau_instrucao"],
            "ocupacao": c["ocupacao"],
            "formacao_academica": [],
            "dias_trabalhados_ultimos_2_anos": None,
            "eh_reeleicao": c["eh_reeleicao"],
            "noticias": [],
            "projetos_aprovados": [],
            "fontes": [c["fonte"]],
            "atualizado_em": hoje,
        }
        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
        print(f"criado analise/{c['id']}.yml")


def main() -> None:
    p = argparse.ArgumentParser(description="Semeia dossiês a partir do TSE.")
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--cargo", required=True, help="ex.: PRESIDENTE")
    p.add_argument("--uf", default=None, help="mesma UF usada em etl/tse.py")
    p.add_argument("--force", action="store_true", help="sobrescrever existentes")
    args = p.parse_args()
    montar(args.ano, args.cargo, args.uf, args.force)


if __name__ == "__main__":
    main()
