// Equipe: mecânicos e funcionários (para escolher na OS e calcular comissões).
import { formEquipe } from '../formularios.js';
import { pode, store } from '../store.js';
import { abrirMenu, confirmar, html, icone, iniciais, toast, vazio } from '../ui.js';
import { calcularOS, fmtMoeda, mascaraTelefone, mesAtual, mesDe, STATUS_ABERTOS } from '../utils.js';

export default {
  montar(el) {
    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <p class="texto-2" style="flex:1;min-width:240px">Cadastre quem trabalha na oficina para escolher o responsável em cada OS e ver comissões nos relatórios.
          ${store.estado.modo === 'nuvem' && pode('usuarios') ? html`Para dar <strong>login no sistema</strong> a alguém, use <a href="#/config?aba=usuarios">Configurações → Usuários</a>.` : ''}</p>
        <button type="button" class="btn btn-primario" data-novo>${icone('user-plus')}Novo funcionário</button>
      </div>
      <div data-lista></div>
    </div>`);
    const pg = el.firstElementChild;

    function desenhar() {
      const $lista = pg.querySelector('[data-lista]');
      const equipe = [...store.todos('equipe')].sort((a, b) => (a.ativo === false) - (b.ativo === false) || a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!equipe.length) {
        $lista.innerHTML = String(html`<div class="cartao">${vazio({ icone: 'hard-hat', titulo: 'Nenhum funcionário cadastrado', texto: 'Cadastre os mecânicos para distribuir as OS e acompanhar o trabalho de cada um.', acao: html`<button type="button" class="btn btn-primario" data-novo-vazio>${icone('user-plus')}Cadastrar funcionário</button>` })}</div>`);
        $lista.querySelector('[data-novo-vazio]').onclick = () => formEquipe();
        return;
      }
      const mes = mesAtual();
      const ordens = store.todos('ordens');
      $lista.innerHTML = String(html`<div class="grade grade-3">${equipe.map((m) => {
        const minhas = ordens.filter((o) => o.mecanicoId === m.id);
        const abertas = minhas.filter((o) => STATUS_ABERTOS.includes(o.status)).length;
        const doMes = minhas.filter((o) => o.status === 'entregue' && mesDe(o.entregueEm) === mes);
        const maoDeObra = doMes.reduce((s, o) => s + calcularOS({ ...o, desconto: 0, descontoPct: 0 }).servicos, 0);
        return html`<section class="cartao" style="${m.ativo === false ? 'opacity:.6' : ''}">
          <div class="cartao-corpo">
            <div class="linha" style="align-items:flex-start;flex-wrap:nowrap">
              <span class="detalhe-avatar" style="width:48px;height:48px;font-size:16px">${iniciais(m.nome)}</span>
              <div style="flex:1;min-width:0">
                <strong style="font-size:15px">${m.nome}</strong>
                <div class="texto-3" style="font-size:13px">${m.funcao || 'Funcionário'}${m.telefone ? ` · ${mascaraTelefone(m.telefone)}` : ''}</div>
                ${m.ativo === false ? html`<span class="selo selo-cinza mt-1">Inativo</span>` : ''}
              </div>
              <button type="button" class="btn-icone sm" data-menu="${m.id}" aria-label="Ações">${icone('ellipsis-vertical')}</button>
            </div>
            <div class="mini-kpis mt-2">
              <div class="mini-kpi"><span>OS em aberto</span><strong>${abertas}</strong></div>
              <div class="mini-kpi"><span>Entregues no mês</span><strong>${doMes.length}</strong></div>
              ${pode('relatorios') ? html`<div class="mini-kpi"><span>Mão de obra (mês)</span><strong>${fmtMoeda(maoDeObra)}</strong></div>
              <div class="mini-kpi"><span>Comissão ${m.comissao ? `(${m.comissao}%)` : ''}</span><strong>${fmtMoeda((maoDeObra * (Number(m.comissao) || 0)) / 100)}</strong></div>` : ''}
            </div>
            ${abertas ? html`<a class="link mt-1" style="display:inline-block" href="#/os?q=${encodeURIComponent(m.nome)}">Ver OS em aberto →</a>` : ''}
          </div>
        </section>`;
      })}</div>`);
      for (const b of $lista.querySelectorAll('[data-menu]')) {
        b.onclick = () => {
          const m = store.porId('equipe', b.dataset.menu);
          abrirMenu(b, [
            { texto: 'Editar', icone: 'pencil', fn: () => formEquipe(m) },
            { texto: m.ativo === false ? 'Reativar' : 'Desativar', icone: m.ativo === false ? 'circle-check' : 'circle-x', fn: () => store.atualizar('equipe', m.id, { ativo: m.ativo === false }) },
            pode('excluir') ? '-' : null,
            pode('excluir')
              ? {
                  texto: 'Excluir',
                  icone: 'trash-2',
                  perigo: true,
                  fn: async () => {
                    const usado = store.todos('ordens').some((o) => o.mecanicoId === m.id);
                    if (!(await confirmar({ titulo: `Excluir ${m.nome}?`, texto: usado ? 'Este funcionário aparece em ordens de serviço. Prefira “Desativar” para manter o histórico e as comissões.' : 'O cadastro será apagado.', ok: 'Excluir mesmo assim', perigo: true }))) return;
                    store.remover('equipe', m.id);
                    toast('Funcionário excluído', 'ok', { acao: { texto: 'Desfazer', fn: () => store.salvar('equipe', m) } });
                  },
                }
              : null,
          ]);
        };
      }
    }
    pg.querySelector('[data-novo]').onclick = () => formEquipe();
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('equipe') || cols.has('ordens') || cols.has('*')) desenhar();
      },
    };
  },
};
