// Ficha do cliente: dados, veículos e histórico de ordens de serviço.
import { definirTitulo } from '../app.js';
import { descVeiculo, ordensDoCliente, resumoCliente, veiculosDoCliente } from '../dominio.js';
import { formCliente, formVeiculo } from '../formularios.js';
import { enviarWhatsApp } from '../mensagens.js';
import { pode, store } from '../store.js';
import { html, icone, iniciais, placa, seloPagamento, seloStatus, vazio } from '../ui.js';
import { calcularOS, fmtData, fmtMoeda, fmtNumero, fmtNumeroOS, mascaraCEP, mascaraDocumento, mascaraTelefone } from '../utils.js';
import { excluirCliente } from './clientes.js';

export default {
  montar(el, { partes }) {
    const id = partes[1];
    const valores = pode('valores');

    function desenhar() {
      const c = store.porId('clientes', id);
      if (!c) {
        el.innerHTML = String(vazio({ icone: 'users', titulo: 'Cliente não encontrado', texto: 'O cadastro pode ter sido excluído.', acao: html`<a class="btn btn-primario" href="#/clientes">Ver clientes</a>` }));
        return;
      }
      definirTitulo('Clientes');
      const r = resumoCliente(c.id);
      const veics = veiculosDoCliente(c.id);
      const ordens = ordensDoCliente(c.id);
      const end = [c.endereco && `${c.endereco}${c.numero ? `, ${c.numero}` : ''}${c.complemento ? ` (${c.complemento})` : ''}`, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep && `CEP ${mascaraCEP(c.cep)}`].filter(Boolean).join(' — ');
      el.innerHTML = String(html`<div class="pagina">
        <div>
          <a class="voltar texto-3" href="#/clientes" style="font-size:13px;font-weight:600">${icone('chevron-left')}Clientes</a>
          <div class="detalhe-cab mt-1">
            <div class="detalhe-avatar">${c.tipo === 'PJ' ? icone('building-2') : iniciais(c.nome)}</div>
            <div class="titulos">
              <h2>${c.nome}${c.tipo === 'PJ' ? html`<span class="selo selo-azul">Empresa</span>` : ''}</h2>
              <div class="sub">${c.telefone ? html`<span>${icone('phone')} ${mascaraTelefone(c.telefone)}</span>` : ''}${c.email ? html`<span>${c.email}</span>` : ''}<span>Cliente desde ${fmtData(c.criadoEm)}</span></div>
            </div>
            <div class="grupo-botoes">
              ${c.telefone ? html`<button type="button" class="btn btn-whats" data-whats>${icone('message-circle')}<span class="so-largo">WhatsApp</span></button>` : ''}
              <button type="button" class="btn" data-editar>${icone('pencil')}<span class="so-largo">Editar</span></button>
              ${pode('excluir') ? html`<button type="button" class="btn-icone perigo" data-excluir aria-label="Excluir cliente">${icone('trash-2')}</button>` : ''}
              <a class="btn btn-primario" href="#/os/nova?cliente=${c.id}">${icone('plus')}Nova OS</a>
            </div>
          </div>
        </div>
        <div class="grade grade-2-1">
          <div class="grade">
            <section class="cartao">
              <div class="cartao-cab"><h3>${icone('car')}Veículos</h3><button type="button" class="btn btn-sm" data-novo-veiculo>${icone('plus')}Adicionar</button></div>
              <div class="cartao-corpo sem-pad">
                ${veics.length
                  ? veics.map((v) => {
                      const ult = ordens.find((o) => o.veiculoId === v.id);
                      return html`<a class="veiculo-card" href="#/veiculos/${v.id}">${placa(v.placa)}
                        <span class="principal-txt" style="flex:1;min-width:0"><strong>${descVeiculo(v)}</strong><small class="texto-3" style="display:block">${[v.cor, v.combustivel, v.km ? `${fmtNumero(v.km)} km` : ''].filter(Boolean).join(' · ')}${ult ? ` · última OS em ${fmtData(ult.entrada)}` : ''}</small></span>
                        ${icone('chevron-right', 'texto-3')}</a>`;
                    })
                  : html`<div class="vazio-mini">Nenhum veículo cadastrado para este cliente.</div>`}
              </div>
            </section>
            <section class="cartao">
              <div class="cartao-cab"><h3>${icone('clipboard-list')}Ordens de serviço</h3><span class="texto-3">${ordens.length}</span></div>
              <div class="cartao-corpo sem-pad">
                ${ordens.length
                  ? html`<div class="tabela-wrap"><table class="tabela responsiva"><thead><tr><th>Nº</th><th>Data</th><th>Veículo</th><th>Status</th>${valores ? html`<th class="num">Total</th><th>Pagamento</th>` : ''}</tr></thead><tbody>
                    ${ordens.map((o) => {
                      const calc = calcularOS(o);
                      const v = store.porId('veiculos', o.veiculoId);
                      return html`<tr class="clicavel" data-os="${o.id}">
                        <td class="principal-cel"><strong>OS ${fmtNumeroOS(o.numero)}</strong></td>
                        <td data-rotulo="Data">${fmtData(o.entrada)}</td>
                        <td data-rotulo="Veículo">${v ? `${v.modelo}${v.placa ? ` · ${v.placa}` : ''}` : o.veiculoDesc || '—'}</td>
                        <td data-rotulo="Status">${seloStatus(o.status)}</td>
                        ${valores ? html`<td data-rotulo="Total" class="num">${fmtMoeda(calc.total)}</td><td data-rotulo="Pagamento">${o.status === 'cancelada' ? '' : seloPagamento(calc.situacao)}</td>` : ''}
                      </tr>`;
                    })}</tbody></table></div>`
                  : html`<div class="vazio-mini">Nenhuma OS ainda. <a href="#/os/nova?cliente=${c.id}">Abrir a primeira</a></div>`}
              </div>
            </section>
          </div>
          <div class="grade" style="align-content:start">
            ${valores ? html`<section class="cartao"><div class="cartao-corpo"><div class="mini-kpis">
              <div class="mini-kpi"><span>Total gasto</span><strong>${fmtMoeda(r.gasto)}</strong></div>
              <div class="mini-kpi"><span>Ordens de serviço</span><strong>${r.qtd}</strong></div>
              <div class="mini-kpi"><span>Ticket médio</span><strong>${fmtMoeda(r.qtd ? r.gasto / Math.max(1, ordens.filter((o) => ['pronta', 'entregue'].includes(o.status)).length) : 0)}</strong></div>
              <div class="mini-kpi"><span>Em aberto</span><strong class="${r.devendo > 0.009 ? 'texto-erro' : ''}">${fmtMoeda(r.devendo)}</strong></div>
            </div></div></section>` : ''}
            <section class="cartao">
              <div class="cartao-cab"><h3>${icone('user')}Dados</h3></div>
              <div class="cartao-corpo"><dl class="dados-lista">
                <dt>${c.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</dt><dd>${c.documento ? mascaraDocumento(c.documento) : '—'}</dd>
                <dt>Telefone</dt><dd>${c.telefone ? mascaraTelefone(c.telefone) : '—'}${c.telefone2 ? ` / ${mascaraTelefone(c.telefone2)}` : ''}</dd>
                <dt>E-mail</dt><dd>${c.email || '—'}</dd>
                ${c.tipo === 'PJ' ? html`<dt>Contato</dt><dd>${c.contato || '—'}</dd>` : html`<dt>Nascimento</dt><dd>${c.nascimento ? fmtData(c.nascimento) : '—'}</dd>`}
                <dt>Endereço</dt><dd>${end || '—'}</dd>
                ${c.observacoes ? html`<dt>Observações</dt><dd style="white-space:pre-wrap">${c.observacoes}</dd>` : ''}
              </dl></div>
            </section>
          </div>
        </div>
      </div>`);

      const pg = el.firstElementChild;
      pg.querySelector('[data-editar]').onclick = () => formCliente(c);
      pg.querySelector('[data-novo-veiculo]').onclick = () => formVeiculo(null, { clienteId: c.id });
      pg.querySelector('[data-whats]')?.addEventListener('click', () => enviarWhatsApp({ titulo: `Mensagem para ${c.nome}`, telefone: c.telefone, texto: `Olá, ${c.nome.split(' ')[0]}! ` }));
      pg.querySelector('[data-excluir]')?.addEventListener('click', async () => {
        if (await excluirCliente(c)) location.hash = '#/clientes';
      });
      for (const tr of pg.querySelectorAll('[data-os]')) tr.onclick = () => (location.hash = `#/os/${tr.dataset.os}`);
    }

    desenhar();
    return {
      atualizar(cols) {
        if (cols.has('clientes') || cols.has('veiculos') || cols.has('ordens') || cols.has('*')) desenhar();
      },
    };
  },
};
