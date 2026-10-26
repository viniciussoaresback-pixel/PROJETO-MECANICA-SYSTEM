// Busca global (Ctrl+K): encontra OS, clientes, veículos e atalhos de qualquer tela.
import { descVeiculo, nomeClienteOS, veiculoOS } from './dominio.js';
import { pode, store } from './store.js';
import { abrirModal, filtrar, html, icone, seloStatus } from './ui.js';
import { fmtNumeroOS, mascaraPlaca, mascaraTelefone, normalizar, ordenarPor, placaLimpa, soDigitos } from './utils.js';

const ACOES = [
  { rotulo: 'Nova ordem de serviço', icone: 'plus', hash: '#/os/nova', termos: 'nova os ordem orçamento abrir' },
  { rotulo: 'Novo cliente', icone: 'user-plus', hash: '#/clientes?novo=1', termos: 'novo cliente cadastrar' },
  { rotulo: 'Novo agendamento', icone: 'calendar-clock', hash: '#/agenda?novo=1', termos: 'agendar agendamento horário' },
  { rotulo: 'Ir para o painel', icone: 'layout-dashboard', hash: '#/painel', termos: 'painel início dashboard' },
  { rotulo: 'Ir para ordens de serviço', icone: 'clipboard-list', hash: '#/os', termos: 'ordens os lista quadro' },
  { rotulo: 'Ir para estoque', icone: 'package', hash: '#/estoque', termos: 'estoque peças produtos' },
  { rotulo: 'Ir para o financeiro', icone: 'wallet', hash: '#/financeiro', termos: 'financeiro caixa receber pagar despesas', permissao: 'financeiro' },
  { rotulo: 'Ir para relatórios', icone: 'chart-column', hash: '#/relatorios', termos: 'relatórios faturamento comissão', permissao: 'relatorios' },
  { rotulo: 'Configurações', icone: 'settings', hash: '#/config', termos: 'configurações oficina logo whatsapp backup' },
];

function buscar(termo) {
  const t = termo.trim();
  const grupos = [];
  if (!t) {
    const recentes = ordenarPor(store.todos('ordens'), (o) => o.atualizadoEm || o.entrada || '', true).slice(0, 5);
    if (recentes.length) grupos.push({ titulo: 'OS recentes', itens: recentes.map(itemOS) });
    grupos.push({ titulo: 'Atalhos', itens: ACOES.filter((a) => !a.permissao || pode(a.permissao)).slice(0, 4).map(itemAcao) });
    return grupos;
  }
  const num = t.replace(/^#/, '');
  const placa = placaLimpa(t);
  const digitos = soDigitos(t);

  let ordens = [];
  if (/^\d{1,6}$/.test(num)) ordens = store.todos('ordens').filter((o) => String(o.numero).includes(String(Number(num))));
  const porTexto = filtrar(store.todos('ordens'), t, (o) => [nomeClienteOS(o), veiculoOS(o).placa, veiculoOS(o).desc]);
  ordens = [...new Map([...ordens, ...porTexto].map((o) => [o.id, o])).values()];
  ordens = ordenarPor(ordens, (o) => o.entrada || '', true).slice(0, 6);
  if (ordens.length) grupos.push({ titulo: 'Ordens de serviço', itens: ordens.map(itemOS) });

  const veiculos = store.todos('veiculos').filter((v) => (placa.length >= 3 && v.placa?.includes(placa)) || normalizar(descVeiculo(v)).includes(normalizar(t))).slice(0, 6);
  if (veiculos.length) {
    grupos.push({
      titulo: 'Veículos',
      itens: veiculos.map((v) => ({ rotulo: `${v.placa ? `${mascaraPlaca(v.placa)} · ` : ''}${descVeiculo(v)}`, detalhe: store.porId('clientes', v.clienteId)?.nome || '', icone: 'car', hash: `#/veiculos/${v.id}` })),
    });
  }

  const clientes = filtrar(store.todos('clientes'), t, (c) => [c.nome, c.telefone, c.documento, c.email])
    .concat(digitos.length >= 4 ? store.todos('clientes').filter((c) => c.telefone?.includes(digitos) || c.documento?.includes(digitos)) : []);
  const unicos = [...new Map(clientes.map((c) => [c.id, c])).values()].slice(0, 6);
  if (unicos.length) {
    grupos.push({ titulo: 'Clientes', itens: unicos.map((c) => ({ rotulo: c.nome, detalhe: mascaraTelefone(c.telefone), icone: c.tipo === 'PJ' ? 'building-2' : 'user', hash: `#/clientes/${c.id}` })) });
  }

  const acoes = ACOES.filter((a) => (!a.permissao || pode(a.permissao)) && normalizar(`${a.rotulo} ${a.termos}`).includes(normalizar(t)));
  if (acoes.length) grupos.push({ titulo: 'Atalhos', itens: acoes.map(itemAcao) });
  return grupos;
}

function itemOS(o) {
  const v = veiculoOS(o);
  return { rotulo: `OS ${fmtNumeroOS(o.numero)} · ${nomeClienteOS(o)}`, detalhe: [v.placa && mascaraPlaca(v.placa), v.desc].filter(Boolean).join(' · '), icone: 'clipboard-list', hash: `#/os/${o.id}`, selo: seloStatus(o.status) };
}
function itemAcao(a) {
  return { rotulo: a.rotulo, icone: a.icone, hash: a.hash };
}

export function abrirBusca() {
  const m = abrirModal({
    titulo: 'Buscar',
    tamanho: 'md',
    classe: 'modal-busca',
    fecharFora: true,
    corpo: html`<div class="busca-campo">${icone('search')}<input type="search" placeholder="Nome do cliente, placa, nº da OS, telefone…" aria-label="Buscar" autofocus></div>
      <div class="busca-resultados" role="listbox"></div>
      <div class="busca-dica"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div>`,
  });
  const input = m.el.querySelector('input');
  const lista = m.el.querySelector('.busca-resultados');
  let itens = [];
  let ativo = 0;
  const desenhar = () => {
    const grupos = buscar(input.value);
    itens = grupos.flatMap((g) => g.itens);
    ativo = 0;
    let i = 0;
    lista.innerHTML = itens.length
      ? String(html`${grupos.map((g) => html`<div class="busca-grupo">${g.titulo}</div>${g.itens.map((it) => {
          const idx = i++;
          return html`<a href="${it.hash}" class="busca-item ${idx === 0 ? 'ativo' : ''}" data-i="${idx}" role="option">${icone(it.icone)}<span class="busca-textos"><span>${it.rotulo}</span>${it.detalhe ? html`<small>${it.detalhe}</small>` : ''}</span>${it.selo || ''}</a>`;
        })}`)}`)
      : String(html`<div class="busca-vazio">Nada encontrado para “${input.value}”.</div>`);
  };
  const marcar = () => {
    for (const el of lista.querySelectorAll('.busca-item')) {
      const sim = Number(el.dataset.i) === ativo;
      el.classList.toggle('ativo', sim);
      if (sim) el.scrollIntoView({ block: 'nearest' });
    }
  };
  input.addEventListener('input', desenhar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ativo = Math.min(itens.length - 1, ativo + 1);
      marcar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ativo = Math.max(0, ativo - 1);
      marcar();
    } else if (e.key === 'Enter' && itens[ativo]) {
      e.preventDefault();
      m.fechar('ok');
      location.hash = itens[ativo].hash;
    }
  });
  lista.addEventListener('click', (e) => {
    if (e.target.closest('.busca-item')) m.fechar('ok');
  });
  desenhar();
}
