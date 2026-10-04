/**
 * Minimal, safe markdown renderer for chat messages.
 * Escapes HTML first, then applies a small subset of markdown
 * (headings, bold, italic, inline code, links, lists and tables).
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
}

function splitCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  if (!line.includes('|') || !line.includes('-')) return false;
  return splitCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function alignments(separator) {
  return splitCells(separator).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return '';
  });
}

function styleAttr(align) {
  return align ? ` style="text-align:${align}"` : '';
}

function renderTable(header, align, rows) {
  const head = header
    .map((cell, index) => `<th${styleAttr(align[index])}>${inline(cell)}</th>`)
    .join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell, index) => `<td${styleAttr(align[index])}>${inline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderMarkdown(text) {
  const lines = escapeHtml(text).split('\n');
  const html = [];
  let listType = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Table: a header row followed by a separator row.
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      closeList();
      const header = splitCells(line);
      const align = alignments(lines[index + 1]);
      const rows = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim() !== '') {
        rows.push(splitCells(lines[cursor]));
        cursor += 1;
      }
      html.push(renderTable(header, align, rows));
      index = cursor - 1;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);

    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (listType !== type) {
        closeList();
        html.push(`<${type}>`);
        listType = type;
      }
      html.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else if (heading) {
      closeList();
      html.push(`<h4>${inline(heading[2])}</h4>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return html.join('');
}
