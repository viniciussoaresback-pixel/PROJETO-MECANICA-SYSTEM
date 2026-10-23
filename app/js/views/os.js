// Editor da ordem de serviço: cliente/veículo, itens, checklist, pagamentos e status.
import { excluirOS, mudarStatusOS } from '../acoes-os.js';
import { substituirHash } from '../app.js';
import {
  CHECKLIST_ITENS, COMBUSTIVEL_NIVEIS, descVeiculo, duplicarOS, itemDeCatalogo, novaOS, salvarOS, veiculosDoCliente,
} from '../dominio.js';
import { formCliente, formPagamento, formVeiculo } from '../formularios.js';
import { pode, store } from '../store.js';
import {
  abrirMenu, confirmar, escolher, filtrar, html, icone, seguro, seletor, seloPagamento, seloStatus, toast, vazio,
} from '../ui.js';
import {
  calcularOS, fmtData, fmtDataHora, fmtDecimal, fmtMoeda, fmtNumero, fmtNumeroOS, infoStatus, linkWhatsApp, mascaraDocumento,
  mascaraPlaca, mascaraTelefone, parseMoeda, placaLimpa, totalItem, uid, validarPlaca,
} from '../utils.js';

const ORDEM = ['orcamento', 'aprovada', 'execucao', 'aguardando_peca', 'pronta', 'entregue'];

function prefill(query) {
  if (query.duplicar) {
    const o = store.porId('ordens', query.duplicar);
    if (o) return duplicarOS(o);
  }
  const pre = {};
  if (query.veiculo) {
    const v = store.porId('veiculos', query.veiculo);
    if (v) {
      pre.veiculoId = v.id;
      pre.clienteId = v.clienteId;
    }
  }
  if (query.cliente) pre.clienteId = query.cliente;
  if (query.agenda) {
    const ag = store.porId('agenda', query.agenda);
    if (ag) {
      pre.agendaId = ag.id;
      if (ag.clienteId) pre.clienteId = ag.clienteId;
      if (ag.veiculoId) pre.veiculoId = ag.veiculoId;
      if (ag.mecanicoId) pre.mecanicoId = ag.mecanicoId;
      pre.relato = [ag.servico, ag.obs, !ag.veiculoId && ag.veiculoDesc ? `Veículo: ${ag.veiculoDesc}` : ''].filter(Boolean).join(' — ');
      pre._nomeSugerido = ag.clienteId ? '' : ag.clienteNome || '';
    }
  }
  if (pre.clienteId && !pre.veiculoId) {
    const vs = veiculosDoCliente(pre.clienteId);
    if (vs.length === 1) pre.veiculoId = vs[0].id;
  }
  return novaOS(pre);
}

