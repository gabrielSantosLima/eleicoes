"""Valida os YAML de um ano contra data/schema.json.

Uso:
  python etl/validar.py            # todos os anos
  python etl/validar.py 2026       # apenas 2026
"""
from __future__ import annotations

import glob
import json
import os
import sys

import yaml
from jsonschema import Draft202012Validator

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")

REFERENCIA = (
    ("candidatos", "#/$defs/cargo"),
    ("resultados", "#/$defs/resultado"),
    ("dados", "#/$defs/populacao"),
    ("noticias", "#/$defs/candidato_dossie"),
    ("projetos_aprovados", "#/$defs/candidato_dossie"),
)


def referencia(doc: dict) -> str | None:
    for chave, ref in REFERENCIA:
        if chave in doc:
            return ref
    if "nome_completo" in doc and "id" in doc:
        return "#/$defs/candidato_dossie"
    return None


def validar(caminho: str, schema: dict) -> list[str]:
    with open(caminho, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    ref = referencia(doc)
    if not ref:
        return []
    validador = Draft202012Validator({"$ref": ref, "$defs": schema["$defs"]})
    return [f"{e.json_path}: {e.message}" for e in validador.iter_errors(doc)]


def main() -> None:
    anos = sys.argv[1:] or [
        os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "[0-9][0-9][0-9][0-9]"))
    ]
    with open(os.path.join(ROOT, "data", "schema.json"), encoding="utf-8") as f:
        schema = json.load(f)

    falhas = 0
    for ano in anos:
        for caminho in sorted(glob.glob(os.path.join(ROOT, ano, "**", "*.yml"), recursive=True)):
            erros = validar(caminho, schema)
            rel = os.path.relpath(caminho, ROOT)
            if erros:
                falhas += 1
                print(f"FALHA {rel}")
                for e in erros:
                    print(f"      {e}")
            else:
                print(f"ok    {rel}")
    print(f"\n{len(anos)} ano(s), {falhas} arquivo(s) com falha")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
