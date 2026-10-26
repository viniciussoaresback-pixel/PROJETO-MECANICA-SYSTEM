// Formulários em janela, usados em várias telas. Cada um devolve uma Promise com o registro salvo (ou null).
import {
  CATEGORIAS_DESPESAS, CATEGORIAS_PECAS, CATEGORIAS_SERVICOS, COMBUSTIVEIS, FUNCOES_EQUIPE, MARCAS, UNIDADES, clienteDuplicado,
  descVeiculo, placaDuplicada, veiculosDoCliente,
} from './dominio.js';
import { store } from './store.js';
import {
  abrirModal, campo, confirmar, erroCampo, falhaCampo, filtrar, html, icone, lerFormulario, limparErros, seguro, seletor, toast,
} from './ui.js';
import {
  addMeses, arred, capitalizar, erroDocumento, fmtDecimal, fmtMoeda, FORMAS_PAGAMENTO, hojeISO, mascaraDocumento, mascaraPlaca,
  mascaraTelefone, parseMoeda, placaLimpa, soDigitos, uid, validarEmail, validarPlaca, validarTelefone,
} from './utils.js';

export const UFS = ['', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CORES = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Bege', 'Marrom', 'Laranja', 'Vinho', 'Dourado'];

function datalist(id, itens) {
  return html`<datalist id="${id}">${itens.map((i) => html`<option value="${i}"></option>`)}</datalist>`;
}

// Janela com formulário. aoSalvar(dados, form) devolve o registro salvo ou false (mantém aberta).
export function modalFormulario({ titulo, tamanho = 'md', campos, textoSalvar = 'Salvar', rodapeEsquerda = '', aoMontar, aoSalvar }) {
  return new Promise((resolve) => {
    let resultado = null;
    let sujo = false;
    const m = abrirModal({
      titulo,
      tamanho,
      corpo: html`<form class="form" novalidate autocomplete="off">${campos}<button type="submit" hidden tabindex="-1"></button></form>`,
      rodape: html`${rodapeEsquerda}<span class="espaco"></span><button type="button" class="btn" data-fechar>Cancelar</button>
        <button type="button" class="btn btn-primario" data-salvar>${icone('check')}${textoSalvar}</button>`,
      aoFechar: () => resolve(resultado),
      podeFechar: async () => !sujo || confirmar({ titulo: 'Descartar alterações?', texto: 'O que você digitou nesta janela será perdido.', ok: 'Descartar', perigo: true }),
    });
    const form = m.el.querySelector('form');
    form.addEventListener('input', () => {
      sujo = true;
    });
    let salvando = false;
    const enviar = async () => {
      if (salvando) return;
      salvando = true;
      try {
        limparErros(form);
        const r = await aoSalvar(lerFormulario(form), form, m);
        if (r) {
          resultado = r;
          m.fechar('ok');
        }
      } finally {
        salvando = false;
      }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      enviar();
    });
    m.el.querySelector('[data-salvar]').onclick = enviar;
    aoMontar?.(m, form, {
      concluir(r) {
        resultado = r;
        m.fechar('ok');
      },
    });
  });
}

