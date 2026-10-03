"""ETL TSE — propostas de governo por área (a partir dos PDFs oficiais).

Uso:
  python etl/propostas.py --ano 2026 --cargo PRESIDENTE --uf AM
  python etl/propostas.py --ano 2026 --cargo GOVERNADOR --uf AM

Baixa o ZIP de propostas do TSE, extrai o texto dos PDFs e grava, por área,
um resumo automático (curto) e o texto bruto em <ano>/analise/<id>.yml.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import unicodedata
import urllib.request
import zipfile

import yaml
from pypdf import PdfReader

import tse

sys.stdout.reconfigure(encoding="utf-8")

ROOT = tse.ROOT
BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo"
CACHE = os.path.join(ROOT, "etl", "cache")

# Taxonomia fixa de áreas (ordem canônica) e palavras-chave para segmentação.
AREAS: list[tuple[str, list[str]]] = [
    ("Economia e Trabalho", ["economia", "trabalho", "emprego", "renda", "industria", "tribut", "inflacao", "empreendedor"]),
    ("Educação", ["educacao", "escola", "ensino", "universidade", "alfabetiz", "professor"]),
    ("Saúde", ["saude", "sus", "hospital", "medic", "vacina", "atencao basica"]),
    ("Segurança Pública", ["seguranca publica", "seguranca", "policia", "crime", "violencia", "trafico"]),
    ("Meio Ambiente", ["meio ambiente", "ambiental", "clima", "desmatamento", "sustentab", "biodiversidade"]),
    ("Infraestrutura e Mobilidade", ["infraestrutura", "mobilidade", "transporte", "saneamento", "energia", "rodovia"]),
    ("Direitos Humanos", ["direitos humanos", "igualdade", "mulher", "lgbt", "indigena", "racial", "cidadania"]),
    ("Agricultura", ["agricultura", "agro", "agronegocio", "pecuaria", "agricultura familiar"]),
    ("Tecnologia e Inovação", ["tecnologia", "inovacao", "digital", "inteligencia artificial", "ciencia", "pesquisa"]),
    ("Gestão Pública e Combate à Corrupção", ["gestao publica", "corrupcao", "transparencia", "eficiencia do estado", "reforma administrativa"]),
    ("Política Externa", ["politica externa", "diplomacia", "relacoes internacionais", "soberania", "mercosul"]),
    ("Assistência Social", ["assistencia social", "bolsa familia", "pobreza", "desigualdade", "protecao social", "vulnerab"]),
]

RESUMO_MAX = 320
TEXTO_MAX = 1800
MIN_FRASE = 30


def sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in normalizado if not unicodedata.combining(c)).lower()


def baixar_propostas(ano: int, uf_zip: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    destino = os.path.join(CACHE, f"proposta_governo_{ano}_{uf_zip}.zip")
    if not os.path.exists(destino):
        url = f"{BASE}/proposta_governo_{ano}_{uf_zip}.zip"
        print(f"baixando {url}")
        urllib.request.urlretrieve(url, destino)
    return destino


def extrair_texto_pdf(caminho: str) -> str:
    leitor = PdfReader(caminho)
    partes = []
    for pagina in leitor.pages:
        try:
            partes.append(pagina.extract_text() or "")
        except Exception:
            continue
    return "\n".join(partes)


def frases(texto: str) -> list[str]:
    normalizado = re.sub(r"\s+", " ", texto)
    partes = re.split(r"(?<=[.!?])\s+", normalizado)
    return [parte.strip() for parte in partes if len(parte.strip()) >= MIN_FRASE]


def pontuar(frase_normalizada: str, palavras: list[str]) -> int:
    """Conta quantas palavras-chave distintas aparecem na frase."""
    return sum(1 for palavra in palavras if palavra in frase_normalizada)


def resumir(texto: str) -> str:
    trechos = re.split(r"(?<=[.!?])\s+", texto)
    resumo = " ".join(trechos[:2]).strip()
    return resumo[:RESUMO_MAX].strip()


def segmentar(texto: str) -> list[dict]:
    todas_frases = frases(texto)
    frases_normalizadas = [sem_acento(frase) for frase in todas_frases]
    propostas = []
    for area, palavras in AREAS:
        melhor_indice = -1
        melhor_pontuacao = 0
        for indice, frase_normalizada in enumerate(frases_normalizadas):
            pontuacao = pontuar(frase_normalizada, palavras)
            if pontuacao > melhor_pontuacao:
                melhor_pontuacao = pontuacao
                melhor_indice = indice
        if melhor_indice < 0:
            continue
        inicio = max(0, melhor_indice - 1)
        fim = min(len(todas_frases), melhor_indice + 4)
        trecho = " ".join(todas_frases[inicio:fim]).strip()
        propostas.append(
            {
                "area": area,
                "resumo": resumir(trecho),
                "texto": trecho[:TEXTO_MAX].strip(),
            }
        )
    return propostas


def nome_pdf(ano: int, uf_zip: str, sq: str) -> str:
    return f"{ano}{uf_zip}{sq}_01.pdf"


def main() -> None:
    p = argparse.ArgumentParser(description="ETL de propostas de governo (TSE).")
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--cargo", required=True, help="ex.: PRESIDENTE")
    p.add_argument("--uf", default=None)
    args = p.parse_args()

    por_cargo, nacional = tse.coletar(args.ano, args.uf, None)
    candidatos = por_cargo.get(args.cargo.upper())
    if not candidatos:
        raise SystemExit(f"cargo '{args.cargo}' não encontrado")

    cargo_upper = args.cargo.upper()
    uf_zip = "BR" if nacional.get(cargo_upper, True) else (args.uf or "BR")
    zip_path = baixar_propostas(args.ano, uf_zip)

    destino_dir = os.path.join(ROOT, str(args.ano), "analise")
    fonte = f"{BASE}/proposta_governo_{args.ano}_{uf_zip}.zip"

    with zipfile.ZipFile(zip_path) as z:
        membros = set(z.namelist())

    encontrados = 0
    for candidato in candidatos:
        pdf = nome_pdf(args.ano, uf_zip, candidato["sq"])
        membro = next((m for m in membros if os.path.basename(m) == pdf), None)
        if not membro:
            continue
        with zipfile.ZipFile(zip_path) as z:
            z.extract(membro, CACHE)
        texto = extrair_texto_pdf(os.path.join(CACHE, membro))
        propostas = segmentar(texto)
        for proposta in propostas:
            proposta["fonte"] = fonte

        caminho = os.path.join(destino_dir, f"{candidato['id']}.yml")
        doc = {}
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                doc = yaml.safe_load(f) or {}
        doc["propostas_governo"] = propostas
        if fonte not in doc.get("fontes", []):
            doc.setdefault("fontes", []).append(fonte)
        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=1000)
        encontrados += 1
        print(f"{candidato['id']}: {len(propostas)} áreas")

    print(f"{encontrados}/{len(candidatos)} candidatos com proposta")


if __name__ == "__main__":
    main()
