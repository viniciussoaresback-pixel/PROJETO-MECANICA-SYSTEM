// Financeiro: entradas (pagamentos das OS), contas a receber e contas a pagar (despesas), mês a mês.
import { receberOS } from '../acoes-os.js';
import { substituirHash } from '../app.js';
import { aReceber, despesasPagas, nomeClienteOS, recebimentos, veiculoOS } from '../dominio.js';
import { formDespesa, modalFormulario } from '../formularios.js';
import { graficoBarras } from '../graficos.js';
import { pode, store } from '../store.js';
import { abrirMenu, campo, confirmar, html, icone, placa, toast, vazio } from '../ui.js';
import {
  addMeses, diasEntre, fmtData, maiuscula, fmtMoeda, fmtNumeroOS, FORMAS_PAGAMENTO, hojeISO, mesAtual, nomeMes, ordenarPor, primeiroDiaMes,
  ultimoDiaMes,
} from '../utils.js';

const ABAS = [
  { id: 'resumo', nome: 'Resumo do mês', icone: 'chart-column' },
  { id: 'recebimentos', nome: 'Recebimentos', icone: 'banknote' },
  { id: 'receber', nome: 'A receber', icone: 'hand-coins' },
  { id: 'pagar', nome: 'Contas a pagar', icone: 'receipt' },
];

async function pagarDespesa(d) {
  const r = await modalFormulario({
    titulo: 'Marcar como paga',
    tamanho: 'sm',
    textoSalvar: 'Confirmar pagamento',
    campos: html`<p class="texto-2 mb-1"><strong>${d.descricao}</strong> — ${fmtMoeda(d.valor)}</p><div class="form-grade">
      ${campo({ rotulo: 'Pago em', nome: 'pagoEm', tipo: 'date', valor: hojeISO(), classe: 'c-6' })}
      ${campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: 'PIX', opcoes: FORMAS_PAGAMENTO, classe: 'c-6' })}
    </div>`,
    async aoSalvar(dados) {
      return dados;
    },
  });
  if (!r) return;
  store.atualizar('despesas', d.id, { pago: true, pagoEm: r.pagoEm || hojeISO(), forma: r.forma });
  toast('Despesa marcada como paga');
}

function situacaoDespesa(d) {
  const hoje = hojeISO();
  if (d.pago) return html`<span class="selo selo-verde">${icone('circle-check')}Paga</span>`;
  if (d.vencimento < hoje) return html`<span class="selo selo-vermelho">${icone('circle-alert')}Vencida há ${diasEntre(d.vencimento, hoje)}d</span>`;
  if (d.vencimento === hoje) return html`<span class="selo selo-amarelo">${icone('clock')}Vence hoje</span>`;
  return html`<span class="selo selo-cinza">Em aberto</span>`;
}

