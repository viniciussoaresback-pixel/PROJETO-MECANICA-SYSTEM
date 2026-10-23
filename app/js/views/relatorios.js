// Relatórios por período: faturamento, lucro, serviços e peças mais vendidos, comissões, clientes.
import { despesasPagas, nomeClienteOS, nomeEquipe, recebimentos, veiculoOS } from '../dominio.js';
import { graficoBarras, graficoColunas } from '../graficos.js';
import { store } from '../store.js';
import { baixarArquivo, html, icone, toast } from '../ui.js';
import {
  addMeses, calcularOS, diaDe, fmtData, fmtMoeda, fmtNumero, fmtNumeroOS, gerarCSV, infoStatus, mesAtual, mesDe, nomeMes,
  ordenarPor, primeiroDiaMes, totalItem, ultimoDiaMes,
} from '../utils.js';

const PRESETS = [
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes_passado', nome: 'Mês passado' },
  { id: '3m', nome: 'Últimos 3 meses' },
  { id: '6m', nome: 'Últimos 6 meses' },
  { id: 'ano', nome: 'Este ano' },
  { id: 'livre', nome: 'Escolher datas' },
];

function intervaloPreset(id) {
  const m = mesAtual();
  if (id === 'mes_passado') {
    const a = addMeses(m, -1);
    return [primeiroDiaMes(a), ultimoDiaMes(a)];
  }
  if (id === '3m') return [primeiroDiaMes(addMeses(m, -2)), ultimoDiaMes(m)];
  if (id === '6m') return [primeiroDiaMes(addMeses(m, -5)), ultimoDiaMes(m)];
  if (id === 'ano') return [`${m.slice(0, 4)}-01-01`, `${m.slice(0, 4)}-12-31`];
  return [primeiroDiaMes(m), ultimoDiaMes(m)];
}

function calcular(ini, fim) {
  const entregues = store.todos('ordens').filter((o) => o.status === 'entregue' && diaDe(o.entregueEm) >= ini && diaDe(o.entregueEm) <= fim);
  let faturado = 0;
  let custoPecas = 0;
  let maoDeObra = 0;
  let pecasVendidas = 0;
  const servicos = new Map();
  const pecas = new Map();
  const mecanicos = new Map();
  const clientes = new Map();
  const porMes = new Map();
  for (const o of entregues) {
    const c = calcularOS(o);
    faturado += c.total;
    custoPecas += c.custoPecas;
    maoDeObra += c.servicos;
    pecasVendidas += c.pecas;
    const m = mesDe(o.entregueEm);
    porMes.set(m, (porMes.get(m) || 0) + c.total);
    const chaveCli = o.clienteId || nomeClienteOS(o);
    const cl = clientes.get(chaveCli) || { rotulo: nomeClienteOS(o), valor: 0, n: 0 };
    cl.valor += c.total;
    cl.n += 1;
    clientes.set(chaveCli, cl);
    const mec = mecanicos.get(o.mecanicoId || '') || { id: o.mecanicoId, n: 0, servicos: 0, total: 0 };
    mec.n += 1;
    mec.servicos += c.servicos;
    mec.total += c.total;
    mecanicos.set(o.mecanicoId || '', mec);
    for (const it of o.itens || []) {
      const chave = (it.refId || it.descricao).toLowerCase();
      const alvo = it.tipo === 'peca' ? pecas : servicos;
      const x = alvo.get(chave) || { rotulo: it.descricao, qtd: 0, valor: 0, custo: 0 };
      x.qtd += Number(it.qtd) || 0;
      x.valor += totalItem(it);
      x.custo += (Number(it.qtd) || 0) * (Number(it.custo) || 0);
      alvo.set(chave, x);
    }
  }
  const recs = recebimentos(ini, fim);
  const recebido = recs.reduce((s, r) => s + Number(r.valor), 0);
  const porForma = new Map();
  for (const r of recs) porForma.set(r.forma || 'Outro', (porForma.get(r.forma || 'Outro') || 0) + Number(r.valor));
  const despesas = despesasPagas(ini, fim).reduce((s, d) => s + Number(d.valor), 0);
  const abertas = store.todos('ordens').filter((o) => diaDe(o.entrada) >= ini && diaDe(o.entrada) <= fim);
  return {
    entregues, faturado, custoPecas, maoDeObra, pecasVendidas, recebido, despesas, servicos, pecas, mecanicos, clientes, porMes, porForma,
    abertas: abertas.length, canceladas: abertas.filter((o) => o.status === 'cancelada').length,
    ticket: entregues.length ? faturado / entregues.length : 0,
  };
}

