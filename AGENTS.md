# Diretiva do agente — Repositório `eleicoes`

Análise de candidatos a cargos públicos no Brasil (presidente, senador, deputado,
etc.) e dados populacionais. O objetivo final é uma página web que consome os
dados de cada ano.

## Regra de ouro

- Os arquivos **YAML são a fonte da verdade**. A página web apenas consome.
- **Sempre priorizar fontes oficiais do governo.**
- **Nunca inventar dados.** Se um campo não for encontrado, usar `null` (ou
  lista vazia) e registrar a lacuna em `fontes`/observações.
- **Toda informação relevante deve citar a URL da fonte oficial.**

## Fontes oficiais (prioridade)

| Fonte | Uso | URL |
|---|---|---|
| TSE — Dados Abertos | Candidaturas, bens, resultados, contas | https://dadosabertos.tse.jus.br/ |
| TSE — CKAN API | Metadados/arquivos dos datasets | https://dadosabertos.tse.jus.br/api/3/action/ |
| DivulgaCand (TSE) | Consulta REST por candidato (não documentada) | https://divulgacandcontas.tse.jus.br/ |
| Câmara dos Deputados — API v2 | Deputados, proposições, votações, despesas | https://dadosabertos.camara.leg.br/api/v2/ |
| Senado Federal — API | Senadores, matérias, votações | https://legis.senado.leg.br/dadosabertos/ |
| Portal da Transparência — API | Servidores, remuneração, emendas (requer token) | https://api.portaldatransparencia.gov.br/api-de-dados/ |
| IBGE — APIs | População, localidades | https://servicodados.ibge.gov.br/api/v3/ |

Fontes **não oficiais** (usar apenas quando não houver oficial, sempre citando a URL):
Google News RSS, GDELT, imprensa.

## Estrutura

```
index.html            página raiz (seletor de ano/cargo)
assets/
  js/                 módulos ES (main, core, data, domain, state, components)
  styles.css
  photos/<id>.jpg     fotos otimizadas dos candidatos (~512px)
  vendor/             js-yaml
  brazil-map.png
data/schema.json      contrato dos campos
data/years.json       anos disponíveis (consumido pela página)
etl/                  scripts de coleta nas APIs oficiais
  tse.py  ibge.py  dossie.py  propostas.py  noticias.py  validar.py
  fotos.yml           mapa id -> foto (usado por tse.py e dossie.py)
_templates/           modelos de YAML
docker-compose.yml    nginx local
nginx/default.conf
serve.sh              sobe o container (http://localhost:8080)
<ano>/                dados do ano (ex.: 2026/)
  index.yml           manifesto do ano
  <CARGO>.yml         lista nominal de candidatos
  <CARGO>_RESULTADO.yml
  POPULACAO.yml
  POPULACAO_MANAUS.yml
  fontes.yml
  analise/<id>.yml    dossiê de cada pessoa
AGENTS.md
```

## Convenções

- **Idioma**: português, sem acentos nos identificadores (`id` em slug).
- **Datas**: formato ISO `AAAA-MM-DD`.
- **`id`**: slug do nome completo, minúsculo, sem acento, hífen
  (ex.: `fulano-de-tal`). Deve ser único no ano e casar o nome do arquivo
  `analise/<id>.yml`.
- **Campos obrigatórios**: conforme `data/schema.json`. Validar antes de commitar.
- **Números**: usar tipo numérico no YAML (não string).
- **`fonte`**: URL oficial da informação. Em dossiês, cada seção deve ter fonte.
- **`atualizado_em`**: data da última atualização do arquivo.

## Campos do dossiê (`analise/<id>.yml`)

Definidos em `data/schema.json`: identificação (nome, nº, partido, coligação,
`foto`), `grau_instrucao` e `ocupacao` (TSE), `formacao_academica` (pesquisada),
`dias_trabalhados_ultimos_2_anos`, `eh_reeleicao`, `noticias` (até 10, últimos 10
anos), `propostas_governo` (por área: `resumo` + `texto` bruto + `fonte`),
`projetos_aprovados`, `fontes`, `atualizado_em`.

> `linha_do_tempo` não existe: a trajetória é inferida de `projetos_aprovados`.

## Fluxo de análise de um cargo

Passo a passo (exemplo: Governador do Amazonas, 2026). Os passos 1 e 2 são anuais;
3 a 6 são por cargo.

1. **Candidatos (TSE)** — baixa `consulta_cand` e `historico_candidatura`, gera um
   `<CARGO>.yml` por cargo e atualiza `index.yml`. Já popula `foto` a partir de
   `etl/fotos.yml`.
   ```bash
   python etl/tse.py --ano 2026 --uf AM
   ```
2. **População (IBGE)** — uma vez por ano.
   ```bash
   python etl/ibge.py --ano 2026
   ```
3. **Semear dossiês** — cria `analise/<id>.yml` com a identificação oficial
   (grau de instrução, ocupação, reeleição). Não sobrescreve dossiês existentes.
   ```bash
   python etl/dossie.py --ano 2026 --cargo GOVERNADOR --uf AM
   ```
4. **Fotos** — obter imagem de alta resolução (preferir Wikimedia Commons/fonte
   oficial), **otimizar** (~512px, JPG) em `assets/photos/<id>.jpg`, registrar em
   `etl/fotos.yml` e propagar (rodar `etl/tse.py` e atualizar o campo `foto` dos
   dossiês). Sem imagem disponível ⇒ `foto: null`.
5. **Propostas de governo (TSE)** — baixa os PDFs de proposta, segmenta nas áreas
   (Economia, Educação, Saúde, Segurança, Meio Ambiente, Infraestrutura, Direitos
   Humanos, Agricultura, Tecnologia, Gestão, Política Externa, Assistência Social)
   e grava `resumo` (automático) + `texto` (bruto) + `fonte`.
   ```bash
   python etl/propostas.py --ano 2026 --cargo GOVERNADOR --uf AM
   ```
   Em seguida **curar os `resumo`** diretamente nos YAMLs: reescrever para frases
   limpas, fiéis e autocontidas (o automático às vezes pega sumário/artefato).
   Manter o `texto` bruto. Paralelizável por grupos de candidatos.
6. **Notícias** — busca os últimos 10 anos e grava as 10 mais relevantes
   (ranking por veículo + diversidade por ano). Google News RSS (não oficial).
   ```bash
   python etl/noticias.py --ano 2026 --cargo GOVERNADOR --uf AM
   ```
7. **Validar** contra `data/schema.json`.
   ```bash
   python etl/validar.py 2026
   ```
8. **Publicar/atualizar o site** (nginx serve o diretório; dados com `no-store`).
   ```bash
   ./serve.sh        # http://localhost:8080
   ```

Scripts são genéricos por ano: `--ano`, `--uf`, `--cargo`. `etl/tse.py` descobre
os cargos do próprio dado; cargos nacionais (SG_UF=BR) ficam com `uf: null`.
`eh_reeleicao` é inferido do `historico_candidatura` (eleito ao mesmo cargo no
pleito anterior do mandato; Senador = 8 anos, demais = 4).

## Adicionar um novo ano

Copiar a estrutura de `2026/`, atualizar `<ano>/index.yml` e ajustar as fontes.
