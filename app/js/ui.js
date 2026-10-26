// Kit de interface: HTML seguro, ícones, janelas (modais), avisos (toasts), campos e seletor com busca.
import { ICONES } from './icones.js';
import {
  escHTML, fmtDecimal, infoStatus, mascaraCEP, mascaraDocumento, mascaraPlaca, mascaraTelefone, normalizar, parseMoeda,
} from './utils.js';

// ---------- HTML seguro ----------
// Tudo que entra em html`...` é escapado, a não ser que já seja Seguro (outro html`` ou seguro()).
export class Seguro {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const seguro = (s) => new Seguro(String(s ?? ''));

function conv(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(conv).join('');
  return escHTML(v);
}

export function html(partes, ...vals) {
  let s = partes[0];
  for (let i = 0; i < vals.length; i++) s += conv(vals[i]) + partes[i + 1];
  return new Seguro(s);
}

export function icone(nome, classe = '') {
  const c = ICONES[nome] || ICONES['circle-help'];
  return seguro(
    `<svg class="ic ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${c}</svg>`,
  );
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// ---------- Peças visuais reutilizáveis ----------
export function seloStatus(status) {
  const s = infoStatus(status);
  return html`<span class="selo selo-${s.cor}">${icone(s.icone)}${s.nome}</span>`;
}

const SITUACAO_PAG = {
  pago: { nome: 'Pago', cor: 'verde', icone: 'circle-check' },
  parcial: { nome: 'Parcial', cor: 'amarelo', icone: 'clock' },
  pendente: { nome: 'A receber', cor: 'laranja', icone: 'circle-dollar-sign' },
  sem_valor: { nome: 'Sem valor', cor: 'cinza', icone: 'minus' },
};
export function seloPagamento(situacao) {
  const s = SITUACAO_PAG[situacao] || SITUACAO_PAG.pendente;
  return html`<span class="selo selo-${s.cor}">${icone(s.icone)}${s.nome}</span>`;
}

export function placa(p) {
  if (!p) return html`<span class="texto-3">sem placa</span>`;
  return html`<span class="placa">${mascaraPlaca(p)}</span>`;
}

export function vazio({ icone: ic = 'search', titulo, texto = '', acao = '' }) {
  return html`<div class="vazio">
    <div class="vazio-icone">${icone(ic)}</div>
    <h3>${titulo}</h3>
    ${texto ? html`<p>${texto}</p>` : ''}
    ${acao}
  </div>`;
}

export function esqueletoLinhas(n = 6) {
  return html`<div class="esqueleto-lista">${Array.from({ length: n }, () => html`<div class="esqueleto esqueleto-linha"></div>`)}</div>`;
}

export function iniciais(nome) {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

// ---------- Avisos (toasts) ----------
let areaToasts = null;
export function toast(msg, tipo = 'ok', { acao, duracao } = {}) {
  if (!areaToasts) {
    areaToasts = document.createElement('div');
    areaToasts.className = 'toasts';
    areaToasts.setAttribute('role', 'status');
    areaToasts.setAttribute('aria-live', 'polite');
    document.body.appendChild(areaToasts);
  }
  const ic = { ok: 'circle-check', erro: 'circle-alert', aviso: 'triangle-alert', info: 'info' }[tipo] || 'info';
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.innerHTML = html`${icone(ic)}<span class="toast-msg">${msg}</span>${acao ? html`<button type="button" class="toast-acao">${acao.texto}</button>` : ''}<button type="button" class="toast-fechar" aria-label="Fechar aviso">${icone('x')}</button>`;
  areaToasts.appendChild(el);
  const fechar = () => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-fechar').onclick = fechar;
  if (acao) {
    el.querySelector('.toast-acao').onclick = () => {
      fechar();
      acao.fn();
    };
  }
  setTimeout(fechar, duracao || (acao ? 7000 : tipo === 'erro' ? 6500 : 3500));
  return fechar;
}

// ---------- Janelas (modais) ----------
const pilha = [];

export function abrirModal({ titulo, corpo = '', rodape = '', tamanho = 'md', classe = '', aoFechar, fecharFora = false, podeFechar }) {
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  const idTitulo = `mt-${Math.random().toString(36).slice(2, 8)}`;
  fundo.innerHTML = html`<div class="modal modal-${tamanho} ${classe}" role="dialog" aria-modal="true" aria-labelledby="${idTitulo}">
    <header class="modal-cab">
      <h2 id="${idTitulo}">${titulo}</h2>
      <button type="button" class="btn-icone" data-fechar aria-label="Fechar">${icone('x')}</button>
    </header>
    <div class="modal-corpo">${corpo}</div>
    ${rodape ? html`<footer class="modal-rod">${rodape}</footer>` : ''}
  </div>`;
  const anterior = document.activeElement;
  document.body.appendChild(fundo);
  document.body.classList.add('com-modal');
  const modal = fundo.querySelector('.modal');
  let fechado = false;
  const api = {
    el: modal,
    fundo,
    async fechar(motivo) {
      if (fechado) return;
      // Fechou sem salvar (Esc, X, Cancelar)? Pergunta antes de descartar o que foi digitado.
      if (motivo !== 'ok' && podeFechar && !(await podeFechar(motivo))) return;
      if (fechado) return;
      fechado = true;
      const i = pilha.indexOf(api);
      if (i >= 0) pilha.splice(i, 1);
      fundo.classList.add('saindo');
      setTimeout(() => {
        fundo.remove();
        if (!pilha.length) document.body.classList.remove('com-modal');
      }, 160);
      anterior?.focus?.({ preventScroll: true });
      aoFechar?.(motivo);
    },
  };
  pilha.push(api);
  for (const b of modal.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => api.fechar('cancelar'));
  if (fecharFora) {
    fundo.addEventListener('mousedown', (e) => {
      if (e.target === fundo) api.fechar('fora');
    });
  }
  requestAnimationFrame(() => {
    const alvo = modal.querySelector('[autofocus]') || modal.querySelector('.modal-corpo input:not([type=hidden]):not([disabled]), .modal-corpo select, .modal-corpo textarea');
    (alvo || modal.querySelector('.modal-rod .btn-primario') || modal).focus?.({ preventScroll: true });
  });
  return api;
}

export function modalAberto() {
  return pilha.length > 0;
}

export function fecharModalTopo() {
  const m = pilha[pilha.length - 1];
  if (m) {
    m.fechar('esc');
    return true;
  }
  return false;
}

export function confirmar({ titulo = 'Confirmar', texto = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false, detalhe = '' } = {}) {
  return new Promise((resolve) => {
    let resposta = false;
    const m = abrirModal({
      titulo,
      tamanho: 'sm',
      corpo: html`<p class="confirmar-texto">${texto}</p>${detalhe ? html`<p class="texto-3 mt-1">${detalhe}</p>` : ''}`,
      rodape: html`<button type="button" class="btn" data-fechar>${cancelar}</button>
        <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-ok autofocus>${ok}</button>`,
      aoFechar: () => resolve(resposta),
    });
    m.el.querySelector('[data-ok]').onclick = () => {
      resposta = true;
      m.fechar('ok');
    };
  });
}

// Pergunta com várias opções. Retorna o id escolhido ou null.
export function escolher({ titulo, texto = '', opcoes }) {
  return new Promise((resolve) => {
    let resposta = null;
    const m = abrirModal({
      titulo,
      tamanho: 'sm',
      corpo: html`${texto ? html`<p class="confirmar-texto">${texto}</p>` : ''}`,
      rodape: html`${opcoes.map((o) => html`<button type="button" class="btn ${o.classe || ''}" data-op="${o.id}">${o.icone ? icone(o.icone) : ''}${o.texto}</button>`)}`,
      aoFechar: () => resolve(resposta),
    });
    for (const b of m.el.querySelectorAll('[data-op]')) {
      b.onclick = () => {
        resposta = b.dataset.op;
        m.fechar('ok');
      };
    }
  });
}

// ---------- Menu suspenso ----------
let menuAberto = null;
export function abrirMenu(botao, itens) {
  fecharMenu();
  const menu = document.createElement('div');
  menu.className = 'menu-suspenso';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = html`${itens.filter(Boolean).map((it, i) =>
    it === '-' ? html`<hr>` : html`<button type="button" role="menuitem" class="${it.perigo ? 'perigo' : ''}" data-i="${i}" ${it.desabilitado ? seguro('disabled') : ''}>${it.icone ? icone(it.icone) : ''}<span>${it.texto}</span></button>`,
  )}`;
  document.body.appendChild(menu);
  const r = botao.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = r.right - mw;
  if (left < 8) left = Math.min(r.left, window.innerWidth - mw - 8);
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${top}px`;
  const lista = itens.filter(Boolean);
  for (const b of menu.querySelectorAll('button[data-i]')) {
    b.onclick = (e) => {
      e.stopPropagation();
      const it = lista[Number(b.dataset.i)];
      fecharMenu();
      it.fn?.();
    };
  }
  menuAberto = menu;
  setTimeout(() => menu.querySelector('button')?.focus({ preventScroll: true }), 0);
}
export function fecharMenu() {
  if (menuAberto) {
    menuAberto.remove();
    menuAberto = null;
    return true;
  }
  return false;
}
document.addEventListener('mousedown', (e) => {
  if (menuAberto && !menuAberto.contains(e.target)) fecharMenu();
});
window.addEventListener('resize', () => fecharMenu());

// ---------- Campos de formulário ----------
// Gera rótulo + campo. tipo: text, email, tel, number, date, time, datetime-local, select, textarea, moeda, checkbox.
export function campo({
  rotulo, nome, tipo = 'text', valor = '', ajuda = '', obrigatorio = false, opcoes = [], placeholder = '', classe = '',
  mascara = '', lista = '', min, max, passo, linhas = 3, autofocus = false, desabilitado = false, extra = '',
}) {
  const id = `c-${nome}-${Math.random().toString(36).slice(2, 7)}`;
  const req = obrigatorio ? seguro(' required') : '';
  const af = autofocus ? seguro(' autofocus') : '';
  const dis = desabilitado ? seguro(' disabled') : '';
  const ext = seguro(extra);
  let controle;
  if (tipo === 'select') {
    controle = html`<select id="${id}" name="${nome}"${req}${af}${dis}${ext}>${opcoes.map((o) => {
      const v = typeof o === 'object' ? o.valor : o;
      const t = typeof o === 'object' ? o.texto : o;
      return html`<option value="${v}" ${String(v) === String(valor ?? '') ? seguro('selected') : ''}>${t}</option>`;
    })}</select>`;
  } else if (tipo === 'textarea') {
    controle = html`<textarea id="${id}" name="${nome}" rows="${linhas}" placeholder="${placeholder}"${req}${af}${dis}${ext}>${valor ?? ''}</textarea>`;
  } else if (tipo === 'checkbox') {
    return html`<label class="campo-check ${classe}"><input type="checkbox" name="${nome}" ${valor ? seguro('checked') : ''}${dis}${ext}><span>${rotulo}</span></label>`;
  } else if (tipo === 'moeda') {
    const v = valor === '' || valor == null ? '' : fmtDecimal(valor);
    controle = html`<div class="campo-prefixo"><span>R$</span><input id="${id}" name="${nome}" type="text" inputmode="decimal" data-tipo="moeda" data-mascara="moeda" value="${v}" placeholder="${placeholder || '0,00'}" autocomplete="off"${req}${af}${dis}${ext}></div>`;
  } else {
    const attrs = [
      min != null ? `min="${escHTML(min)}"` : '',
      max != null ? `max="${escHTML(max)}"` : '',
      passo != null ? `step="${escHTML(passo)}"` : '',
      mascara ? `data-mascara="${escHTML(mascara)}"` : '',
      lista ? `list="${escHTML(lista)}"` : '',
      tipo === 'number' ? 'inputmode="decimal"' : '',
      mascara === 'telefone' ? 'inputmode="tel"' : '',
      mascara === 'documento' || mascara === 'cep' ? 'inputmode="numeric"' : '',
    ].filter(Boolean).join(' ');
    controle = html`<input id="${id}" name="${nome}" type="${tipo}" value="${valor ?? ''}" placeholder="${placeholder}" ${seguro(attrs)}${req}${af}${dis}${ext}>`;
  }
  return html`<div class="campo ${classe}">
    <label for="${id}">${rotulo}${obrigatorio ? html`<span class="obrig" aria-hidden="true">*</span>` : ''}</label>
    ${controle}
    ${ajuda ? html`<small class="campo-ajuda">${ajuda}</small>` : ''}
    <small class="campo-erro" hidden></small>
  </div>`;
}

export function lerFormulario(form) {
  const dados = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.disabled) continue;
    const n = el.name;
    if (el.type === 'checkbox') dados[n] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) dados[n] = el.value;
    } else if (el.dataset.tipo === 'moeda') dados[n] = el.value.trim() === '' ? null : parseMoeda(el.value);
    else if (el.type === 'number') dados[n] = el.value === '' ? null : Number(el.value);
    else dados[n] = el.value.trim();
  }
  return dados;
}

export function erroCampo(form, nome, msg) {
  const el = form.querySelector(`[name="${nome}"]`);
  if (!el) return;
  const box = el.closest('.campo');
  const alvo = box?.querySelector('.campo-erro');
  el.classList.toggle('invalido', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (alvo) {
    alvo.textContent = msg || '';
    alvo.hidden = !msg;
  }
  if (msg) el.focus();
}

// Marca o erro no campo e devolve false (para usar em "return falhaCampo(...)" nas validações).
export function falhaCampo(form, nome, msg) {
  erroCampo(form, nome, msg);
  return false;
}

export function limparErros(form) {
  for (const el of form.querySelectorAll('.invalido')) {
    el.classList.remove('invalido');
    el.removeAttribute('aria-invalid');
  }
  for (const e of form.querySelectorAll('.campo-erro')) {
    e.hidden = true;
    e.textContent = '';
  }
}

// Máscaras: um só ouvinte para a página inteira (campos com data-mascara).
const MASCARAS = { telefone: mascaraTelefone, documento: mascaraDocumento, cep: mascaraCEP, placa: mascaraPlaca };
document.addEventListener('input', (e) => {
  const el = e.target;
  const m = el?.dataset?.mascara;
  if (!m) return;
  if (m === 'moeda') {
    el.value = el.value.replace(/[^\d,.]/g, '');
    return;
  }
  const fn = MASCARAS[m];
  if (!fn) return;
  const antes = el.value;
  const novo = fn(antes);
  if (novo !== antes) {
    const fimAntes = el.selectionStart === antes.length;
    el.value = novo;
    if (fimAntes) el.setSelectionRange(novo.length, novo.length);
  }
});
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (el?.dataset?.mascara === 'moeda' && el.value.trim() !== '') el.value = fmtDecimal(parseMoeda(el.value));
});

// ---------- Seletor com busca (cliente, veículo, peça…) ----------
// fonte(termo) -> [{ id, rotulo, detalhe, icone }]; extras: [{ id, rotulo, icone }] sempre no fim (ex.: "Cadastrar novo").
export function seletor(input, { fonte, aoEscolher, extras = () => [], minimo = 0, limite = 8 }) {
  const caixa = document.createElement('div');
  caixa.className = 'seletor-lista';
  caixa.setAttribute('role', 'listbox');
  caixa.hidden = true;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  const pai = input.closest('.seletor') || input.parentElement;
  pai.classList.add('seletor');
  pai.appendChild(caixa);
  let itens = [];
  let ativo = -1;
  let timerFechar = null;

  function desenhar() {
    // Cancela um "fechar" pendente de um blur anterior (pessoa voltou rápido para o campo).
    clearTimeout(timerFechar);
    const termo = input.value;
    const base = termo.length >= minimo ? fonte(termo).slice(0, limite) : [];
    itens = [...base, ...extras(termo)];
    ativo = itens.length ? 0 : -1;
    if (!itens.length) {
      caixa.innerHTML = html`<div class="seletor-vazio">Nada encontrado</div>`;
    } else {
      caixa.innerHTML = html`${itens.map((it, i) => html`<div class="seletor-item ${it.extra ? 'extra' : ''} ${i === ativo ? 'ativo' : ''}" role="option" data-i="${i}">
        ${it.icone ? icone(it.icone) : ''}<div><div class="seletor-rotulo">${it.rotulo}</div>${it.detalhe ? html`<div class="seletor-detalhe">${it.detalhe}</div>` : ''}</div>
      </div>`)}`;
    }
    caixa.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function fechar() {
    caixa.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }
  function escolherItem(i) {
    const it = itens[i];
    if (!it) return;
    fechar();
    aoEscolher(it);
  }
  function marcar() {
    caixa.querySelectorAll('.seletor-item').forEach((el, i) => {
      el.classList.toggle('ativo', i === ativo);
      if (i === ativo) el.scrollIntoView({ block: 'nearest' });
    });
  }
  input.addEventListener('focus', desenhar);
  input.addEventListener('input', desenhar);
  input.addEventListener('keydown', (e) => {
    if (caixa.hidden && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      if (e.key === 'ArrowDown') desenhar();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ativo = Math.min(itens.length - 1, ativo + 1);
      marcar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ativo = Math.max(0, ativo - 1);
      marcar();
    } else if (e.key === 'Enter') {
      if (ativo >= 0) {
        e.preventDefault();
        escolherItem(ativo);
      }
    } else if (e.key === 'Escape') {
      if (!caixa.hidden) {
        e.stopPropagation();
        fechar();
      }
    }
  });
  caixa.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.seletor-item');
    if (!el) return;
    e.preventDefault();
    escolherItem(Number(el.dataset.i));
  });
  input.addEventListener('blur', () => {
    timerFechar = setTimeout(fechar, 120);
  });
  return { fechar, abrir: desenhar };
}

// Filtra uma lista por termo (várias palavras, sem acento).
export function filtrar(lista, termo, textosDe) {
  const t = normalizar(termo);
  if (!t) return lista;
  const partes = t.split(/\s+/);
  return lista.filter((x) => {
    const alvo = normalizar(textosDe(x).filter(Boolean).join(' '));
    return partes.every((p) => alvo.includes(p));
  });
}

// Debounce simples (busca).
export function atrasar(fn, ms = 150) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// Baixa um arquivo gerado no navegador.
export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

// Abre link externo (WhatsApp etc.) em outra aba.
export function abrirExterno(url) {
  // Com 'noopener' o window.open sempre devolve null; por isso cortamos o opener depois.
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  else location.href = url;
}
