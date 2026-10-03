/**
 * Data access layer.
 *
 * `createElectionRepository` is an abstraction over the data source. The rest
 * of the application depends on this interface, not on `fetch` or YAML details
 * (Dependency Inversion). A different implementation (e.g. a build-time JSON
 * API) could be injected without touching the components.
 */

export function createElectionRepository({ basePath = '', fetchImpl = fetch, yamlParser } = {}) {
  const parseYaml = (text) => (yamlParser ?? window.jsyaml).load(text);

  async function fetchText(path) {
    const response = await fetchImpl(`${basePath}${path}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar ${path} (HTTP ${response.status})`);
    return response.text();
  }

  async function fetchYaml(path) {
    return parseYaml(await fetchText(path));
  }

  /** Optional resources (missing dossiers, missing sources) return null. */
  async function fetchYamlOrNull(path) {
    try {
      return await fetchYaml(path);
    } catch {
      return null;
    }
  }

  return {
    async listYears() {
      return JSON.parse(await fetchText('data/years.json'));
    },
    getManifest: (year) => fetchYaml(`${year}/index.yml`),
    getCargo: (year, fileName) => fetchYaml(`${year}/${fileName}`),
    getDossier: (year, candidateId) => fetchYamlOrNull(`${year}/analise/${candidateId}.yml`),
    getPopulation: (year, fileName) => fetchYaml(`${year}/${fileName}`),
    getSources: (year, fileName) => fetchYamlOrNull(`${year}/${fileName}`),
  };
}
