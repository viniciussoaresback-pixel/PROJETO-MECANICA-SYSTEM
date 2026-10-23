// Ordens de serviço: lista com filtros e quadro (kanban) com arrastar e soltar.
import { mudarStatusOS } from '../acoes-os.js';
import { nomeClienteOS, nomeEquipe, veiculoOS } from '../dominio.js';
import { pode, store } from '../store.js';
import { abrirMenu, atrasar, filtrar, html, icone, iniciais, placa, seloPagamento, seloStatus, vazio } from '../ui.js';
import {
  addDias, addMeses, calcularOS, dentroPeriodo, fmtData, fmtMoeda, fmtNumeroOS, hojeISO, mesAtual, ordenarPor, primeiroDiaMes,
  STATUS_ABERTOS, STATUS_OS, ultimoDiaMes,
} from '../utils.js';

const PERIODOS = [
  { id: 'todos', nome: 'Qualquer data' },
  { id: 'hoje', nome: 'Hoje' },
  { id: '7', nome: 'Últimos 7 dias' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes_passado', nome: 'Mês passado' },
  { id: '90', nome: 'Últimos 90 dias' },
];

function intervalo(periodo) {
  const hoje = hojeISO();
  if (periodo === 'hoje') return [hoje, hoje];
  if (periodo === '7') return [addDias(hoje, -6), hoje];
  if (periodo === '90') return [addDias(hoje, -89), hoje];
  if (periodo === 'mes') return [primeiroDiaMes(mesAtual()), ultimoDiaMes(mesAtual())];
  if (periodo === 'mes_passado') {
    const m = addMeses(mesAtual(), -1);
    return [primeiroDiaMes(m), ultimoDiaMes(m)];
  }
  return [null, null];
}

function lerPref(chave, padrao) {
  try {
    return localStorage.getItem(chave) || padrao;
  } catch {
    return padrao;
  }
}
function gravarPref(chave, v) {
  try {
    localStorage.setItem(chave, v);
  } catch {
    /* ok */
  }
}

export default {
  montar(el, { query }) {
    let visao = query.visao || lerPref('mp:os-visao', window.innerWidth < 760 ? 'lista' : 'quadro');
    let status = query.status || 'abertas';
    if (query.status) visao = 'lista';
    let periodo = query.periodo || 'todos';
    let termo = query.q || '';
    let limite = 60;
    const mostraValores = pode('valores');

    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="campo-busca">${icone('search')}<input type="search" data-busca placeholder="Buscar por nº, cliente, placa ou modelo…" value="${termo}" aria-label="Buscar ordens"></div>
        <select data-periodo aria-label="Período" style="width:auto">${PERIODOS.map((p) => html`<option value="${p.id}">${p.nome}</option>`)}</select>
        <div class="segmentado" role="radiogroup" aria-label="Visualização">
          <label><input type="radio" name="visao" value="quadro"><span>${icone('columns-3')}<span class="so-largo">Quadro</span></span></label>
          <label><input type="radio" name="visao" value="lista"><span>${icone('list')}<span class="so-largo">Lista</span></span></label>
        </div>
        <span class="espaco"></span>
        <a class="btn btn-primario so-largo-flex" href="#/os/nova">${icone('plus')}Nova OS</a>
      </div>
      <div class="chips chips-rolagem" data-chips></div>
      <div data-resultado></div>
    </div>`);

    const $busca = el.querySelector('[data-busca]');
    const $periodo = el.querySelector('[data-periodo]');
    const $chips = el.querySelector('[data-chips]');
    const $res = el.querySelector('[data-resultado]');
    $periodo.value = periodo;

    function base() {
      const [ini, fim] = intervalo(periodo);
      let lista = store.todos('ordens');
      if (ini) lista = lista.filter((o) => dentroPeriodo(o.entrada, ini, fim));
      if (termo) {
        const num = termo.replace(/^#/, '').trim();
        lista = /^\d+$/.test(num)
          ? lista.filter((o) => String(o.numero).includes(String(Number(num))) || veiculoOS(o).placa.includes(num))
          : filtrar(lista, termo, (o) => [nomeClienteOS(o), veiculoOS(o).placa, veiculoOS(o).desc, o.relato, nomeEquipe(o.mecanicoId)]);
      }
      return lista;
    }

    function desenharChips(lista) {
      if (visao === 'quadro') {
        $chips.hidden = true;
        return;
      }
      $chips.hidden = false;
      const conta = (f) => lista.filter(f).length;
      const chips = [
        { id: 'abertas', nome: 'Em aberto', n: conta((o) => STATUS_ABERTOS.includes(o.status)) },
        { id: 'todas', nome: 'Todas', n: lista.length },
        ...STATUS_OS.map((s) => ({ id: s.id, nome: s.nome, n: conta((o) => o.status === s.id) })),
        { id: 'receber', nome: 'Com saldo a receber', n: conta((o) => ['pronta', 'entregue'].includes(o.status) && calcularOS(o).saldo > 0.009) },
      ].filter((c) => c.id !== 'receber' || pode('financeiro'));
      $chips.innerHTML = String(html`${chips.map((c) => html`<button type="button" class="chip ${status === c.id ? 'ativo' : ''}" data-status="${c.id}">${c.nome}<span class="n">${c.n}</span></button>`)}`);
      for (const b of $chips.querySelectorAll('[data-status]')) {
        b.onclick = () => {
          status = b.dataset.status;
          limite = 60;
          desenhar();
        };
      }
    }

    function desenharLista(lista) {
      let filtrada = lista;
      if (status === 'abertas') filtrada = lista.filter((o) => STATUS_ABERTOS.includes(o.status));
      else if (status === 'receber') filtrada = lista.filter((o) => ['pronta', 'entregue'].includes(o.status) && calcularOS(o).saldo > 0.009);
      else if (status !== 'todas') filtrada = lista.filter((o) => o.status === status);
      filtrada = ordenarPor(filtrada, (o) => `${o.entrada || ''}${String(o.numero).padStart(6, '0')}`, true);
      if (!filtrada.length) {
        $res.innerHTML = String(html`<div class="cartao">${vazio({
          icone: 'clipboard-list',
          titulo: store.todos('ordens').length ? 'Nenhuma OS encontrada' : 'Nenhuma ordem de serviço ainda',
          texto: store.todos('ordens').length ? 'Tente mudar os filtros ou a busca.' : 'Abra a primeira OS para começar a acompanhar os carros da oficina.',
          acao: html`<a class="btn btn-primario" href="#/os/nova">${icone('plus')}Nova OS</a>`,
        })}</div>`);
        return;
      }
      const visiveis = filtrada.slice(0, limite);
      const total = filtrada.reduce((s, o) => s + calcularOS(o).total, 0);
      const hoje = hojeISO();
      $res.innerHTML = String(html`<div class="cartao"><div class="tabela-wrap"><table class="tabela responsiva">
        <thead><tr><th>Nº</th><th>Entrada</th><th>Cliente</th><th>Veículo</th><th>Status</th><th class="oculta-celular">Mecânico</th>${mostraValores ? html`<th class="num">Total</th><th>Pagamento</th>` : ''}</tr></thead>
        <tbody>${visiveis.map((o) => {
          const v = veiculoOS(o);
          const c = calcularOS(o);
          const atrasada = ['aprovada', 'execucao', 'aguardando_peca'].includes(o.status) && o.previsao && o.previsao < hoje;
          return html`<tr class="clicavel" data-os="${o.id}">
            <td class="principal-cel"><strong>OS ${fmtNumeroOS(o.numero)}</strong>${atrasada ? html`<small class="texto-erro">atrasada</small>` : ''}</td>
            <td data-rotulo="Entrada">${fmtData(o.entrada)}</td>
            <td data-rotulo="Cliente"><strong>${nomeClienteOS(o)}</strong></td>
            <td data-rotulo="Veículo"><span class="linha">${placa(v.placa)}<span class="texto-2">${v.desc}</span></span></td>
            <td data-rotulo="Status">${seloStatus(o.status)}</td>
            <td data-rotulo="Mecânico" class="oculta-celular">${nomeEquipe(o.mecanicoId) || html`<span class="texto-3">—</span>`}</td>
            ${mostraValores ? html`<td data-rotulo="Total" class="num"><strong>${fmtMoeda(c.total)}</strong></td><td data-rotulo="Pagamento">${o.status === 'cancelada' ? '' : seloPagamento(c.situacao)}</td>` : ''}
          </tr>`;
        })}</tbody>
      </table></div>
      <div class="rodape-tabela"><span>${filtrada.length} OS${mostraValores ? html` · total ${fmtMoeda(total)}` : ''}</span>
        ${filtrada.length > limite ? html`<button type="button" class="btn btn-sm" data-mais>Mostrar mais ${Math.min(60, filtrada.length - limite)}</button>` : ''}</div>
      </div>`);
      for (const tr of $res.querySelectorAll('[data-os]')) tr.onclick = () => (location.hash = `#/os/${tr.dataset.os}`);
      const mais = $res.querySelector('[data-mais]');
      if (mais) {
        mais.onclick = () => {
          limite += 60;
          desenharLista(lista);
        };
      }
    }

    function desenharQuadro(lista) {
      const hoje = hojeISO();
      const colunas = STATUS_OS.filter((s) => STATUS_ABERTOS.includes(s.id));
      $res.innerHTML = String(html`<div class="quadro">${colunas.map((s) => {
        const cards = ordenarPor(lista.filter((o) => o.status === s.id), (o) => o.entrada || '');
        const soma = cards.reduce((acc, o) => acc + calcularOS(o).total, 0);
        return html`<section class="coluna" data-coluna="${s.id}" aria-label="${s.nome}">
          <div class="coluna-cab">${seloStatus(s.id)}<span class="n">${cards.length}</span></div>
          ${mostraValores && cards.length ? html`<div class="coluna-total">${fmtMoeda(soma)}</div>` : ''}
          <div class="coluna-corpo">${cards.length
            ? cards.map((o) => {
                const v = veiculoOS(o);
                const c = calcularOS(o);
                const mec = nomeEquipe(o.mecanicoId);
                const atrasada = ['aprovada', 'execucao', 'aguardando_peca'].includes(o.status) && o.previsao && o.previsao < hoje;
                return html`<a class="card-os" href="#/os/${o.id}" draggable="true" data-card="${o.id}">
                  <div class="card-os-topo"><span class="card-os-num">OS ${fmtNumeroOS(o.numero)}</span>${placa(v.placa)}</div>
                  <div class="card-os-veic">${v.desc || 'Veículo não informado'}</div>
                  <div class="card-os-cli">${nomeClienteOS(o)}</div>
                  <div class="card-os-rodape">
                    <span>${atrasada ? html`<span class="atrasada">${icone('clock')}${fmtData(o.previsao).slice(0, 5)}</span>` : o.previsao ? html`Prev. ${fmtData(o.previsao).slice(0, 5)}` : fmtData(o.entrada).slice(0, 5)}</span>
                    <span class="linha">${mec ? html`<span class="mini-avatar" title="${mec}">${iniciais(mec)}</span>` : ''}${mostraValores ? html`<span class="valor">${fmtMoeda(c.total)}</span>` : ''}</span>
                  </div>
                </a>`;
              })
            : html`<div class="vazio-mini">Nenhuma OS</div>`}</div>
        </section>`;
      })}</div>
      <p class="texto-3 mt-1">${icone('info')} Arraste os cartões entre as colunas para mudar o status. No celular, toque e segure o cartão ou use a lista.</p>`);
      ligarArrastar();
    }

    function ligarArrastar() {
      let arrastando = null;
      for (const card of $res.querySelectorAll('[data-card]')) {
        card.addEventListener('dragstart', (e) => {
          arrastando = card.dataset.card;
          card.classList.add('arrastando');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', arrastando);
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('arrastando');
          for (const c of $res.querySelectorAll('.arrastando-sobre')) c.classList.remove('arrastando-sobre');
        });
        // Toque longo (celular): menu "mover para…"
        let tempo = null;
        card.addEventListener('touchstart', () => {
          tempo = setTimeout(() => {
            tempo = null;
            menuMover(card, card.dataset.card);
          }, 550);
        }, { passive: true });
        const cancelar = () => clearTimeout(tempo);
        card.addEventListener('touchend', (e) => {
          if (tempo === null) e.preventDefault();
          cancelar();
        });
        card.addEventListener('touchmove', cancelar, { passive: true });
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          menuMover(card, card.dataset.card);
        });
      }
      for (const col of $res.querySelectorAll('[data-coluna]')) {
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          col.classList.add('arrastando-sobre');
        });
        col.addEventListener('dragleave', (e) => {
          if (!col.contains(e.relatedTarget)) col.classList.remove('arrastando-sobre');
        });
        col.addEventListener('drop', async (e) => {
          e.preventDefault();
          col.classList.remove('arrastando-sobre');
          const id = e.dataTransfer.getData('text/plain') || arrastando;
          const os = store.porId('ordens', id);
          if (os && os.status !== col.dataset.coluna) await mudarStatusOS(os, col.dataset.coluna);
        });
      }
    }

    function menuMover(ancora, id) {
      const os = store.porId('ordens', id);
      if (!os) return;
      abrirMenu(ancora, [
        { texto: 'Abrir OS', icone: 'external-link', fn: () => (location.hash = `#/os/${id}`) },
        '-',
        ...STATUS_OS.filter((s) => s.id !== os.status).map((s) => ({ texto: `Mover para: ${s.nome}`, icone: s.icone, perigo: s.id === 'cancelada', fn: () => mudarStatusOS(os, s.id) })),
      ]);
    }

    function desenhar() {
      for (const r of el.querySelectorAll('[name=visao]')) r.checked = r.value === visao;
      const lista = base();
      desenharChips(lista);
      if (visao === 'quadro') desenharQuadro(lista);
      else desenharLista(lista);
    }

    $busca.addEventListener('input', atrasar(() => {
      termo = $busca.value;
      limite = 60;
      desenhar();
    }, 120));
    $periodo.onchange = () => {
      periodo = $periodo.value;
      desenhar();
    };
    for (const r of el.querySelectorAll('[name=visao]')) {
      r.onchange = () => {
        visao = r.value;
        gravarPref('mp:os-visao', visao);
        desenhar();
      };
    }
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('ordens') || cols.has('clientes') || cols.has('veiculos') || cols.has('equipe') || cols.has('*')) desenhar();
      },
    };
  },
};
