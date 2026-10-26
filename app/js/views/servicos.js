// Tabela de serviços (mão de obra): preços padrão usados na OS.
import { SERVICOS_COMUNS } from '../dominio.js';
import { formServico, modalFormulario } from '../formularios.js';
import { pode, store } from '../store.js';
import { abrirMenu, atrasar, campo, confirmar, falhaCampo, filtrar, html, icone, toast, vazio } from '../ui.js';
import { addDias, arred, fmtDecimal, fmtMoeda, hojeISO, uid } from '../utils.js';

function carregarComuns() {
  const existentes = new Set(store.todos('servicos').map((s) => s.descricao.toLowerCase()));
  const ops = SERVICOS_COMUNS.filter(([d]) => !existentes.has(d.toLowerCase())).map(([descricao, categoria, preco, tempo]) => ({ op: 'gravar', col: 'servicos', dados: { id: uid(), descricao, categoria, preco, tempo } }));
  if (!ops.length) return toast('Os serviços comuns já estão na sua tabela', 'info');
  store.lote(ops);
  toast(`${ops.length} serviços adicionados. Ajuste os preços para a sua oficina.`, 'ok', { duracao: 6000 });
}

async function reajustar() {
  const cats = [...new Set(store.todos('servicos').map((s) => s.categoria).filter(Boolean))].sort();
  const r = await modalFormulario({
    titulo: 'Reajustar preços',
    tamanho: 'sm',
    textoSalvar: 'Aplicar reajuste',
    campos: html`<p class="texto-2 mb-1">Aumenta (ou diminui, com número negativo) o preço dos serviços de uma vez.</p><div class="form-grade">
      ${campo({ rotulo: 'Percentual (%)', nome: 'pct', tipo: 'number', valor: '10', passo: 0.5, obrigatorio: true, classe: 'c-12', autofocus: true })}
      ${campo({ rotulo: 'Quais serviços', nome: 'cat', tipo: 'select', opcoes: [{ valor: '', texto: 'Todos' }, ...cats], classe: 'c-12' })}
      ${campo({ rotulo: 'Arredondar para valores redondos (ex.: R$ 87,30 → R$ 88,00)', nome: 'arredondar', tipo: 'checkbox', valor: true, classe: 'c-12' })}
    </div>`,
    async aoSalvar(d, form) {
      if (!d.pct) return falhaCampo(form, 'pct', 'Informe o percentual');
      return d;
    },
  });
  if (!r) return;
  const alvo = store.todos('servicos').filter((s) => !r.cat || s.categoria === r.cat);
  const ok = await confirmar({ titulo: 'Confirmar reajuste', texto: `${alvo.length} serviço(s) terão o preço ${r.pct > 0 ? 'aumentado' : 'reduzido'} em ${fmtDecimal(Math.abs(r.pct)).replace(',00', '')}%.`, ok: 'Aplicar' });
  if (!ok) return;
  store.lote(alvo.map((s) => {
    let novo = arred((Number(s.preco) || 0) * (1 + r.pct / 100));
    if (r.arredondar) novo = Math.ceil(novo);
    return { op: 'alterar', col: 'servicos', id: s.id, dados: { preco: novo } };
  }));
  toast('Preços reajustados');
}