function exportarOS(ini, fim) {
  const lista = ordenarPor(store.todos('ordens').filter((o) => diaDe(o.entrada) >= ini && diaDe(o.entrada) <= fim), (o) => o.numero);
  const linhas = [['Nº', 'Entrada', 'Entrega', 'Status', 'Cliente', 'Placa', 'Veículo', 'Mecânico', 'Serviços', 'Peças', 'Desconto', 'Total', 'Pago', 'Falta', 'Itens']];
  for (const o of lista) {
    const c = calcularOS(o);
    const v = veiculoOS(o);
    const n = (x) => x.toFixed(2).replace('.', ',');
    linhas.push([fmtNumeroOS(o.numero), fmtData(o.entrada), fmtData(o.entregueEm), infoStatus(o.status).nome, nomeClienteOS(o), v.placa, v.desc, nomeEquipe(o.mecanicoId), n(c.servicos), n(c.pecas), n(c.desconto), n(c.total), n(c.pago), n(Math.max(0, c.saldo)), (o.itens || []).map((it) => `${it.qtd}x ${it.descricao}`).join(' | ')]);
  }
  baixarArquivo(`ordens-de-servico-${ini}-a-${fim}.csv`, gerarCSV(linhas), 'text/csv');
  toast(`${lista.length} OS exportadas para planilha`);
}

