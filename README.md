# eleicoes

Analysis of candidates for public office in Brazil (president, senator, federal
and state deputy, etc.) together with population data.

The repository holds one directory per election year. Each year contains
machine-readable **YAML** files that are the single source of truth: nominal
candidate lists, election results, population data and a dossier per person
under `analise/`. A root web page consumes those files to render the data.

Data is collected from **official government sources** (TSE, Câmara dos
Deputados, Senado Federal, Portal da Transparência and IBGE) and every relevant
piece of information cites its source URL.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the
full text.