export default {
  montar(el, { query }) {
    let mes = query.mes || mesAtual();
    let aba = ABAS.some((a) => a.id === query.aba) ? query.aba : 'resumo';
    if (query.aba || query.mes) substituirHash('#/financeiro');

    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="agenda-nav">
          <button type="button" class="btn-icone" data-ant aria-label="Mês anterior">${icone('chevron-left')}</button>
          <h3 data-mes style="min-width:190px"></h3>
          <button type="button" class="btn-icone" data-prox aria-label="Próximo mês">${icone('chevron-right')}</button>
          <button type="button" class="btn btn-sm" data-atual>Mês atual</button>
        </div>
        <span class="espaco"></span>
        <button type="button" class="btn btn-primario" data-despesa>${icone('plus')}Nova despesa</button>
      </div>
      <div class="grade grade-4" data-kpis></div>
      <div class="cartao">
        <div class="abas" role="tablist" style="padding:0 10px">${ABAS.map((a) => html`<button type="button" role="tab" class="aba" data-aba="${a.id}">${icone(a.icone)}${a.nome}<span class="contagem" data-cont="${a.id}" hidden></span></button>`)}</div>
        <div data-conteudo></div>
      </div>
    </div>`);
    const pg = el.firstElementChild;

    function periodo() {
      return [primeiroDiaMes(mes), ultimoDiaMes(mes)];
    }

    function desenharKpis() {
      const [ini, fim] = periodo();
      const entradas = recebimentos(ini, fim).reduce((s, r) => s + Number(r.valor || 0), 0);
      const saidas = despesasPagas(ini, fim).reduce((s, d) => s + Number(d.valor || 0), 0);
      const receber = aReceber();
      const totalReceber = receber.reduce((s, x) => s + x.calc.saldo, 0);
      const abertas = store.todos('despesas').filter((d) => !d.pago && d.vencimento <= fim);
      const totalPagar = abertas.reduce((s, d) => s + Number(d.valor || 0), 0);
      const vencidas = abertas.filter((d) => d.vencimento < hojeISO()).length;
      const saldo = entradas - saidas;
      pg.querySelector('[data-kpis]').innerHTML = String(html`
        <div class="cartao kpi verde"><span class="kpi-rotulo">${icone('trending-up')}Entradas</span><span class="kpi-valor">${fmtMoeda(entradas)}</span><span class="kpi-sub">pagamentos recebidos no mês</span></div>
        <div class="cartao kpi vermelho"><span class="kpi-rotulo">${icone('trending-down')}Saídas</span><span class="kpi-valor">${fmtMoeda(saidas)}</span><span class="kpi-sub">despesas pagas no mês</span></div>
        <div class="cartao kpi ${saldo >= 0 ? 'ciano' : 'vermelho'}"><span class="kpi-rotulo">${icone('wallet')}Saldo do mês</span><span class="kpi-valor ${saldo < 0 ? 'texto-erro' : ''}">${fmtMoeda(saldo)}</span><span class="kpi-sub">entradas − saídas</span></div>
        <div class="cartao kpi laranja"><span class="kpi-rotulo">${icone('hand-coins')}A receber / a pagar</span><span class="kpi-valor" style="font-size:20px">${fmtMoeda(totalReceber)} <span class="texto-3" style="font-size:14px;font-weight:600">/ ${fmtMoeda(totalPagar)}</span></span><span class="kpi-sub">${receber.length} OS a receber · ${vencidas ? html`<strong class="texto-erro">${vencidas} conta(s) vencida(s)</strong>` : `${abertas.length} conta(s) em aberto`}</span></div>`);
      const contR = pg.querySelector('[data-cont=receber]');
      contR.hidden = !receber.length;
      contR.textContent = receber.length;
      const contP = pg.querySelector('[data-cont=pagar]');
      contP.hidden = !abertas.length;
      contP.textContent = abertas.length;
    }

    function abaResumo(box) {
      const [ini, fim] = periodo();
      const recs = recebimentos(ini, fim);
      const desp = despesasPagas(ini, fim);
      const extrato = ordenarPor([
        ...recs.map((r) => ({ data: r.data, desc: `OS ${fmtNumeroOS(r.os.numero)} · ${nomeClienteOS(r.os)}`, detalhe: r.forma, entrada: Number(r.valor), osId: r.os.id })),
        ...desp.map((d) => ({ data: d.pagoEm || d.vencimento, desc: d.descricao, detalhe: d.categoria, saida: Number(d.valor) })),
      ], (x) => x.data, true);
      const porForma = new Map();
      for (const r of recs) porForma.set(r.forma || 'Outro', (porForma.get(r.forma || 'Outro') || 0) + Number(r.valor));
      const porCat = new Map();
      for (const d of desp) porCat.set(d.categoria || 'Outros', (porCat.get(d.categoria || 'Outros') || 0) + Number(d.valor));
      box.innerHTML = String(html`<div class="grade grade-2-1" style="padding:16px">
        <div>
          <h3 class="secao-titulo mb-1">${icone('list')}Extrato do mês</h3>
          ${extrato.length
            ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Data</th><th>Descrição</th><th class="num">Entrada</th><th class="num">Saída</th></tr></thead><tbody>
              ${extrato.map((x) => html`<tr ${x.osId ? html`class="clicavel" data-os="${x.osId}"` : ''}>
                <td data-rotulo="Data">${fmtData(x.data)}</td>
                <td class="principal-cel"><strong>${x.desc}</strong><small>${x.detalhe || ''}</small></td>
                <td data-rotulo="Entrada" class="num texto-ok">${x.entrada ? fmtMoeda(x.entrada) : ''}</td>
                <td data-rotulo="Saída" class="num texto-erro">${x.saida ? fmtMoeda(x.saida) : ''}</td></tr>`)}
              </tbody><tfoot><tr><td colspan="2">Total</td><td class="num texto-ok">${fmtMoeda(recs.reduce((s, r) => s + Number(r.valor), 0))}</td><td class="num texto-erro">${fmtMoeda(desp.reduce((s, d) => s + Number(d.valor), 0))}</td></tr></tfoot></table></div>`
            : html`<div class="vazio-mini">Nenhuma entrada ou saída em ${nomeMes(mes)}.</div>`}
        </div>
        <div class="grade" style="align-content:start">
          <div><h3 class="secao-titulo mb-1">${icone('banknote')}Recebido por forma</h3>
            ${porForma.size ? graficoBarras(ordenarPor([...porForma].map(([rotulo, valor]) => ({ rotulo, valor })), (x) => x.valor, true)) : html`<p class="texto-3">Sem recebimentos.</p>`}</div>
          <div><h3 class="secao-titulo mb-1">${icone('receipt')}Despesas por categoria</h3>
            ${porCat.size ? graficoBarras(ordenarPor([...porCat].map(([rotulo, valor]) => ({ rotulo, valor })), (x) => x.valor, true)) : html`<p class="texto-3">Sem despesas pagas.</p>`}</div>
        </div>
      </div>`);
    }

    function abaRecebimentos(box) {
      const [ini, fim] = periodo();
      const recs = recebimentos(ini, fim);
      box.innerHTML = String(recs.length
        ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Data</th><th>OS</th><th>Cliente</th><th>Forma</th><th class="num">Valor</th></tr></thead><tbody>
          ${recs.map((r) => html`<tr class="clicavel" data-os="${r.os.id}"><td data-rotulo="Data">${fmtData(r.data)}</td><td class="principal-cel"><strong>OS ${fmtNumeroOS(r.os.numero)}</strong>${r.obs ? html`<small>${r.obs}</small>` : ''}</td>
            <td data-rotulo="Cliente">${nomeClienteOS(r.os)}</td><td data-rotulo="Forma">${r.forma}</td><td data-rotulo="Valor" class="num"><strong>${fmtMoeda(r.valor)}</strong></td></tr>`)}
          </tbody><tfoot><tr><td colspan="4">${recs.length} recebimento(s)</td><td class="num">${fmtMoeda(recs.reduce((s, r) => s + Number(r.valor), 0))}</td></tr></tfoot></table></div>`
        : vazio({ icone: 'banknote', titulo: `Nenhum recebimento em ${nomeMes(mes)}`, texto: 'Os pagamentos registrados nas ordens de serviço aparecem aqui.' }));
    }

    function abaReceber(box) {
      const lista = ordenarPor(aReceber(), (x) => x.os.entregueEm || x.os.concluidaEm || x.os.entrada || '');
      box.innerHTML = String(lista.length
        ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Concluída</th><th class="num">Total</th><th class="num">Falta</th><th class="acoes"></th></tr></thead><tbody>
          ${lista.map(({ os, calc }) => {
            const v = veiculoOS(os);
            const quando = os.entregueEm || os.concluidaEm;
            const dias = quando ? diasEntre(quando, hojeISO()) : 0;
            return html`<tr>
              <td class="principal-cel"><a href="#/os/${os.id}"><strong>OS ${fmtNumeroOS(os.numero)}</strong></a><small>${os.status === 'pronta' ? 'pronta, aguardando retirada' : 'entregue'}</small></td>
              <td data-rotulo="Cliente">${nomeClienteOS(os)}</td>
              <td data-rotulo="Veículo"><span class="linha">${placa(v.placa)}</span></td>
              <td data-rotulo="Concluída">${quando ? html`${fmtData(quando)} ${dias > 15 ? html`<span class="texto-erro" style="font-size:12px">(${dias} dias)</span>` : ''}` : '—'}</td>
              <td data-rotulo="Total" class="num">${fmtMoeda(calc.total)}</td>
              <td data-rotulo="Falta" class="num"><strong class="texto-erro">${fmtMoeda(calc.saldo)}</strong></td>
              <td class="acoes"><span class="linha nowrap" style="gap:4px;justify-content:flex-end">
                <button type="button" class="btn btn-sm btn-ok" data-receber="${os.id}">${icone('banknote')}<span class="so-largo">Receber</span></button>
                <button type="button" class="btn-icone sm" data-cobrar="${os.id}" aria-label="Cobrar pelo WhatsApp" title="Cobrar pelo WhatsApp" style="color:var(--whats)">${icone('message-circle')}</button></span></td>
            </tr>`;
          })}</tbody><tfoot><tr><td colspan="5">${lista.length} OS</td><td class="num">${fmtMoeda(lista.reduce((s, x) => s + x.calc.saldo, 0))}</td><td></td></tr></tfoot></table></div>`
        : vazio({ icone: 'circle-check', titulo: 'Nada a receber', texto: 'Todas as OS prontas e entregues estão pagas. 🎉' }));
      for (const b of box.querySelectorAll('[data-receber]')) b.onclick = () => receberOS(store.porId('ordens', b.dataset.receber));
      for (const b of box.querySelectorAll('[data-cobrar]')) {
        b.onclick = async () => {
          const { whatsOS } = await import('../mensagens.js');
          whatsOS(store.porId('ordens', b.dataset.cobrar), 'cobranca');
        };
      }
    }

    function abaPagar(box) {
      const [ini, fim] = periodo();
      const hoje = hojeISO();
      const doMes = store.todos('despesas').filter((d) => d.vencimento >= ini && d.vencimento <= fim);
      const atrasadas = store.todos('despesas').filter((d) => !d.pago && d.vencimento < ini);
      const lista = ordenarPor([...atrasadas, ...doMes], (d) => `${d.pago ? 1 : 0}${d.vencimento}`);
      const total = doMes.reduce((s, d) => s + Number(d.valor), 0);
      const pago = doMes.filter((d) => d.pago).reduce((s, d) => s + Number(d.valor), 0);
      box.innerHTML = String(lista.length
        ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th><th>Situação</th><th class="acoes"></th></tr></thead><tbody>
          ${lista.map((d) => html`<tr class="${!d.pago && d.vencimento < hoje ? 'linha-alerta' : ''}">
            <td data-rotulo="Vencimento">${fmtData(d.vencimento)}</td>
            <td class="principal-cel"><strong>${d.descricao}</strong><small>${[d.fornecedor, d.pago && d.pagoEm ? `paga em ${fmtData(d.pagoEm)}${d.forma ? ` (${d.forma})` : ''}` : ''].filter(Boolean).join(' · ')}</small></td>
            <td data-rotulo="Categoria">${d.categoria || '—'}</td>
            <td data-rotulo="Valor" class="num"><strong>${fmtMoeda(d.valor)}</strong></td>
            <td data-rotulo="Situação">${situacaoDespesa(d)}</td>
            <td class="acoes"><span class="linha nowrap" style="gap:4px;justify-content:flex-end">
              ${!d.pago ? html`<button type="button" class="btn btn-sm" data-pagar="${d.id}">${icone('check')}<span class="so-largo">Pagar</span></button>` : ''}
              <button type="button" class="btn-icone sm" data-menu-desp="${d.id}" aria-label="Ações">${icone('ellipsis-vertical')}</button></span></td>
          </tr>`)}</tbody>
          <tfoot><tr><td colspan="3">Total do mês: ${fmtMoeda(total)} · pago ${fmtMoeda(pago)}</td><td class="num">${fmtMoeda(total - pago + atrasadas.reduce((s, d) => s + Number(d.valor), 0))}</td><td colspan="2">em aberto</td></tr></tfoot></table></div>`
        : vazio({ icone: 'receipt', titulo: `Nenhuma conta em ${nomeMes(mes)}`, texto: 'Lance aluguel, energia, fornecedores e outras despesas para saber quanto sobra no fim do mês.', acao: html`<button type="button" class="btn btn-primario" data-despesa-vazio>${icone('plus')}Lançar despesa</button>` }));
      box.querySelector('[data-despesa-vazio]')?.addEventListener('click', () => formDespesa(null, { vencimento: mes === mesAtual() ? hojeISO() : primeiroDiaMes(mes) }));
      for (const b of box.querySelectorAll('[data-pagar]')) b.onclick = () => pagarDespesa(store.porId('despesas', b.dataset.pagar));
      for (const b of box.querySelectorAll('[data-menu-desp]')) {
        b.onclick = () => {
          const d = store.porId('despesas', b.dataset.menuDesp);
          abrirMenu(b, [
            !d.pago ? { texto: 'Marcar como paga', icone: 'check', fn: () => pagarDespesa(d) } : { texto: 'Desfazer pagamento', icone: 'rotate-ccw', fn: () => store.atualizar('despesas', d.id, { pago: false, pagoEm: '', forma: '' }) },
            { texto: 'Editar', icone: 'pencil', fn: () => formDespesa(d) },
            pode('excluir') ? '-' : null,
            pode('excluir')
              ? {
                  texto: 'Excluir',
                  icone: 'trash-2',
                  perigo: true,
                  fn: async () => {
                    if (!(await confirmar({ titulo: 'Excluir despesa?', texto: `${d.descricao} — ${fmtMoeda(d.valor)}`, ok: 'Excluir', perigo: true }))) return;
                    store.remover('despesas', d.id);
                    toast('Despesa excluída', 'ok', { acao: { texto: 'Desfazer', fn: () => store.salvar('despesas', d) } });
                  },
                }
              : null,
          ]);
        };
      }
    }

    function desenhar() {
      pg.querySelector('[data-mes]').textContent = maiuscula(nomeMes(mes));
      desenharKpis();
      for (const b of pg.querySelectorAll('[data-aba]')) b.classList.toggle('ativa', b.dataset.aba === aba);
      const box = pg.querySelector('[data-conteudo]');
      if (aba === 'resumo') abaResumo(box);
      else if (aba === 'recebimentos') abaRecebimentos(box);
      else if (aba === 'receber') abaReceber(box);
      else abaPagar(box);
      for (const tr of box.querySelectorAll('tr[data-os]')) tr.onclick = (e) => {
        if (!e.target.closest('a, button')) location.hash = `#/os/${tr.dataset.os}`;
      };
    }

    for (const b of pg.querySelectorAll('[data-aba]')) {
      b.onclick = () => {
        aba = b.dataset.aba;
        desenhar();
      };
    }
    pg.querySelector('[data-ant]').onclick = () => {
      mes = addMeses(mes, -1);
      desenhar();
    };
    pg.querySelector('[data-prox]').onclick = () => {
      mes = addMeses(mes, 1);
      desenhar();
    };
    pg.querySelector('[data-atual]').onclick = () => {
      mes = mesAtual();
      desenhar();
    };
    pg.querySelector('[data-despesa]').onclick = async () => {
      const d = await formDespesa(null, { vencimento: mes === mesAtual() ? hojeISO() : primeiroDiaMes(mes) });
      if (d) {
        aba = 'pagar';
        desenhar();
      }
    };
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('ordens') || cols.has('despesas') || cols.has('*')) desenhar();
      },
    };
  },
};
