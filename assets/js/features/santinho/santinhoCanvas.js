/**
 * Draws the "santinho" (a shareable voting card) into a canvas and returns a PNG
 * blob. Candidates are laid out side by side.
 */
const SCALE = 2;
const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif";

const COLORS = {
  bg: '#ffffff',
  header: '#007a2e',
  headerText: '#ffffff',
  accent: '#ffdf00',
  card: '#f5f8f5',
  cardBorder: '#e2e8e3',
  tag: '#009c3b',
  tagText: '#ffffff',
  ink: '#0b0c0c',
  muted: '#484949',
  placeholder: '#d7ddd9',
};

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, '')}…`;
  }
  return lines;
}

function drawTag(ctx, text, x, y) {
  ctx.font = `700 20px ${FONT}`;
  const paddingX = 14;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 32;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = COLORS.tag;
  ctx.fill();
  ctx.fillStyle = COLORS.tagText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + paddingX, y + height / 2 + 1);
}

function drawPhoto(ctx, image, name, centerX, top, size) {
  const x = centerX - size / 2;
  ctx.save();
  roundRect(ctx, x, top, size, size, 22);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, top, size, size);
  } else {
    ctx.fillStyle = COLORS.placeholder;
    ctx.fillRect(x, top, size, size);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = String(name || '?').trim().slice(0, 1).toUpperCase();
    ctx.fillText(initials, centerX, top + size / 2);
  }
  ctx.restore();

  roundRect(ctx, x, top, size, size, 22);
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.accent;
  ctx.stroke();
}

function drawCell(ctx, item, x, y, width, height, image) {
  roundRect(ctx, x, y, width, height, 20);
  ctx.fillStyle = COLORS.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.cardBorder;
  ctx.stroke();

  drawTag(ctx, item.cargo, x + 18, y + 18);

  const photoSize = 176;
  const photoTop = y + 66;
  drawPhoto(ctx, image, item.candidate.nome_urna || item.candidate.nome_completo, x + width / 2, photoTop, photoSize);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 26px ${FONT}`;
  let cursorY = photoTop + photoSize + 40;
  const lines = wrapText(ctx, item.candidate.nome_urna || item.candidate.nome_completo, width - 36, 2);
  for (const line of lines) {
    ctx.fillText(line, x + width / 2, cursorY);
    cursorY += 32;
  }

  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  const number = item.candidate.numero ?? '—';
  ctx.fillText(`${item.candidate.partido || ''} · ${number}`, x + width / 2, cursorY + 6);
}

async function renderSantinho(items, { ano, uf }, includePhotos) {
  const count = items.length;
  const cols = count <= 4 ? count : Math.ceil(count / 2);
  const rows = Math.ceil(count / cols);

  const cellWidth = 300;
  const cellHeight = 420;
  const gap = 24;
  const padding = 48;
  const titleHeight = 168;

  const width = padding * 2 + cols * cellWidth + (cols - 1) * gap;
  const height = titleHeight + padding + rows * cellHeight + (rows - 1) * gap + padding;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.header;
  ctx.fillRect(0, 0, width, titleHeight);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.headerText;
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText('Meu Santinho', padding, 76);
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(`Eleições ${ano}${uf ? ` · ${uf}` : ''}`, padding, 120);

  const images = includePhotos
    ? await Promise.all(items.map((item) => loadImage(item.candidate.foto)))
    : items.map(() => null);

  items.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = padding + col * (cellWidth + gap);
    const y = titleHeight + padding + row * (cellHeight + gap);
    drawCell(ctx, item, x, y, cellWidth, cellHeight, images[index]);
  });

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
        'image/png',
      );
    } catch (error) {
      reject(error);
    }
  });
}

export async function buildSantinhoImage(items, meta) {
  try {
    return await renderSantinho(items, meta, true);
  } catch (error) {
    // Canvas pode ficar "tainted" por fotos de outra origem; refaz sem fotos.
    console.warn('Santinho: refazendo sem fotos.', error);
    return renderSantinho(items, meta, false);
  }
}