// ---------- Cliente ----------
export function formCliente(cli = null, { nomeInicial = '' } = {}) {
  const c = cli || { tipo: 'PF', nome: capitalizar(nomeInicial) };
  const pj = c.tipo === 'PJ';
  return modalFormulario({
    titulo: cli ? 'Editar cliente' : 'Novo cliente',
    tamanho: 'lg',
    textoSalvar: cli ? 'Salvar alterações' : 'Cadastrar cliente',
    campos: html`
      <div class="segmentado" role="radiogroup" aria-label="Tipo de cliente">
        <label><input type="radio" name="tipo" value="PF" ${!pj ? seguro('checked') : ''}><span>${icone('user')}Pessoa física</span></label>
        <label><input type="radio" name="tipo" value="PJ" ${pj ? seguro('checked') : ''}><span>${icone('building-2')}Empresa</span></label>
      </div>
      <div class="form-grade">
        ${campo({ rotulo: pj ? 'Razão social / nome da empresa' : 'Nome completo', nome: 'nome', valor: c.nome, obrigatorio: true, classe: 'c-8 rot-nome', autofocus: true })}
        ${campo({ rotulo: pj ? 'CNPJ' : 'CPF', nome: 'documento', valor: mascaraDocumento(c.documento || ''), mascara: 'documento', classe: 'c-4 rot-doc', placeholder: 'Opcional' })}
        ${campo({ rotulo: 'Celular / WhatsApp', nome: 'telefone', tipo: 'tel', valor: mascaraTelefone(c.telefone || ''), mascara: 'telefone', classe: 'c-4', placeholder: '(00) 00000-0000' })}
        ${campo({ rotulo: 'Outro telefone', nome: 'telefone2', tipo: 'tel', valor: mascaraTelefone(c.telefone2 || ''), mascara: 'telefone', classe: 'c-4' })}
        ${campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', valor: c.email || '', classe: 'c-4' })}
        ${campo({ rotulo: pj ? 'Pessoa de contato' : 'Data de nascimento', nome: pj ? 'contato' : 'nascimento', tipo: pj ? 'text' : 'date', valor: pj ? c.contato || '' : c.nascimento || '', classe: 'c-4 rot-extra' })}
      </div>
      <details class="form-secao" ${c.cep || c.endereco ? seguro('open') : ''}>
        <summary>${icone('map-pin')}Endereço</summary>
        <div class="form-grade">
          ${campo({ rotulo: 'CEP', nome: 'cep', valor: c.cep || '', mascara: 'cep', classe: 'c-3', ajuda: 'Preenche o endereço sozinho' })}
          ${campo({ rotulo: 'Rua / avenida', nome: 'endereco', valor: c.endereco || '', classe: 'c-7' })}
          ${campo({ rotulo: 'Número', nome: 'numero', valor: c.numero || '', classe: 'c-2' })}
          ${campo({ rotulo: 'Complemento', nome: 'complemento', valor: c.complemento || '', classe: 'c-4' })}
          ${campo({ rotulo: 'Bairro', nome: 'bairro', valor: c.bairro || '', classe: 'c-3' })}
          ${campo({ rotulo: 'Cidade', nome: 'cidade', valor: c.cidade || '', classe: 'c-3' })}
          ${campo({ rotulo: 'UF', nome: 'uf', tipo: 'select', valor: c.uf || '', opcoes: UFS, classe: 'c-2' })}
        </div>
      </details>
      ${campo({ rotulo: 'Observações', nome: 'observacoes', tipo: 'textarea', valor: c.observacoes || '', linhas: 2, placeholder: 'Preferências, forma de contato, indicação…' })}`,
    aoMontar(_m, form) {
      // Troca de PF/PJ muda os rótulos.
      for (const r of form.querySelectorAll('[name=tipo]')) {
        r.addEventListener('change', () => {
          const ehPJ = form.querySelector('[name=tipo]:checked').value === 'PJ';
          form.querySelector('.rot-nome label').firstChild.textContent = ehPJ ? 'Razão social / nome da empresa' : 'Nome completo';
          form.querySelector('.rot-doc label').firstChild.textContent = ehPJ ? 'CNPJ' : 'CPF';
          const extra = form.querySelector('.rot-extra');
          const inp = extra.querySelector('input');
          extra.querySelector('label').firstChild.textContent = ehPJ ? 'Pessoa de contato' : 'Data de nascimento';
          inp.name = ehPJ ? 'contato' : 'nascimento';
          inp.type = ehPJ ? 'text' : 'date';
          inp.value = '';
        });
      }
      ligarBuscaCEP(form);
    },
    async aoSalvar(d, form) {
      if (!d.nome) return falhaCampo(form, 'nome', 'Informe o nome');
      const eDoc = erroDocumento(d.documento);
      if (eDoc) return falhaCampo(form, 'documento', eDoc);
      if (d.telefone && !validarTelefone(d.telefone)) return falhaCampo(form, 'telefone', 'Telefone incompleto (DDD + número)');
      if (d.telefone2 && !validarTelefone(d.telefone2)) return falhaCampo(form, 'telefone2', 'Telefone incompleto');
      if (d.email && !validarEmail(d.email)) return falhaCampo(form, 'email', 'E-mail inválido');
      const dados = {
        ...d,
        nome: capitalizar(d.nome),
        email: (d.email || '').toLowerCase(),
        documento: soDigitos(d.documento),
        telefone: soDigitos(d.telefone),
        telefone2: soDigitos(d.telefone2),
        cep: soDigitos(d.cep),
        endereco: d.endereco ? capitalizar(d.endereco) : '',
        bairro: d.bairro ? capitalizar(d.bairro) : '',
        cidade: d.cidade ? capitalizar(d.cidade) : '',
      };
      const dup = clienteDuplicado({ id: cli?.id, documento: dados.documento, telefone: dados.telefone });
      if (dup) {
        const ok = await confirmar({
          titulo: 'Cliente parecido já cadastrado',
          texto: `Já existe "${dup.nome}" com o mesmo ${dup.documento && dup.documento === dados.documento ? 'CPF/CNPJ' : 'telefone'}.`,
          detalhe: 'Deseja salvar mesmo assim?',
          ok: 'Salvar mesmo assim',
        });
        if (!ok) return false;
      }
      const salvo = cli ? store.atualizar('clientes', cli.id, dados) : store.adicionar('clientes', dados);
      toast(cli ? 'Cliente atualizado' : 'Cliente cadastrado');
      return salvo;
    },
  });
}

function ligarBuscaCEP(form) {
  const cep = form.querySelector('[name=cep]');
  if (!cep) return;
  let ultimo = '';
  cep.addEventListener('input', async () => {
    const d = soDigitos(cep.value);
    if (d.length !== 8 || d === ultimo) return;
    ultimo = d;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
      const j = await r.json();
      if (j.erro) {
        toast('CEP não encontrado', 'aviso');
        return;
      }
      const set = (n, v) => {
        const el = form.querySelector(`[name=${n}]`);
        if (el && v && !el.value) el.value = v;
      };
      set('endereco', j.logradouro);
      set('bairro', j.bairro);
      set('cidade', j.localidade);
      const uf = form.querySelector('[name=uf]');
      if (uf && j.uf) uf.value = j.uf;
      form.querySelector('[name=numero]')?.focus();
    } catch {
      // Sem internet ou serviço fora do ar: a pessoa digita o endereço.
    } finally {
      clearTimeout(t);
    }
  });
}

