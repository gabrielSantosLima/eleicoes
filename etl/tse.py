"""ETL TSE — candidatos de qualquer ano de eleição.

Fontes oficiais:
  - consulta_cand_<ano>.zip
  - historico_candidatura_<ano>.zip

Uso:
  python etl/tse.py --ano 2026 --uf AM
  python etl/tse.py --ano 2028            # municipal, todos os municípios
  python etl/tse.py --ano 2030 --uf AM --cargos PRESIDENTE,SENADOR

Gera um arquivo YAML por cargo em <ano>/ e atualiza <ano>/index.yml.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict

import yaml

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele"
CACHE = os.path.join(ROOT, "etl", "cache")
NADA = {"", "#NE", "#NULO", "#NÃO", "#NAO"}

# Mandato (em anos) por cargo; usado para achar o pleito anterior do mesmo cargo.
TERMO = {"SENADOR": 8}
TERMO_PADRAO = 4

# Cargos que não representam disputa direta ao cargo (chapas de suplentes).
IGNORAR = ("SUPLENTE",)

# Campos gravados em <CARGO>.yml (contrato de data/schema.json).
CAMPOS_CARGO = (
    "id",
    "nome_completo",
    "nome_urna",
    "numero",
    "partido",
    "coligacao",
    "eh_reeleicao",
    "situacao_candidatura",
    "foto",
    "fonte",
)


def carregar_fotos() -> dict[str, str]:
    caminho = os.path.join(ROOT, "etl", "fotos.yml")
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def baixar(url: str, destino: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    caminho = os.path.join(CACHE, destino)
    if not os.path.exists(caminho):
        print(f"baixando {url}")
        urllib.request.urlretrieve(url, caminho)
    return caminho


def ler_csv_zip(zip_path: str, membro: str) -> list[dict]:
    with zipfile.ZipFile(zip_path) as z:
        with z.open(membro) as raw:
            texto = io.TextIOWrapper(raw, encoding="latin-1")
            return list(csv.DictReader(texto, delimiter=";", quotechar='"'))


def limpar(valor: str) -> str | None:
    v = (valor or "").strip()
    return None if v.upper() in NADA else v


def slug(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^a-z0-9]+", "-", texto.lower())
    return texto.strip("-")


def nome_arquivo(cargo: str, sufixo: str = "") -> str:
    return slug(cargo).upper().replace("-", "_") + sufixo + ".yml"


def nome_cargo(cargo: str) -> str:
    return cargo.strip().title()


def termo_cargo(cargo: str) -> int:
    return TERMO.get(cargo.upper(), TERMO_PADRAO)


def carregar_eleitos(ano: int) -> dict[str, set[tuple[int, str]]]:
    """Mapa SQ_CANDIDATO_ATUAL -> {(ano, CARGO) em que foi eleito}."""
    url = f"{BASE}/historico_candidatura/historico_candidatura_{ano}.zip"
    zip_path = baixar(url, f"historico_candidatura_{ano}.zip")
    registros = ler_csv_zip(zip_path, f"historico_candidatura_{ano}_BRASIL.csv")
    eleitos: dict[str, set[tuple[int, str]]] = defaultdict(set)
    for r in registros:
        if r["DS_SIT_TOT_TURNO"].startswith("Eleito"):
            eleitos[r["SQ_CANDIDATO_ATUAL"]].add(
                (int(r["ANO_ELEICAO"]), r["DS_CARGO"].upper())
            )
    return eleitos


def selecionar(linhas, uf, cargos):
    for r in linhas:
        cargo = r["DS_CARGO"].upper()
        if any(ig in cargo for ig in IGNORAR):
            continue
        if cargos and cargo not in cargos:
            continue
        nacional = r["SG_UF"] == "BR"
        if not nacional and uf and r["SG_UF"] != uf:
            continue
        yield r, cargo, nacional


def coletar(
    ano: int, uf: str | None, cargos: set[str] | None
) -> tuple[dict[str, list[dict]], dict[str, bool]]:
    url = f"{BASE}/consulta_cand/consulta_cand_{ano}.zip"
    zip_path = baixar(url, f"consulta_cand_{ano}.zip")
    linhas = ler_csv_zip(zip_path, f"consulta_cand_{ano}_BRASIL.csv")
    eleitos = carregar_eleitos(ano)
    fotos = carregar_fotos()

    por_cargo: dict[str, list[dict]] = defaultdict(list)
    nacional: dict[str, bool] = defaultdict(lambda: True)
    usados: set[str] = set()

    for r, cargo, _ in selecionar(linhas, uf, cargos):
        if r["SG_UF"] != "BR":
            nacional[cargo] = False
        base_id = slug(r["NM_CANDIDATO"])
        cid = base_id
        n = 2
        while cid in usados:
            cid = f"{base_id}-{n}"
            n += 1
        usados.add(cid)

        sq = r["SQ_CANDIDATO"]
        ano_anterior = ano - termo_cargo(cargo)
        eh_reeleicao = (ano_anterior, cargo) in eleitos.get(sq, set())

        por_cargo[cargo].append(
            {
                "id": cid,
                "nome_completo": r["NM_CANDIDATO"].title(),
                "nome_urna": r["NM_URNA_CANDIDATO"].title(),
                "numero": int(r["NR_CANDIDATO"]),
                "partido": r["SG_PARTIDO"],
                "coligacao": limpar(r["NM_COLIGACAO"]),
                "eh_reeleicao": eh_reeleicao,
                "situacao_candidatura": None,
                "foto": fotos.get(cid),
                "fonte": url,
                "sq": sq,
                "grau_instrucao": limpar(r["DS_GRAU_INSTRUCAO"]),
                "ocupacao": limpar(r["DS_OCUPACAO"]),
            }
        )
    return por_cargo, nacional


def gravar_cargo(
    ano: int, uf: str | None, cargo: str, candidatos: list[dict], nacional: bool
) -> str:
    candidatos.sort(key=lambda c: c["nome_completo"])
    arquivo = nome_arquivo(cargo)
    doc = {
        "ano": ano,
        "cargo": nome_cargo(cargo),
        "uf": None if nacional else uf,
        "candidatos": [{k: c[k] for k in CAMPOS_CARGO} for c in candidatos],
    }
    destino = os.path.join(ROOT, str(ano), arquivo)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
    print(f"{arquivo}: {len(candidatos)} candidatos")
    return arquivo


def atualizar_index(
    ano: int, uf: str | None, arquivos: dict[str, str], nacional: dict[str, bool]
) -> None:
    caminho = os.path.join(ROOT, str(ano), "index.yml")
    doc = {}
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            doc = yaml.safe_load(f) or {}
    doc["ano"] = ano
    doc["eleicoes"] = [
        {
            "cargo": nome_cargo(cargo),
            "arquivo": arquivo,
            "resultado": nome_arquivo(cargo, "_RESULTADO"),
            "uf": None if nacional.get(cargo) else uf,
        }
        for cargo, arquivo in sorted(arquivos.items())
    ]
    doc.setdefault("populacao", [])
    doc.setdefault("fontes", "fontes.yml")
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
    print(f"index.yml: {len(doc['eleicoes'])} cargos")


def main() -> None:
    p = argparse.ArgumentParser(description="ETL de candidatos do TSE.")
    p.add_argument("--ano", type=int, required=True, help="ano da eleição")
    p.add_argument("--uf", default=None, help="UF (ex.: AM); omitir = todo o Brasil")
    p.add_argument("--cargos", default=None, help="lista de cargos separada por vírgula")
    args = p.parse_args()

    cargos = {c.strip().upper() for c in args.cargos.split(",")} if args.cargos else None
    por_cargo, nacional = coletar(args.ano, args.uf, cargos)
    arquivos = {}
    for cargo in sorted(por_cargo):
        arquivos[cargo] = gravar_cargo(
            args.ano, args.uf, cargo, por_cargo[cargo], nacional[cargo]
        )
    if arquivos:
        atualizar_index(args.ano, args.uf, arquivos, nacional)


if __name__ == "__main__":
    main()