export default {
  montar(el) {
    let preset = 'mes';
    let [ini, fim] = intervaloPreset(preset);
    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="chips" data-presets>${PRESETS.map((p) => html`<button type="button" class="chip" data-preset="${p.id}">${p.nome}</button>`)}</div>
        <div class="linha" data-livre hidden>
          <input type="date" data-ini aria-label="Data inicial" style="width:auto"> <span class="texto-3">até</span> <input type="date" data-fim aria-label="Data final" style="width:auto">
        </div>
        <span class="espaco"></span>
        <button type="button" class="btn" data-csv>${icone('download')}<span class="so-largo">Exportar OS</span></button>
        <button type="button" class="btn btn-primario" data-imprimir>${icone('printer')}<span class="so-largo">Imprimir</span></button>
      </div>
      <div data-rel></div>
    </div>`);
    const pg = el.firstElementChild;
    const $ini = pg.querySelector('[data-ini]');
    const $fim = pg.querySelector('[data-fim]');

    function textoPeriodo() {
      if (preset === 'mes' || preset === 'mes_passado') return nomeMes(ini.slice(0, 7));
      return `${fmtData(ini)} a ${fmtData(fim)}`;
    }

    function blocos(r, paraImpressao = false) {
      const topServ = ordenarPor([...r.servicos.values()], (x) => x.valor, true).slice(0, 10);
      const topPecas = ordenarPor([...r.pecas.values()], (x) => x.valor, true).slice(0, 10);
      const topCli = ordenarPor([...r.clientes.values()], (x) => x.valor, true).slice(0, 10);
      const mecs = ordenarPor([...r.mecanicos.values()], (x) => x.servicos, true);
      const lucroBruto = r.faturado - r.custoPecas;
      const resultado = r.recebido - r.despesas;
      const tabela = (cab, linhas) => html`<div class="tabela-wrap"><table class="${paraImpressao ? 'doc-tabela' : 'tabela responsiva'}"><thead><tr>${cab.map((c, i) => html`<th class="${i ? 'num' : ''}">${c}</th>`)}</tr></thead><tbody>${linhas.length ? linhas.map((l) => html`<tr>${l.map((c, i) => html`<td class="${i ? 'num' : ''}" data-rotulo="${cab[i]}">${c}</td>`)}</tr>`) : html`<tr><td colspan="${cab.length}" class="texto-3">Sem dados no período.</td></tr>`}</tbody></table></div>`;
      const meses = [];
      for (let m = ini.slice(0, 7); m <= fim.slice(0, 7); m = addMeses(m, 1)) meses.push(m);
      return {
        kpis: [
          ['Faturado (OS entregues)', fmtMoeda(r.faturado), `${r.entregues.length} OS entregues`],
          ['Recebido no período', fmtMoeda(r.recebido), 'pagamentos registrados'],
          ['Ticket médio', fmtMoeda(r.ticket), 'por OS entregue'],
          ['Lucro bruto', fmtMoeda(lucroBruto), `faturado − custo das peças (${fmtMoeda(r.custoPecas)})`],
          ['Mão de obra', fmtMoeda(r.maoDeObra), 'serviços vendidos'],
          ['Peças vendidas', fmtMoeda(r.pecasVendidas), 'valor de venda'],
          ['Despesas pagas', fmtMoeda(r.despesas), 'saídas do financeiro'],
          ['Resultado do caixa', fmtMoeda(resultado), 'recebido − despesas pagas'],
        ],
        meses,
        servicos: tabela(['Serviço', 'Vezes', 'Valor'], topServ.map((x) => [x.rotulo, fmtNumero(x.qtd), fmtMoeda(x.valor)])),
        pecas: tabela(['Peça', 'Qtd', 'Venda', 'Lucro'], topPecas.map((x) => [x.rotulo, fmtNumero(x.qtd), fmtMoeda(x.valor), fmtMoeda(x.valor - x.custo)])),
        mecanicos: tabela(['Mecânico', 'OS', 'Mão de obra', 'Comissão'], mecs.map((m) => {
          const eq = store.porId('equipe', m.id);
          const pct = Number(eq?.comissao) || 0;
          return [eq?.nome || (m.id ? 'Funcionário removido' : 'Sem mecânico definido'), fmtNumero(m.n), fmtMoeda(m.servicos), pct ? `${fmtMoeda((m.servicos * pct) / 100)} (${pct}%)` : '—'];
        })),
        clientes: tabela(['Cliente', 'OS', 'Total'], topCli.map((x) => [x.rotulo, fmtNumero(x.n), fmtMoeda(x.valor)])),
        formas: ordenarPor([...r.porForma].map(([rotulo, valor]) => ({ rotulo, valor })), (x) => x.valor, true),
      };
    }

    function desenhar() {
      for (const b of pg.querySelectorAll('[data-preset]')) b.classList.toggle('ativo', b.dataset.preset === preset);
      pg.querySelector('[data-livre]').hidden = preset !== 'livre';
      $ini.value = ini;
      $fim.value = fim;
      const r = calcular(ini, fim);
      const b = blocos(r);
      pg.querySelector('[data-rel]').innerHTML = String(html`
        <p class="texto-2 mb-2">Período: <strong>${textoPeriodo()}</strong> · ${r.abertas} OS abertas no período${r.canceladas ? `, ${r.canceladas} cancelada(s)` : ''}.</p>
        <div class="grade grade-4">${b.kpis.map(([rot, val, sub], i) => html`<div class="cartao kpi ${['', 'verde', 'violeta', 'ciano', '', '', 'vermelho', ''][i]}"><span class="kpi-rotulo">${rot}</span><span class="kpi-valor" style="font-size:22px">${val}</span><span class="kpi-sub">${sub}</span></div>`)}</div>
        ${b.meses.length > 1 ? html`<section class="cartao mt-2"><div class="cartao-cab"><h3>${icone('chart-column')}Faturado por mês</h3><span class="texto-3">OS entregues</span></div>
          <div class="cartao-corpo">${graficoColunas(b.meses.map((m) => ({ rotulo: nomeMes(m, true), valor: r.porMes.get(m) || 0 })), { destaque: b.meses.indexOf(mesAtual()), rotuloAria: 'Faturado por mês' })}</div></section>` : ''}
        <div class="grade grade-1-1 mt-2">
          <section class="cartao"><div class="cartao-cab"><h3>${icone('wrench')}Serviços mais vendidos</h3></div><div class="cartao-corpo sem-pad">${b.servicos}</div></section>
          <section class="cartao"><div class="cartao-cab"><h3>${icone('package')}Peças mais vendidas</h3></div><div class="cartao-corpo sem-pad">${b.pecas}</div></section>
          <section class="cartao"><div class="cartao-cab"><h3>${icone('hard-hat')}Desempenho e comissão por mecânico</h3></div><div class="cartao-corpo sem-pad">${b.mecanicos}</div></section>
          <section class="cartao"><div class="cartao-cab"><h3>${icone('users')}Clientes que mais gastaram</h3></div><div class="cartao-corpo sem-pad">${b.clientes}</div></section>
          <section class="cartao"><div class="cartao-cab"><h3>${icone('banknote')}Recebido por forma de pagamento</h3></div><div class="cartao-corpo">${b.formas.length ? graficoBarras(b.formas) : html`<p class="texto-3">Sem recebimentos no período.</p>`}</div></section>
        </div>`);
    }

    for (const bt of pg.querySelectorAll('[data-preset]')) {
      bt.onclick = () => {
        preset = bt.dataset.preset;
        if (preset !== 'livre') [ini, fim] = intervaloPreset(preset);
        desenhar();
      };
    }
    const mudarDatas = () => {
      if ($ini.value && $fim.value && $ini.value <= $fim.value) {
        ini = $ini.value;
        fim = $fim.value;
        desenhar();
      }
    };
    $ini.onchange = mudarDatas;
    $fim.onchange = mudarDatas;
    pg.querySelector('[data-csv]').onclick = () => exportarOS(ini, fim);
    pg.querySelector('[data-imprimir]').onclick = async () => {
      const r = calcular(ini, fim);
      const b = blocos(r, true);
      const { documentoRelatorio, visualizar } = await import('../impressao.js');
      visualizar('Relatório', documentoRelatorio('Relatório gerencial', textoPeriodo(), html`
        <div class="doc-kpis">${b.kpis.map(([rot, val]) => html`<div><span>${rot}</span><strong>${val}</strong></div>`)}</div>
        <h3>Serviços mais vendidos</h3>${b.servicos}
        <h3>Peças mais vendidas</h3>${b.pecas}
        <h3>Desempenho e comissão por mecânico</h3>${b.mecanicos}
        <h3>Clientes que mais gastaram</h3>${b.clientes}
        <h3>Recebido por forma de pagamento</h3>
        <table class="doc-tabela"><tbody>${b.formas.map((f) => html`<tr><td>${f.rotulo}</td><td class="num">${fmtMoeda(f.valor)}</td></tr>`)}</tbody></table>`));
    };
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('ordens') || cols.has('despesas') || cols.has('equipe') || cols.has('*')) desenhar();
      },
    };
  },
};

