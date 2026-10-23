// Lista de clientes com busca, ordenação e ações rápidas.
import { substituirHash } from '../app.js';
import { resumoCliente, veiculosDoCliente } from '../dominio.js';
import { formCliente } from '../formularios.js';
import { pode, store } from '../store.js';
import { abrirMenu, atrasar, baixarArquivo, confirmar, filtrar, html, icone, placa, toast, vazio } from '../ui.js';
import { fmtData, fmtMoeda, gerarCSV, hojeISO, linkWhatsApp, mascaraDocumento, mascaraTelefone, ordenarPor } from '../utils.js';

export async function excluirCliente(c) {
  const ordens = store.todos('ordens').filter((o) => o.clienteId === c.id).length;
  const veiculos = veiculosDoCliente(c.id);
  const ok = await confirmar({
    titulo: `Excluir ${c.nome}?`,
    texto: veiculos.length ? `O cadastro e ${veiculos.length === 1 ? 'o veículo dele' : `os ${veiculos.length} veículos dele`} serão apagados.` : 'O cadastro será apagado.',
    detalhe: ordens ? `As ${ordens} ordens de serviço deste cliente continuam guardadas (com o nome e a placa).` : '',
    ok: 'Excluir',
    perigo: true,
  });
  if (!ok) return false;
  store.lote([{ op: 'apagar', col: 'clientes', id: c.id }, ...veiculos.map((v) => ({ op: 'apagar', col: 'veiculos', id: v.id }))]);
  toast(`${c.nome} excluído`, 'ok', {
    acao: {
      texto: 'Desfazer',
      fn: () => store.lote([{ op: 'gravar', col: 'clientes', id: c.id, dados: c }, ...veiculos.map((v) => ({ op: 'gravar', col: 'veiculos', id: v.id, dados: v }))]),
    },
  });
  return true;
}

export function exportarClientesCSV() {
  const linhas = [['Nome', 'Tipo', 'CPF/CNPJ', 'Telefone', 'Outro telefone', 'E-mail', 'Endereço', 'Número', 'Bairro', 'Cidade', 'UF', 'CEP', 'Veículos', 'Última visita', 'Total gasto']];
  for (const c of ordenarPor(store.todos('clientes'), (x) => x.nome)) {
    const r = resumoCliente(c.id);
    linhas.push([
      c.nome, c.tipo === 'PJ' ? 'Empresa' : 'Pessoa física', mascaraDocumento(c.documento || ''), mascaraTelefone(c.telefone || ''), mascaraTelefone(c.telefone2 || ''),
      c.email || '', c.endereco || '', c.numero || '', c.bairro || '', c.cidade || '', c.uf || '', c.cep || '',
      veiculosDoCliente(c.id).map((v) => v.placa || v.modelo).join(', '), fmtData(r.ultima), r.gasto.toFixed(2).replace('.', ','),
    ]);
  }
  baixarArquivo(`clientes-${hojeISO()}.csv`, gerarCSV(linhas), 'text/csv');
}

const ORDENS = [
  { id: 'nome', nome: 'Nome (A–Z)' },
  { id: 'ultima', nome: 'Última visita' },
  { id: 'gasto', nome: 'Quem mais gastou' },
  { id: 'novos', nome: 'Cadastrados recentemente' },
];