export default {
  montar(el) {
    let termo = '';
    let categoria = '';
    const podeEditar = pode('excluir');
    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="campo-busca">${icone('search')}<input type="search" data-busca placeholder="Buscar serviço…" aria-label="Buscar serviços"></div>
        <select data-cat aria-label="Categoria" style="width:auto"></select>
        <span class="espaco"></span>
        ${podeEditar ? html`<button type="button" class="btn" data-reajustar>${icone('trending-up')}<span class="so-largo">Reajustar preços</span></button>` : ''}
        <button type="button" class="btn btn-primario" data-novo>${icone('plus')}Novo serviço</button>
      </div>
      <div data-lista></div>
    </div>`);
    const pg = el.firstElementChild;

    function desenhar() {
      const todos = store.todos('servicos');
      const cats = [...new Set(todos.map((s) => s.categoria).filter(Boolean))].sort();
      const sel = pg.querySelector('[data-cat]');
      sel.innerHTML = String(html`<option value="">Todas as categorias</option>${cats.map((c) => html`<option value="${c}">${c}</option>`)}`);
      sel.value = categoria;
      const $lista = pg.querySelector('[data-lista]');
      if (!todos.length) {
        $lista.innerHTML = String(html`<div class="cartao">${vazio({
          icone: 'wrench',
          titulo: 'Monte sua tabela de serviços',
          texto: 'Com os serviços cadastrados, montar uma OS fica muito mais rápido: é só buscar e o preço já vem preenchido.',
          acao: html`<div class="grupo-botoes"><button type="button" class="btn btn-primario" data-comuns>${icone('sparkles')}Carregar ${SERVICOS_COMUNS.length} serviços comuns</button><button type="button" class="btn" data-novo-vazio>${icone('plus')}Cadastrar um por um</button></div>`,
        })}</div>`);
        $lista.querySelector('[data-comuns]').onclick = carregarComuns;
        $lista.querySelector('[data-novo-vazio]').onclick = () => formServico();
        return;
      }
      // Quantas vezes cada serviço foi usado nos últimos 90 dias
      const desde = addDias(hojeISO(), -90);
      const uso = new Map();
      for (const o of store.todos('ordens')) {
        if (o.status === 'cancelada' || (o.entrada || '') < desde) continue;
        for (const it of o.itens || []) if (it.tipo === 'servico' && it.refId) uso.set(it.refId, (uso.get(it.refId) || 0) + 1);
      }
      let lista = todos;
      if (categoria) lista = lista.filter((s) => s.categoria === categoria);
      if (termo) lista = filtrar(lista, termo, (s) => [s.descricao, s.categoria]);
      lista = [...lista].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
      $lista.innerHTML = String(lista.length
        ? html`<div class="cartao"><div class="tabela-wrap"><table class="tabela responsiva">
          <thead><tr><th>Serviço</th><th>Categoria</th><th class="num">Tempo</th><th class="num">Usado (90 dias)</th><th class="num">Preço</th><th class="acoes"></th></tr></thead>
          <tbody>${lista.map((s) => html`<tr class="clicavel" data-serv="${s.id}">
            <td class="principal-cel"><strong>${s.descricao}</strong>${s.observacoes ? html`<small>${s.observacoes}</small>` : ''}</td>
            <td data-rotulo="Categoria">${s.categoria || html`<span class="texto-3">—</span>`}</td>
            <td data-rotulo="Tempo" class="num">${s.tempo ? `${fmtDecimal(s.tempo).replace(',00', '')} h` : '—'}</td>
            <td data-rotulo="Usado" class="num">${uso.get(s.id) || 0}x</td>
            <td data-rotulo="Preço" class="num"><strong>${fmtMoeda(s.preco)}</strong></td>
            <td class="acoes"><button type="button" class="btn-icone sm" data-menu="${s.id}" aria-label="Ações">${icone('ellipsis-vertical')}</button></td>
          </tr>`)}</tbody></table></div>
          <div class="rodape-tabela"><span>${lista.length} serviço(s)</span><button type="button" class="link" data-comuns-mais>${icone('sparkles')} Adicionar serviços comuns que faltam</button></div></div>`
        : html`<div class="cartao">${vazio({ icone: 'search', titulo: 'Nenhum serviço encontrado' })}</div>`);
      $lista.querySelector('[data-comuns-mais]')?.addEventListener('click', carregarComuns);
      for (const tr of $lista.querySelectorAll('[data-serv]')) {
        tr.onclick = (e) => {
          if (e.target.closest('[data-menu]')) return;
          formServico(store.porId('servicos', tr.dataset.serv));
        };
      }
      for (const b of $lista.querySelectorAll('[data-menu]')) {
        b.onclick = (e) => {
          e.stopPropagation();
          const s = store.porId('servicos', b.dataset.menu);
          abrirMenu(b, [
            { texto: 'Editar', icone: 'pencil', fn: () => formServico(s) },
            {
              texto: 'Duplicar',
              icone: 'copy',
              fn: () => {
                store.adicionar('servicos', { ...s, id: undefined, criadoEm: undefined, descricao: `${s.descricao} (cópia)` });
                toast('Serviço duplicado');
              },
            },
            podeEditar ? '-' : null,
            podeEditar
              ? {
                  texto: 'Excluir',
                  icone: 'trash-2',
                  perigo: true,
                  fn: async () => {
                    if (!(await confirmar({ titulo: `Excluir “${s.descricao}”?`, texto: 'As OS que já usaram este serviço não mudam.', ok: 'Excluir', perigo: true }))) return;
                    store.remover('servicos', s.id);
                    toast('Serviço excluído', 'ok', { acao: { texto: 'Desfazer', fn: () => store.salvar('servicos', s) } });
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
    pg.querySelector('[data-novo]').onclick = () => formServico();
    pg.querySelector('[data-reajustar]')?.addEventListener('click', reajustar);
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('servicos') || cols.has('*')) desenhar();
      },
    };
  },
};
