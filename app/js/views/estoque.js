// Estoque de peças: quantidades, custo/preço, entradas, ajustes e histórico de movimentações.
import { substituirHash } from '../app.js';
import { ajustarEstoque, entradaEstoque, estoqueBaixo } from '../dominio.js';
import { formAjusteEstoque, formEntradaEstoque, formPeca } from '../formularios.js';
import { pode, store } from '../store.js';
import { abrirMenu, abrirModal, atrasar, baixarArquivo, confirmar, filtrar, html, icone, toast, vazio } from '../ui.js';
import { fmtData, fmtMoeda, fmtNumero, gerarCSV, hojeISO, ordenarPor } from '../utils.js';

const TIPOS_MOV = { entrada: ['Entrada', 'verde', 'package-plus'], saida: ['Saída (OS)', 'laranja', 'package-minus'], devolucao: ['Devolução', 'azul', 'rotate-ccw'], ajuste: ['Ajuste', 'violeta', 'refresh-cw'] };

function verMovimentos(p) {
  const movs = ordenarPor(store.todos('movimentos').filter((m) => m.pecaId === p.id), (m) => `${m.data}${m.criadoEm || ''}`, true);
  abrirModal({
    titulo: `Movimentações: ${p.descricao}`,
    tamanho: 'lg',
    fecharFora: true,
    corpo: movs.length
      ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Data</th><th>Tipo</th><th class="num">Qtd</th><th>Motivo</th><th>Por</th></tr></thead><tbody>
        ${movs.map((m) => {
          const [nome, cor, ic] = TIPOS_MOV[m.tipo] || [m.tipo, 'cinza', 'info'];
          const sinal = m.tipo === 'saida' ? '−' : m.tipo === 'ajuste' ? (m.qtd > 0 ? '+' : '−') : '+';
          return html`<tr><td data-rotulo="Data">${fmtData(m.data)}</td><td data-rotulo="Tipo"><span class="selo selo-${cor}">${icone(ic)}${nome}</span></td>
            <td data-rotulo="Qtd" class="num"><strong>${sinal}${fmtNumero(Math.abs(m.qtd))}</strong></td>
            <td data-rotulo="Motivo">${m.osId ? html`<a href="#/os/${m.osId}" data-fechar>${m.motivo}</a>` : m.motivo || '—'}</td><td data-rotulo="Por">${m.por || '—'}</td></tr>`;
        })}</tbody></table></div>
        <p class="texto-3 mt-1" style="font-size:13px">Mostrando o último ano de movimentações.</p>`
      : html`<div class="vazio-mini">Nenhuma movimentação registrada.</div>`,
  });
}

async function darEntrada(p) {
  const d = await formEntradaEstoque(p);
  if (!d) return;
  entradaEstoque(p, d);
  toast(`Entrada de ${fmtNumero(d.qtd)} ${p.unidade || 'un'} registrada${d.lancarDespesa ? ' (e lançada no financeiro)' : ''}`);
}

async function ajustar(p) {
  const d = await formAjusteEstoque(p);
  if (!d) return;
  ajustarEstoque(p, d.qtd, d.motivo);
  toast('Estoque ajustado');
}

export default {
  montar(el, { query }) {
    let termo = '';
    let categoria = '';
    let soBaixo = query.filtro === 'baixo';
    if (query.filtro) substituirHash('#/estoque');

    el.innerHTML = String(html`<div class="pagina">
      <div class="grade grade-4" data-kpis></div>
      <div class="ferramentas">
        <div class="campo-busca">${icone('search')}<input type="search" data-busca placeholder="Buscar por descrição, código ou marca…" aria-label="Buscar peças"></div>
        <select data-cat aria-label="Categoria" style="width:auto"></select>
        <button type="button" class="chip" data-baixo>${icone('triangle-alert')}Estoque baixo</button>
        <span class="espaco"></span>
        <button type="button" class="btn" data-exportar>${icone('download')}<span class="so-largo">Exportar</span></button>
        <button type="button" class="btn btn-primario" data-nova>${icone('plus')}Nova peça</button>
      </div>
      <div data-lista></div>
    </div>`);
    const pg = el.firstElementChild;

    function desenharKpis() {
      const pecas = store.todos('pecas');
      const custo = pecas.reduce((s, p) => s + Math.max(0, Number(p.qtd) || 0) * (Number(p.custo) || 0), 0);
      const venda = pecas.reduce((s, p) => s + Math.max(0, Number(p.qtd) || 0) * (Number(p.preco) || 0), 0);
      const baixo = estoqueBaixo().length;
      pg.querySelector('[data-kpis]').innerHTML = String(html`
        <div class="cartao kpi"><span class="kpi-rotulo">${icone('package')}Itens cadastrados</span><span class="kpi-valor">${pecas.length}</span><span class="kpi-sub">${fmtNumero(pecas.reduce((s, p) => s + Math.max(0, Number(p.qtd) || 0), 0))} unidades em estoque</span></div>
        <div class="cartao kpi violeta"><span class="kpi-rotulo">${icone('wallet')}Valor em estoque</span><span class="kpi-valor">${fmtMoeda(custo)}</span><span class="kpi-sub">pelo preço de custo</span></div>
        <div class="cartao kpi verde"><span class="kpi-rotulo">${icone('trending-up')}Valor de venda</span><span class="kpi-valor">${fmtMoeda(venda)}</span><span class="kpi-sub">lucro possível de ${fmtMoeda(venda - custo)}</span></div>
        <button type="button" class="cartao kpi ${baixo ? 'vermelho' : ''}" data-kpi-baixo style="text-align:left;font:inherit;color:inherit;cursor:pointer"><span class="kpi-rotulo">${icone('triangle-alert')}Estoque baixo</span><span class="kpi-valor">${baixo}</span><span class="kpi-sub">${baixo ? 'clique para ver e repor' : 'tudo acima do mínimo'}</span></button>`);
      pg.querySelector('[data-kpi-baixo]').onclick = () => {
        soBaixo = true;
        desenhar();
      };
      const cats = [...new Set(pecas.map((p) => p.categoria).filter(Boolean))].sort();
      const sel = pg.querySelector('[data-cat]');
      sel.innerHTML = String(html`<option value="">Todas as categorias</option>${cats.map((c) => html`<option value="${c}">${c}</option>`)}`);
      sel.value = categoria;
    }

    function desenhar() {
      desenharKpis();
      pg.querySelector('[data-baixo]').classList.toggle('ativo', soBaixo);
      const $lista = pg.querySelector('[data-lista]');
      let lista = store.todos('pecas');
      if (soBaixo) lista = estoqueBaixo();
      if (categoria) lista = lista.filter((p) => p.categoria === categoria);
      if (termo) lista = filtrar(lista, termo, (p) => [p.descricao, p.codigo, p.marca, p.categoria, p.local, p.fornecedor]);
      lista = [...lista].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
      if (!lista.length) {
        $lista.innerHTML = String(html`<div class="cartao">${vazio({
          icone: 'package',
          titulo: store.todos('pecas').length ? 'Nenhuma peça encontrada' : 'Estoque vazio',
          texto: store.todos('pecas').length ? (soBaixo ? 'Nenhuma peça abaixo do mínimo. 👍' : 'Confira a busca e os filtros.') : 'Cadastre as peças que você mantém na oficina. Quando uma OS fica pronta, as peças usadas saem do estoque sozinhas.',
          acao: store.todos('pecas').length ? '' : html`<button type="button" class="btn btn-primario" data-nova-vazio>${icone('plus')}Cadastrar peça</button>`,
        })}</div>`);
        $lista.querySelector('[data-nova-vazio]')?.addEventListener('click', () => formPeca());
        return;
      }
      $lista.innerHTML = String(html`<div class="cartao"><div class="tabela-wrap"><table class="tabela responsiva">
        <thead><tr><th>Peça</th><th>Categoria</th><th>Local</th><th class="num">Estoque</th><th class="num">Custo</th><th class="num">Venda</th><th class="num">Margem</th><th class="acoes"></th></tr></thead>
        <tbody>${lista.map((p) => {
          const q = Number(p.qtd) || 0;
          const baixo = Number(p.minimo) > 0 && q <= Number(p.minimo);
          const margem = Number(p.preco) > 0 ? Math.round(((Number(p.preco) - (Number(p.custo) || 0)) / Number(p.preco)) * 100) : null;
          return html`<tr>
            <td class="principal-cel"><strong>${p.descricao}</strong><small>${[p.codigo, p.marca].filter(Boolean).join(' · ') || '—'}</small></td>
            <td data-rotulo="Categoria">${p.categoria || html`<span class="texto-3">—</span>`}</td>
            <td data-rotulo="Local">${p.local || html`<span class="texto-3">—</span>`}</td>
            <td data-rotulo="Estoque" class="num"><span class="selo ${q <= 0 ? 'selo-vermelho' : baixo ? 'selo-amarelo' : 'selo-cinza'}" title="${Number(p.minimo) ? `Mínimo: ${fmtNumero(p.minimo)}` : ''}">${fmtNumero(q)} ${p.unidade || 'un'}</span></td>
            <td data-rotulo="Custo" class="num">${fmtMoeda(p.custo)}</td>
            <td data-rotulo="Venda" class="num"><strong>${fmtMoeda(p.preco)}</strong></td>
            <td data-rotulo="Margem" class="num ${margem != null && margem < 0 ? 'texto-erro' : ''}">${margem == null ? '—' : `${margem}%`}</td>
            <td class="acoes"><span class="linha nowrap" style="justify-content:flex-end;gap:2px">
              <button type="button" class="btn btn-sm" data-entrada="${p.id}" title="Dar entrada (compra)">${icone('package-plus')}<span class="so-largo">Entrada</span></button>
              <button type="button" class="btn-icone sm" data-menu="${p.id}" aria-label="Mais ações">${icone('ellipsis-vertical')}</button></span></td>
          </tr>`;
        })}</tbody></table></div>
        <div class="rodape-tabela"><span>${lista.length} item(ns)</span></div></div>`);
      for (const b of $lista.querySelectorAll('[data-entrada]')) b.onclick = () => darEntrada(store.porId('pecas', b.dataset.entrada));
      for (const b of $lista.querySelectorAll('[data-menu]')) {
        b.onclick = () => {
          const p = store.porId('pecas', b.dataset.menu);
          abrirMenu(b, [
            { texto: 'Dar entrada (compra)', icone: 'package-plus', fn: () => darEntrada(p) },
            { texto: 'Ajustar quantidade', icone: 'refresh-cw', fn: () => ajustar(p) },
            { texto: 'Ver movimentações', icone: 'history', fn: () => verMovimentos(p) },
            { texto: 'Editar', icone: 'pencil', fn: () => formPeca(p) },
            pode('excluir') ? '-' : null,
            pode('excluir')
              ? {
                  texto: 'Excluir',
                  icone: 'trash-2',
                  perigo: true,
                  fn: async () => {
                    if (!(await confirmar({ titulo: `Excluir ${p.descricao}?`, texto: 'A peça sai do cadastro. As OS que já usaram esta peça não mudam.', ok: 'Excluir', perigo: true }))) return;
                    store.remover('pecas', p.id);
                    toast('Peça excluída', 'ok', { acao: { texto: 'Desfazer', fn: () => store.salvar('pecas', p) } });
                  },
                }
              : null,
          ]);
        };
      }
    }

    pg.querySelector('[data-busca]').addEventListener('input', atrasar((e) => {
      termo = e.target.value;
      desenhar();
    }, 120));
    pg.querySelector('[data-cat]').onchange = (e) => {
      categoria = e.target.value;
      desenhar();
    };
    pg.querySelector('[data-baixo]').onclick = () => {
      soBaixo = !soBaixo;
      desenhar();
    };
    pg.querySelector('[data-nova]').onclick = () => formPeca();
    pg.querySelector('[data-exportar]').onclick = () => {
      const linhas = [['Código', 'Descrição', 'Marca', 'Categoria', 'Unidade', 'Quantidade', 'Mínimo', 'Custo', 'Preço', 'Local', 'Fornecedor']];
      for (const p of ordenarPor(store.todos('pecas'), (x) => x.descricao)) {
        linhas.push([p.codigo || '', p.descricao, p.marca || '', p.categoria || '', p.unidade || 'un', String(p.qtd ?? 0).replace('.', ','), String(p.minimo ?? 0).replace('.', ','), (Number(p.custo) || 0).toFixed(2).replace('.', ','), (Number(p.preco) || 0).toFixed(2).replace('.', ','), p.local || '', p.fornecedor || '']);
      }
      baixarArquivo(`estoque-${hojeISO()}.csv`, gerarCSV(linhas), 'text/csv');
      toast('Planilha do estoque baixada');
    };
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('pecas') || cols.has('movimentos') || cols.has('*')) desenhar();
      },
    };
  },
};