function lerCaminho(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function gravarCaminho(obj, caminho, valor) {
  const partes = caminho.split('.');
  let o = obj;
  for (const k of partes.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[partes[partes.length - 1]] = valor;
}

export default {
  montar(el, { partes, query }) {
    const nova = partes[1] === 'nova';
    let original = nova ? null : store.porId('ordens', partes[1]);
    if (!nova && !original) {
      el.innerHTML = String(vazio({ icone: 'clipboard-list', titulo: 'OS não encontrada', texto: 'Ela pode ter sido excluída.', acao: html`<a class="btn btn-primario" href="#/os">Ver ordens de serviço</a>` }));
      return {};
    }
    let os = nova ? prefill(query) : structuredClone(original);
    const nomeSugerido = os._nomeSugerido || '';
    delete os._nomeSugerido;
    let sujo = nova && !!(os.clienteId || os.itens.length);
    const mostraValores = pode('valores');
    const equipe = store.todos('equipe').filter((e) => e.ativo !== false || e.id === os.mecanicoId);

    el.innerHTML = String(html`<div class="pagina os-editor">
      <div class="os-cab">
        <div>
          <a class="voltar" href="#/os">${icone('chevron-left')}Ordens de serviço</a>
          <h2 data-titulo></h2>
          <div class="sub" data-sub></div>
        </div>
        <div class="grupo-botoes">
          <button type="button" class="btn" data-imprimir>${icone('printer')}<span class="so-largo">Imprimir</span>${icone('chevron-down')}</button>
          <button type="button" class="btn" data-whats>${icone('message-circle')}<span class="so-largo">WhatsApp</span>${icone('chevron-down')}</button>
          <button type="button" class="btn-icone" data-mais aria-label="Mais ações">${icone('ellipsis-vertical')}</button>
        </div>
      </div>
      <div class="etapas" data-etapas role="group" aria-label="Status da OS"></div>
      <div class="os-layout">
        <div class="os-principal">
          <section class="cartao">
            <div class="cartao-cab"><h3>${icone('user')}Cliente e veículo</h3></div>
            <div class="cartao-corpo"><div class="form-grade">
              <div class="campo c-12" data-campo-cli>
                <label for="os-cli">Cliente ou placa<span class="obrig">*</span></label>
                <div class="seletor"><span class="seletor-icone">${icone('search')}</span>
                  <input id="os-cli" class="seletor-input" data-cli-busca placeholder="Digite o nome, telefone ou a placa do carro…"></div>
                <small class="campo-erro" hidden></small>
                <div class="info-cliente" data-info-cliente></div>
              </div>
              <div class="campo c-6">
                <label for="os-veic">Veículo</label>
                <select id="os-veic" data-veiculo></select>
              </div>
              <div class="campo c-3"><label for="os-km">KM na entrada</label><input id="os-km" type="number" inputmode="numeric" min="0" data-bind="km" data-num></div>
              <div class="campo c-3"><label for="os-mec">Mecânico</label>
                <select id="os-mec" data-bind="mecanicoId"><option value="">—</option>${equipe.map((e) => html`<option value="${e.id}">${e.nome}</option>`)}</select></div>
              <div class="campo c-6"><label for="os-ent">Entrada</label><input id="os-ent" type="datetime-local" data-bind="entrada"></div>
              <div class="campo c-6"><label for="os-prev">Previsão de entrega</label><input id="os-prev" type="date" data-bind="previsao"></div>
            </div></div>
          </section>

          <section class="cartao">
            <div class="cartao-cab"><h3>${icone('notebook-pen')}Relato e diagnóstico</h3></div>
            <div class="cartao-corpo"><div class="form-grade">
              <div class="campo c-6"><label for="os-rel">O que o cliente relatou</label><textarea id="os-rel" rows="4" data-bind="relato" placeholder="Ex.: barulho na roda dianteira ao frear"></textarea></div>
              <div class="campo c-6"><label for="os-diag">Diagnóstico / laudo técnico</label><textarea id="os-diag" rows="4" data-bind="diagnostico" placeholder="O que foi encontrado na avaliação"></textarea></div>
            </div></div>
          </section>

          <section class="cartao">
            <div class="cartao-cab"><h3>${icone('list-checks')}Peças e serviços</h3><span class="texto-3" data-qtd-itens></span></div>
            <div class="cartao-corpo">
              <div class="tabela-wrap"><table class="itens-os">
                <thead><tr><th class="c-tipo"></th><th>Descrição</th><th class="c-qtd">Qtd</th>${mostraValores ? html`<th class="c-valor">Valor unit.</th><th class="c-total">Total</th>` : ''}<th class="c-acao"></th></tr></thead>
                <tbody data-itens></tbody>
              </table></div>
              <div class="adicionar-item">
                <div class="seletor"><span class="seletor-icone">${icone('plus')}</span><input class="seletor-input" data-add-item placeholder="Adicionar serviço ou peça do catálogo…" aria-label="Adicionar item"></div>
                <button type="button" class="btn" data-avulso="servico">${icone('wrench')}Serviço avulso</button>
                <button type="button" class="btn" data-avulso="peca">${icone('package')}Peça avulsa</button>
              </div>
            </div>
          </section>

          <section class="cartao">
            <details class="cartao-corpo" data-checklist ${os.checklist?.combustivel || Object.values(os.checklist?.itens || {}).some(Boolean) || os.checklist?.avarias ? seguro('open') : ''}>
              <summary class="secao-titulo" style="cursor:pointer">${icone('clipboard-check')}Checklist de entrada <span class="texto-3" style="font-weight:500;font-size:13px">(combustível, itens e avarias)</span></summary>
              <div class="form mt-2">
                <div class="campo"><label>Nível de combustível</label><div class="combustivel" data-combustivel>
                  ${COMBUSTIVEL_NIVEIS.map((n) => html`<button type="button" data-nivel="${n.id}">${n.nome}</button>`)}</div></div>
                <div class="campo"><label>Itens no veículo</label><div class="checklist">
                  ${CHECKLIST_ITENS.map(([id, nome]) => html`<label class="campo-check"><input type="checkbox" data-check="${id}"><span>${nome}</span></label>`)}</div></div>
                <div class="campo"><label for="os-av">Avarias e observações da entrada</label><textarea id="os-av" rows="2" data-bind="checklist.avarias" placeholder="Riscos, amassados, luzes acesas no painel…"></textarea></div>
              </div>
            </details>
          </section>

          <section class="cartao">
            <div class="cartao-cab"><h3>${icone('shield-check')}Observações, garantia e revisão</h3></div>
            <div class="cartao-corpo"><div class="form-grade">
              <div class="campo c-6"><label for="os-obs">Observações para o cliente <small class="texto-3">(saem na impressão)</small></label><textarea id="os-obs" rows="3" data-bind="observacoes"></textarea></div>
              <div class="campo c-6"><label for="os-int">Anotações internas <small class="texto-3">(não saem na impressão)</small></label><textarea id="os-int" rows="3" data-bind="obsInternas"></textarea></div>
              <div class="campo c-4"><label for="os-gar">Garantia (dias)</label><input id="os-gar" type="number" min="0" data-bind="garantiaDias" data-num></div>
              <div class="campo c-4"><label for="os-rev">Próxima revisão em</label><input id="os-rev" type="date" data-bind="proximaRevisao.data"></div>
              <div class="campo c-4"><label for="os-revkm">ou aos (km)</label><input id="os-revkm" type="number" min="0" data-bind="proximaRevisao.km" data-num></div>
              <div class="c-12 linha"><span class="texto-3" style="font-size:13px">Sugestões de revisão:</span>
                ${[3, 6, 12].map((m) => html`<button type="button" class="chip-mini" data-rev-meses="${m}">${m} meses</button>`)}
                <button type="button" class="chip-mini" data-rev-km="10000">+10.000 km</button></div>
            </div></div>
          </section>
        </div>

        <aside class="os-lado">
          ${mostraValores ? html`<section class="cartao"><div class="cartao-corpo" data-resumo></div></section>
          <section class="cartao"><div class="cartao-cab"><h3>${icone('banknote')}Pagamento</h3><span data-selo-pag></span></div><div class="cartao-corpo" data-pagamentos></div></section>` : ''}
          <section class="cartao"><div class="cartao-cab"><h3>${icone('history')}Histórico</h3></div><div class="cartao-corpo" data-historico></div></section>
        </aside>
      </div>
      <div class="barra-salvar">
        <span class="estado" data-estado></span>
        <span class="espaco"></span>
        <a class="btn" href="#/os">Voltar</a>
        <button type="button" class="btn btn-primario" data-salvar>${icone('check')}Salvar OS</button>
      </div>
    </div>`);

    // Ouvintes vão na raiz desta tela (não no #conteudo, que é reaproveitado pelas outras telas).
    const pg = el.firstElementChild;
    const $ = (s) => pg.querySelector(s);
    const $cli = $('[data-cli-busca]');
    const $veic = $('[data-veiculo]');
    const $itens = $('[data-itens]');

    // ---------- Estado "sujo" ----------
    function marcarSujo() {
      sujo = true;
      desenharEstado();
    }
    function desenharEstado() {
      const e = $('[data-estado]');
      if (sujo) e.innerHTML = String(html`${icone('circle-alert')}Alterações não salvas`);
      else if (os.id) e.innerHTML = String(html`${icone('circle-check')}Salvo${original?.atualizadoEm ? ` às ${fmtDataHora(original.atualizadoEm).slice(11)}` : ''}`);
      else e.innerHTML = String(html`${icone('info')}OS ainda não salva`);
      e.classList.toggle('sujo', sujo);
    }

    // ---------- Cabeçalho e status ----------
    function desenharCab() {
      $('[data-titulo]').innerHTML = String(os.id ? html`OS ${fmtNumeroOS(os.numero)} ${seloStatus(os.status)}` : html`Nova ordem de serviço ${seloStatus(os.status)}`);
      const partesSub = [];
      if (original?.criadoEm) partesSub.push(`Aberta em ${fmtDataHora(original.criadoEm)}`);
      if (original?.atualizadoPor) partesSub.push(`última alteração por ${original.atualizadoPor}`);
      if (os.entregueEm) partesSub.push(`entregue em ${fmtDataHora(os.entregueEm)}`);
      $('[data-sub]').textContent = partesSub.join(' · ') || 'Preencha os dados e clique em “Salvar OS”.';
      document.title = `${os.id ? `OS ${fmtNumeroOS(os.numero)}` : 'Nova OS'} · ${store.estado.config.nome || 'Mecânica Pro'}`;
    }

    function desenharEtapas() {
      const idx = ORDEM.indexOf(os.status);
      const cancelada = os.status === 'cancelada';
      $('[data-etapas]').innerHTML = String(html`${ORDEM.map((id, i) => {
        const s = infoStatus(id);
        const cls = !cancelada && i < idx ? 'feita' : id === os.status ? 'atual' : '';
        return html`<button type="button" class="etapa ${cls}" data-etapa="${id}" aria-pressed="${id === os.status}">${icone(cls === 'feita' ? 'circle-check' : s.icone)}${s.nome}</button>`;
      })}<button type="button" class="etapa cancelar ${cancelada ? 'atual' : ''}" data-etapa="cancelada" aria-pressed="${cancelada}">${icone('circle-x')}<span class="so-largo">Cancelar</span></button>`);
      for (const b of el.querySelectorAll('[data-etapa]')) b.onclick = () => trocarStatus(b.dataset.etapa);
    }

    async function trocarStatus(novo) {
      if (novo === os.status) return;
      if (!os.clienteId) {
        os.status = novo;
        marcarSujo();
        desenharEtapas();
        desenharCab();
        toast('Escolha o cliente para salvar a OS', 'info');
        return;
      }
      const eraNova = !os.id;
      const salvo = await mudarStatusOS(os, novo);
      if (salvo) aposSalvar(salvo, eraNova);
    }

    // ---------- Cliente e veículo ----------
    function nomeClienteAtual() {
      return store.porId('clientes', os.clienteId)?.nome || '';
    }

    function desenharInfoCliente() {
      const c = store.porId('clientes', os.clienteId);
      const box = $('[data-info-cliente]');
      if (!c) {
        box.innerHTML = os.clienteNome && os.clienteId ? String(html`<span class="texto-3">Cadastro do cliente não encontrado (${os.clienteNome}).</span>`) : '';
        return;
      }
      const tel = c.telefone;
      box.innerHTML = String(html`
        ${tel ? html`<a href="tel:${tel}">${icone('phone')}${mascaraTelefone(tel)}</a><a href="${linkWhatsApp(tel)}" target="_blank" rel="noopener">${icone('message-circle')}WhatsApp</a>` : html`<span class="texto-aviso">${icone('triangle-alert')}Sem telefone cadastrado</span>`}
        ${c.documento ? html`<span>${c.tipo === 'PJ' ? 'CNPJ' : 'CPF'} ${mascaraDocumento(c.documento)}</span>` : ''}
        <a href="#/clientes/${c.id}">${icone('external-link')}Ver cadastro</a>
        <button type="button" class="link" data-editar-cli>${icone('pencil')}Editar</button>`);
      box.querySelector('[data-editar-cli]').onclick = async () => {
        const r = await formCliente(c);
        if (r) {
          $cli.value = r.nome;
          desenharInfoCliente();
        }
      };
    }

    function desenharVeiculos() {
      const lista = os.clienteId ? veiculosDoCliente(os.clienteId) : [];
      const atual = store.porId('veiculos', os.veiculoId);
      if (atual && !lista.includes(atual)) lista.unshift(atual);
      if (!os.clienteId) {
        $veic.innerHTML = String(html`<option value="">Escolha o cliente primeiro</option>`);
        $veic.disabled = true;
      } else {
        $veic.disabled = false;
        $veic.innerHTML = String(html`<option value="">${lista.length ? 'Escolha o veículo…' : 'Nenhum veículo cadastrado'}</option>
          ${lista.map((v) => html`<option value="${v.id}" ${v.id === os.veiculoId ? seguro('selected') : ''}>${v.placa ? `${mascaraPlaca(v.placa)} · ` : ''}${descVeiculo(v)}</option>`)}
          <option value="__novo">＋ Cadastrar outro veículo…</option>`);
      }
      const km = $('#os-km');
      km.placeholder = atual?.km ? `Último: ${fmtNumero(atual.km)}` : '';
    }

    function escolherCliente(c, veiculoId = null) {
      os.clienteId = c.id;
      if (veiculoId) os.veiculoId = veiculoId;
      else {
        const vs = veiculosDoCliente(c.id);
        os.veiculoId = vs.length === 1 ? vs[0].id : '';
      }
      $cli.value = c.nome;
      erroCliente('');
      desenharInfoCliente();
      desenharVeiculos();
      marcarSujo();
    }

    function erroCliente(msg) {
      const e = $('[data-campo-cli] .campo-erro');
      e.textContent = msg;
      e.hidden = !msg;
      $cli.classList.toggle('invalido', !!msg);
    }

    seletor($cli, {
      fonte: (t) => {
        const r = [];
        const pl = placaLimpa(t);
        if (pl.length >= 3) {
          for (const v of store.todos('veiculos').filter((x) => x.placa?.includes(pl)).slice(0, 5)) {
            r.push({ id: `v:${v.id}`, rotulo: `${mascaraPlaca(v.placa)} · ${descVeiculo(v)}`, detalhe: store.porId('clientes', v.clienteId)?.nome || 'sem dono', icone: 'car' });
          }
        }
        for (const c of filtrar(store.todos('clientes'), t, (x) => [x.nome, x.telefone, x.documento]).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 8)) {
          const vs = veiculosDoCliente(c.id);
          r.push({ id: `c:${c.id}`, rotulo: c.nome, detalhe: [mascaraTelefone(c.telefone), vs.map((v) => v.placa && mascaraPlaca(v.placa)).filter(Boolean).join(', ')].filter(Boolean).join(' · '), icone: c.tipo === 'PJ' ? 'building-2' : 'user' });
        }
        return r;
      },
      limite: 10,
      extras: (t) => {
        const ehPlaca = validarPlaca(t);
        return [
          ehPlaca ? { id: 'novo-veiculo', rotulo: `Cadastrar veículo com a placa ${mascaraPlaca(t)}`, icone: 'car', extra: true } : null,
          { id: 'novo-cliente', rotulo: t && !ehPlaca ? `Cadastrar cliente “${t}”` : 'Cadastrar novo cliente', icone: 'user-plus', extra: true },
        ].filter(Boolean);
      },
      aoEscolher: async (it) => {
        if (it.id === 'novo-cliente') {
          const c = await formCliente(null, { nomeInicial: validarPlaca($cli.value) ? '' : $cli.value });
          if (c) {
            escolherCliente(c);
            if (!veiculosDoCliente(c.id).length) {
              const v = await formVeiculo(null, { clienteId: c.id });
              if (v) {
                os.veiculoId = v.id;
                desenharVeiculos();
              }
            }
          }
          return;
        }
        if (it.id === 'novo-veiculo') {
          const v = await formVeiculo(null, { placaInicial: $cli.value, clienteId: os.clienteId });
          if (v) escolherCliente(store.porId('clientes', v.clienteId), v.id);
          return;
        }
        const [tipo, id] = it.id.split(':');
        if (tipo === 'v') {
          const v = store.porId('veiculos', id);
          escolherCliente(store.porId('clientes', v.clienteId) || { id: v.clienteId, nome: '' }, v.id);
        } else escolherCliente(store.porId('clientes', id));
      },
    });
    $cli.addEventListener('input', () => {
      if (os.clienteId && $cli.value !== nomeClienteAtual()) {
        os.clienteId = '';
        os.veiculoId = '';
        desenharInfoCliente();
        desenharVeiculos();
        marcarSujo();
      }
    });

    $veic.addEventListener('change', async () => {
      if ($veic.value === '__novo') {
        const v = await formVeiculo(null, { clienteId: os.clienteId });
        if (v) {
          if (v.clienteId !== os.clienteId) escolherCliente(store.porId('clientes', v.clienteId), v.id);
          else os.veiculoId = v.id;
        }
        desenharVeiculos();
        marcarSujo();
        return;
      }
      os.veiculoId = $veic.value;
      desenharVeiculos();
      marcarSujo();
    });

    // ---------- Campos simples (data-bind) ----------
    function preencherCampos() {
      for (const inp of el.querySelectorAll('[data-bind]')) {
        const v = lerCaminho(os, inp.dataset.bind);
        inp.value = v ?? '';
      }
      for (const b of el.querySelectorAll('[data-nivel]')) b.classList.toggle('ativo', os.checklist?.combustivel === b.dataset.nivel);
      for (const c of el.querySelectorAll('[data-check]')) c.checked = !!os.checklist?.itens?.[c.dataset.check];
      $cli.value = nomeClienteAtual() || (os.clienteId ? os.clienteNome || '' : nomeSugerido);
    }
    pg.addEventListener('input', (e) => {
      const inp = e.target;
      if (inp.dataset.bind) {
        const valor = inp.hasAttribute('data-num') ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
        gravarCaminho(os, inp.dataset.bind, valor);
        marcarSujo();
      } else if (inp.dataset.check) {
        os.checklist = os.checklist || { itens: {} };
        os.checklist.itens = { ...(os.checklist.itens || {}), [inp.dataset.check]: inp.checked };
        marcarSujo();
      }
    });
    pg.addEventListener('change', (e) => {
      if (e.target.dataset.bind && e.target.tagName === 'SELECT') {
        gravarCaminho(os, e.target.dataset.bind, e.target.value);
        marcarSujo();
      }
    });
    for (const b of el.querySelectorAll('[data-nivel]')) {
      b.onclick = () => {
        os.checklist = os.checklist || { itens: {} };
        os.checklist.combustivel = os.checklist.combustivel === b.dataset.nivel ? '' : b.dataset.nivel;
        for (const x of el.querySelectorAll('[data-nivel]')) x.classList.toggle('ativo', os.checklist.combustivel === x.dataset.nivel);
        marcarSujo();
      };
    }
    for (const b of el.querySelectorAll('[data-rev-meses]')) {
      b.onclick = () => {
        const d = new Date();
        d.setMonth(d.getMonth() + Number(b.dataset.revMeses));
        const iso = d.toISOString().slice(0, 10);
        gravarCaminho(os, 'proximaRevisao.data', iso);
        $('#os-rev').value = iso;
        marcarSujo();
      };
    }
    $('[data-rev-km]').onclick = () => {
      const base = Number(os.km) || Number(store.porId('veiculos', os.veiculoId)?.km) || 0;
      if (!base) {
        toast('Informe o KM de entrada primeiro', 'info');
        $('#os-km').focus();
        return;
      }
      gravarCaminho(os, 'proximaRevisao.km', base + 10000);
      $('#os-revkm').value = base + 10000;
      marcarSujo();
    };

    // ---------- Itens ----------
    function avisoEstoque(it) {
      if (it.tipo !== 'peca' || !it.refId) return '';
      const p = store.porId('pecas', it.refId);
      if (!p) return html`<small class="item-aviso">Peça removida do estoque</small>`;
      const usado = os.itens.filter((x) => x.refId === it.refId).reduce((s, x) => s + (Number(x.qtd) || 0), 0);
      const disponivel = (Number(p.qtd) || 0) + (Number(os.estoqueAplicado?.[it.refId]) || 0);
      if (usado > disponivel) return html`<small class="item-aviso">${icone('triangle-alert')} Só há ${fmtNumero(disponivel)} ${p.unidade || 'un'} em estoque</small>`;
      return html`<small class="texto-3" style="font-size:12px">Estoque: ${fmtNumero(disponivel)} ${p.unidade || 'un'}${it.codigo ? ` · ${it.codigo}` : ''}</small>`;
    }

    function desenharItens() {
      $('[data-qtd-itens]').textContent = os.itens.length ? `${os.itens.length} ${os.itens.length === 1 ? 'item' : 'itens'}` : '';
      if (!os.itens.length) {
        $itens.innerHTML = String(html`<tr><td colspan="6"><div class="vazio-mini">Nenhum item ainda. Busque abaixo um serviço ou peça do catálogo, ou adicione um item avulso.</div></td></tr>`);
        return;
      }
      $itens.innerHTML = String(html`${os.itens.map((it, i) => html`<tr data-i="${i}">
        <td class="c-tipo"><span class="tipo-item ${it.tipo}" title="${it.tipo === 'peca' ? 'Peça' : 'Serviço'}">${icone(it.tipo === 'peca' ? 'package' : 'wrench')}</span></td>
        <td class="c-desc"><input type="text" data-campo="descricao" value="${it.descricao}" aria-label="Descrição" placeholder="${it.tipo === 'peca' ? 'Descrição da peça' : 'Descrição do serviço'}"><span data-aviso>${avisoEstoque(it)}</span></td>
        <td class="c-qtd"><input type="number" data-campo="qtd" value="${it.qtd}" min="0" step="any" inputmode="decimal" aria-label="Quantidade"></td>
        ${mostraValores ? html`<td class="c-valor"><div class="campo-prefixo"><span>R$</span><input type="text" data-campo="valor" data-tipo="moeda" data-mascara="moeda" inputmode="decimal" value="${fmtDecimal(it.valor)}" aria-label="Valor unitário"></div></td>
        <td class="c-total" data-total>${fmtMoeda(totalItem(it))}</td>` : ''}
        <td class="c-acao"><button type="button" class="btn-icone sm perigo" data-remover aria-label="Remover item">${icone('trash-2')}</button></td>
      </tr>`)}`);
    }

    $itens.addEventListener('input', (e) => {
      const inp = e.target;
      const tr = inp.closest('[data-i]');
      if (!tr || !inp.dataset.campo) return;
      e.stopPropagation();
      const it = os.itens[Number(tr.dataset.i)];
      if (inp.dataset.campo === 'descricao') it.descricao = inp.value;
      else if (inp.dataset.campo === 'qtd') it.qtd = inp.value === '' ? 0 : Number(inp.value);
      else if (inp.dataset.campo === 'valor') it.valor = parseMoeda(inp.value);
      const tot = tr.querySelector('[data-total]');
      if (tot) tot.textContent = fmtMoeda(totalItem(it));
      if (inp.dataset.campo === 'qtd') for (const linha of $itens.querySelectorAll('[data-i]')) linha.querySelector('[data-aviso]').innerHTML = String(avisoEstoque(os.itens[Number(linha.dataset.i)]));
      desenharResumo();
      marcarSujo();
    });
    $itens.addEventListener('click', (e) => {
      const b = e.target.closest('[data-remover]');
      if (!b) return;
      const i = Number(b.closest('[data-i]').dataset.i);
      const removido = os.itens.splice(i, 1)[0];
      desenharItens();
      desenharResumo();
      marcarSujo();
      toast(`“${removido.descricao || 'Item'}” removido`, 'info', {
        acao: {
          texto: 'Desfazer',
          fn: () => {
            os.itens.splice(i, 0, removido);
            desenharItens();
            desenharResumo();
          },
        },
      });
    });

    function adicionarItem(item, focar = 'qtd') {
      if (item.refId) {
        const existente = os.itens.find((x) => x.refId === item.refId && x.tipo === item.tipo);
        if (existente) {
          existente.qtd = (Number(existente.qtd) || 0) + 1;
          desenharItens();
          desenharResumo();
          marcarSujo();
          toast(`Quantidade de “${existente.descricao}” aumentada para ${fmtNumero(existente.qtd)}`, 'info');
          return;
        }
      }
      os.itens.push(item);
      desenharItens();
      desenharResumo();
      marcarSujo();
      const linha = $itens.querySelector(`[data-i="${os.itens.length - 1}"]`);
      const alvo = linha?.querySelector(`[data-campo="${focar}"]`);
      if (alvo) {
        alvo.focus();
        alvo.select?.();
      }
    }

    const $add = $('[data-add-item]');
    seletor($add, {
      fonte: (t) => {
        const servs = filtrar(store.todos('servicos'), t, (s) => [s.descricao, s.categoria]).sort((a, b) => a.descricao.localeCompare(b.descricao));
        const pecas = filtrar(store.todos('pecas'), t, (p) => [p.descricao, p.codigo, p.marca, p.categoria]).sort((a, b) => a.descricao.localeCompare(b.descricao));
        const r = [];
        for (const s of servs.slice(0, t ? 6 : 4)) r.push({ id: `s:${s.id}`, rotulo: s.descricao, detalhe: [mostraValores ? fmtMoeda(s.preco) : '', s.categoria].filter(Boolean).join(' · '), icone: 'wrench' });
        for (const p of pecas.slice(0, t ? 6 : 4)) r.push({ id: `p:${p.id}`, rotulo: p.descricao, detalhe: [p.codigo, mostraValores ? fmtMoeda(p.preco) : '', `estoque ${fmtNumero(p.qtd || 0)} ${p.unidade || 'un'}`].filter(Boolean).join(' · '), icone: 'package' });
        return r;
      },
      limite: 12,
      extras: (t) => (t ? [
        { id: 'avulso-servico', rotulo: `Serviço avulso: “${t}”`, icone: 'wrench', extra: true },
        { id: 'avulso-peca', rotulo: `Peça avulsa: “${t}”`, icone: 'package', extra: true },
      ] : []),
      aoEscolher: (it) => {
        const termo = $add.value;
        $add.value = '';
        if (it.id.startsWith('avulso-')) {
          const tipo = it.id.slice(7);
          adicionarItem({ id: uid(), tipo, descricao: termo, qtd: 1, valor: 0 }, 'valor');
          return;
        }
        const [tipo, id] = it.id.split(':');
        const ref = store.porId(tipo === 's' ? 'servicos' : 'pecas', id);
        adicionarItem(itemDeCatalogo(tipo === 's' ? 'servico' : 'peca', ref));
      },
    });
    for (const b of el.querySelectorAll('[data-avulso]')) {
      b.onclick = () => adicionarItem({ id: uid(), tipo: b.dataset.avulso, descricao: '', qtd: 1, valor: 0 }, 'descricao');
    }

    // ---------- Resumo e pagamentos ----------
    function desenharResumo() {
      if (!mostraValores) return;
      const c = calcularOS(os);
      const box = $('[data-resumo]');
      const pct = !!os.descontoPct;
      box.innerHTML = String(html`
        <div class="resumo-linha"><span>Serviços</span><strong>${fmtMoeda(c.servicos)}</strong></div>
        <div class="resumo-linha"><span>Peças</span><strong>${fmtMoeda(c.pecas)}</strong></div>
        <div class="resumo-linha"><span>Desconto</span>
          <div class="desconto-linha"><input type="text" inputmode="decimal" data-desconto value="${pct ? fmtDecimal(os.descontoPct).replace(',00', '') : os.desconto ? fmtDecimal(os.desconto) : ''}" placeholder="0,00" aria-label="Desconto">
          <select data-desconto-tipo aria-label="Tipo de desconto"><option value="R$" ${!pct ? seguro('selected') : ''}>R$</option><option value="%" ${pct ? seguro('selected') : ''}>%</option></select></div></div>
        ${c.desconto > 0 && pct ? html`<div class="resumo-linha"><span></span><small class="texto-3">− ${fmtMoeda(c.desconto)}</small></div>` : ''}
        <div class="resumo-linha resumo-total"><span>Total</span><strong data-total-os>${fmtMoeda(c.total)}</strong></div>
        ${c.custoPecas > 0 ? html`<div class="resumo-linha"><span class="texto-3" style="font-size:12.5px">Lucro estimado nas peças</span><small class="texto-3">${fmtMoeda(c.pecas - c.custoPecas)}</small></div>` : ''}`);
      const inp = box.querySelector('[data-desconto]');
      const tipo = box.querySelector('[data-desconto-tipo]');
      const aplicar = () => {
        const v = parseMoeda(inp.value);
        if (tipo.value === '%') {
          os.descontoPct = Math.min(100, v);
          os.desconto = 0;
        } else {
          os.desconto = v;
          os.descontoPct = 0;
        }
        const nc = calcularOS(os);
        box.querySelector('[data-total-os]').textContent = fmtMoeda(nc.total);
        desenharPagamentos();
        marcarSujo();
      };
      inp.addEventListener('input', (e) => {
        e.stopPropagation();
        aplicar();
      });
      inp.addEventListener('change', () => desenharResumo());
      tipo.addEventListener('change', (e) => {
        e.stopPropagation();
        aplicar();
        desenharResumo();
      });
      desenharPagamentos();
    }

    function desenharPagamentos() {
      if (!mostraValores) return;
      const c = calcularOS(os);
      $('[data-selo-pag]').innerHTML = String(os.status === 'cancelada' ? '' : seloPagamento(c.situacao));
      const box = $('[data-pagamentos]');
      box.innerHTML = String(html`
        <div class="resumo-linha"><span>Pago</span><strong class="${c.pago > 0 ? 'texto-ok' : ''}">${fmtMoeda(c.pago)}</strong></div>
        <div class="resumo-linha"><span>${c.saldo < -0.009 ? 'Troco / crédito' : 'Falta receber'}</span><strong class="${c.saldo > 0.009 ? 'texto-erro' : ''}">${fmtMoeda(Math.abs(c.saldo))}</strong></div>
        ${(os.pagamentos || []).map((p, i) => html`<div class="pagamento-item"><span>${fmtData(p.data)} · ${p.forma}${p.obs ? ` · ${p.obs}` : ''}</span><strong>${fmtMoeda(p.valor)}</strong>
          <button type="button" class="btn-icone sm" data-recibo="${i}" aria-label="Imprimir recibo" title="Imprimir recibo">${icone('receipt')}</button>
          <button type="button" class="btn-icone sm perigo" data-tirar-pag="${i}" aria-label="Remover pagamento">${icone('x')}</button></div>`)}
        <button type="button" class="btn btn-largo mt-1 ${c.saldo > 0.009 && ['pronta', 'entregue'].includes(os.status) ? 'btn-ok' : ''}" data-receber ${os.status === 'cancelada' ? seguro('disabled') : ''}>${icone('plus')}Registrar pagamento</button>`);
      box.querySelector('[data-receber]').onclick = registrarPagamento;
      for (const b of box.querySelectorAll('[data-tirar-pag]')) {
        b.onclick = async () => {
          const p = os.pagamentos[Number(b.dataset.tirarPag)];
          if (!(await confirmar({ titulo: 'Remover pagamento?', texto: `${fmtData(p.data)} · ${p.forma} · ${fmtMoeda(p.valor)}`, ok: 'Remover', perigo: true }))) return;
          os.pagamentos.splice(Number(b.dataset.tirarPag), 1);
          if (os.id) salvar({ mensagem: 'Pagamento removido' });
          else {
            desenharResumo();
            marcarSujo();
          }
        };
      }
      for (const b of box.querySelectorAll('[data-recibo]')) {
        b.onclick = async () => {
          if (!os.id || sujo) {
            if (!salvar({ mensagem: '' })) return;
          }
          const { imprimirRecibo } = await import('../impressao.js');
          imprimirRecibo(original, original.pagamentos[Number(b.dataset.recibo)]);
        };
      }
    }

    async function registrarPagamento() {
      if (!validar()) return;
      const c = calcularOS(os);
      const p = await formPagamento({ saldo: Math.max(0, c.saldo) });
      if (!p) return;
      os.pagamentos = [...(os.pagamentos || []), p];
      const salvo = salvar({ mensagem: `Pagamento de ${fmtMoeda(p.valor)} registrado` });
      if (salvo) {
        toast(`Pagamento de ${fmtMoeda(p.valor)} registrado`, 'ok', {
          acao: {
            texto: 'Imprimir recibo',
            fn: async () => {
              const { imprimirRecibo } = await import('../impressao.js');
              imprimirRecibo(salvo, p);
            },
          },
        });
      }
    }

    function desenharHistorico() {
      const h = [...(os.historico || [])].reverse();
      $('[data-historico]').innerHTML = String(h.length
        ? html`<ul class="historico">${h.slice(0, 12).map((x) => html`<li><span class="ponto"></span><div>${x.texto || `Status: ${infoStatus(x.status).nome}`}<small>${fmtDataHora(x.em)}${x.por ? ` · ${x.por}` : ''}</small></div></li>`)}</ul>`
        : html`<p class="texto-3" style="font-size:13px">O histórico aparece depois de salvar.</p>`);
    }

    // ---------- Salvar ----------
    function validar() {
      if (!os.clienteId) {
        erroCliente('Escolha o cliente (ou cadastre um novo) para salvar a OS');
        $cli.scrollIntoView({ block: 'center', behavior: 'smooth' });
        $cli.focus();
        toast('Escolha o cliente da OS', 'aviso');
        return false;
      }
      const semDescricao = os.itens.findIndex((it) => !String(it.descricao || '').trim());
      if (semDescricao >= 0) {
        const alvo = $itens.querySelector(`[data-i="${semDescricao}"] [data-campo=descricao]`);
        alvo?.classList.add('invalido');
        alvo?.focus();
        toast('Preencha a descrição do item (ou remova a linha)', 'aviso');
        return false;
      }
      return true;
    }

    function salvar({ mensagem } = {}) {
      if (!validar()) return null;
      const eraNova = !os.id;
      os.itens = os.itens.map((it) => ({ ...it, descricao: it.descricao.trim() }));
      const salvo = salvarOS(os);
      aposSalvar(salvo, eraNova);
      const msg = mensagem ?? (eraNova ? `OS ${fmtNumeroOS(salvo.numero)} criada` : 'OS salva');
      if (msg && !String(msg).startsWith('Pagamento')) toast(msg);
      return salvo;
    }

    function aposSalvar(salvo, eraNova) {
      if (eraNova && salvo.agendaId) store.atualizar('agenda', salvo.agendaId, { status: 'concluido', osId: salvo.id });
      original = salvo;
      os = structuredClone(salvo);
      sujo = false;
      if (eraNova) substituirHash(`#/os/${salvo.id}`);
      desenharTudo();
    }

    function desenharTudo() {
      desenharCab();
      desenharEtapas();
      preencherCampos();
      desenharInfoCliente();
      desenharVeiculos();
      desenharItens();
      desenharResumo();
      desenharHistorico();
      desenharEstado();
    }

    $('[data-salvar]').onclick = () => salvar();

    // ---------- Menus de ação ----------
    async function garantirSalvo() {
      if (os.id && !sujo) return original;
      return salvar({ mensagem: os.id ? 'OS salva' : undefined });
    }
    $('[data-imprimir]').onclick = (e) => {
      const c = calcularOS(os);
      abrirMenu(e.currentTarget, [
        { texto: 'Ordem de serviço', icone: 'file-text', fn: async () => { const s = await garantirSalvo(); if (s) (await import('../impressao.js')).imprimirOS(s, 'os'); } },
        { texto: 'Orçamento', icone: 'clipboard-list', fn: async () => { const s = await garantirSalvo(); if (s) (await import('../impressao.js')).imprimirOS(s, 'orcamento'); } },
        { texto: 'Recibo de pagamento', icone: 'receipt', desabilitado: c.pago <= 0, fn: async () => { const s = await garantirSalvo(); if (s) (await import('../impressao.js')).imprimirRecibo(s); } },
      ]);
    };
    $('[data-whats]').onclick = (e) => {
      const c = calcularOS(os);
      const enviar = (tipo) => async () => {
        const s = await garantirSalvo();
        if (!s) return;
        const { whatsOS } = await import('../mensagens.js');
        whatsOS(s, tipo);
      };
      abrirMenu(e.currentTarget, [
        { texto: 'Enviar orçamento', icone: 'file-text', fn: enviar('orcamento') },
        { texto: 'Avisar que está pronto', icone: 'circle-check', fn: enviar('pronto') },
        { texto: 'Lembrar pagamento', icone: 'hand-coins', desabilitado: c.saldo <= 0.009, fn: enviar('cobranca') },
        { texto: 'Mensagem livre', icone: 'message-circle', fn: enviar('livre') },
      ]);
    };
    $('[data-mais]').onclick = (e) => {
      abrirMenu(e.currentTarget, [
        { texto: 'Duplicar esta OS', icone: 'copy', desabilitado: !os.id, fn: () => (location.hash = `#/os/nova?duplicar=${os.id}`) },
        os.veiculoId ? { texto: 'Histórico do veículo', icone: 'car', fn: () => (location.hash = `#/veiculos/${os.veiculoId}`) } : null,
        pode('excluir') ? '-' : null,
        pode('excluir') ? {
          texto: 'Excluir OS', icone: 'trash-2', perigo: true, desabilitado: !os.id,
          fn: async () => {
            if (await excluirOS(original)) {
              sujo = false;
              location.hash = '#/os';
            }
          },
        } : null,
      ]);
    };

    const teclas = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvar();
      }
    };
    document.addEventListener('keydown', teclas);

    desenharTudo();
    if (nova && !os.clienteId) {
      requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body || document.activeElement.id === 'conteudo') $cli.focus();
      });
    }

    return {
      sujo: () => sujo,
      async podeSair() {
        if (!sujo) return true;
        const r = await escolher({
          titulo: 'Alterações não salvas',
          texto: 'Você mexeu nesta OS e ainda não salvou.',
          opcoes: [
            { id: 'descartar', texto: 'Descartar', classe: 'btn-fantasma perigo' },
            { id: 'continuar', texto: 'Continuar editando' },
            { id: 'salvar', texto: 'Salvar e sair', classe: 'btn-primario', icone: 'check' },
          ],
        });
        if (r === 'salvar') return !!salvar();
        return r === 'descartar';
      },
      sair() {
        document.removeEventListener('keydown', teclas);
      },
      atualizar(cols) {
        if (cols.has('ordens') && os.id) {
          const atual = store.porId('ordens', os.id);
          if (!atual) {
            if (!sujo) el.innerHTML = String(vazio({ icone: 'trash-2', titulo: 'Esta OS foi excluída', acao: html`<a class="btn btn-primario" href="#/os">Ver ordens de serviço</a>` }));
            return;
          }
          if (!sujo && atual !== original && atual.atualizadoEm !== original?.atualizadoEm) {
            original = atual;
            os = structuredClone(atual);
            desenharTudo();
            return;
          }
        }
        if (cols.has('clientes') || cols.has('veiculos')) {
          desenharInfoCliente();
          if (document.activeElement !== $veic) desenharVeiculos();
        }
        if (cols.has('pecas') && !el.contains(document.activeElement)) desenharItens();
      },
    };
  },
};
