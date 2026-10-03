"""Busca URLs públicas de fotos dos candidatos e grava no YAML do cargo.

Uso:
  python etl/fotos_busca.py --ano 2026 --cargo SENADOR --uf AM
  python etl/fotos_busca.py --ano 2026 --cargo DEPUTADO_FEDERAL --uf AM --jobs 8

Não baixa imagens: apenas localiza URLs públicas e as grava em `<CARGO>.yml`
(campo `foto`) e em `etl/fotos.yml` (para sobreviver a re-execuções do tse.py).

Provedores (em ordem): Wikimedia (Wikipédia/Commons) e Bing Images (best-effort,
com filtro de relevância pelo nome). Resultados ficam em cache.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import html as html_module
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

import yaml

import tse

sys.stdout.reconfigure(encoding="utf-8")

ROOT = tse.ROOT
CACHE = os.path.join(ROOT, "etl", "cache")
FOTOS_YML = os.path.join(ROOT, "etl", "fotos.yml")
USER_AGENT = "eleicoes-etl/1.0 (+https://github.com/gabrielSantosLima/eleicoes)"
RELEVANTE_MIN = 2  # número mínimo de tokens do nome que precisam bater


def sem_acento(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in normalizado if not unicodedata.combining(c)).lower()


def tokens(nome: str) -> list[str]:
    return [token for token in re.split(r"\W+", sem_acento(nome)) if len(token) >= 4]


def relevante(nome: str, texto: str) -> bool:
    alvo = set(tokens(nome))
    if not alvo:
        return False
    encontrados = alvo & set(tokens(texto))
    return len(encontrados) >= min(RELEVANTE_MIN, len(alvo))


def http_get(url: str, headers: dict | None = None) -> str:
    request = urllib.request.Request(url, headers=headers or {"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def http_json(url: str) -> dict:
    return json.loads(http_get(url))


# ------------------------------- providers -------------------------------- #

def buscar_wikimedia(nome: str) -> str | None:
    """Foto da página da Wikipédia em português."""
    try:
        busca = http_json(
            "https://pt.wikipedia.org/w/api.php?action=query&list=search&srnamespace=0&format=json&srlimit=1"
            f"&srsearch={urllib.parse.quote(nome)}"
        )
        hits = busca.get("query", {}).get("search", [])
        if not hits or not relevante(nome, hits[0]["title"]):
            return None
        titulo = hits[0]["title"]
        dados = http_json(
            "https://pt.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=500"
            f"&redirects=1&format=json&titles={urllib.parse.quote(titulo)}"
        )
        page = next(iter(dados["query"]["pages"].values()))
        source = (page.get("thumbnail") or {}).get("source")
        return source.split("?")[0] if source else None
    except Exception:
        return None


def buscar_commons(nome: str) -> str | None:
    """Primeiro arquivo de mídia no Wikimedia Commons cujo nome bate com o candidato."""
    try:
        dados = http_json(
            "https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&format=json&srlimit=5"
            f"&srsearch={urllib.parse.quote(nome)}"
        )
        for hit in dados.get("query", {}).get("search", []):
            titulo = hit["title"].replace("File:", "")
            if not relevante(nome, titulo):
                continue
            if not re.search(r"\.(jpg|jpeg|png|webp)$", titulo, re.I):
                continue
            info = http_json(
                "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&format=json"
                f"&titles={urllib.parse.quote('File:' + titulo)}"
            )
            page = next(iter(info["query"]["pages"].values()))
            url = (page.get("imageinfo") or [{}])[0].get("url")
            if url:
                return url.split("?")[0]
    except Exception:
        return None
    return None


def buscar_bing(nome: str) -> str | None:
    """Bing Images (best-effort). Só aceita se a URL/título contiver o nome."""
    try:
        pagina = http_get(
            "https://www.bing.com/images/search?form=HDRSC2&q=" + urllib.parse.quote(f"{nome} amazonas"),
            {"User-Agent": USER_AGENT},
        )
        for match in re.finditer(r"murl&quot;:&quot;(https?://.+?)&quot;", pagina):
            url = html_module.unescape(match.group(1))
            if relevante(nome, urllib.parse.unquote(url)) and re.search(r"\.(jpg|jpeg|png|webp)", url, re.I):
                return url
    except Exception:
        return None
    return None


PROVIDERS = (buscar_wikimedia, buscar_commons, buscar_bing)


def encontrar_foto(candidato: dict) -> str | None:
    nomes = [candidato.get("nome_completo"), candidato.get("nome_urna")]
    for nome in filter(None, nomes):
        for provider in PROVIDERS:
            url = provider(nome)
            if url:
                return url
            time.sleep(0.2)
    return None


# --------------------------------- main ----------------------------------- #

def carregar_cache() -> dict:
    caminho = os.path.join(CACHE, "fotos_search.json")
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as arquivo:
            return json.load(arquivo)
    return {}


def salvar_cache(cache: dict) -> None:
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, "fotos_search.json"), "w", encoding="utf-8") as arquivo:
        json.dump(cache, arquivo, ensure_ascii=False, indent=1)


def atualizar_fotos_yml(mapa: dict[str, str]) -> None:
    existente = {}
    if os.path.exists(FOTOS_YML):
        with open(FOTOS_YML, encoding="utf-8") as arquivo:
            existente = yaml.safe_load(arquivo) or {}
    existente.update(mapa)
    with open(FOTOS_YML, "w", encoding="utf-8", newline="\n") as arquivo:
        yaml.safe_dump(existente, arquivo, allow_unicode=True, sort_keys=True, width=1000)


def main() -> None:
    parser = argparse.ArgumentParser(description="Busca URLs de fotos dos candidatos.")
    parser.add_argument("--ano", type=int, required=True)
    parser.add_argument("--cargo", required=True)
    parser.add_argument("--uf", default=None)
    parser.add_argument("--jobs", type=int, default=8)
    args = parser.parse_args()

    caminho = os.path.join(ROOT, str(args.ano), tse.nome_arquivo(args.cargo))
    with open(caminho, encoding="utf-8") as arquivo:
        documento = yaml.safe_load(arquivo)

    candidatos = documento.get("candidatos", [])
    cache = carregar_cache()
    faltantes = [c for c in candidatos if not c.get("foto")]

    def buscar(candidato: dict) -> tuple[str, str | None]:
        if candidato["id"] in cache and cache[candidato["id"]]:
            return candidato["id"], cache[candidato["id"]]
        return candidato["id"], encontrar_foto(candidato)

    resultados: dict[str, str] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
        for cid, url in executor.map(buscar, faltantes):
            cache[cid] = url
            if url:
                resultados[cid] = url

    salvar_cache(cache)

    for candidato in candidatos:
        if not candidato.get("foto") and resultados.get(candidato["id"]):
            candidato["foto"] = resultados[candidato["id"]]

    with open(caminho, "w", encoding="utf-8", newline="\n") as arquivo:
        yaml.safe_dump(documento, arquivo, allow_unicode=True, sort_keys=False, width=1000)

    atualizar_fotos_yml({cid: url for cid, url in resultados.items()})

    total = len(candidatos)
    com_foto = sum(1 for c in candidatos if c.get("foto"))
    print(f"{args.cargo}: {com_foto}/{total} com foto (adicionadas {len(resultados)})")


if __name__ == "__main__":
    main()