// ---------- Seletor de cliente dentro de um formulário ----------
// Campo de texto com busca + campo escondido "clienteId". Permite cadastrar na hora.
export function campoCliente({ rotulo = 'Cliente', clienteId = '', textoLivre = '', obrigatorio = false, classe = 'c-12', permiteLivre = false }) {
  const c = store.porId('clientes', clienteId);
  return html`<div class="campo ${classe}">
    <label>${rotulo}${obrigatorio ? html`<span class="obrig">*</span>` : ''}</label>
    <div class="seletor">
      <span class="seletor-icone">${icone('search')}</span>
      <input type="text" class="seletor-input" data-campo-cliente value="${c?.nome || textoLivre || ''}" placeholder="Buscar por nome, telefone ou CPF…" ${permiteLivre ? seguro('data-livre') : ''}>
      <input type="hidden" name="clienteId" value="${clienteId || ''}">
    </div>
    <small class="campo-erro" hidden></small>
  </div>`;
}

export function ligarCampoCliente(form, { aoMudar } = {}) {
  const input = form.querySelector('[data-campo-cliente]');
  const oculto = form.querySelector('[name=clienteId]');
  const livre = input.hasAttribute('data-livre');
  seletor(input, {
    fonte: (t) =>
      filtrar(store.todos('clientes'), t, (c) => [c.nome, c.telefone, c.documento, mascaraTelefone(c.telefone)])
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((c) => ({ id: c.id, rotulo: c.nome, detalhe: [mascaraTelefone(c.telefone), c.documento && mascaraDocumento(c.documento)].filter(Boolean).join(' · '), icone: c.tipo === 'PJ' ? 'building-2' : 'user' })),
    extras: (t) => [{ id: '__novo', rotulo: t ? `Cadastrar "${t}"` : 'Cadastrar novo cliente', icone: 'user-plus', extra: true }],
    aoEscolher: async (it) => {
      if (it.id === '__novo') {
        const novo = await formCliente(null, { nomeInicial: input.value });
        if (novo) {
          input.value = novo.nome;
          oculto.value = novo.id;
          aoMudar?.(novo);
        }
        return;
      }
      input.value = it.rotulo;
      oculto.value = it.id;
      aoMudar?.(store.porId('clientes', it.id));
    },
  });
  input.addEventListener('input', () => {
    if (oculto.value) {
      oculto.value = '';
      aoMudar?.(null);
    }
  });
  return { input, oculto, livre };
}

// ---------- Veículo ----------
export function formVeiculo(vei = null, { clienteId = '', placaInicial = '' } = {}) {
  const v = vei || { clienteId, placa: placaLimpa(placaInicial), combustivel: 'Flex' };
  return modalFormulario({
    titulo: vei ? 'Editar veículo' : 'Novo veículo',
    tamanho: 'lg',
    textoSalvar: vei ? 'Salvar alterações' : 'Cadastrar veículo',
    campos: html`
      <div class="form-grade">
        ${campo({ rotulo: 'Placa', nome: 'placa', valor: mascaraPlaca(v.placa || ''), mascara: 'placa', classe: 'c-3 campo-placa', placeholder: 'ABC1D23', autofocus: !vei, ajuda: 'Deixe em branco se não tiver' })}
        ${campo({ rotulo: 'Marca', nome: 'marca', valor: v.marca || '', lista: 'lista-marcas', classe: 'c-3' })}
        ${campo({ rotulo: 'Modelo', nome: 'modelo', valor: v.modelo || '', obrigatorio: true, classe: 'c-6', placeholder: 'Ex.: Onix 1.0 LT' })}
        ${campo({ rotulo: 'Ano', nome: 'ano', valor: v.ano || '', classe: 'c-3', placeholder: '2020/2021' })}
        ${campo({ rotulo: 'Cor', nome: 'cor', valor: v.cor || '', lista: 'lista-cores', classe: 'c-3' })}
        ${campo({ rotulo: 'Combustível', nome: 'combustivel', tipo: 'select', valor: v.combustivel || 'Flex', opcoes: COMBUSTIVEIS, classe: 'c-3' })}
        ${campo({ rotulo: 'KM atual', nome: 'km', tipo: 'number', valor: v.km ?? '', min: 0, classe: 'c-3' })}
        ${campoCliente({ rotulo: 'Dono do veículo', clienteId: v.clienteId, obrigatorio: true, classe: 'c-8' })}
        ${campo({ rotulo: 'Chassi', nome: 'chassi', valor: v.chassi || '', classe: 'c-4' })}
      </div>
      ${campo({ rotulo: 'Observações', nome: 'observacoes', tipo: 'textarea', valor: v.observacoes || '', linhas: 2 })}
      ${datalist('lista-marcas', MARCAS)}${datalist('lista-cores', CORES)}`,
    aoMontar(_m, form) {
      ligarCampoCliente(form);
    },
    async aoSalvar(d, form) {
      const placa = placaLimpa(d.placa);
      if (placa && !validarPlaca(placa)) return falhaCampo(form, 'placa', 'Placa inválida (ex.: ABC1234 ou ABC1D23)');
      if (!d.modelo) return falhaCampo(form, 'modelo', 'Informe o modelo');
      if (!d.clienteId) {
        const inp = form.querySelector('[data-campo-cliente]');
        const box = inp.closest('.campo').querySelector('.campo-erro');
        box.textContent = 'Escolha o dono na lista (ou cadastre um novo)';
        box.hidden = false;
        inp.focus();
        return false;
      }
      const dup = placaDuplicada(placa, vei?.id);
      if (dup) {
        const dono = store.porId('clientes', dup.clienteId)?.nome || 'outro cliente';
        erroCampo(form, 'placa', `Placa já cadastrada (${descVeiculo(dup)} de ${dono})`);
        return false;
      }
      const dados = { ...d, placa, marca: d.marca ? capitalizar(d.marca) : '', modelo: d.modelo, cor: d.cor ? capitalizar(d.cor) : '', chassi: (d.chassi || '').toUpperCase() };
      const salvo = vei ? store.atualizar('veiculos', vei.id, dados) : store.adicionar('veiculos', dados);
      toast(vei ? 'Veículo atualizado' : 'Veículo cadastrado');
      return salvo;
    },
  });
}

