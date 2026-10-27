// Assistente de IA (Google Gemini): ler receitas, substituir ingredientes,
// adaptar receitas, calcular calorias e verificar alergias.

import { state } from './ctx.js';
import { CATEGORIES, CATEGORY_KEYS, DIFFICULTIES, recipeToPrompt, normalizeRecipe } from './util.js';
import { base64Of } from './images.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
export const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACKS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];

export class AIError extends Error {}
export const aiReady = () => !!state.settings.geminiKey;

const SYSTEM = `És o assistente de cozinha da app "Receitas da Família", usada por uma família em Portugal.
Responde sempre em português de Portugal (ex.: "frigorífico", "natas", "pequeno-almoço", "fiambre", "chávena").
Usa o sistema métrico e as medidas caseiras portuguesas. Sê prático, claro e caloroso, sem exageros.
Nunca inventes ingredientes que não estão na receita. Quando uma informação é estimada, di-lo.
Em temas de saúde (diabetes, alergias, doença celíaca) dás orientação culinária geral, não aconselhamento médico.`;

async function call(parts, schema, { temperature = 0.3 } = {}) {
  const key = (state.settings.geminiKey || '').trim();
  if (!key) throw new AIError('Falta a chave do Gemini. Peça a quem gere a app para a colocar em Definições.');
  const models = [...new Set([(state.settings.geminiModel || '').trim() || DEFAULT_MODEL, ...FALLBACKS])];
  let lastErr;
  for (const model of models) {
    let res;
    try {
      res = await fetch(`${ENDPOINT}${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
        }),
      });
    } catch {
      throw new AIError('Sem ligação à internet. O assistente precisa de internet.');
    }
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || '';
    if (res.status === 404 || (res.status === 400 && /model/i.test(msg) && /(not found|not supported|unknown)/i.test(msg))) {
      lastErr = new AIError(`O modelo "${model}" não está disponível.`);
      continue;
    }
    if (!res.ok) {
      if (res.status === 429) throw new AIError('Atingiu o limite gratuito do Gemini por agora. Espere um minuto e tente de novo.');
      if (/API key|API_KEY/i.test(msg)) throw new AIError('A chave do Gemini não é válida. Verifique-a em Definições.');
      if (res.status === 403) throw new AIError('A chave do Gemini não tem autorização para este pedido. ' + msg);
      if (res.status >= 500) throw new AIError('O serviço Gemini está ocupado. Tente daqui a pouco.');
      throw new AIError('O Gemini devolveu um erro: ' + (msg || res.status));
    }
    const cand = body.candidates?.[0];
    if (!cand?.content) {
      throw new AIError(body.promptFeedback?.blockReason ? 'O Gemini recusou este pedido.' : 'O Gemini não devolveu resposta. Tente de novo.');
    }
    const text = (cand.content.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('');
    try { return JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch { /* continua */ } }
      throw new AIError(cand.finishReason === 'MAX_TOKENS'
        ? 'A resposta ficou incompleta (texto demasiado longo). Tente com menos páginas de cada vez.'
        : 'Não consegui interpretar a resposta do Gemini. Tente de novo.');
    }
  }
  throw lastErr || new AIError('Nenhum modelo do Gemini disponível.');
}

// ---------- Esquemas de resposta ----------
const S = (type, extra = {}) => ({ type, ...extra });
const ING = S('OBJECT', {
  properties: {
    qty: S('NUMBER', { nullable: true, description: 'Quantidade numérica; null se não houver (q.b.)' }),
    unit: S('STRING', { description: 'g, kg, ml, l, dl, colher de sopa, colher de chá, chávena, copo, lata, dente, pitada, q.b., ou vazio' }),
    name: S('STRING'),
    note: S('STRING', { description: 'Observação curta, ex.: "picada", "à temperatura ambiente"' }),
    heading: S('BOOLEAN', { description: 'true se for um subtítulo do tipo "Para a massa"' }),
  },
  required: ['name'],
});
const RECIPE = S('OBJECT', {
  properties: {
    title: S('STRING'),
    category: S('STRING', { enum: CATEGORY_KEYS }),
    servings: S('INTEGER', { nullable: true }),
    prepMinutes: S('INTEGER', { nullable: true }),
    cookMinutes: S('INTEGER', { nullable: true }),
    difficulty: S('STRING', { enum: DIFFICULTIES }),
    ingredients: S('ARRAY', { items: ING }),
    steps: S('ARRAY', { items: S('STRING') }),
    tags: S('ARRAY', { items: S('STRING') }),
    notes: S('STRING'),
    source: S('STRING'),
  },
  required: ['title', 'category', 'ingredients', 'steps'],
});

const catHelp = CATEGORIES.map(c => `${c.key} = ${c.label}`).join('; ');

// ---------- 1. Ler receitas de fotos ou texto ----------
export async function extractRecipes({ images = [], text = '' }) {
  const parts = [{
    text: `Transcreve a(s) receita(s) ${images.length ? 'destas fotografias' : 'deste texto'}.
- As fotografias podem ser várias páginas da MESMA receita (junta-as numa só), páginas de um livro, ou receitas escritas à mão. Lê a letra manuscrita com cuidado.
- Mantém as palavras e as quantidades originais; não inventes nada. Corrige só erros evidentes de leitura.
- Separa quantidade (número; frações em decimal, ex.: ½ = 0.5), unidade e nome. Se não houver quantidade ("sal q.b."), usa qty null e unit "q.b.".
- Usa heading=true para subtítulos como "Para a massa".
- Cada passo da preparação é um elemento de "steps". Se o texto for corrido, divide-o em passos lógicos sem alterar o conteúdo.
- Categorias possíveis: ${catHelp}.
- Se as doses não estiverem indicadas, estima-as e menciona isso em "notes". Estima também os tempos se for razoável.
- "tags": 3 a 6 palavras úteis para pesquisa (ex.: natal, forno, rápido, bacalhau, tradicional).
- "source": autor, pessoa ou livro, se estiver visível.
- Se o texto tiver várias receitas diferentes, devolve todas em "recipes".
- Se partes estiverem ilegíveis, explica em "warning". Se não houver receita nenhuma, devolve "recipes" vazio e explica em "warning".`
      + (text ? `\n\nTEXTO:\n${text.slice(0, 60000)}` : ''),
  }];
  for (const img of images) parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Of(img) } });
  const out = await call(parts, S('OBJECT', {
    properties: { recipes: S('ARRAY', { items: RECIPE }), warning: S('STRING') },
    required: ['recipes'],
  }), { temperature: 0.1 });
  return { recipes: (out.recipes || []).map(normalizeRecipe), warning: out.warning || '' };
}

// ---------- 2. Substituir um ingrediente ----------
export async function suggestSubstitutes(recipe, ingredientName, context = '') {
  const out = await call([{
    text: `Receita:\n${recipeToPrompt(recipe)}\n\nNão tenho (ou não posso usar): "${ingredientName}".${context ? `\nInformação adicional: ${context}` : ''}
Sugere 2 a 4 substituições realistas para esta receita, da melhor para a menos boa. Para cada uma indica a quantidade a usar (para as doses da receita), como a usar e o efeito no resultado (sabor, textura, tempo). Se for possível simplesmente omitir o ingrediente, inclui essa opção.`,
  }], S('OBJECT', {
    properties: {
      options: S('ARRAY', {
        items: S('OBJECT', {
          properties: { substitute: S('STRING'), amount: S('STRING'), howTo: S('STRING'), impact: S('STRING') },
          required: ['substitute', 'amount', 'howTo', 'impact'],
        }),
      }),
      tip: S('STRING'),
    },
    required: ['options'],
  }), { temperature: 0.5 });
  return out;
}

// ---------- 3. Adaptar / melhorar a receita ----------
export const ADAPTATIONS = {
  melhorar: { label: 'Melhorar a receita', short: 'melhorada', text: 'Melhora esta receita mantendo a sua identidade: técnica, tempero, tempos, ordem dos passos e pequenos truques que fazem diferença. Não mudes a natureza do prato.' },
  leve: { label: 'Versão mais leve', short: 'mais leve', text: 'Cria uma versão mais leve: menos calorias, gordura e açúcar, mantendo o sabor tanto quanto possível.' },
  gluten: { label: 'Sem glúten (celíacos)', short: 'sem glúten', text: 'Adapta esta receita para ser segura para pessoas com doença celíaca. Substitui TODOS os ingredientes com glúten (farinha de trigo, centeio, cevada, aveia não certificada, pão ralado, massa, cerveja, molhos e caldos industriais) por alternativas sem glúten, com as quantidades certas. Se for um bolo ou massa, ajusta a mistura de farinhas, os líquidos e acrescenta um ligante como goma xantana ou psyllium quando necessário, e indica as mudanças de tempo de forno. Nos avisos, lembra os riscos de contaminação cruzada (utensílios, formas, tábuas, fermento em pó, chocolate, especiarias e enchidos que podem conter glúten) e que se deve confirmar o rótulo "sem glúten" de cada produto.' },
  diabetes: { label: 'Para diabéticos', short: 'para diabéticos', text: 'Adapta esta receita para pessoas com diabetes: reduz açúcares e hidratos de carbono refinados, usa alternativas adequadas (adoçantes próprios para cozinhar, farinhas integrais ou de frutos secos quando fizer sentido), aumenta a fibra e indica uma porção recomendada. Nos avisos, diz que é orientação culinária geral e não substitui o plano alimentar do médico ou nutricionista.' },
  lactose: { label: 'Sem lactose', short: 'sem lactose', text: 'Adapta esta receita para ser sem lactose (ou sem leite, se a quantidade de laticínios for grande): substitui leite, natas, manteiga, queijo e iogurte por alternativas adequadas, com quantidades. Nos avisos, lembra de confirmar os rótulos.' },
  vegetariana: { label: 'Versão vegetariana', short: 'vegetariana', text: 'Cria uma versão vegetariana desta receita, mantendo o espírito do prato e a proteína adequada.' },
};

export async function adaptRecipe(recipe, instruction) {
  const out = await call([{
    text: `Receita original:\n${recipeToPrompt(recipe)}\n\nPedido: ${instruction}
Devolve a receita COMPLETA já adaptada (todos os ingredientes e todos os passos), mantendo o que não precisa de mudar.
Mantém as mesmas doses, salvo se o pedido disser o contrário.
Em "summary" explica numa ou duas frases o que mudou. Em "changes" lista as alterações principais (curtas). Em "warnings" coloca cuidados importantes (pode ficar vazio).`,
  }], S('OBJECT', {
    properties: {
      recipe: RECIPE,
      summary: S('STRING'),
      changes: S('ARRAY', { items: S('STRING') }),
      warnings: S('ARRAY', { items: S('STRING') }),
    },
    required: ['recipe', 'summary', 'changes'],
  }), { temperature: 0.4 });
  return { recipe: normalizeRecipe(out.recipe), summary: out.summary || '', changes: out.changes || [], warnings: out.warnings || [] };
}

// ---------- 4. Pergunta livre ----------
export async function askAboutRecipe(recipe, question) {
  return call([{
    text: `Receita:\n${recipeToPrompt(recipe)}\n\nPergunta: ${question}
Responde de forma prática e breve (no máximo uns 8 parágrafos curtos ou uma lista). Se a resposta implicar mudar a receita, descreve essa mudança numa frase de instrução em "adaptation" (ex.: "Substituir a courgette por beringela na mesma quantidade"); caso contrário deixa "adaptation" vazio.`,
  }], S('OBJECT', {
    properties: { answer: S('STRING'), adaptation: S('STRING') },
    required: ['answer'],
  }), { temperature: 0.5 });
}

// ---------- 5. Calorias e nutrição ----------
export async function computeNutrition(recipe) {
  const out = await call([{
    text: `Receita:\n${recipeToPrompt(recipe)}\n\nEstima a informação nutricional desta receita, usando valores de referência (por ex. a Tabela da Composição de Alimentos do INSA).
- Para cada ingrediente: peso aproximado em gramas usado na receita e calorias (kcal). Ingredientes q.b. (sal, pimenta) conta como quantidades típicas pequenas.
- Se houver fritura, considera só o óleo absorvido.
- Total de calorias da receita inteira e número de doses (usa as doses da receita; se não estiverem indicadas, estima).
- Por dose: kcal, hidratos de carbono, dos quais açúcares, gordura, proteína, fibra e sal, em gramas.
- Em "note" explica em uma frase os pressupostos principais.`,
  }], S('OBJECT', {
    properties: {
      items: S('ARRAY', { items: S('OBJECT', { properties: { name: S('STRING'), grams: S('NUMBER'), kcal: S('NUMBER') }, required: ['name', 'kcal'] }) }),
      totalKcal: S('NUMBER'),
      servings: S('INTEGER'),
      perServing: S('OBJECT', {
        properties: { kcal: S('NUMBER'), carbsG: S('NUMBER'), sugarG: S('NUMBER'), fatG: S('NUMBER'), proteinG: S('NUMBER'), fiberG: S('NUMBER'), saltG: S('NUMBER') },
        required: ['kcal'],
      }),
      note: S('STRING'),
    },
    required: ['items', 'totalKcal', 'servings', 'perServing'],
  }), { temperature: 0.1 });
  return out;
}

// ---------- 6. Alergias e dietas ----------
export const DIET_KEYS = [
  { key: 'gluten', label: 'Celíacos (sem glúten)', group: 'dieta', adapt: 'gluten' },
  { key: 'diabetes', label: 'Diabéticos', group: 'dieta', adapt: 'diabetes' },
  { key: 'lactose', label: 'Sem lactose', group: 'dieta', adapt: 'lactose' },
  { key: 'vegetariano', label: 'Vegetariano', group: 'dieta', adapt: 'vegetariana' },
  { key: 'vegano', label: 'Vegano', group: 'dieta' },
  { key: 'leite', label: 'Leite (proteína do leite)', group: 'alergia' },
  { key: 'ovo', label: 'Ovo', group: 'alergia' },
  { key: 'frutos_casca_rija', label: 'Frutos de casca rija (nozes, amêndoa…)', group: 'alergia' },
  { key: 'amendoim', label: 'Amendoim', group: 'alergia' },
  { key: 'peixe', label: 'Peixe', group: 'alergia' },
  { key: 'crustaceos', label: 'Crustáceos (camarão, caranguejo…)', group: 'alergia' },
  { key: 'moluscos', label: 'Moluscos (amêijoa, lula, polvo…)', group: 'alergia' },
  { key: 'soja', label: 'Soja', group: 'alergia' },
  { key: 'sesamo', label: 'Sésamo', group: 'alergia' },
  { key: 'aipo', label: 'Aipo', group: 'alergia' },
  { key: 'mostarda', label: 'Mostarda', group: 'alergia' },
  { key: 'sulfitos', label: 'Sulfitos (vinho, frutos secos…)', group: 'alergia' },
  { key: 'tremoco', label: 'Tremoço', group: 'alergia' },
];
export const DIET_STATUS = {
  adequado: { label: 'Adequado', cls: 'ok' },
  adaptavel: { label: 'Pode adaptar-se', cls: 'warn' },
  verificar: { label: 'Verificar rótulos', cls: 'warn' },
  nao_adequado: { label: 'Não adequado', cls: 'bad' },
};

export async function checkDiets(recipe) {
  const keys = DIET_KEYS.map(d => `${d.key} (${d.label})`).join('; ');
  const out = await call([{
    text: `Receita:\n${recipeToPrompt(recipe)}\n\nAvalia esta receita para cada uma destas dietas/alergias: ${keys}.
Para cada uma, "status":
- "adequado": pode ser servida tal como está;
- "nao_adequado": contém o ingrediente/alergénio ou não serve para essa dieta e não é fácil de adaptar;
- "adaptavel": não serve tal como está, mas adapta-se bem com substituições;
- "verificar": depende de produtos industriais que podem conter o alergénio (ex.: fermento, caldos, enchidos, chocolate) — é preciso ler os rótulos.
Para dietas (celíacos, diabéticos, sem lactose, vegetariano, vegano) e alergias, "reason" é uma frase curta e "culprits" lista os ingredientes responsáveis.
Para diabéticos, considera a quantidade de açúcar e de hidratos refinados por dose.
"summary": uma ou duas frases com o mais importante.`,
  }], S('OBJECT', {
    properties: {
      items: S('ARRAY', {
        items: S('OBJECT', {
          properties: {
            key: S('STRING', { enum: DIET_KEYS.map(d => d.key) }),
            status: S('STRING', { enum: Object.keys(DIET_STATUS) }),
            reason: S('STRING'),
            culprits: S('ARRAY', { items: S('STRING') }),
          },
          required: ['key', 'status', 'reason'],
        }),
      }),
      summary: S('STRING'),
    },
    required: ['items'],
  }), { temperature: 0.1 });
  return out;
}

// Teste da chave nas Definições.
export async function testKey() {
  const out = await call([{ text: 'Responde só com {"ok": true}.' }], S('OBJECT', { properties: { ok: S('BOOLEAN') }, required: ['ok'] }), { temperature: 0 });
  return !!out.ok;
}
