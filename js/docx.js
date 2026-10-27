// Lê ficheiros Word (.docx) diretamente no telemóvel, sem bibliotecas externas.
// Um .docx é um ficheiro ZIP com o texto em word/document.xml e as imagens em word/media/.

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Este ficheiro não parece ser um documento Word (.docx) válido.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    files.set(name, async () => {
      const ln = dv.getUint16(local + 26, true), le = dv.getUint16(local + 28, true);
      const start = local + 30 + ln + le;
      const data = u8.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return inflate(data);
      throw new Error('Formato de compressão não suportado.');
    });
  }
  return files;
}

function paragraphText(p) {
  let out = '';
  const walk = node => {
    for (const ch of node.childNodes) {
      if (ch.nodeType !== 1) continue;
      const tag = ch.localName;
      if (tag === 't') out += ch.textContent;
      else if (tag === 'tab') out += '\t';
      else if (tag === 'br' || tag === 'cr') out += '\n';
      else if (tag === 'pPr' || tag === 'rPr') continue;
      else walk(ch);
    }
  };
  walk(p);
  const isList = [...p.getElementsByTagNameNS('*', 'numPr')].length > 0;
  return (isList && out.trim() ? '- ' : '') + out;
}

export async function readDocx(file) {
  if (!('DecompressionStream' in window)) throw new Error('Este navegador é antigo demais para ler ficheiros Word. Atualize o Chrome.');
  if (/\.doc$/i.test(file.name)) throw new Error('Ficheiros .doc antigos não são suportados. No Word, use "Guardar como" > .docx.');
  const files = await unzip(await file.arrayBuffer());
  const docEntry = files.get('word/document.xml');
  if (!docEntry) throw new Error('Não encontrei texto neste ficheiro Word.');
  const xml = new TextDecoder().decode(await docEntry());
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  const lines = [];
  for (const node of body ? body.children : []) {
    if (node.localName === 'p') lines.push(paragraphText(node));
    else if (node.localName === 'tbl') {
      for (const tr of node.getElementsByTagNameNS('*', 'tr')) {
        const cells = [...tr.getElementsByTagNameNS('*', 'tc')].map(tc => [...tc.getElementsByTagNameNS('*', 'p')].map(paragraphText).join(' ').trim());
        lines.push(cells.filter(Boolean).join(' | '));
      }
    }
  }
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const images = [];
  for (const [name, get] of files) {
    const m = name.match(/^word\/media\/.+\.(png|jpe?g|gif|webp)$/i);
    if (!m) continue;
    const bytes = await get();
    if (bytes.length < 8000) continue; // ignora ícones e enfeites pequenos
    const mime = m[1].toLowerCase() === 'png' ? 'image/png' : m[1].toLowerCase() === 'gif' ? 'image/gif' : m[1].toLowerCase() === 'webp' ? 'image/webp' : 'image/jpeg';
    images.push(new Blob([bytes], { type: mime }));
  }
  return { text, images };
}

// Leitura simples sem IA: título, ingredientes e preparação por palavras-chave.
export function heuristicRecipe(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = (lines.shift() || 'Receita sem título').replace(/^[-•]\s*/, '');
  const ingredients = [], steps = [], notes = [];
  let mode = 'start';
  for (const l of lines) {
    const n = l.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/^ingredientes\b/.test(n)) { mode = 'ing'; continue; }
    if (/^(modo de )?(preparacao|confecao|confeccao|preparo)\b/.test(n)) { mode = 'steps'; continue; }
    if (mode === 'steps') steps.push(l.replace(/^\d+[.)]\s*/, '').replace(/^[-•]\s*/, ''));
    else if (mode === 'ing') ingredients.push(l);
    else if (/^(\d|[-•½¼¾])/.test(l)) ingredients.push(l);
    else notes.push(l);
  }
  return { title, ingredients, steps, notes: notes.join('\n') };
}