// ---------- Peça (estoque) ----------
export function formPeca(peca = null) {
  const p = peca || { unidade: 'un', qtd: 0, minimo: 0 };
  return modalFormulario({
    titulo: peca ? 'Editar peça' : 'Nova peça / produto',
    tamanho: 'lg',
    textoSalvar: peca ? 'Salvar alterações' : 'Cadastrar peça',
    campos: html`
      <div class="form-grade">
        ${campo({ rotulo: 'Descrição', nome: 'descricao', valor: p.descricao || '', obrigatorio: true, classe: 'c-8', autofocus: true, placeholder: 'Ex.: Filtro de óleo PSL 140' })}
        ${campo({ rotulo: 'Código / referência', nome: 'codigo', valor: p.codigo || '', classe: 'c-4' })}
        ${campo({ rotulo: 'Marca', nome: 'marca', valor: p.marca || '', classe: 'c-4' })}
        ${campo({ rotulo: 'Categoria', nome: 'categoria', valor: p.categoria || '', lista: 'lista-cat-pecas', classe: 'c-4' })}
        ${campo({ rotulo: 'Unidade', nome: 'unidade', tipo: 'select', valor: p.unidade || 'un', opcoes: UNIDADES, classe: 'c-4' })}
        ${peca
          ? html`<div class="campo c-4"><label>Quantidade em estoque</label><div class="campo-leitura">${fmtDecimal(p.qtd).replace(',00', '')} ${p.unidade || 'un'}</div><small class="campo-ajuda">Use “Entrada” ou “Ajustar” na lista</small></div>`
          : campo({ rotulo: 'Quantidade inicial', nome: 'qtd', tipo: 'number', valor: p.qtd ?? 0, min: 0, passo: 'any', classe: 'c-4' })}
        ${campo({ rotulo: 'Estoque mínimo', nome: 'minimo', tipo: 'number', valor: p.minimo ?? 0, min: 0, passo: 'any', classe: 'c-4', ajuda: 'Avisa quando chegar nesse número' })}
        ${campo({ rotulo: 'Localização', nome: 'local', valor: p.local || '', classe: 'c-4', placeholder: 'Prateleira, gaveta…' })}
        ${campo({ rotulo: 'Custo (compra)', nome: 'custo', tipo: 'moeda', valor: p.custo ?? '', classe: 'c-4' })}
        ${campo({ rotulo: 'Preço de venda', nome: 'preco', tipo: 'moeda', valor: p.preco ?? '', classe: 'c-4' })}
        <div class="campo c-4"><label>Margem</label><div class="campo-leitura" data-margem>—</div>
          <div class="botoes-mini">${[30, 50, 80, 100].map((x) => html`<button type="button" class="chip-mini" data-markup="${x}">+${x}%</button>`)}</div>
        </div>
        ${campo({ rotulo: 'Fornecedor', nome: 'fornecedor', valor: p.fornecedor || '', classe: 'c-12' })}
      </div>
      ${datalist('lista-cat-pecas', CATEGORIAS_PECAS)}`,
    aoMontar(_m, form) {
      const custo = form.querySelector('[name=custo]');
      const preco = form.querySelector('[name=preco]');
      const saida = form.querySelector('[data-margem]');
      const calc = () => {
        const c = parseMoeda(custo.value);
        const v = parseMoeda(preco.value);
        if (!v) {
          saida.textContent = '—';
          return;
        }
        const lucro = v - c;
        saida.textContent = `${c ? `${Math.round((lucro / v) * 100)}% · ` : ''}lucro ${fmtMoeda(lucro)}`;
        saida.classList.toggle('negativo', lucro < 0);
      };
      custo.addEventListener('input', calc);
      preco.addEventListener('input', calc);
      for (const b of form.querySelectorAll('[data-markup]')) {
        b.onclick = () => {
          const c = parseMoeda(custo.value);
          if (!c) {
            toast('Informe o custo primeiro', 'info');
            custo.focus();
            return;
          }
          preco.value = fmtDecimal(arred(c * (1 + Number(b.dataset.markup) / 100)));
          form.dispatchEvent(new Event('input'));
          calc();
        };
      }
      calc();
    },
    async aoSalvar(d, form) {
      if (!d.descricao) return falhaCampo(form, 'descricao', 'Informe a descrição');
      const dados = { ...d, descricao: d.descricao.trim(), custo: d.custo || 0, preco: d.preco || 0, minimo: d.minimo || 0 };
      if (peca) delete dados.qtd;
      else dados.qtd = d.qtd || 0;
      const salvo = peca ? store.atualizar('pecas', peca.id, dados) : store.adicionar('pecas', dados);
      if (!peca && dados.qtd > 0) {
        store.adicionar('movimentos', { pecaId: salvo.id, tipo: 'entrada', qtd: dados.qtd, custo: dados.custo, data: hojeISO(), motivo: 'Estoque inicial', por: store.estado.usuario?.nome || '' });
      }
      toast(peca ? 'Peça atualizada' : 'Peça cadastrada');
      return salvo;
    },
  });
}

