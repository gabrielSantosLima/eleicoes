/**
 * "Criar Meu Santinho" wizard.
 *
 * Guides the voter through one step per cargo (in ballot order), lets them skip
 * any cargo, reviews the choices and exports a shareable image via Web Share.
 */
import { createElement, createFragmentFromHtml, replaceContent } from '../../core/dom.js';
import { createBallotStore } from './ballotStore.js';
import { buildSantinhoImage } from './santinhoCanvas.js';
import { shareSantinho, isShareSupported } from './ballotShare.js';

const VOTE_ORDER = ['Presidente', 'Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual', 'Deputado Distrital'];
const SENATOR_SEATS = 2;
const MAX_LISTED = 80;

function matchesQuery(candidate, query) {
  if (!query) return true;
  const haystack = `${candidate.nome_urna || ''} ${candidate.nome_completo || ''} ${candidate.partido || ''} ${candidate.numero ?? ''}`;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export function createSantinhoWizard({ repository, electionStore, container, scrim }) {
  const store = createBallotStore();
  const state = {
    year: null,
    uf: null,
    cargos: [],
    candidatesByCargo: {},
    steps: [],
    stepIndex: 0,
    query: '',
    previewUrl: null,
    error: null,
  };

  function context() {
    const entries = electionStore.getEntries();
    state.year = electionStore.getYear();
    state.uf = entries.find((entry) => entry.uf)?.uf ?? null;
    state.cargos = VOTE_ORDER.map((name) => entries.find((entry) => entry.cargo === name)).filter(Boolean);
  }

  async function loadCandidates() {
    const results = await Promise.all(
      state.cargos.map(async (entry) => [entry.cargo, (await repository.getCargo(state.year, entry.arquivo)).candidatos ?? []]),
    );
    state.candidatesByCargo = Object.fromEntries(results);
  }

  function buildSteps() {
    state.steps = [
      { type: 'welcome' },
      ...state.cargos.map((entry) => ({ type: 'cargo', cargo: entry.cargo })),
      { type: 'review' },
      { type: 'export' },
    ];
  }

  function maxSeats(cargo) {
    return cargo === 'Senador' ? SENATOR_SEATS : 1;
  }

  /* ------------------------------- helpers ------------------------------ */

  function navButton(label, { primary = false, disabled = false, onClick } = {}) {
    const button = createElement(
      'button',
      { class: `wizard__btn${primary ? ' wizard__btn--primary' : ''}`, type: 'button', disabled: disabled ? 'disabled' : null },
      label,
    );
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  function goTo(index) {
    state.stepIndex = Math.max(0, Math.min(index, state.steps.length - 1));
    state.query = '';
    state.error = null;
    render();
  }

  function pickedCandidates(cargo) {
    const ids = store.getPick(cargo);
    const list = state.candidatesByCargo[cargo] ?? [];
    return ids.map((id) => list.find((candidate) => candidate.id === id)).filter(Boolean);
  }

  /* ------------------------------ rendering ----------------------------- */

  function render() {
    context(); // keep cargo list in sync in case the year changed
    if (state.steps.length === 0) buildSteps();
    const step = state.steps[state.stepIndex];
    const panel = createElement('div', { class: 'wizard__panel' });

    const closeButton = createElement('button', { class: 'close', type: 'button', 'aria-label': 'Fechar' }, '×');
    closeButton.addEventListener('click', close);
    panel.append(
      createElement('div', { class: 'wizard__bar' }, [
        closeButton,
        createElement('span', { class: 'wizard__progress' }, `Passo ${state.stepIndex + 1} de ${state.steps.length}`),
      ]),
    );

    if (step.type === 'welcome') panel.append(renderWelcome());
    else if (step.type === 'cargo') panel.append(renderCargo(step.cargo));
    else if (step.type === 'review') panel.append(renderReview());
    else panel.append(renderExport());

    if (state.error) panel.append(createElement('p', { class: 'wizard__error' }, state.error));

    replaceContent(container, panel);
  }

  function renderWelcome() {
    const content = createElement('div', { class: 'wizard__step' }, [
      createElement('h2', { class: 'wizard__title' }, 'Criar meu santinho'),
      createElement('p', { class: 'wizard__hint' }, [
        'Monte sua lista de voto escolhendo um candidato por cargo (e dois para Senador). ',
        'Você pode pular os cargos que não quiser. No fim, compartilhe seu santinho como imagem.',
      ]),
    ]);
    content.append(
      createElement('div', { class: 'wizard__nav' }, [
        navButton('Começar', { primary: true, onClick: () => goTo(1) }),
      ]),
    );
    return content;
  }

  function renderCargo(cargo) {
    const seats = maxSeats(cargo);
    const content = createElement('div', { class: 'wizard__step' });
    content.append(createElement('h2', { class: 'wizard__title' }, cargo));
    content.append(
      createElement(
        'p',
        { class: 'wizard__hint' },
        seats > 1 ? `Escolha até ${seats} candidatos diferentes (ou pule).` : 'Escolha um candidato (ou pule).',
      ),
    );

    const search = createElement('input', {
      class: 'wizard__search',
      type: 'search',
      placeholder: 'Buscar por nome, número ou partido',
      value: state.query,
      'aria-label': 'Buscar candidato',
    });
    content.append(search);

    const list = createElement('div', { class: 'wizard__list' });
    content.append(list);

    function refreshList() {
      const pickedIds = store.getPick(cargo);
      const filtered = (state.candidatesByCargo[cargo] ?? []).filter((candidate) => matchesQuery(candidate, state.query));
      const shown = filtered.slice(0, MAX_LISTED);

      const rows = shown.map((candidate) => {
        const isPicked = pickedIds.includes(candidate.id);
        const row = createElement('button', {
          class: `wizard__candidate${isPicked ? ' is-picked' : ''}`,
          type: 'button',
          'aria-pressed': isPicked ? 'true' : 'false',
        });
        const photo = candidate.foto
          ? createElement('img', { class: 'wizard__candidate-photo', src: candidate.foto, alt: '', loading: 'lazy' })
          : createElement('span', { class: 'wizard__candidate-photo cell-muted' }, '—');
        row.append(
          photo,
          createElement('span', { class: 'wizard__candidate-name' }, candidate.nome_urna || candidate.nome_completo || '—'),
          createElement('span', { class: 'wizard__candidate-meta' }, `${candidate.partido || ''} · ${candidate.numero ?? '—'}`),
        );
        row.addEventListener('click', () => togglePick(cargo, candidate.id, seats, refreshList));
        return row;
      });

      const footer = filtered.length > shown.length
        ? createElement('p', { class: 'wizard__hint' }, `Mostrando ${shown.length} de ${filtered.length}. Refine a busca.`)
        : null;

      replaceContent(list, [rows.length ? rows : createElement('p', { class: 'wizard__empty' }, 'Nenhum candidato encontrado.'), footer]);
    }

    search.addEventListener('input', () => {
      state.query = search.value;
      refreshList();
    });
    refreshList();

    content.append(
      createElement('div', { class: 'wizard__nav' }, [
        navButton('Voltar', { onClick: () => goTo(state.stepIndex - 1) }),
        navButton('Pular', { onClick: () => goTo(state.stepIndex + 1) }),
        navButton('Próximo', { primary: true, onClick: () => goTo(state.stepIndex + 1) }),
      ]),
    );
    return content;
  }

  function togglePick(cargo, id, seats, refreshList) {
    const current = store.getPick(cargo);
    let next;
    if (current.includes(id)) {
      next = current.filter((value) => value !== id);
    } else if (current.length >= seats) {
      state.error = seats > 1 ? `Você só pode escolher ${seats} candidatos.` : 'Escolha apenas um candidato.';
      return;
    } else {
      next = [...current, id];
    }
    state.error = null;
    store.setPick(cargo, next);
    refreshList();
  }

  function renderReview() {
    const content = createElement('div', { class: 'wizard__step' });
    content.append(createElement('h2', { class: 'wizard__title' }, 'Revisão'));
    content.append(createElement('p', { class: 'wizard__hint' }, 'Confira sua lista. Toque em "editar" para trocar.'));

    const list = createElement('div', { class: 'wizard__review' });
    state.cargos.forEach((entry, index) => {
      const picked = pickedCandidates(entry.cargo);
      const stepNumber = index + 1; // welcome is step 0
      const item = createElement('div', { class: 'wizard__review-item' });
      const edit = createElement('button', { class: 'wizard__link', type: 'button' }, 'editar');
      edit.addEventListener('click', () => goTo(stepNumber));

      item.append(createElement('div', { class: 'wizard__review-head' }, [createElement('span', { class: 'wizard__review-cargo' }, entry.cargo), edit]));
      if (picked.length === 0) {
        item.append(createElement('span', { class: 'wizard__empty' }, 'Não escolhido (pulado).'));
      } else {
        item.append(
          createElement('ul', { class: 'wizard__review-list' }, picked.map((candidate) =>
            createElement('li', {}, `${candidate.nome_urna || candidate.nome_completo} — ${candidate.partido || ''} · ${candidate.numero ?? '—'}`),
          )),
        );
      }
      list.append(item);
    });
    content.append(list);

    content.append(
      createElement('div', { class: 'wizard__nav' }, [
        navButton('Voltar', { onClick: () => goTo(state.stepIndex - 1) }),
        navButton('Gerar santinho', { primary: true, onClick: () => goTo(state.stepIndex + 1) }),
      ]),
    );
    return content;
  }

  function buildExportItems() {
    const items = [];
    for (const entry of state.cargos) {
      for (const candidate of pickedCandidates(entry.cargo)) {
        items.push({ cargo: entry.cargo, candidate });
      }
    }
    return items;
  }

  function renderExport() {
    const content = createElement('div', { class: 'wizard__step' });
    content.append(createElement('h2', { class: 'wizard__title' }, 'Seu santinho'));
    const items = buildExportItems();

    if (items.length === 0) {
      content.append(createElement('p', { class: 'wizard__hint' }, 'Você não escolheu nenhum candidato. Volte e selecione ao menos um.'));
    } else {
      const preview = createElement('div', { class: 'wizard__preview' });
      preview.append(createElement('p', { class: 'wizard__hint' }, 'Gerando imagem…'));
      content.append(preview);

      buildSantinhoImage(items, { ano: state.year, uf: state.uf })
        .then((blob) => {
          if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
          state.previewUrl = URL.createObjectURL(blob);
          replaceContent(preview, createElement('img', { src: state.previewUrl, alt: 'Prévia do santinho' }));
          state.blob = blob;
          shareButton.disabled = false;
        })
        .catch(() => replaceContent(preview, createElement('p', { class: 'wizard__error' }, 'Não foi possível gerar a imagem.')));
    }

    const shareSupported = isShareSupported();
    const shareButton = navButton('Compartilhar', {
      primary: true,
      disabled: !shareSupported,
      onClick: () => handleShare(items),
    });

    const nav = createElement('div', { class: 'wizard__nav' }, [navButton('Voltar', { onClick: () => goTo(state.stepIndex - 1) }), shareButton]);
    content.append(nav);

    if (!shareSupported) {
      content.append(createElement('p', { class: 'wizard__hint' }, 'Compartilhamento não disponível neste navegador.'));
    }
    return content;
  }

  async function handleShare(items) {
    state.error = null;
    try {
      const text = [
        `Meu Santinho — Eleições ${state.year}`,
        ...items.map((item) => `${item.cargo}: ${item.candidate.nome_urna || item.candidate.nome_completo} (${item.candidate.partido || ''}, ${item.candidate.numero ?? '—'})`),
      ].join('\n');
      await shareSantinho(state.blob, { title: `Meu Santinho ${state.year}`, text, fileName: `meu-santinho-${state.year}.png` });
    } catch (error) {
      if (error && error.name === 'AbortError') return; // user cancelled the share sheet
      state.error = error?.message ?? 'Não foi possível compartilhar.';
      render();
    }
  }

  /* ------------------------------- lifecycle ---------------------------- */

  async function open() {
    container.hidden = false;
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    replaceContent(container, createElement('div', { class: 'wizard__panel' }, createElement('p', { class: 'wizard__hint' }, 'Carregando…')));
    context();
    if (!store.matches(state.year, state.uf)) store.start(state.year, state.uf);
    if (Object.keys(state.candidatesByCargo).length === 0) {
      await loadCandidates();
    }
    buildSteps();
    state.stepIndex = 0;
    render();
  }

  function close() {
    container.hidden = true;
    scrim.hidden = true;
    document.body.style.overflow = '';
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
    state.blob = null;
  }

  return { open, close };
}
