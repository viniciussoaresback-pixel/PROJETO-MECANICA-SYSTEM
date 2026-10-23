// Ficha do veículo: dados, dono e histórico de serviços (linha do tempo).
import { definirTitulo } from '../app.js';
import { descVeiculo, lembretesRevisao, ordensDoVeiculo } from '../dominio.js';
import { formVeiculo } from '../formularios.js';
import { pode, store } from '../store.js';
import { html, icone, placa, seloStatus, vazio } from '../ui.js';
import { calcularOS, diasEntre, fmtData, fmtMoeda, fmtNumero, fmtNumeroOS, hojeISO, mascaraTelefone } from '../utils.js';
import { excluirVeiculo } from './veiculos.js';

export default {
  montar(el, { partes }) {
    const id = partes[1];
    const valores = pode('valores');

    function desenhar() {
      const v = store.porId('veiculos', id);
      if (!v) {
        el.innerHTML = String(vazio({ icone: 'car', titulo: 'Veículo não encontrado', acao: html`<a class="btn btn-primario" href="#/veiculos">Ver veículos</a>` }));
        return;
      }
      definirTitulo('Veículos');
      const dono = store.porId('clientes', v.clienteId);
      const ordens = ordensDoVeiculo(v.id);
      const validas = ordens.filter((o) => o.status !== 'cancelada');
      const gasto = validas.filter((o) => ['pronta', 'entregue'].includes(o.status)).reduce((s, o) => s + calcularOS(o).total, 0);
      const rev = lembretesRevisao(3650).find((x) => x.os.veiculoId === v.id);
      el.innerHTML = String(html`<div class="pagina">
        <div>
          <a class="voltar texto-3" href="#/veiculos" style="font-size:13px;font-weight:600">${icone('chevron-left')}Veículos</a>
          <div class="detalhe-cab mt-1">
            <div class="detalhe-avatar">${icone('car')}</div>
            <div class="titulos">
              <h2>${descVeiculo(v)} ${placa(v.placa)}</h2>
              <div class="sub">${dono ? html`<span>Dono: <a href="#/clientes/${dono.id}">${dono.nome}</a></span>${dono.telefone ? html`<span>${mascaraTelefone(dono.telefone)}</span>` : ''}` : html`<span class="texto-aviso">Sem dono cadastrado</span>`}</div>
            </div>
            <div class="grupo-botoes">
              <button type="button" class="btn" data-editar>${icone('pencil')}<span class="so-largo">Editar</span></button>
              ${pode('excluir') ? html`<button type="button" class="btn-icone perigo" data-excluir aria-label="Excluir veículo">${icone('trash-2')}</button>` : ''}
              <a class="btn btn-primario" href="#/os/nova?veiculo=${v.id}">${icone('plus')}Nova OS</a>
            </div>
          </div>
        </div>
        <div class="grade grade-2-1">
          <section class="cartao">
            <div class="cartao-cab"><h3>${icone('history')}Histórico de serviços</h3><span class="texto-3">${validas.length} OS</span></div>
            <div class="cartao-corpo">
              ${ordens.length
                ? html`<ul class="linha-tempo">${ordens.map((o) => {
                    const c = calcularOS(o);
                    return html`<li><span class="marcador"></span>
                      <div class="lt-cab"><a href="#/os/${o.id}"><strong>OS ${fmtNumeroOS(o.numero)}</strong></a><span class="texto-3">${fmtData(o.entrada)}</span>${seloStatus(o.status)}${o.km ? html`<span class="texto-3">${fmtNumero(o.km)} km</span>` : ''}${valores ? html`<span class="espaco"></span><strong>${fmtMoeda(c.total)}</strong>` : ''}</div>
                      <div class="lt-itens">${(o.itens || []).map((it) => it.descricao).join(' · ') || o.relato || 'Sem itens'}</div>
                    </li>`;
                  })}</ul>`
                : html`<div class="vazio-mini">Nenhum serviço registrado para este veículo.</div>`}
            </div>
          </section>
          <div class="grade" style="align-content:start">
            ${rev ? html`<div class="aviso ${rev.faltam < 0 ? 'aviso-erro' : rev.faltam <= 30 ? 'aviso-alerta' : 'aviso-info'}">${icone('bell')}<span><strong>Próxima revisão:</strong> ${fmtData(rev.data)}${rev.os.proximaRevisao?.km ? ` ou ${fmtNumero(rev.os.proximaRevisao.km)} km` : ''} (${rev.faltam < 0 ? `venceu há ${-rev.faltam} dias` : `em ${diasEntre(hojeISO(), rev.data)} dias`})</span></div>` : ''}
            ${valores ? html`<section class="cartao"><div class="cartao-corpo"><div class="mini-kpis">
              <div class="mini-kpi"><span>Serviços</span><strong>${validas.length}</strong></div>
              <div class="mini-kpi"><span>Total gasto</span><strong>${fmtMoeda(gasto)}</strong></div>
            </div></div></section>` : ''}
            <section class="cartao">
              <div class="cartao-cab"><h3>${icone('car')}Dados do veículo</h3></div>
              <div class="cartao-corpo"><dl class="dados-lista">
                <dt>Placa</dt><dd>${v.placa ? placa(v.placa) : 'sem placa'}</dd>
                <dt>Marca</dt><dd>${v.marca || '—'}</dd>
                <dt>Modelo</dt><dd>${v.modelo || '—'}</dd>
                <dt>Ano</dt><dd>${v.ano || '—'}</dd>
                <dt>Cor</dt><dd>${v.cor || '—'}</dd>
                <dt>Combustível</dt><dd>${v.combustivel || '—'}</dd>
                <dt>KM atual</dt><dd>${v.km ? `${fmtNumero(v.km)} km` : '—'}</dd>
                <dt>Chassi</dt><dd>${v.chassi || '—'}</dd>
                ${v.observacoes ? html`<dt>Observações</dt><dd style="white-space:pre-wrap">${v.observacoes}</dd>` : ''}
              </dl></div>
            </section>
          </div>
        </div>
      </div>`);
      const pg = el.firstElementChild;
      pg.querySelector('[data-editar]').onclick = () => formVeiculo(v);
      pg.querySelector('[data-excluir]')?.addEventListener('click', async () => {
        if (await excluirVeiculo(v)) location.hash = '#/veiculos';
      });
    }
    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('veiculos') || cols.has('clientes') || cols.has('ordens') || cols.has('*')) desenhar();
      },
    };
  },
};