// ---------- Serviço (tabela de preços) ----------
export function formServico(serv = null) {
  const s = serv || {};
  return modalFormulario({
    titulo: serv ? 'Editar serviço' : 'Novo serviço',
    textoSalvar: serv ? 'Salvar alterações' : 'Cadastrar serviço',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: 'Nome do serviço', nome: 'descricao', valor: s.descricao || '', obrigatorio: true, classe: 'c-12', autofocus: true, placeholder: 'Ex.: Troca de óleo e filtro' })}
      ${campo({ rotulo: 'Categoria', nome: 'categoria', valor: s.categoria || '', lista: 'lista-cat-serv', classe: 'c-6' })}
      ${campo({ rotulo: 'Preço (mão de obra)', nome: 'preco', tipo: 'moeda', valor: s.preco ?? '', obrigatorio: true, classe: 'c-3' })}
      ${campo({ rotulo: 'Tempo (horas)', nome: 'tempo', tipo: 'number', valor: s.tempo ?? '', min: 0, passo: 0.25, classe: 'c-3' })}
      ${campo({ rotulo: 'Observação interna', nome: 'observacoes', tipo: 'textarea', valor: s.observacoes || '', linhas: 2, classe: 'c-12' })}
    </div>${datalist('lista-cat-serv', CATEGORIAS_SERVICOS)}`,
    async aoSalvar(d, form) {
      if (!d.descricao) return falhaCampo(form, 'descricao', 'Informe o nome do serviço');
      if (d.preco == null) return falhaCampo(form, 'preco', 'Informe o preço (pode ser 0)');
      const salvo = serv ? store.atualizar('servicos', serv.id, d) : store.adicionar('servicos', d);
      toast(serv ? 'Serviço atualizado' : 'Serviço cadastrado');
      return salvo;
    },
  });
}

// ---------- Pagamento ----------
export function formPagamento({ saldo = 0, titulo = 'Registrar pagamento' } = {}) {
  let ultimaForma = 'PIX';
  try {
    ultimaForma = localStorage.getItem('mp:ultima-forma') || 'PIX';
  } catch {
    /* ok */
  }
  return modalFormulario({
    titulo,
    tamanho: 'sm',
    textoSalvar: 'Registrar',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: 'Valor recebido', nome: 'valor', tipo: 'moeda', valor: saldo > 0 ? saldo : '', obrigatorio: true, classe: 'c-12', autofocus: true, ajuda: saldo > 0 ? `Falta receber ${fmtMoeda(saldo)}` : '' })}
      ${campo({ rotulo: 'Forma de pagamento', nome: 'forma', tipo: 'select', valor: ultimaForma, opcoes: FORMAS_PAGAMENTO, classe: 'c-6' })}
      ${campo({ rotulo: 'Data', nome: 'data', tipo: 'date', valor: hojeISO(), classe: 'c-6' })}
      ${campo({ rotulo: 'Observação', nome: 'obs', valor: '', classe: 'c-12', placeholder: 'Ex.: 3x no cartão, sinal…' })}
    </div>`,
    async aoSalvar(d, form) {
      if (!d.valor || d.valor <= 0) return falhaCampo(form, 'valor', 'Informe o valor');
      if (saldo > 0 && d.valor > saldo + 0.009) {
        const ok = await confirmar({ titulo: 'Valor maior que o saldo', texto: `O valor informado (${fmtMoeda(d.valor)}) é maior do que falta receber (${fmtMoeda(saldo)}). Registrar assim mesmo?`, ok: 'Registrar' });
        if (!ok) return false;
      }
      try {
        localStorage.setItem('mp:ultima-forma', d.forma);
      } catch {
        /* ok */
      }
      return { id: uid(), valor: arred(d.valor), forma: d.forma, data: d.data || hojeISO(), obs: d.obs || '', por: store.estado.usuario?.nome || '' };
    },
  });
}

