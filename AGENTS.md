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
index.html            página raiz (seletor de ano)
assets/               app.js, styles.css
data/schema.json      contrato dos campos
etl/                  scripts de coleta nas APIs oficiais
_templates/           modelos de YAML
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

Definidos em `data/schema.json`: identificação (nome, nº, partido, coligação),
`formacao_academica`, `dias_trabalhados_ultimos_2_anos`, `eh_reeleicao`,
`noticias`, `projetos_aprovados`, `fontes`, `atualizado_em`.

> `linha_do_tempo` não existe: a trajetória é inferida de `projetos_aprovados`.

## Fluxo de trabalho

1. Coletar nas APIs oficiais (ver `etl/`).
2. Gravar/atualizar os YAML seguindo `_templates/`.
3. Validar contra `data/schema.json`.
4. Atualizar `atualizado_em` e `fontes`.

## Adicionar um novo ano

Copiar a estrutura de `2026/`, atualizar `<ano>/index.yml` e ajustar as fontes.
