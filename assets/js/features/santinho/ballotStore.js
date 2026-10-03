/**
 * Voter ballot state, persisted in localStorage.
 *
 * The ballot is the user's own data (not part of the repository), so it lives
 * only in the browser. It stores the chosen candidate ids per cargo.
 */
const STORAGE_KEY = 'eleicoes:santinho';

function readFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export function createBallotStore() {
  let ballot = readFromStorage();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ballot));
    } catch {
      /* storage unavailable (private mode) — keep in memory only */
    }
  }

  return {
    get: () => ballot,
    matches: (ano, uf) => ballot?.ano === ano && ballot?.uf === uf,

    start(ano, uf) {
      ballot = { ano, uf, picks: {}, updatedAt: new Date().toISOString() };
      persist();
    },

    getPick: (cargo) => ballot?.picks?.[cargo] ?? [],

    setPick(cargo, ids) {
      if (!ballot) return;
      ballot.picks[cargo] = ids;
      ballot.updatedAt = new Date().toISOString();
      persist();
    },

    clear() {
      ballot = null;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