// ---------- Equipe ----------
export function formEquipe(m = null) {
  const e = m || { funcao: 'Mecânico', comissao: 0, ativo: true };
  return modalFormulario({
    titulo: m ? 'Editar funcionário' : 'Novo funcionário',
    textoSalvar: m ? 'Salvar alterações' : 'Cadastrar',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: 'Nome', nome: 'nome', valor: e.nome || '', obrigatorio: true, classe: 'c-8', autofocus: true })}
      ${campo({ rotulo: 'Função', nome: 'funcao', valor: e.funcao || '', lista: 'lista-funcoes', classe: 'c-4' })}
      ${campo({ rotulo: 'Telefone', nome: 'telefone', tipo: 'tel', valor: mascaraTelefone(e.telefone || ''), mascara: 'telefone', classe: 'c-6' })}
      ${campo({ rotulo: 'Comissão sobre mão de obra (%)', nome: 'comissao', tipo: 'number', valor: e.comissao ?? 0, min: 0, max: 100, passo: 0.5, classe: 'c-6', ajuda: 'Usada no relatório de comissões' })}
      ${campo({ rotulo: 'Ativo (aparece para escolher nas OS)', nome: 'ativo', tipo: 'checkbox', valor: e.ativo !== false, classe: 'c-12' })}
    </div>${datalist('lista-funcoes', FUNCOES_EQUIPE)}`,
    async aoSalvar(d, form) {
      if (!d.nome) return falhaCampo(form, 'nome', 'Informe o nome');
      const dados = { ...d, nome: capitalizar(d.nome), telefone: soDigitos(d.telefone), comissao: Number(d.comissao) || 0 };
      const salvo = m ? store.atualizar('equipe', m.id, dados) : store.adicionar('equipe', dados);
      toast(m ? 'Funcionário atualizado' : 'Funcionário cadastrado');
      return salvo;
    },
  });
}

// ---------- Despesa ----------
export function formDespesa(desp = null, { vencimento = hojeISO() } = {}) {
  const d0 = desp || { categoria: 'Outros', vencimento, pago: false };
  return modalFormulario({
    titulo: desp ? 'Editar despesa' : 'Nova despesa',
    tamanho: 'md',
    textoSalvar: desp ? 'Salvar alterações' : 'Lançar despesa',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: 'Descrição', nome: 'descricao', valor: d0.descricao || '', obrigatorio: true, classe: 'c-12', autofocus: true, placeholder: 'Ex.: Conta de luz' })}
      ${campo({ rotulo: 'Categoria', nome: 'categoria', tipo: 'select', valor: d0.categoria, opcoes: CATEGORIAS_DESPESAS, classe: 'c-6' })}
      ${campo({ rotulo: 'Valor', nome: 'valor', tipo: 'moeda', valor: d0.valor ?? '', obrigatorio: true, classe: 'c-6' })}
      ${campo({ rotulo: 'Vencimento', nome: 'vencimento', tipo: 'date', valor: d0.vencimento || hojeISO(), obrigatorio: true, classe: 'c-6' })}
      ${campo({ rotulo: 'Fornecedor / favorecido', nome: 'fornecedor', valor: d0.fornecedor || '', classe: 'c-6' })}
      ${campo({ rotulo: 'Já está paga', nome: 'pago', tipo: 'checkbox', valor: d0.pago, classe: 'c-12' })}
      <div class="c-12 form-grade sub-pago" ${d0.pago ? '' : seguro('hidden')}>
        ${campo({ rotulo: 'Pago em', nome: 'pagoEm', tipo: 'date', valor: d0.pagoEm || hojeISO(), classe: 'c-6' })}
        ${campo({ rotulo: 'Forma', nome: 'forma', tipo: 'select', valor: d0.forma || 'PIX', opcoes: FORMAS_PAGAMENTO, classe: 'c-6' })}
      </div>
      ${!desp ? campo({ rotulo: 'Repetir nos próximos meses', nome: 'repetir', tipo: 'select', valor: '0', opcoes: [{ valor: '0', texto: 'Não repetir' }, ...[1, 2, 3, 5, 11].map((n) => ({ valor: String(n), texto: `Mais ${n} ${n === 1 ? 'mês' : 'meses'}` }))], classe: 'c-12', ajuda: 'Bom para aluguel, internet e contas fixas' }) : ''}
      ${campo({ rotulo: 'Observação', nome: 'obs', valor: d0.obs || '', classe: 'c-12' })}
    </div>`,
    aoMontar(_m, form) {
      const chk = form.querySelector('[name=pago]');
      const sub = form.querySelector('.sub-pago');
      chk.addEventListener('change', () => {
        sub.hidden = !chk.checked;
      });
    },
    async aoSalvar(d, form) {
      if (!d.descricao) return falhaCampo(form, 'descricao', 'Informe a descrição');
      if (!d.valor || d.valor <= 0) return falhaCampo(form, 'valor', 'Informe o valor');
      if (!d.vencimento) return falhaCampo(form, 'vencimento', 'Informe o vencimento');
      const repetir = Number(d.repetir) || 0;
      delete d.repetir;
      const dados = { ...d, pagoEm: d.pago ? d.pagoEm || hojeISO() : '', forma: d.pago ? d.forma : '' };
      if (desp) {
        const s = store.atualizar('despesas', desp.id, dados);
        toast('Despesa atualizada');
        return s;
      }
      const grupo = repetir ? uid() : '';
      const s = store.adicionar('despesas', { ...dados, grupo });
      if (repetir) {
        const [, , dia] = d.vencimento.split('-');
        const ops = [];
        for (let i = 1; i <= repetir; i++) {
          const mes = addMeses(d.vencimento.slice(0, 7), i);
          const [a, mm] = mes.split('-').map(Number);
          const ultimo = new Date(a, mm, 0).getDate();
          const venc = `${mes}-${String(Math.min(Number(dia), ultimo)).padStart(2, '0')}`;
          ops.push({ op: 'gravar', col: 'despesas', dados: { ...dados, id: uid(), vencimento: venc, pago: false, pagoEm: '', forma: '', grupo } });
        }
        store.lote(ops);
      }
      toast(repetir ? `Despesa lançada (+${repetir} ${repetir === 1 ? 'mês' : 'meses'})` : 'Despesa lançada');
      return s;
    },
  });
}

