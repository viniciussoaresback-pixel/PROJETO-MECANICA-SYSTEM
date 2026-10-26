// Documentos para imprimir ou salvar em PDF: OS, orçamento, recibo e relatórios.
// Mostra uma pré-visualização; ao imprimir, só o documento vai para o papel (ver impressao.css).
import { CHECKLIST_ITENS, COMBUSTIVEL_NIVEIS, nomeClienteOS, nomeEquipe, veiculoOS } from './dominio.js';
import { store } from './store.js';
import { abrirModal, html, icone } from './ui.js';
import {
  addDias, calcularOS, diaDe, fmtData, fmtDataHora, fmtMoeda, fmtNumero, fmtNumeroOS, hojeISO, infoStatus, mascaraDocumento,
  mascaraPlaca, mascaraTelefone, totalItem, valorPorExtenso,
} from './utils.js';

function cabecalho(tituloDoc, numero, subtitulo = '') {
  const c = store.estado.config;
  const linhaEnd = [c.endereco, [c.cidade, c.uf].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  const contatos = [c.telefone && mascaraTelefone(c.telefone), c.whatsapp && `WhatsApp ${mascaraTelefone(c.whatsapp)}`, c.email, c.site].filter(Boolean).join(' · ');
  return html`<header class="doc-cab">
    <div class="doc-oficina">
      ${c.logo ? html`<img class="doc-logo" src="${c.logo}" alt="">` : ''}
      <div>
        <div class="doc-oficina-nome">${c.nome || 'Oficina'}</div>
        ${c.razaoSocial ? html`<div>${c.razaoSocial}</div>` : ''}
        ${c.cnpj ? html`<div>CNPJ ${mascaraDocumento(c.cnpj)}</div>` : ''}
        ${linhaEnd ? html`<div>${linhaEnd}</div>` : ''}
        ${contatos ? html`<div>${contatos}</div>` : ''}
      </div>
    </div>
    <div class="doc-numero">
      <div class="doc-tipo">${tituloDoc}</div>
      ${numero ? html`<div class="doc-num">Nº ${numero}</div>` : ''}
      ${subtitulo ? html`<div class="doc-sub">${subtitulo}</div>` : ''}
    </div>
  </header>`;
}

function blocoClienteVeiculo(os) {
  const cl = store.porId('clientes', os.clienteId);
  const ve = store.porId('veiculos', os.veiculoId);
  const v = veiculoOS(os);
  const end = cl ? [cl.endereco && `${cl.endereco}${cl.numero ? `, ${cl.numero}` : ''}`, cl.bairro, [cl.cidade, cl.uf].filter(Boolean).join('/')].filter(Boolean).join(' — ') : '';
  return html`<section class="doc-grade2">
    <div class="doc-caixa">
      <div class="doc-rotulo">Cliente</div>
      <div class="doc-forte">${nomeClienteOS(os)}</div>
      ${cl?.documento ? html`<div>${cl.tipo === 'PJ' ? 'CNPJ' : 'CPF'}: ${mascaraDocumento(cl.documento)}</div>` : ''}
      ${cl?.telefone || os.telefone ? html`<div>Telefone: ${mascaraTelefone(cl?.telefone || os.telefone)}</div>` : ''}
      ${cl?.email ? html`<div>${cl.email}</div>` : ''}
      ${end ? html`<div>${end}</div>` : ''}
    </div>
    <div class="doc-caixa">
      <div class="doc-rotulo">Veículo</div>
      <div class="doc-forte">${v.desc || 'Não informado'}</div>
      <div>Placa: <strong>${v.placa ? mascaraPlaca(v.placa) : '—'}</strong>${ve?.cor ? html` · Cor: ${ve.cor}` : ''}</div>
      ${os.km ? html`<div>KM na entrada: ${fmtNumero(os.km)}</div>` : ''}
      ${ve?.combustivel ? html`<div>Combustível: ${ve.combustivel}</div>` : ''}
      ${ve?.chassi ? html`<div>Chassi: ${ve.chassi}</div>` : ''}
    </div>
  </section>`;
}

function tabelaItens(itens, tipo) {
  if (!itens.length) return '';
  return html`<table class="doc-tabela">
    <thead><tr>
      <th>${tipo === 'peca' ? 'Peças e produtos' : 'Serviços'}</th>
      <th class="num">Qtd</th><th class="num">Valor unit.</th><th class="num">Total</th>
    </tr></thead>
    <tbody>${itens.map((it) => html`<tr>
      <td>${it.codigo ? html`<span class="doc-cod">${it.codigo}</span> ` : ''}${it.descricao}${Number(it.desconto) > 0 ? html` <small>(desconto ${fmtMoeda(it.desconto)})</small>` : ''}</td>
      <td class="num">${fmtNumero(it.qtd)}${it.tipo === 'peca' && it.unidade && it.unidade !== 'un' ? ` ${it.unidade}` : ''}</td>
      <td class="num">${fmtMoeda(it.valor)}</td>
      <td class="num">${fmtMoeda(totalItem(it))}</td>
    </tr>`)}</tbody>
  </table>`;
}

function blocoChecklist(os) {
  const ck = os.checklist || {};
  const marcados = CHECKLIST_ITENS.filter(([id]) => ck.itens?.[id]);
  if (!ck.combustivel && !marcados.length && !ck.avarias) return '';
  const comb = COMBUSTIVEL_NIVEIS.find((n) => n.id === ck.combustivel)?.nome;
  return html`<section class="doc-secao">
    <div class="doc-rotulo">Checklist de entrada</div>
    <div class="doc-checklist">
      ${comb ? html`<span><strong>Combustível:</strong> ${comb}</span>` : ''}
      ${CHECKLIST_ITENS.map(([id, nome]) => html`<span>${ck.itens?.[id] ? '☑' : '☐'} ${nome}</span>`)}
    </div>
    ${ck.avarias ? html`<div class="doc-texto"><strong>Avarias / observações:</strong> ${ck.avarias}</div>` : ''}
  </section>`;
}

export function documentoOS(os, tipo = 'os') {
  const cfg = store.estado.config;
  const c = calcularOS(os);
  const orc = tipo === 'orcamento';
  const servicos = (os.itens || []).filter((i) => i.tipo !== 'peca');
  const pecas = (os.itens || []).filter((i) => i.tipo === 'peca');
  const validade = addDias(diaDe(os.entrada) || hojeISO(), Number(cfg.validadeOrcamentoDias) || 7);
  const mecanico = nomeEquipe(os.mecanicoId);
  const sub = orc ? `Emitido em ${fmtData(hojeISO())}` : `Situação: ${infoStatus(os.status).nome}`;
  return html`<article class="doc">
    ${cabecalho(orc ? 'Orçamento' : 'Ordem de serviço', fmtNumeroOS(os.numero), sub)}
    ${blocoClienteVeiculo(os)}
    <section class="doc-datas">
      <div><span>Entrada</span><strong>${fmtDataHora(os.entrada) || '—'}</strong></div>
      ${os.previsao ? html`<div><span>Previsão</span><strong>${fmtData(os.previsao)}</strong></div>` : ''}
      ${!orc && os.entregueEm ? html`<div><span>Entrega</span><strong>${fmtDataHora(os.entregueEm)}</strong></div>` : ''}
      ${orc ? html`<div><span>Válido até</span><strong>${fmtData(validade)}</strong></div>` : ''}
      ${mecanico ? html`<div><span>Responsável</span><strong>${mecanico}</strong></div>` : ''}
    </section>
    ${os.relato ? html`<section class="doc-secao"><div class="doc-rotulo">Relato do cliente</div><div class="doc-texto">${os.relato}</div></section>` : ''}
    ${os.diagnostico ? html`<section class="doc-secao"><div class="doc-rotulo">Diagnóstico / laudo técnico</div><div class="doc-texto">${os.diagnostico}</div></section>` : ''}
    ${!orc && cfg.imprimirChecklist ? blocoChecklist(os) : ''}
    ${tabelaItens(servicos, 'servico')}
    ${tabelaItens(pecas, 'peca')}
    ${!servicos.length && !pecas.length ? html`<p class="doc-texto">Nenhum item lançado.</p>` : ''}
    <section class="doc-totais">
      <div class="doc-totais-esq">
        ${!orc && os.pagamentos?.length ? html`<div class="doc-rotulo">Pagamentos</div>
          ${os.pagamentos.map((p) => html`<div>${fmtData(p.data)} · ${p.forma} · ${fmtMoeda(p.valor)}</div>`)}` : ''}
        ${!orc && os.garantiaDias ? html`<div class="doc-garantia"><strong>Garantia: ${os.garantiaDias} dias</strong>${os.entregueEm ? html` (até ${fmtData(addDias(diaDe(os.entregueEm), Number(os.garantiaDias)))})` : ''}</div>` : ''}
      </div>
      <table class="doc-soma">
        ${servicos.length ? html`<tr><td>Serviços</td><td>${fmtMoeda(c.servicos)}</td></tr>` : ''}
        ${pecas.length ? html`<tr><td>Peças</td><td>${fmtMoeda(c.pecas)}</td></tr>` : ''}
        ${c.desconto > 0 ? html`<tr><td>Desconto</td><td>− ${fmtMoeda(c.desconto)}</td></tr>` : ''}
        <tr class="doc-total"><td>Total</td><td>${fmtMoeda(c.total)}</td></tr>
        ${!orc && c.pago > 0 ? html`<tr><td>Pago</td><td>${fmtMoeda(c.pago)}</td></tr><tr class="doc-saldo"><td>${c.saldo > 0 ? 'Falta pagar' : 'Saldo'}</td><td>${fmtMoeda(Math.max(0, c.saldo))}</td></tr>` : ''}
      </table>
    </section>
    ${os.observacoes ? html`<section class="doc-secao"><div class="doc-rotulo">Observações</div><div class="doc-texto">${os.observacoes}</div></section>` : ''}
    ${!orc && cfg.termoGarantia ? html`<section class="doc-secao doc-termo"><div class="doc-rotulo">Termo de garantia</div><div>${cfg.termoGarantia}</div></section>` : ''}
    ${orc
      ? html`<section class="doc-aprovacao">Autorizo a execução dos serviços descritos neste orçamento.</section>
        <section class="doc-assinaturas"><div>Assinatura do cliente</div><div>Data: ____/____/________</div></section>`
      : html`<section class="doc-assinaturas"><div>Responsável técnico</div><div>Cliente — declaro ter recebido o veículo</div></section>`}
    <footer class="doc-rodape">${cfg.rodapeOS || ''}</footer>
  </article>`;
}

export function documentoRecibo(os, pagamento = null) {
  const cfg = store.estado.config;
  const c = calcularOS(os);
  const cl = store.porId('clientes', os.clienteId);
  const v = veiculoOS(os);
  const valor = pagamento ? Number(pagamento.valor) : c.pago;
  const formas = pagamento ? pagamento.forma : [...new Set((os.pagamentos || []).map((p) => p.forma))].join(', ');
  const data = pagamento?.data || os.pagamentos?.[os.pagamentos.length - 1]?.data || hojeISO();
  const doc = cl?.documento ? `, ${cl.tipo === 'PJ' ? 'CNPJ' : 'CPF'} ${mascaraDocumento(cl.documento)}` : '';
  return html`<article class="doc doc-recibo">
    ${cabecalho('Recibo', fmtNumeroOS(os.numero), `Valor: ${fmtMoeda(valor)}`)}
    <div class="recibo-valor">${fmtMoeda(valor)}</div>
    <p class="recibo-texto">Recebemos de <strong>${nomeClienteOS(os)}</strong>${doc} a importância de
      <strong>${fmtMoeda(valor)}</strong> (${valorPorExtenso(valor)}), referente aos serviços da
      ordem de serviço nº ${fmtNumeroOS(os.numero)}${v.desc ? ` — ${v.desc}` : ''}${v.placa ? `, placa ${mascaraPlaca(v.placa)}` : ''}.</p>
    ${formas ? html`<p class="recibo-texto">Forma de pagamento: ${formas}.</p>` : ''}
    ${!pagamento && c.saldo > 0.009 ? html`<p class="recibo-texto">Valor total da OS: ${fmtMoeda(c.total)}. Restante a pagar: ${fmtMoeda(c.saldo)}.</p>` : ''}
    <p class="recibo-local">${[cfg.cidade, cfg.uf].filter(Boolean).join('/') || ''}${cfg.cidade ? ', ' : ''}${fmtData(data)}.</p>
    <section class="doc-assinaturas doc-assinatura-unica"><div>${cfg.nome || 'Oficina'}${cfg.cnpj ? ` — CNPJ ${mascaraDocumento(cfg.cnpj)}` : ''}</div></section>
  </article>`;
}

export function documentoRelatorio(titulo, periodo, conteudo) {
  return html`<article class="doc doc-relatorio">
    ${cabecalho(titulo, '', periodo)}
    ${conteudo}
    <footer class="doc-rodape">Gerado em ${fmtDataHora(new Date())}</footer>
  </article>`;
}

// ---------- Pré-visualização e impressão ----------
export function visualizar(titulo, documento) {
  const m = abrirModal({
    titulo,
    tamanho: 'xl',
    classe: 'modal-impressao',
    corpo: html`<div class="folha-area"><div class="folha">${documento}</div></div>`,
    rodape: html`<span class="texto-3 rod-dica">Dica: para gerar PDF, escolha “Salvar como PDF” na janela de impressão.</span>
      <button type="button" class="btn" data-fechar>Fechar</button>
      <button type="button" class="btn btn-primario" data-imprimir>${icone('printer')}Imprimir / PDF</button>`,
  });
  m.el.querySelector('[data-imprimir]').onclick = () => imprimir(documento);
  return m;
}

export function imprimir(documento) {
  let area = document.getElementById('area-impressao');
  if (!area) {
    area = document.createElement('div');
    area.id = 'area-impressao';
    document.body.appendChild(area);
  }
  area.innerHTML = String(documento);
  // A classe só tem efeito na impressão (@media print), então pode ficar até a próxima vez.
  document.body.classList.add('imprimindo');
  // Espera a logo carregar antes de abrir a impressão.
  const imgs = [...area.querySelectorAll('img')];
  Promise.all(
    imgs.map((i) =>
      i.complete
        ? null
        : new Promise((r) => {
            i.onload = r;
            i.onerror = r;
          }),
    ),
  ).then(() => window.print());
}

export function imprimirOS(os, tipo = 'os') {
  const nome = tipo === 'orcamento' ? 'Orçamento' : 'Ordem de serviço';
  return visualizar(`${nome} nº ${fmtNumeroOS(os.numero)}`, documentoOS(os, tipo));
}

export function imprimirRecibo(os, pagamento) {
  return visualizar(`Recibo — OS ${fmtNumeroOS(os.numero)}`, documentoRecibo(os, pagamento));
}
