// Painel: visão geral do dia da oficina.
import {
  aReceber, agendaDoDia, despesasAVencer, estoqueBaixo, lembretesRevisao, nomeClienteOS, orcamentosParados, osAtrasadas, veiculoOS,
} from '../dominio.js';
import { graficoColunas } from '../graficos.js';
import { pode, store } from '../store.js';
import { html, icone, placa, seloStatus, toast } from '../ui.js';
import {
  addMeses, agoraISO, calcularOS, DIAS_SEMANA, diasEntre, fmtData, fmtDataCurta, fmtMoeda, fmtNumeroOS, hojeISO, MESES, mesAtual,
  mesDe, nomeMes, STATUS_ABERTOS, STATUS_OS,
} from '../utils.js';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataExtensa() {
  const d = new Date();
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function totaisMes(mes) {
  let recebido = 0;
  for (const o of store.todos('ordens')) {
    if (o.status === 'cancelada') continue;
    for (const p of o.pagamentos || []) if (mesDe(p.data) === mes) recebido += Number(p.valor) || 0;
  }
  const entregues = store.todos('ordens').filter((o) => o.status === 'entregue' && mesDe(o.entregueEm) === mes);
  const faturado = entregues.reduce((s, o) => s + calcularOS(o).total, 0);
  return { recebido, entregues: entregues.length, faturado };
}

function variacao(atual, anterior) {
  if (!anterior) return '';
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (!Number.isFinite(p) || p === 0) return html`igual a ${nomeMes(addMeses(mesAtual(), -1)).split(' ')[0]}`;
  return html`<span class="${p > 0 ? 'sobe' : 'desce'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</span> vs. mesmo período de ${nomeMes(addMeses(mesAtual(), -1)).split(' ')[0]}`;
}

// Recebido no mês anterior até o mesmo dia (comparação justa).
function recebidoMesAnteriorAteHoje() {
  const mes = addMeses(mesAtual(), -1);
  const dia = new Date().getDate();
  let t = 0;
  for (const o of store.todos('ordens')) {
    if (o.status === 'cancelada') continue;
    for (const p of o.pagamentos || []) {
      if (mesDe(p.data) === mes && Number(String(p.data).slice(8, 10)) <= dia) t += Number(p.valor) || 0;
    }
  }
  return t;
}

function primeirosPassos() {
  const cfg = store.estado.config;
  const passos = [
    { feito: !!cfg.nome && !!(cfg.telefone || cfg.whatsapp), texto: 'Preencha os dados da oficina (nome, telefone, logo)', hash: '#/config', permissao: 'config-oficina' },
    { feito: store.todos('servicos').length > 0, texto: 'Monte sua tabela de serviços (dá para carregar uma lista pronta)', hash: '#/servicos' },
    { feito: store.todos('equipe').length > 0, texto: 'Cadastre os mecânicos da equipe', hash: '#/equipe', permissao: 'equipe' },
    { feito: store.todos('clientes').length > 0, texto: 'Cadastre o primeiro cliente e o veículo', hash: '#/clientes?novo=1' },
    { feito: store.todos('ordens').length > 0, texto: 'Abra a primeira ordem de serviço', hash: '#/os/nova' },
  ].filter((p) => !p.permissao || pode(p.permissao));
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('sparkles')}Primeiros passos</h3><span class="texto-3">${passos.filter((p) => p.feito).length} de ${passos.length}</span></div>
    <ul class="lista mt-1">${passos.map((p) => html`<li><a class="lista-item" href="${p.hash}">
      <span class="icone-redondo ${p.feito ? 'verde' : ''}">${icone(p.feito ? 'circle-check' : 'arrow-right')}</span>
      <span class="principal-txt"><strong style="${p.feito ? 'text-decoration:line-through;opacity:.6' : ''}">${p.texto}</strong></span>
    </a></li>`)}</ul>
  </section>`;
}

function kpis() {
  const ordens = store.todos('ordens');
  const abertas = ordens.filter((o) => STATUS_ABERTOS.includes(o.status));
  const prontas = abertas.filter((o) => o.status === 'pronta').length;
  if (!pode('financeiro')) {
    const exec = abertas.filter((o) => o.status === 'execucao').length;
    const peca = abertas.filter((o) => o.status === 'aguardando_peca').length;
    return html`<section class="grade grade-4">
      <a class="cartao kpi" href="#/os"><span class="kpi-rotulo">${icone('car-front')}Carros na oficina</span><span class="kpi-valor">${abertas.length}</span><span class="kpi-sub">${prontas} pronto(s) para retirada</span></a>
      <a class="cartao kpi ciano" href="#/os?status=execucao"><span class="kpi-rotulo">${icone('wrench')}Em execução</span><span class="kpi-valor">${exec}</span><span class="kpi-sub">serviços em andamento</span></a>
      <a class="cartao kpi laranja" href="#/os?status=aguardando_peca"><span class="kpi-rotulo">${icone('package')}Aguardando peça</span><span class="kpi-valor">${peca}</span><span class="kpi-sub">esperando chegar</span></a>
      <a class="cartao kpi violeta" href="#/agenda"><span class="kpi-rotulo">${icone('calendar')}Agenda de hoje</span><span class="kpi-valor">${agendaDoDia().length}</span><span class="kpi-sub">agendamentos</span></a>
    </section>`;
  }
  const mes = mesAtual();
  const t = totaisMes(mes);
  const ant = recebidoMesAnteriorAteHoje();
  const receber = aReceber();
  const totalReceber = receber.reduce((s, x) => s + x.calc.saldo, 0);
  const ticket = t.entregues ? t.faturado / t.entregues : 0;
  return html`<section class="grade grade-4">
    <a class="cartao kpi" href="#/os"><span class="kpi-rotulo">${icone('car-front')}Carros na oficina</span><span class="kpi-valor">${abertas.length}</span><span class="kpi-sub">${prontas ? html`<strong>${prontas}</strong> pronto(s) para retirada` : 'nenhum pronto para retirada'}</span></a>
    <a class="cartao kpi verde" href="#/financeiro"><span class="kpi-rotulo">${icone('banknote')}Recebido em ${MESES[Number(mes.slice(5)) - 1]}</span><span class="kpi-valor">${fmtMoeda(t.recebido)}</span><span class="kpi-sub">${variacao(t.recebido, ant) || 'pagamentos registrados no mês'}</span></a>
    <a class="cartao kpi laranja" href="#/financeiro?aba=receber"><span class="kpi-rotulo">${icone('hand-coins')}A receber</span><span class="kpi-valor">${fmtMoeda(totalReceber)}</span><span class="kpi-sub">${receber.length} OS com saldo em aberto</span></a>
    <a class="cartao kpi violeta" href="#/relatorios"><span class="kpi-rotulo">${icone('receipt')}Ticket médio do mês</span><span class="kpi-valor">${fmtMoeda(ticket)}</span><span class="kpi-sub">${t.entregues} OS entregue(s) no mês</span></a>
  </section>`;
}

function fluxo() {
  const ordens = store.todos('ordens');
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('columns-3')}Oficina agora</h3><a class="acao" href="#/os?visao=quadro">Abrir quadro →</a></div>
    <div class="cartao-corpo"><div class="fluxo-oficina">
      ${STATUS_OS.filter((s) => STATUS_ABERTOS.includes(s.id)).map((s) => {
        const lista = ordens.filter((o) => o.status === s.id);
        const valor = lista.reduce((acc, o) => acc + calcularOS(o).total, 0);
        return html`<a class="fluxo-etapa" href="#/os?status=${s.id}">${seloStatus(s.id)}<strong>${lista.length}</strong>${pode('valores') ? html`<small>${fmtMoeda(valor)}</small>` : ''}</a>`;
      })}
    </div></div>
  </section>`;
}

