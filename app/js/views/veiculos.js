// Lista de veículos (busca por placa, modelo ou dono).
import { substituirHash } from '../app.js';
import { descVeiculo } from '../dominio.js';
import { formVeiculo } from '../formularios.js';
import { pode, store } from '../store.js';
import { abrirMenu, atrasar, confirmar, html, icone, placa, toast, vazio } from '../ui.js';
import { contemTermo, fmtData, fmtNumero, ordenarPor, placaLimpa } from '../utils.js';

export async function excluirVeiculo(v) {
  const n = store.todos('ordens').filter((o) => o.veiculoId === v.id).length;
  const ok = await confirmar({
    titulo: `Excluir ${descVeiculo(v)}?`,
    texto: 'O cadastro do veículo será apagado.',
    detalhe: n ? `As ${n} ordens de serviço dele continuam guardadas (com a placa e o modelo).` : '',
    ok: 'Excluir',
    perigo: true,
  });
  if (!ok) return false;
  store.remover('veiculos', v.id);
  toast('Veículo excluído', 'ok', { acao: { texto: 'Desfazer', fn: () => store.salvar('veiculos', v) } });
  return true;
}

export default {
  montar(el, { query }) {
    let termo = '';
    let limite = 80;
    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="campo-busca">${icone('search')}<input type="search" data-busca placeholder="Buscar por placa, modelo, marca ou dono…" aria-label="Buscar veículos"></div>
        <span class="espaco"></span>
        <button type="button" class="btn btn-primario" data-novo>${icone('plus')}Novo veículo</button>
      </div>
      <div data-lista></div>
    </div>`);
    const pg = el.firstElementChild;
    const $lista = pg.querySelector('[data-lista]');

    function desenhar() {
      let lista = store.todos('veiculos');
      if (termo) {
        const pl = placaLimpa(termo);
        lista = lista.filter((v) => (pl.length >= 2 && v.placa?.includes(pl)) || contemTermo([v.marca, v.modelo, v.ano, v.cor, store.porId('clientes', v.clienteId)?.nome], termo));
      }
      const ultimas = new Map();
      for (const o of store.todos('ordens')) {
        if (!o.veiculoId) continue;
        const a = ultimas.get(o.veiculoId);
        if (!a || (o.entrada || '') > (a.entrada || '')) ultimas.set(o.veiculoId, o);
      }
      lista = ordenarPor(lista, (v) => ultimas.get(v.id)?.entrada || v.criadoEm || '', true);
      if (!lista.length) {
        $lista.innerHTML = String(html`<div class="cartao">${vazio({
          icone: 'car',
          titulo: store.todos('veiculos').length ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado',
          texto: store.todos('veiculos').length ? 'Confira a placa ou o nome digitado.' : 'Os veículos ficam ligados ao cliente. Você também pode cadastrar direto ao abrir uma OS.',
          acao: html`<button type="button" class="btn btn-primario" data-novo-vazio>${icone('plus')}Cadastrar veículo</button>`,
        })}</div>`);
        $lista.querySelector('[data-novo-vazio]').onclick = novo;
        return;
      }
      $lista.innerHTML = String(html`<div class="cartao"><div class="tabela-wrap"><table class="tabela responsiva">
        <thead><tr><th>Placa</th><th>Veículo</th><th>Dono</th><th class="num">KM</th><th>Última OS</th><th class="acoes"></th></tr></thead>
        <tbody>${lista.slice(0, limite).map((v) => {
          const dono = store.porId('clientes', v.clienteId);
          const ult = ultimas.get(v.id);
          return html`<tr class="clicavel" data-veiculo="${v.id}">
            <td class="principal-cel">${placa(v.placa)}</td>
            <td data-rotulo="Veículo"><strong>${descVeiculo(v)}</strong>${v.cor ? html` <span class="texto-3">· ${v.cor}</span>` : ''}</td>
            <td data-rotulo="Dono">${dono ? html`<a href="#/clientes/${dono.id}" data-parar>${dono.nome}</a>` : html`<span class="texto-3">—</span>`}</td>
            <td data-rotulo="KM" class="num">${v.km ? fmtNumero(v.km) : '—'}</td>
            <td data-rotulo="Última OS">${ult ? fmtData(ult.entrada) : html`<span class="texto-3">nenhuma</span>`}</td>
            <td class="acoes"><button type="button" class="btn-icone sm" data-menu="${v.id}" aria-label="Ações">${icone('ellipsis-vertical')}</button></td>
          </tr>`;
        })}</tbody></table></div>
        <div class="rodape-tabela"><span>${lista.length} veículo(s)</span>${lista.length > limite ? html`<button type="button" class="btn btn-sm" data-mais>Mostrar mais</button>` : ''}</div></div>`);
      for (const tr of $lista.querySelectorAll('[data-veiculo]')) {
        tr.onclick = (e) => {
          if (e.target.closest('[data-parar], [data-menu]')) return;
          location.hash = `#/veiculos/${tr.dataset.veiculo}`;
        };
      }
      for (const b of $lista.querySelectorAll('[data-menu]')) {
        b.onclick = (e) => {
          e.stopPropagation();
          const v = store.porId('veiculos', b.dataset.menu);
          abrirMenu(b, [
            { texto: 'Histórico do veículo', icone: 'history', fn: () => (location.hash = `#/veiculos/${v.id}`) },
            { texto: 'Nova OS para este veículo', icone: 'plus', fn: () => (location.hash = `#/os/nova?veiculo=${v.id}`) },
            { texto: 'Editar', icone: 'pencil', fn: () => formVeiculo(v) },
            pode('excluir') ? '-' : null,
            pode('excluir') ? { texto: 'Excluir', icone: 'trash-2', perigo: true, fn: () => excluirVeiculo(v) } : null,
          ]);
        };
      }
      const mais = $lista.querySelector('[data-mais]');
      if (mais) {
        mais.onclick = () => {
          limite += 80;
          desenhar();
        };
      }
    }

    async function novo() {
      const v = await formVeiculo();
      if (v) location.hash = `#/veiculos/${v.id}`;
    }
    pg.querySelector('[data-busca]').addEventListener('input', atrasar((e) => {
      termo = e.target.value;
      limite = 80;
      desenhar();
    }, 120));
    pg.querySelector('[data-novo]').onclick = novo;
    desenhar();
    if (query.novo) {
      substituirHash('#/veiculos');
      setTimeout(novo, 50);
    }
    return {
      atualizar(cols) {
        if (cols.has('veiculos') || cols.has('clientes') || cols.has('ordens') || cols.has('*')) desenhar();
      },
    };
  },
};