export default {
  montar(el, { query }) {
    let termo = '';
    let ordem = 'nome';
    let limite = 80;
    const valores = pode('valores');

    el.innerHTML = String(html`<div class="pagina">
      <div class="ferramentas">
        <div class="campo-busca">${icone('search')}<input type="search" data-busca placeholder="Buscar por nome, telefone, CPF/CNPJ ou placa…" aria-label="Buscar clientes"></div>
        <select data-ordem aria-label="Ordenar" style="width:auto">${ORDENS.map((o) => html`<option value="${o.id}">${o.nome}</option>`)}</select>
        <span class="espaco"></span>
        <button type="button" class="btn" data-exportar>${icone('download')}<span class="so-largo">Exportar</span></button>
        <button type="button" class="btn btn-primario" data-novo>${icone('user-plus')}Novo cliente</button>
      </div>
      <div data-lista></div>
    </div>`);
    const pg = el.firstElementChild;
    const $lista = pg.querySelector('[data-lista]');

    function desenhar() {
      let lista = store.todos('clientes');
      if (termo) {
        const placas = new Map();
        for (const v of store.todos('veiculos')) placas.set(v.clienteId, `${placas.get(v.clienteId) || ''} ${v.placa || ''} ${v.modelo || ''}`);
        lista = filtrar(lista, termo, (c) => [c.nome, c.telefone, c.telefone2, c.documento, c.email, placas.get(c.id)]);
      }
      const resumos = new Map(lista.map((c) => [c.id, resumoCliente(c.id)]));
      if (ordem === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      else if (ordem === 'ultima') lista = ordenarPor(lista, (c) => resumos.get(c.id).ultima || '', true);
      else if (ordem === 'gasto') lista = ordenarPor(lista, (c) => resumos.get(c.id).gasto, true);
      else lista = ordenarPor(lista, (c) => c.criadoEm || '', true);

      if (!lista.length) {
        $lista.innerHTML = String(html`<div class="cartao">${vazio({
          icone: 'users',
          titulo: store.todos('clientes').length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado',
          texto: store.todos('clientes').length ? 'Confira o que foi digitado na busca.' : 'Cadastre seus clientes para abrir ordens de serviço e mandar mensagens pelo WhatsApp.',
          acao: html`<button type="button" class="btn btn-primario" data-novo-vazio>${icone('user-plus')}Cadastrar cliente</button>`,
        })}</div>`);
        $lista.querySelector('[data-novo-vazio]').onclick = novo;
        return;
      }
      const visiveis = lista.slice(0, limite);
      $lista.innerHTML = String(html`<div class="cartao"><div class="tabela-wrap"><table class="tabela responsiva">
        <thead><tr><th>Cliente</th><th>Telefone</th><th>Veículos</th><th>Última visita</th>${valores ? html`<th class="num">Total gasto</th>` : ''}<th class="acoes"></th></tr></thead>
        <tbody>${visiveis.map((c) => {
          const r = resumos.get(c.id);
          const vs = veiculosDoCliente(c.id);
          return html`<tr class="clicavel" data-cliente="${c.id}">
            <td class="principal-cel"><strong>${c.nome}</strong><small>${c.documento ? `${c.tipo === 'PJ' ? 'CNPJ' : 'CPF'} ${mascaraDocumento(c.documento)}` : c.tipo === 'PJ' ? 'Empresa' : ''}${r.devendo > 0.009 && valores ? html` · <span class="texto-erro">deve ${fmtMoeda(r.devendo)}</span>` : ''}</small></td>
            <td data-rotulo="Telefone">${c.telefone ? html`<span class="linha nowrap">${mascaraTelefone(c.telefone)}<a href="${linkWhatsApp(c.telefone)}" target="_blank" rel="noopener" class="btn-icone sm" aria-label="WhatsApp de ${c.nome}" data-parar style="color:var(--whats)">${icone('message-circle')}</a></span>` : html`<span class="texto-3">—</span>`}</td>
            <td data-rotulo="Veículos">${vs.length ? html`<span class="linha">${vs.slice(0, 3).map((v) => (v.placa ? placa(v.placa) : html`<span class="texto-2">${v.modelo}</span>`))}${vs.length > 3 ? html`<span class="texto-3">+${vs.length - 3}</span>` : ''}</span>` : html`<span class="texto-3">nenhum</span>`}</td>
            <td data-rotulo="Última visita">${r.ultima ? fmtData(r.ultima) : html`<span class="texto-3">—</span>`}</td>
            ${valores ? html`<td data-rotulo="Total gasto" class="num">${fmtMoeda(r.gasto)}</td>` : ''}
            <td class="acoes"><button type="button" class="btn-icone sm" data-menu="${c.id}" aria-label="Ações para ${c.nome}">${icone('ellipsis-vertical')}</button></td>
          </tr>`;
        })}</tbody>
      </table></div>
      <div class="rodape-tabela"><span>${lista.length} cliente(s)</span>${lista.length > limite ? html`<button type="button" class="btn btn-sm" data-mais>Mostrar mais</button>` : ''}</div></div>`);

      for (const tr of $lista.querySelectorAll('[data-cliente]')) {
        tr.onclick = (e) => {
          if (e.target.closest('[data-parar], [data-menu]')) return;
          location.hash = `#/clientes/${tr.dataset.cliente}`;
        };
      }
      for (const b of $lista.querySelectorAll('[data-menu]')) {
        b.onclick = (e) => {
          e.stopPropagation();
          const c = store.porId('clientes', b.dataset.menu);
          abrirMenu(b, [
            { texto: 'Abrir cadastro', icone: 'external-link', fn: () => (location.hash = `#/clientes/${c.id}`) },
            { texto: 'Nova OS para este cliente', icone: 'plus', fn: () => (location.hash = `#/os/nova?cliente=${c.id}`) },
            { texto: 'Editar', icone: 'pencil', fn: () => formCliente(c) },
            pode('excluir') ? '-' : null,
            pode('excluir') ? { texto: 'Excluir', icone: 'trash-2', perigo: true, fn: () => excluirCliente(c) } : null,
          ]);
        };
      }
      const mais = $lista.querySelector('[data-mais]');
      if (mais) {
        mais.onclick = () => {
          limite += 80;
          desenhar();
        };
      }
    }

    async function novo() {
      const c = await formCliente();
      if (c) location.hash = `#/clientes/${c.id}`;
    }

    pg.querySelector('[data-busca]').addEventListener('input', atrasar((e) => {
      termo = e.target.value;
      limite = 80;
      desenhar();
    }, 120));
    pg.querySelector('[data-ordem]').onchange = (e) => {
      ordem = e.target.value;
      desenhar();
    };
    pg.querySelector('[data-novo]').onclick = novo;
    pg.querySelector('[data-exportar]').onclick = () => {
      if (!store.todos('clientes').length) return toast('Nenhum cliente para exportar', 'info');
      exportarClientesCSV();
      toast('Planilha de clientes baixada');
    };
    desenhar();
    if (query.novo) {
      substituirHash('#/clientes');
      setTimeout(novo, 50);
    }
    return {
      atualizar(cols) {
        if (cols.has('clientes') || cols.has('veiculos') || cols.has('ordens') || cols.has('*')) desenhar();
      },
    };
  },
};
