/**
 * Composition root: wires the repository, the store and the view components.
 *
 * This is the only module that knows about both data and DOM, keeping the
 * components decoupled from each other (Dependency Inversion at the edges).
 */
import { select } from './core/dom.js';
import { createElectionRepository } from './data/electionRepository.js';
import { createElectionStore } from './state/electionStore.js';
import { DEFAULT_VISIBLE_COLUMN_KEYS, selectAvailableColumns } from './domain/candidateColumns.js';
import { mergeCandidateWithDossier } from './domain/candidates.js';
import { renderPopulationHero } from './components/populationHero.js';
import { renderCargoSelector } from './components/cargoSelector.js';
import { renderColumnCloud } from './components/columnCloud.js';
import { renderCandidatesTable, renderCandidatesCards } from './components/candidatesTable.js';
import { renderCandidateDetail } from './components/candidateDetail.js';
import { renderComparisonModal, renderCompareBar } from './components/comparison.js';
import { renderSourcesFooter } from './components/sourcesFooter.js';
import { hideLoadingOverlay, showErrorOverlay } from './components/overlays.js';
import { createSantinhoWizard } from './features/santinho/ballotWizard.js';
import { createAssistant } from './features/assistant/chatPanel.js';

const MAX_COMPARISON = 4;
const DEFAULT_CARGO_NAME = 'Presidente';

const elements = {
  loading: select('#loading'),
  topbar: select('#topbar'),
  app: select('#app'),
  yearLabel: select('#year-label'),
  cargoSelect: select('#cargo-select'),
  population: {
    number: select('#pop-number'),
    year: select('#pop-year'),
    note: select('#pop-census'),
  },
  candidatesTitle: select('#candidates-title'),
  candidatesSubtitle: select('#candidates-sub'),
  tableCaption: select('#table-caption'),
  columnCloud: select('#column-cloud'),
  table: select('#candidates-table'),
  cards: select('#candidates-cards'),
  compareBar: select('#compare-bar'),
  compareCount: select('#compare-count'),
  compareOpenButton: select('#compare-open'),
  compareClearButton: select('#compare-clear'),
  detail: select('#detail'),
  compare: select('#compare'),
  santinho: select('#santinho'),
  santinhoOpen: select('#santinho-open'),
  scrim: select('#scrim'),
  footer: select('#footer'),
};

const repository = createElectionRepository();
const store = createElectionStore();
const santinhoWizard = createSantinhoWizard({
  repository,
  electionStore: store,
  container: elements.santinho,
  scrim: elements.scrim,
});

/* ----------------------------- rendering ----------------------------- */

function renderSectionHeader() {
  const cargoEntry = store.getCargoEntry();
  const total = store.getCandidates().length;
  elements.candidatesTitle.textContent = `${cargoEntry.cargo} — ${store.getYear()}`;
  elements.candidatesSubtitle.textContent = `${total} ${total === 1 ? 'candidato' : 'candidatos'} · ${
    cargoEntry.uf ? `UF ${cargoEntry.uf}` : 'Abrangência nacional'
  }`;
  elements.tableCaption.textContent = `Relação de candidatos a ${cargoEntry.cargo} em ${store.getYear()}`;
}

function renderColumnCloudView() {
  renderColumnCloud(elements.columnCloud, store.getColumns(), store.getVisibleColumnKeys(), handleToggleColumn);
}

function renderTableView() {
  const viewModel = {
    columns: store.getColumns(),
    visibleKeys: store.getVisibleColumnKeys(),
    candidates: store.getCandidates(),
    sort: store.getSort(),
    comparedIds: store.getComparedIds(),
    handlers: {
      onSortColumn: handleSortColumn,
      onToggleCompare: handleToggleCompare,
      onOpenCandidate: handleOpenCandidate,
    },
  };
  renderCandidatesTable({ tableElement: elements.table, ...viewModel });
  renderCandidatesCards({ container: elements.cards, ...viewModel });
}

function renderCompareBarView() {
  renderCompareBar(elements.compareBar, elements.compareCount, store.getComparedIds().size, MAX_COMPARISON);
}

function renderCargoView() {
  renderSectionHeader();
  renderColumnCloudView();
  renderTableView();
  renderCompareBarView();
}

/* ------------------------------ handlers ----------------------------- */

function handleToggleColumn(columnKey) {
  store.toggleColumnVisibility(columnKey);
  renderColumnCloudView();
  renderTableView();
}

