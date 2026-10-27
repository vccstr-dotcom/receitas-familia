// Reduz e comprime fotografias para caberem na base de dados (máx. ~900 KB por foto).

const MAX_CHARS = 900_000;

async function loadBitmap(src) {
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* usa o método antigo */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    return im;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function draw(bmp, maxSide, quality) {
  const w = bmp.width, h = bmp.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bmp, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', quality);
}

// Devolve um "data URL" JPEG. maxSide = lado maior em píxeis.
export async function compressImage(src, maxSide = 1600, quality = 0.82) {
  const bmp = await loadBitmap(src);
  let side = maxSide, q = quality, out = draw(bmp, side, q);
  while (out.length > MAX_CHARS && side > 500) {
    side = Math.round(side * 0.8);
    q = Math.max(0.6, q - 0.06);
    out = draw(bmp, side, q);
  }
  bmp.close?.();
  return out;
}

export const makeThumb = src => compressImage(src, 360, 0.72);

export function dataUrlToFile(dataUrl, name = 'foto.jpg') {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

export const base64Of = dataUrl => dataUrl.split(',')[1];