// ---------- Agendamento ----------
// Devolve { acao: 'salvo'|'os'|'excluido', ag }
export function formAgendamento(ag = null, { data = hojeISO(), hora = '08:00' } = {}) {
  const a = ag || { data, hora, status: 'agendado' };
  const equipe = store.todos('equipe').filter((e) => e.ativo !== false);
  const servicos = store.todos('servicos').map((s) => s.descricao);
  let acao = 'salvo';
  return modalFormulario({
    titulo: ag ? 'Agendamento' : 'Novo agendamento',
    tamanho: 'lg',
    textoSalvar: ag ? 'Salvar alterações' : 'Agendar',
    rodapeEsquerda: ag
      ? html`<button type="button" class="btn btn-fantasma perigo" data-excluir>${icone('trash-2')}<span class="so-largo">Excluir</span></button>
          <button type="button" class="btn btn-fantasma" data-whats>${icone('message-circle')}<span class="so-largo">Confirmar no WhatsApp</span></button>
          ${!a.osId ? html`<button type="button" class="btn btn-fantasma" data-abrir-os>${icone('clipboard-list')}<span class="so-largo">Abrir OS</span></button>` : ''}`
      : '',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: 'Data', nome: 'data', tipo: 'date', valor: a.data, obrigatorio: true, classe: 'c-4' })}
      ${campo({ rotulo: 'Horário', nome: 'hora', tipo: 'time', valor: a.hora, obrigatorio: true, classe: 'c-4' })}
      ${campo({ rotulo: 'Situação', nome: 'status', tipo: 'select', valor: a.status, opcoes: [{ valor: 'agendado', texto: 'Agendado' }, { valor: 'confirmado', texto: 'Confirmado' }, { valor: 'concluido', texto: 'Compareceu' }, { valor: 'faltou', texto: 'Não compareceu' }, { valor: 'cancelado', texto: 'Cancelado' }], classe: 'c-4' })}
      ${campoCliente({ rotulo: 'Cliente', clienteId: a.clienteId, textoLivre: a.clienteNome, classe: 'c-8', permiteLivre: true })}
      ${campo({ rotulo: 'Telefone', nome: 'telefone', tipo: 'tel', valor: mascaraTelefone(a.telefone || store.porId('clientes', a.clienteId)?.telefone || ''), mascara: 'telefone', classe: 'c-4' })}
      <div class="campo c-6"><label for="ag-veic">Veículo</label>
        <select id="ag-veic" name="veiculoId"></select>
      </div>
      ${campo({ rotulo: 'Veículo (se não cadastrado)', nome: 'veiculoDesc', valor: a.veiculoDesc || '', classe: 'c-6', placeholder: 'Ex.: Gol branco ABC1234' })}
      ${campo({ rotulo: 'Serviço / motivo', nome: 'servico', valor: a.servico || '', lista: 'lista-serv-ag', classe: 'c-8', placeholder: 'Ex.: Revisão, barulho na suspensão…' })}
      ${campo({ rotulo: 'Mecânico', nome: 'mecanicoId', tipo: 'select', valor: a.mecanicoId || '', opcoes: [{ valor: '', texto: '—' }, ...equipe.map((e) => ({ valor: e.id, texto: e.nome }))], classe: 'c-4' })}
      ${campo({ rotulo: 'Observações', nome: 'obs', tipo: 'textarea', valor: a.obs || '', linhas: 2, classe: 'c-12' })}
    </div>${datalist('lista-serv-ag', servicos)}`,
    aoMontar(m, form, ctl) {
      const selV = form.querySelector('[name=veiculoId]');
      const tel = form.querySelector('[name=telefone]');
      const preencherVeiculos = (clienteId, atual = '') => {
        const lista = clienteId ? veiculosDoCliente(clienteId) : [];
        selV.innerHTML = html`<option value="">${lista.length ? 'Escolha…' : clienteId ? 'Nenhum veículo cadastrado' : 'Escolha o cliente primeiro'}</option>${lista.map((v) => html`<option value="${v.id}" ${v.id === atual ? seguro('selected') : ''}>${descVeiculo(v)}${v.placa ? ` · ${mascaraPlaca(v.placa)}` : ''}</option>`)}`;
        if (lista.length === 1 && !atual) selV.value = lista[0].id;
      };
      preencherVeiculos(a.clienteId, a.veiculoId);
      ligarCampoCliente(form, {
        aoMudar: (c) => {
          preencherVeiculos(c?.id || '');
          if (c?.telefone) tel.value = mascaraTelefone(c.telefone);
        },
      });
      if (!ag) return;
      m.el.querySelector('[data-excluir]').onclick = async () => {
        if (!(await confirmar({ titulo: 'Excluir agendamento?', texto: 'Esta ação não pode ser desfeita.', ok: 'Excluir', perigo: true }))) return;
        store.remover('agenda', ag.id);
        toast('Agendamento excluído');
        acao = 'excluido';
        ctl.concluir({ acao, ag });
      };
      m.el.querySelector('[data-whats]').onclick = async () => {
        const { enviarWhatsApp, msgAgendamento } = await import('./mensagens.js');
        const dados = lerFormulario(form);
        const atual = { ...ag, ...dados, clienteNome: form.querySelector('[data-campo-cliente]').value };
        enviarWhatsApp({ titulo: 'Confirmar agendamento', telefone: dados.telefone, texto: msgAgendamento(atual) });
      };
      const btnOS = m.el.querySelector('[data-abrir-os]');
      if (btnOS) {
        btnOS.onclick = () => {
          acao = 'os';
          form.requestSubmit();
        };
      }
    },
    async aoSalvar(d, form) {
      if (!d.data) return falhaCampo(form, 'data', 'Informe a data');
      if (!d.hora) return falhaCampo(form, 'hora', 'Informe o horário');
      const nomeDigitado = form.querySelector('[data-campo-cliente]').value.trim();
      if (!d.clienteId && !nomeDigitado) {
        const box = form.querySelector('[data-campo-cliente]').closest('.campo').querySelector('.campo-erro');
        box.textContent = 'Informe o cliente';
        box.hidden = false;
        return false;
      }
      const dados = { ...d, clienteNome: d.clienteId ? '' : capitalizar(nomeDigitado), telefone: soDigitos(d.telefone) };
      const salvo = ag ? store.atualizar('agenda', ag.id, dados) : store.adicionar('agenda', dados);
      if (acao !== 'os') toast(ag ? 'Agendamento atualizado' : 'Agendamento criado');
      return { acao, ag: salvo };
    },
  });
}

// ---------- Estoque: entrada e ajuste ----------
export function formEntradaEstoque(peca) {
  return modalFormulario({
    titulo: `Entrada: ${peca.descricao}`,
    tamanho: 'md',
    textoSalvar: 'Dar entrada',
    campos: html`<div class="form-grade">
      ${campo({ rotulo: `Quantidade (${peca.unidade || 'un'})`, nome: 'qtd', tipo: 'number', valor: '', min: 0, passo: 'any', obrigatorio: true, classe: 'c-6', autofocus: true })}
      ${campo({ rotulo: 'Custo unitário', nome: 'custo', tipo: 'moeda', valor: peca.custo ?? '', classe: 'c-6' })}
      ${campo({ rotulo: 'Fornecedor', nome: 'fornecedor', valor: peca.fornecedor || '', classe: 'c-6' })}
      ${campo({ rotulo: 'Nº da nota fiscal', nome: 'nota', valor: '', classe: 'c-3' })}
      ${campo({ rotulo: 'Data', nome: 'data', tipo: 'date', valor: hojeISO(), classe: 'c-3' })}
      ${campo({ rotulo: 'Lançar o valor da compra como despesa paga no financeiro', nome: 'lancarDespesa', tipo: 'checkbox', valor: false, classe: 'c-12' })}
    </div>`,
    async aoSalvar(d, form) {
      if (!d.qtd || d.qtd <= 0) return falhaCampo(form, 'qtd', 'Informe a quantidade');
      return d;
    },
  });
}

export function formAjusteEstoque(peca) {
  return modalFormulario({
    titulo: `Ajustar estoque: ${peca.descricao}`,
    tamanho: 'sm',
    textoSalvar: 'Ajustar',
    campos: html`<p class="texto-2 mb-1">Hoje o sistema mostra <strong>${fmtDecimal(peca.qtd).replace(',00', '')} ${peca.unidade || 'un'}</strong>. Informe a quantidade contada na prateleira.</p>
      <div class="form-grade">
        ${campo({ rotulo: 'Quantidade correta', nome: 'qtd', tipo: 'number', valor: peca.qtd ?? 0, min: 0, passo: 'any', obrigatorio: true, classe: 'c-12', autofocus: true })}
        ${campo({ rotulo: 'Motivo', nome: 'motivo', valor: '', classe: 'c-12', placeholder: 'Ex.: inventário, perda, quebra…' })}
      </div>`,
    async aoSalvar(d, form) {
      if (d.qtd == null || d.qtd < 0) return falhaCampo(form, 'qtd', 'Informe a quantidade');
      return d;
    },
  });
}