function handleSortColumn(columnKey) {
  store.toggleSort(columnKey);
  renderTableView();
}

function handleToggleCompare(candidateId, isChecked) {
  if (isChecked) {
    if (store.getComparedIds().size >= MAX_COMPARISON) {
      window.alert(`Você pode comparar no máximo ${MAX_COMPARISON} candidatos.`);
      return false;
    }
    store.addCompared(candidateId);
  } else {
    store.removeCompared(candidateId);
  }
  renderCompareBarView();
  return true;
}

function handleOpenCandidate(candidate) {
  renderCandidateDetail(elements.detail, candidate, closeOverlays);
  elements.scrim.hidden = false;
}

function handleOpenComparison() {
  const selectedCandidates = store.getSelectedCandidates();
  if (selectedCandidates.length === 0) return;
  renderComparisonModal(
    elements.compare,
    { candidates: selectedCandidates, columns: store.getColumns(), cargoLabel: store.getCargoEntry()?.cargo ?? '' },
    closeOverlays,
  );
  elements.scrim.hidden = false;
}

function handleClearComparison() {
  store.clearCompared();
  renderCompareBarView();
  renderTableView();
}

function closeOverlays() {
  elements.detail.hidden = true;
  elements.compare.hidden = true;
  elements.scrim.hidden = true;
  santinhoWizard.close();
}

/* ---------------------------- data loading --------------------------- */

async function loadCargo(cargoName) {
  const cargoEntry = store.getEntries().find((entry) => entry.cargo === cargoName) ?? store.getEntries()[0];
  store.setCargoEntry(cargoEntry);

  const cargoDocument = await repository.getCargo(store.getYear(), cargoEntry.arquivo);
  store.setCargoDocument(cargoDocument);

  const nominalCandidates = cargoDocument.candidatos ?? [];
  const candidates = await Promise.all(
    nominalCandidates.map(async (candidate) =>
      mergeCandidateWithDossier(candidate, await repository.getDossier(store.getYear(), candidate.id)),
    ),
  );
  store.setCandidates(candidates);

  const columns = selectAvailableColumns(candidates);
  store.setColumns(columns);
  store.clearCompared();
  store.setVisibleColumnKeys(
    new Set(DEFAULT_VISIBLE_COLUMN_KEYS.filter((key) => columns.some((column) => column.key === key))),
  );
  store.setSort('nome_urna', 1);

  renderCargoView();
  renderCargoSelector(elements.cargoSelect, store.getEntries(), cargoEntry.cargo);
}

async function loadPopulation() {
  const populationFiles = store.getManifest().populacao ?? [];
  if (populationFiles.length === 0) return;
  const populationDocument = await repository.getPopulation(store.getYear(), populationFiles[0]);
  renderPopulationHero(elements.population, populationDocument);
}

async function loadFooter() {
  const sourcesDocument = await repository.getSources(store.getYear(), store.getManifest().fontes ?? 'fontes.yml');
  renderSourcesFooter(elements.footer, {
    sources: sourcesDocument?.fontes,
    updatedAt: store.getManifest().atualizado_em,
  });
}

async function bootstrap() {
  try {
    const years = await repository.listYears();
    const latestYear = String([...years].sort().at(-1));
    store.setYear(latestYear);

    const manifest = await repository.getManifest(latestYear);
    store.setManifest(manifest);
    store.setEntries(manifest.eleicoes ?? []);
    elements.yearLabel.textContent = latestYear;

    await loadPopulation();
    const initialEntry = store.getEntries().find((entry) => entry.cargo === DEFAULT_CARGO_NAME) ?? store.getEntries()[0];
    await loadCargo(initialEntry.cargo);
    await loadFooter();

    elements.app.hidden = false;
    elements.topbar.hidden = false;
  } catch (error) {
    console.error(error);
    showErrorOverlay(error?.message ?? String(error));
  } finally {
    hideLoadingOverlay(elements.loading);
  }
}

/* ------------------------------- wiring ------------------------------ */

elements.cargoSelect.addEventListener('change', () => loadCargo(elements.cargoSelect.value));
elements.compareOpenButton.addEventListener('click', handleOpenComparison);
elements.compareClearButton.addEventListener('click', handleClearComparison);
elements.santinhoOpen.addEventListener('click', () => santinhoWizard.open());
elements.scrim.addEventListener('click', closeOverlays);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeOverlays();
});

createAssistant();

bootstrap();