function grafico() {
  const meses = Array.from({ length: 6 }, (_, i) => addMeses(mesAtual(), i - 5));
  if (pode('financeiro')) {
    const dados = meses.map((m) => {
      const t = totaisMes(m);
      return { rotulo: nomeMes(m, true), valor: t.recebido, detalhe: `${t.entregues} OS entregues` };
    });
    return html`<section class="cartao">
      <div class="cartao-cab"><h3>${icone('chart-column')}Recebido por mês</h3><span class="texto-3">últimos 6 meses</span></div>
      <div class="cartao-corpo">${graficoColunas(dados, { rotuloAria: 'Valor recebido por mês nos últimos 6 meses' })}</div>
    </section>`;
  }
  const dados = meses.map((m) => ({ rotulo: nomeMes(m, true), valor: store.todos('ordens').filter((o) => o.status === 'entregue' && mesDe(o.entregueEm) === m).length }));
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('chart-column')}Carros entregues por mês</h3><span class="texto-3">últimos 6 meses</span></div>
    <div class="cartao-corpo">${graficoColunas(dados, { formatar: (v) => `${v} OS`, rotuloAria: 'OS entregues por mês' })}</div>
  </section>`;
}

const NOMES_AG = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Compareceu', faltou: 'Faltou', cancelado: 'Cancelado' };
const CORES_AG = { agendado: 'azul', confirmado: 'verde', concluido: 'cinza', faltou: 'vermelho', cancelado: 'vermelho' };

function agenda() {
  const hoje = agendaDoDia();
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('calendar')}Agenda de hoje</h3><a class="acao" href="#/agenda">Ver semana →</a></div>
    <div class="cartao-corpo sem-pad">
      ${hoje.length
        ? html`<ul class="lista">${hoje.map((a) => {
            const c = store.porId('clientes', a.clienteId);
            const v = store.porId('veiculos', a.veiculoId);
            return html`<li><a class="lista-item" href="#/agenda?ag=${a.id}">
              <span class="lista-hora">${a.hora}</span>
              <span class="principal-txt"><strong>${c?.nome || a.clienteNome || 'Cliente'}</strong><small>${[a.servico, v ? `${v.modelo}` : a.veiculoDesc].filter(Boolean).join(' · ')}</small></span>
              <span class="selo selo-${CORES_AG[a.status] || 'azul'}">${NOMES_AG[a.status] || a.status}</span>
            </a></li>`;
          })}</ul>`
        : html`<div class="vazio-mini">Nenhum agendamento para hoje. <a href="#/agenda?novo=1">Agendar</a></div>`}
    </div>
  </section>`;
}

