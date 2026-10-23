// Agenda da semana: agendamentos por dia, confirmação por WhatsApp e abertura de OS.
import { substituirHash } from '../app.js';
import { formAgendamento } from '../formularios.js';
import { store } from '../store.js';
import { html, icone } from '../ui.js';
import { addDias, DIAS_SEMANA, fmtDataCurta, hojeISO, MESES, ordenarPor, paraData } from '../utils.js';

function inicioSemana(dia) {
  const d = paraData(dia);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  return addDias(dia, -dow);
}

function tituloSemana(ini) {
  const a = paraData(ini);
  const b = paraData(addDias(ini, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

const NOMES = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Compareceu', faltou: 'Faltou', cancelado: 'Cancelado' };

export default {
  montar(el, { query }) {
    let semana = inicioSemana(hojeISO());
    if (query.ag) {
      const a = store.porId('agenda', query.ag);
      if (a) semana = inicioSemana(a.data);
    }
    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="agenda-nav">
          <button type="button" class="btn-icone" data-ant aria-label="Semana anterior">${icone('chevron-left')}</button>
          <h3 data-titulo></h3>
          <button type="button" class="btn-icone" data-prox aria-label="Próxima semana">${icone('chevron-right')}</button>
          <button type="button" class="btn btn-sm" data-hoje>Hoje</button>
        </div>
        <span class="espaco"></span>
        <span class="texto-3" data-resumo></span>
        <button type="button" class="btn btn-primario" data-novo>${icone('calendar-clock')}Novo agendamento</button>
      </div>
      <div class="semana" data-semana></div>
    </div>`);
    const pg = el.firstElementChild;

    async function abrir(ag, padrao) {
      const r = await formAgendamento(ag, padrao);
      if (r?.acao === 'os') location.hash = `#/os/nova?agenda=${r.ag.id}`;
    }

    function desenhar() {
      const hoje = hojeISO();
      pg.querySelector('[data-titulo]').textContent = tituloSemana(semana);
      const dias = Array.from({ length: 7 }, (_, i) => addDias(semana, i));
      const todos = store.todos('agenda');
      const daSemana = todos.filter((a) => a.data >= dias[0] && a.data <= dias[6] && a.status !== 'cancelado');
      pg.querySelector('[data-resumo]').textContent = daSemana.length ? `${daSemana.length} agendamento(s) na semana` : '';
      pg.querySelector('[data-semana]').innerHTML = String(html`${dias.map((d) => {
        const lista = ordenarPor(todos.filter((a) => a.data === d), (a) => a.hora || '');
        const dt = paraData(d);
        return html`<section class="dia ${d === hoje ? 'hoje' : ''} ${d < hoje ? 'passado' : ''}" aria-label="${DIAS_SEMANA[dt.getDay()]} ${fmtDataCurta(d)}">
          <div class="dia-cab"><strong>${d === hoje ? 'Hoje' : DIAS_SEMANA[dt.getDay()]}</strong><span>${dt.getDate()}</span></div>
          <div class="dia-corpo">
            ${lista.map((a) => {
              const c = store.porId('clientes', a.clienteId);
              const v = store.porId('veiculos', a.veiculoId);
              return html`<button type="button" class="ag-card ${a.status}" data-ag="${a.id}" title="${NOMES[a.status] || ''}">
                <strong>${a.hora}${a.osId ? html` · ${icone('clipboard-list')}` : ''}</strong>
                <span class="ag-cli">${c?.nome || a.clienteNome || 'Cliente'}</span>
                <span class="ag-serv">${[a.servico, v ? v.modelo : a.veiculoDesc].filter(Boolean).join(' · ') || NOMES[a.status]}</span>
              </button>`;
            })}
            <button type="button" class="dia-add" data-add="${d}">${icone('plus')}Agendar</button>
          </div>
        </section>`;
      })}`);
      for (const b of pg.querySelectorAll('[data-ag]')) b.onclick = () => abrir(store.porId('agenda', b.dataset.ag));
      for (const b of pg.querySelectorAll('[data-add]')) b.onclick = () => abrir(null, { data: b.dataset.add, hora: '08:00' });
    }

    pg.querySelector('[data-ant]').onclick = () => {
      semana = addDias(semana, -7);
      desenhar();
    };
    pg.querySelector('[data-prox]').onclick = () => {
      semana = addDias(semana, 7);
      desenhar();
    };
    pg.querySelector('[data-hoje]').onclick = () => {
      semana = inicioSemana(hojeISO());
      desenhar();
    };
    pg.querySelector('[data-novo]').onclick = () => abrir(null, { data: hojeISO() < semana ? semana : hojeISO(), hora: '08:00' });
    desenhar();
    // No celular os dias ficam um embaixo do outro: já mostra o dia de hoje.
    if (window.innerWidth <= 760 && !query.ag) requestAnimationFrame(() => pg.querySelector('.dia.hoje')?.scrollIntoView({ block: 'start' }));
    if (query.novo) {
      substituirHash('#/agenda');
      setTimeout(() => abrir(null, { data: hojeISO(), hora: '08:00' }), 50);
    } else if (query.ag) {
      substituirHash('#/agenda');
      const a = store.porId('agenda', query.ag);
      if (a) setTimeout(() => abrir(a), 50);
    }
    return {
      atualizar(cols) {
        if (cols.has('agenda') || cols.has('clientes') || cols.has('veiculos') || cols.has('*')) desenhar();
      },
    };
  },
};
