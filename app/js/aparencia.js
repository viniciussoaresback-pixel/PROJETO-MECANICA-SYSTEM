// Aparência da oficina: cor principal, menu lateral, cantos, letra e espaçamento.
// Fica salva nas configurações da oficina (vale para todos os usuários) e guardada no aparelho
// para já abrir com a cara certa, antes mesmo de carregar os dados.
import { hexParaRgb, paletaDoTema, rgbParaHex, rgbParaHsl } from './cores.js';

export const CORES = [
  { id: 'azul', nome: 'Azul', cor: '#2563eb' },
  { id: 'laranja', nome: 'Laranja', cor: '#ea580c' },
  { id: 'vermelho', nome: 'Vermelho', cor: '#dc2626' },
  { id: 'verde', nome: 'Verde', cor: '#16a34a' },
  { id: 'ciano', nome: 'Ciano', cor: '#0891b2' },
  { id: 'roxo', nome: 'Roxo', cor: '#7c3aed' },
  { id: 'rosa', nome: 'Rosa', cor: '#db2777' },
  { id: 'amarelo', nome: 'Amarelo', cor: '#eab308' },
  { id: 'grafite', nome: 'Grafite', cor: '#475569' },
];

export const FONTES = {
  jakarta: { nome: 'Moderna', familia: "'Plus Jakarta Sans'", google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  inter: { nome: 'Clássica', familia: "'Inter'", google: 'Inter:wght@400;500;600;700;800' },
  poppins: { nome: 'Arredondada', familia: "'Poppins'", google: 'Poppins:wght@400;500;600;700;800' },
  barlow: { nome: 'Esportiva', familia: "'Barlow'", google: 'Barlow:wght@400;500;600;700;800' },
  sistema: { nome: 'Do aparelho', familia: '', google: '' },
};

export const APARENCIA_PADRAO = { cor: '#2563eb', lateral: 'escura', cantos: 'arredondado', fonte: 'jakarta', densidade: 'confortavel' };

export const TEMAS_PRONTOS = [
  { id: 'classico', nome: 'Clássico', descricao: 'Azul e menu escuro', cor: '#2563eb', lateral: 'escura', cantos: 'arredondado', fonte: 'jakarta' },
  { id: 'racing', nome: 'Racing', descricao: 'Vermelho, cantos retos', cor: '#dc2626', lateral: 'escura', cantos: 'reto', fonte: 'barlow' },
  { id: 'garagem', nome: 'Garagem', descricao: 'Laranja forte no menu', cor: '#ea580c', lateral: 'marca', cantos: 'arredondado', fonte: 'inter' },
  { id: 'limpo', nome: 'Limpo', descricao: 'Claro e arejado', cor: '#0891b2', lateral: 'clara', cantos: 'bem', fonte: 'poppins' },
  { id: 'premium', nome: 'Premium', descricao: 'Dourado sobre preto', cor: '#ca8a04', lateral: 'escura', cantos: 'reto', fonte: 'inter' },
  { id: 'eco', nome: 'Ecológico', descricao: 'Verde e menu claro', cor: '#16a34a', lateral: 'clara', cantos: 'arredondado', fonte: 'jakarta' },
  { id: 'neon', nome: 'Neon', descricao: 'Roxo vibrante', cor: '#7c3aed', lateral: 'marca', cantos: 'bem', fonte: 'poppins' },
  { id: 'industrial', nome: 'Industrial', descricao: 'Grafite e amarelo', cor: '#eab308', lateral: 'escura', cantos: 'reto', fonte: 'barlow' },
];

const CHAVE = 'mp:aparencia';
const fontesCarregadas = new Set();

export function normalizarAparencia(ap) {
  const a = { ...APARENCIA_PADRAO, ...(ap || {}) };
  if (!hexParaRgb(a.cor)) a.cor = APARENCIA_PADRAO.cor;
  if (!['escura', 'clara', 'marca'].includes(a.lateral)) a.lateral = 'escura';
  if (!['reto', 'arredondado', 'bem'].includes(a.cantos)) a.cantos = 'arredondado';
  if (!FONTES[a.fonte]) a.fonte = 'jakarta';
  if (!['confortavel', 'compacta'].includes(a.densidade)) a.densidade = 'confortavel';
  return a;
}

function carregarFonte(id) {
  const f = FONTES[id];
  if (!f?.google || fontesCarregadas.has(id)) return;
  fontesCarregadas.add(id);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  document.head.appendChild(link);
}

function bloco(p) {
  return `--acento:${p.acento};--acento-2:${p.acento2};--acento-suave:${p.suave};--acento-txt:${p.texto};--sobre-acento:${p.sobre};--foco:${p.foco};--graf-barra:${p.grafico};--graf-barra-atual:${p.graficoAtual};`;
}

// Monta o CSS do tema. Fica num <style> próprio, depois do app.css.
export function cssDaAparencia(ap) {
  const a = normalizarAparencia(ap);
  const p = paletaDoTema(a.cor);
  const fonte = FONTES[a.fonte].familia;
  const raiz = [
    bloco(p.claro),
    `--acento-impressao:${p.impressao};`,
    `--lateral-marca:${p.lateralMarca};`,
    `--lateral-indicador:${p.escuro.acento};`,
    `--acento-translucido:${p.translucido};`,
    fonte ? `--fonte:${fonte}, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;` : `--fonte:system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;`,
  ].join('');
  return `:root{${raiz}}\n:root[data-tema='escuro']{${bloco(p.escuro)}}`;
}

export function aplicarAparencia(ap, { guardar = true } = {}) {
  const a = normalizarAparencia(ap);
  let el = document.getElementById('mp-aparencia');
  if (!el) {
    el = document.createElement('style');
    el.id = 'mp-aparencia';
    document.head.appendChild(el);
  }
  el.textContent = cssDaAparencia(a);
  const html = document.documentElement;
  html.dataset.lateral = a.lateral;
  html.dataset.cantos = a.cantos;
  html.dataset.densidade = a.densidade;
  carregarFonte(a.fonte);
  if (guardar) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(a));
    } catch {
      /* ok */
    }
  }
  return a;
}

export function aparenciaGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}

// Cor que mais aparece na logo (ignorando branco, preto e tons cinza).
export async function corDaLogo(dataUrl) {
  if (!dataUrl) return null;
  const img = await new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = falha;
    i.src = dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const caixas = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    const [h, s, l] = rgbParaHsl(rgb);
    if (s < 0.25 || l < 0.12 || l > 0.88) continue;
    const chave = Math.round(h / 15);
    const cx = caixas.get(chave) || { n: 0, r: 0, g: 0, b: 0 };
    cx.n += 1;
    cx.r += rgb[0];
    cx.g += rgb[1];
    cx.b += rgb[2];
    caixas.set(chave, cx);
  }
  let melhor = null;
  for (const cx of caixas.values()) if (!melhor || cx.n > melhor.n) melhor = cx;
  if (!melhor || melhor.n < 20) return null;
  return rgbParaHex([melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n]);
}