function atencao() {
  const itens = [];
  for (const o of osAtrasadas()) {
    const v = veiculoOS(o);
    itens.push(html`<li><a class="lista-item" href="#/os/${o.id}"><span class="icone-redondo vermelho">${icone('clock')}</span>
      <span class="principal-txt"><strong>OS ${fmtNumeroOS(o.numero)} atrasada · ${v.desc || nomeClienteOS(o)}</strong><small>Previsão era ${fmtData(o.previsao)} · ${nomeClienteOS(o)}</small></span></a></li>`);
  }
  for (const o of orcamentosParados()) {
    itens.push(html`<li><a class="lista-item" href="#/os/${o.id}"><span class="icone-redondo amarelo">${icone('file-text')}</span>
      <span class="principal-txt"><strong>Orçamento ${fmtNumeroOS(o.numero)} sem resposta há ${diasEntre(o.entrada, hojeISO())} dias</strong><small>${nomeClienteOS(o)} · ${pode('valores') ? fmtMoeda(calcularOS(o).total) : ''}</small></span></a></li>`);
  }
  if (pode('financeiro')) {
    for (const d of despesasAVencer(3)) {
      const vencida = d.vencimento < hojeISO();
      itens.push(html`<li><a class="lista-item" href="#/financeiro?aba=pagar"><span class="icone-redondo ${vencida ? 'vermelho' : 'amarelo'}">${icone('receipt')}</span>
        <span class="principal-txt"><strong>${d.descricao} — ${fmtMoeda(d.valor)}</strong><small>${vencida ? `Venceu em ${fmtData(d.vencimento)}` : d.vencimento === hojeISO() ? 'Vence hoje' : `Vence em ${fmtData(d.vencimento)}`}</small></span></a></li>`);
    }
  }
  const baixo = estoqueBaixo();
  if (baixo.length) {
    itens.push(html`<li><a class="lista-item" href="#/estoque?filtro=baixo"><span class="icone-redondo amarelo">${icone('package-minus')}</span>
      <span class="principal-txt"><strong>${baixo.length} ${baixo.length === 1 ? 'peça está' : 'peças estão'} com estoque baixo</strong><small>${baixo.slice(0, 3).map((p) => p.descricao).join(', ')}${baixo.length > 3 ? '…' : ''}</small></span></a></li>`);
  }
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('triangle-alert')}Precisa de atenção</h3></div>
    <div class="cartao-corpo sem-pad">${itens.length ? html`<ul class="lista">${itens}</ul>` : html`<div class="vazio-mini">${icone('circle-check')} Tudo em dia por aqui.</div>`}</div>
  </section>`;
}

function revisoes() {
  const lista = lembretesRevisao(30).slice(0, 8);
  return html`<section class="cartao">
    <div class="cartao-cab"><h3>${icone('bell')}Revisões chegando</h3><span class="texto-3">próximos 30 dias</span></div>
    <div class="cartao-corpo sem-pad">
      ${lista.length
        ? html`<ul class="lista">${lista.map((x) => {
            const v = veiculoOS(x.os);
            const quando = x.faltam < 0 ? `venceu há ${-x.faltam} dia(s)` : x.faltam === 0 ? 'vence hoje' : `em ${x.faltam} dia(s) · ${fmtDataCurta(x.data)}`;
            return html`<li class="lista-item">
              ${placa(v.placa)}
              <span class="principal-txt"><strong>${nomeClienteOS(x.os)}</strong><small>${v.desc} · revisão ${quando}${x.avisado ? ' · já avisado' : ''}</small></span>
              <button type="button" class="btn btn-sm ${x.avisado ? '' : 'btn-whats'}" data-lembrar="${x.os.id}">${icone('message-circle')}<span class="so-largo">${x.avisado ? 'Avisar de novo' : 'Avisar'}</span></button>
            </li>`;
          })}</ul>`
        : html`<div class="vazio-mini">Nenhuma revisão prevista. Ao fechar uma OS, preencha “Próxima revisão” para o sistema lembrar você.</div>`}
    </div>
  </section>`;
}

export default {
  montar(el) {
    const desenhar = () => {
      const nome = (store.estado.usuario?.nome || '').split(' ')[0];
      const vazio = store.todos('ordens').length === 0;
      el.innerHTML = String(html`<div class="pagina">
        <div class="pagina-cab saudacao">
          <div><h2>${saudacao()}${nome && nome !== 'Visitante' ? `, ${nome}` : ''}!</h2><p>${dataExtensa()}</p></div>
          <div class="grupo-botoes">
            <a class="btn" href="#/agenda?novo=1">${icone('calendar-clock')}<span class="so-largo">Agendar</span></a>
            <a class="btn" href="#/clientes?novo=1">${icone('user-plus')}<span class="so-largo">Novo cliente</span></a>
            <a class="btn btn-primario" href="#/os/nova">${icone('plus')}Nova OS</a>
          </div>
        </div>
        ${vazio ? primeirosPassos() : ''}
        ${kpis()}
        ${fluxo()}
        <div class="grade grade-2-1">${grafico()}${agenda()}</div>
        <div class="grade grade-1-1">${atencao()}${revisoes()}</div>
      </div>`);
      for (const b of el.querySelectorAll('[data-lembrar]')) {
        b.onclick = async () => {
          const os = store.porId('ordens', b.dataset.lembrar);
          const { whatsOS } = await import('../mensagens.js');
          whatsOS(os, 'revisao', {
            aoEnviar: () => {
              store.atualizar('ordens', os.id, { lembreteAvisadoEm: agoraISO() });
              toast('Lembrete marcado como enviado');
            },
          });
        };
      }
    };
    desenhar();
    return { atualizar: desenhar };
  },
};
