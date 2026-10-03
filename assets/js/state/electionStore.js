/**
 * Application state container.
 *
 * Encapsulates all mutable state behind explicit methods so components never
 * touch shared variables directly (Single Responsibility + encapsulation).
 */
export function createElectionStore() {
  let year = null;
  let manifest = null;
  let entries = [];
  let cargoEntry = null;
  let cargoDocument = null;
  let candidates = [];
  let columns = [];
  let visibleColumnKeys = new Set();
  let sort = { key: 'nome_urna', direction: 1 };
  const comparedIds = new Set();

  return {
    getYear: () => year,
    setYear: (value) => {
      year = value;
    },

    getManifest: () => manifest,
    setManifest: (value) => {
      manifest = value;
    },

    getEntries: () => entries,
    setEntries: (value) => {
      entries = value;
    },

    getCargoEntry: () => cargoEntry,
    setCargoEntry: (value) => {
      cargoEntry = value;
    },

    getCargoDocument: () => cargoDocument,
    setCargoDocument: (value) => {
      cargoDocument = value;
    },

    getCandidates: () => candidates,
    setCandidates: (value) => {
      candidates = value;
    },

    getColumns: () => columns,
    setColumns: (value) => {
      columns = value;
    },

    getVisibleColumnKeys: () => visibleColumnKeys,
    setVisibleColumnKeys: (value) => {
      visibleColumnKeys = value;
    },
    isColumnVisible: (key) => visibleColumnKeys.has(key),
    toggleColumnVisibility: (key) => {
      if (visibleColumnKeys.has(key)) visibleColumnKeys.delete(key);
      else visibleColumnKeys.add(key);
    },

    getSort: () => sort,
    setSort: (key, direction = 1) => {
      sort = { key, direction };
    },
    toggleSort: (key) => {
      sort = sort.key === key ? { key, direction: sort.direction * -1 } : { key, direction: 1 };
      return sort;
    },

    getComparedIds: () => comparedIds,
    isCompared: (id) => comparedIds.has(id),
    addCompared: (id) => {
      comparedIds.add(id);
    },
    removeCompared: (id) => {
      comparedIds.delete(id);
    },
    clearCompared: () => {
      comparedIds.clear();
    },
    getSelectedCandidates: () =>
      [...comparedIds].map((id) => candidates.find((candidate) => candidate.id === id)).filter(Boolean),
  };
}
