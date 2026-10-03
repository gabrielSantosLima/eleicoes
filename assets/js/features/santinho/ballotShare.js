/**
 * Sharing via the Web Share API.
 */
export function isShareSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function canShareFile(file) {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/**
 * Share the santinho image (preferred) or its text description.
 * Returns 'file' | 'text' depending on what the browser accepted.
 */
export async function shareSantinho(blob, { title, text, fileName }) {
  if (!isShareSupported()) {
    throw new Error('Compartilhamento não disponível neste navegador.');
  }

  if (blob) {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (canShareFile(file)) {
      await navigator.share({ files: [file], title, text });
      return 'file';
    }
  }

  await navigator.share({ title, text });
  return 'text';
}
