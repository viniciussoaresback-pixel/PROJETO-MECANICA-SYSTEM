// Regras de negócio da oficina: ordens de serviço, estoque, pagamentos, alertas.
import { store, incremento } from './store.js';
import {
  addDias, agoraISO, alvoEstoque, calcularOS, capitalizar, dataISO, diaDe, diffEstoque, diasEntre, fmtNumeroOS, hojeISO,
  infoStatus, mascaraPlaca, ordenarPor, proximoNumero, STATUS_ABERTOS, uid,
} from './utils.js';

// ---------- Listas fixas ----------
export const COMBUSTIVEL_NIVEIS = [
  { id: 'reserva', nome: 'Reserva' },
  { id: '1/4', nome: '1/4' },
  { id: '1/2', nome: '1/2' },
  { id: '3/4', nome: '3/4' },
  { id: 'cheio', nome: 'Cheio' },
];

export const CHECKLIST_ITENS = [
  ['estepe', 'Estepe'],
  ['macaco', 'Macaco'],
  ['chave_roda', 'Chave de roda'],
  ['triangulo', 'Triângulo'],
  ['documento', 'Documento (CRLV)'],
  ['multimidia', 'Rádio / multimídia'],
  ['tapetes', 'Tapetes'],
  ['calotas', 'Calotas'],
  ['chave_reserva', 'Chave reserva'],
];

export const MARCAS = [
  'Audi', 'BMW', 'BYD', 'Caoa Chery', 'Chevrolet', 'Citroën', 'Fiat', 'Ford', 'GWM', 'Honda', 'Hyundai', 'Iveco', 'JAC', 'Jeep',
  'Kia', 'Land Rover', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Ram', 'Renault', 'Subaru',
  'Suzuki', 'Toyota', 'Troller', 'Volkswagen', 'Volvo', 'Yamaha', 'Dafra', 'Harley-Davidson', 'Kawasaki', 'Scania', 'Volare',
];

export const COMBUSTIVEIS = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico'];

export const CATEGORIAS_PECAS = [
  'Filtros', 'Óleos e fluidos', 'Freios', 'Suspensão', 'Direção', 'Motor', 'Arrefecimento', 'Ignição', 'Elétrica',
  'Transmissão', 'Ar-condicionado', 'Pneus e rodas', 'Iluminação', 'Acessórios', 'Outros',
];
export const UNIDADES = ['un', 'L', 'kg', 'm', 'par', 'jogo', 'kit', 'cx'];

export const CATEGORIAS_SERVICOS = ['Manutenção preventiva', 'Freios', 'Suspensão e direção', 'Motor', 'Elétrica', 'Ar-condicionado', 'Pneus e alinhamento', 'Diagnóstico', 'Funilaria e pintura', 'Outros'];

export const CATEGORIAS_DESPESAS = [
  'Aluguel', 'Energia elétrica', 'Água', 'Internet e telefone', 'Compra de peças', 'Salários e comissões', 'Impostos e taxas',
  'Ferramentas e equipamentos', 'Manutenção da oficina', 'Contador', 'Marketing', 'Outros',
];

export const FUNCOES_EQUIPE = ['Mecânico', 'Mecânico chefe', 'Eletricista', 'Funileiro', 'Pintor', 'Auxiliar', 'Atendente', 'Gerente'];

export const SERVICOS_COMUNS = [
  ['Troca de óleo e filtro', 'Manutenção preventiva', 80, 0.5],
  ['Revisão completa', 'Manutenção preventiva', 280, 3],
  ['Alinhamento', 'Pneus e alinhamento', 80, 0.5],
  ['Balanceamento (4 rodas)', 'Pneus e alinhamento', 80, 0.5],
  ['Troca de pastilhas de freio (dianteiras)', 'Freios', 120, 1],
  ['Troca de discos e pastilhas', 'Freios', 180, 1.5],
  ['Troca de fluido de freio', 'Freios', 100, 0.8],
  ['Troca de amortecedores (par)', 'Suspensão e direção', 220, 2],
  ['Troca de bieletas', 'Suspensão e direção', 90, 0.8],
  ['Troca de correia dentada', 'Motor', 380, 3],
  ['Troca de embreagem', 'Motor', 480, 4],
  ['Troca de velas de ignição', 'Motor', 80, 0.5],
  ['Limpeza de bicos injetores', 'Motor', 180, 1.5],
  ['Troca de bateria', 'Elétrica', 30, 0.3],
  ['Diagnóstico com scanner', 'Diagnóstico', 120, 1],
  ['Higienização do ar-condicionado', 'Ar-condicionado', 150, 1],
  ['Recarga de gás do ar-condicionado', 'Ar-condicionado', 220, 1],
  ['Troca do líquido de arrefecimento', 'Motor', 100, 1],
  ['Mão de obra (hora)', 'Outros', 120, 1],
];

// ---------- Consultas ----------
export function descVeiculo(v) {
  if (!v) return '';
  return [v.marca, v.modelo, v.ano].filter(Boolean).join(' ');
}

export function cliente(id) {
  return store.porId('clientes', id);
}
export function veiculo(id) {
  return store.porId('veiculos', id);
}

export function veiculosDoCliente(clienteId) {
  return store.todos('veiculos').filter((v) => v.clienteId === clienteId);
}

export function ordensDoCliente(clienteId) {
  return ordenarPor(store.todos('ordens').filter((o) => o.clienteId === clienteId), (o) => o.entrada || '', true);
}

export function ordensDoVeiculo(veiculoId) {
  return ordenarPor(store.todos('ordens').filter((o) => o.veiculoId === veiculoId), (o) => o.entrada || '', true);
}

export function nomeEquipe(id) {
  return store.porId('equipe', id)?.nome || '';
}

// Nome do cliente da OS (cadastro atual ou o nome guardado na própria OS).
export function nomeClienteOS(os) {
  return cliente(os.clienteId)?.nome || os.clienteNome || 'Cliente não informado';
}
export function veiculoOS(os) {
  const v = veiculo(os.veiculoId);
  return { desc: v ? descVeiculo(v) : os.veiculoDesc || '', placa: v?.placa || os.placa || '' };
}
export function telefoneOS(os) {
  return cliente(os.clienteId)?.telefone || os.telefone || '';
}

export function tituloOS(os) {
  return `OS ${fmtNumeroOS(os.numero)}`;
}

export function resumoCliente(clienteId) {
  const ordens = ordensDoCliente(clienteId).filter((o) => o.status !== 'cancelada');
  let gasto = 0;
  let devendo = 0;
  for (const o of ordens) {
    const c = calcularOS(o);
    if (o.status === 'entregue' || o.status === 'pronta') gasto += c.total;
    if ((o.status === 'entregue' || o.status === 'pronta') && c.saldo > 0) devendo += c.saldo;
  }
  const ultima = ordens[0]?.entrada || '';
  return { qtd: ordens.length, gasto, devendo, ultima, abertas: ordens.filter((o) => STATUS_ABERTOS.includes(o.status)).length };
}

// ---------- Nova OS ----------
function agoraLocal() {
  const d = new Date();
  return `${dataISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function novaOS(pre = {}) {
  return {
    id: '',
    numero: 0,
    status: 'orcamento',
    clienteId: '',
    veiculoId: '',
    mecanicoId: '',
    km: null,
    entrada: agoraLocal(),
    previsao: '',
    relato: '',
    diagnostico: '',
    checklist: { combustivel: '', itens: {}, avarias: '' },
    itens: [],
    desconto: 0,
    descontoPct: 0,
    pagamentos: [],
    garantiaDias: Number(store.estado.config.garantiaDias) || 90,
    observacoes: '',
    obsInternas: '',
    proximaRevisao: { data: '', km: null },
    historico: [],
    estoqueAplicado: {},
    ...pre,
  };
}

export function itemDeCatalogo(tipo, ref) {
  if (tipo === 'peca') {
    return { id: uid(), tipo: 'peca', refId: ref.id, codigo: ref.codigo || '', descricao: ref.descricao, qtd: 1, valor: Number(ref.preco) || 0, custo: Number(ref.custo) || 0, unidade: ref.unidade || 'un' };
  }
  return { id: uid(), tipo: 'servico', refId: ref.id, descricao: ref.descricao, qtd: 1, valor: Number(ref.preco) || 0 };
}

// ---------- Salvar OS (com estoque, número, histórico) ----------
// Retorna a OS salva. Todas as gravações relacionadas vão num único lote.
export function salvarOS(dados) {
  const anterior = dados.id ? store.porId('ordens', dados.id) : null;
  const os = structuredClone(dados);
  if (!os.id) os.id = uid();
  if (!os.numero) os.numero = proximoNumero(store.todos('ordens'));
  const usuario = store.estado.usuario?.nome || '';

  // Cópia de nome/placa na OS: a OS continua legível mesmo se o cadastro for apagado.
  const c = cliente(os.clienteId);
  const v = veiculo(os.veiculoId);
  if (c) {
    os.clienteNome = c.nome;
    os.telefone = c.telefone || '';
  }
  if (v) {
    os.veiculoDesc = descVeiculo(v);
    os.placa = v.placa || '';
  }

  // Histórico de status
  os.historico = os.historico || [];
  if (!anterior) os.historico.push({ em: agoraISO(), status: os.status, por: usuario, texto: 'OS criada' });
  else if (anterior.status !== os.status) os.historico.push({ em: agoraISO(), status: os.status, por: usuario });
  if (os.status === 'pronta' && !os.concluidaEm) os.concluidaEm = agoraISO();
  if (os.status === 'entregue') {
    if (!os.entregueEm) os.entregueEm = agoraISO();
    if (!os.concluidaEm) os.concluidaEm = os.entregueEm;
  } else if (anterior?.status === 'entregue') os.entregueEm = '';
  if (!['pronta', 'entregue'].includes(os.status) && anterior && ['pronta', 'entregue'].includes(anterior.status)) os.concluidaEm = '';

  // Estoque: tira/devolve só a diferença.
  const ops = [];
  const alvo = alvoEstoque(os);
  const diff = diffEstoque(os.estoqueAplicado || {}, alvo);
  const aplicado = { ...(os.estoqueAplicado || {}) };
  for (const [pecaId, qtd] of Object.entries(diff)) {
    const peca = store.porId('pecas', pecaId);
    if (!peca) {
      // Peça apagada do cadastro: só ajusta o controle da OS.
      if (alvo[pecaId]) aplicado[pecaId] = alvo[pecaId];
      else delete aplicado[pecaId];
      continue;
    }
    ops.push({ op: 'alterar', col: 'pecas', id: pecaId, dados: { qtd: incremento(-qtd) } });
    ops.push({
      op: 'gravar',
      col: 'movimentos',
      dados: {
        id: uid(),
        pecaId,
        tipo: qtd > 0 ? 'saida' : 'devolucao',
        qtd: Math.abs(qtd),
        data: hojeISO(),
        motivo: `${qtd > 0 ? 'Usada na' : 'Devolvida da'} OS ${fmtNumeroOS(os.numero)}`,
        osId: os.id,
        por: usuario,
      },
    });
    if (alvo[pecaId]) aplicado[pecaId] = alvo[pecaId];
    else delete aplicado[pecaId];
  }
  os.estoqueAplicado = aplicado;

  // Atualiza a quilometragem do veículo
  if (v && Number(os.km) > (Number(v.km) || 0)) ops.push({ op: 'alterar', col: 'veiculos', id: v.id, dados: { km: Number(os.km) } });

  ops.unshift({ op: 'gravar', col: 'ordens', id: os.id, dados: os });
  store.lote(ops);
  return store.porId('ordens', os.id);
}

// Apaga a OS e devolve as peças ao estoque.
export function removerOS(os) {
  const ops = [];
  for (const [pecaId, qtd] of Object.entries(os.estoqueAplicado || {})) {
    if (!store.porId('pecas', pecaId) || !qtd) continue;
    ops.push({ op: 'alterar', col: 'pecas', id: pecaId, dados: { qtd: incremento(qtd) } });
    ops.push({
      op: 'gravar',
      col: 'movimentos',
      dados: { id: uid(), pecaId, tipo: 'devolucao', qtd, data: hojeISO(), motivo: `OS ${fmtNumeroOS(os.numero)} excluída`, por: store.estado.usuario?.nome || '' },
    });
  }
  ops.unshift({ op: 'apagar', col: 'ordens', id: os.id });
  store.lote(ops);
}

export function duplicarOS(os) {
  return novaOS({
    clienteId: os.clienteId,
    veiculoId: os.veiculoId,
    mecanicoId: os.mecanicoId,
    relato: os.relato,
    itens: (os.itens || []).map((it) => ({ ...it, id: uid() })),
    desconto: os.desconto || 0,
    descontoPct: os.descontoPct || 0,
    observacoes: os.observacoes || '',
  });
}

// ---------- Estoque ----------
export function entradaEstoque(peca, { qtd, custo, fornecedor = '', nota = '', data = hojeISO(), lancarDespesa = false }) {
  const q = Number(qtd) || 0;
  if (q <= 0) return;
  const patch = { qtd: incremento(q) };
  if (custo != null && custo !== '' && Number(custo) > 0) patch.custo = Number(custo);
  const ops = [
    { op: 'alterar', col: 'pecas', id: peca.id, dados: patch },
    {
      op: 'gravar',
      col: 'movimentos',
      dados: { id: uid(), pecaId: peca.id, tipo: 'entrada', qtd: q, custo: Number(custo) || Number(peca.custo) || 0, data, motivo: ['Compra', fornecedor, nota ? `NF ${nota}` : ''].filter(Boolean).join(' · '), por: store.estado.usuario?.nome || '' },
    },
  ];
  if (lancarDespesa) {
    const valor = q * (Number(custo) || Number(peca.custo) || 0);
    if (valor > 0) {
      ops.push({
        op: 'gravar',
        col: 'despesas',
        dados: { id: uid(), descricao: `Compra: ${peca.descricao} (${q} ${peca.unidade || 'un'})`, categoria: 'Compra de peças', valor, vencimento: data, pago: true, pagoEm: data, fornecedor, obs: nota ? `NF ${nota}` : '' },
      });
    }
  }
  store.lote(ops);
}

export function ajustarEstoque(peca, novaQtd, motivo = '') {
  const atual = Number(peca.qtd) || 0;
  const n = Number(novaQtd) || 0;
  const dif = n - atual;
  if (!dif) return;
  store.lote([
    { op: 'alterar', col: 'pecas', id: peca.id, dados: { qtd: incremento(dif) } },
    { op: 'gravar', col: 'movimentos', dados: { id: uid(), pecaId: peca.id, tipo: 'ajuste', qtd: dif, data: hojeISO(), motivo: motivo || 'Ajuste de inventário', por: store.estado.usuario?.nome || '' } },
  ]);
}

export function estoqueBaixo() {
  return store.todos('pecas').filter((p) => Number(p.minimo) > 0 && (Number(p.qtd) || 0) <= Number(p.minimo));
}

// ---------- Alertas do painel ----------
export function osAtrasadas() {
  const hoje = hojeISO();
  return store.todos('ordens').filter((o) => ['aprovada', 'execucao', 'aguardando_peca'].includes(o.status) && o.previsao && o.previsao < hoje);
}

export function orcamentosParados(dias = 3) {
  const hoje = hojeISO();
  return store.todos('ordens').filter((o) => o.status === 'orcamento' && diasEntre(o.entrada, hoje) >= dias);
}

export function despesasAVencer(dias = 3) {
  const limite = addDias(hojeISO(), dias);
  return store.todos('despesas').filter((d) => !d.pago && d.vencimento && d.vencimento <= limite);
}

export function aReceber() {
  return store.todos('ordens')
    .filter((o) => ['pronta', 'entregue'].includes(o.status))
    .map((o) => ({ os: o, calc: calcularOS(o) }))
    .filter((x) => x.calc.saldo > 0.009);
}

// Revisões que vencem nos próximos `dias` (ou venceram há pouco), pela última OS de cada veículo.
export function lembretesRevisao(dias = 30) {
  const hoje = hojeISO();
  const ultimaPorVeiculo = new Map();
  for (const o of store.todos('ordens')) {
    if (!o.veiculoId || o.status === 'cancelada') continue;
    const atual = ultimaPorVeiculo.get(o.veiculoId);
    if (!atual || (o.entrada || '') > (atual.entrada || '')) ultimaPorVeiculo.set(o.veiculoId, o);
  }
  const lista = [];
  for (const o of ultimaPorVeiculo.values()) {
    const data = o.proximaRevisao?.data;
    if (!data) continue;
    const faltam = diasEntre(hoje, data);
    if (faltam <= dias && faltam >= -45) lista.push({ os: o, data, faltam, avisado: !!o.lembreteAvisadoEm });
  }
  return ordenarPor(lista, (x) => x.data);
}

export function agendaDoDia(dia = hojeISO()) {
  return ordenarPor(
    store.todos('agenda').filter((a) => a.data === dia && a.status !== 'cancelado'),
    (a) => a.hora || '',
  );
}

// ---------- Financeiro ----------
// Recebimentos (pagamentos das OS) num período.
export function recebimentos(inicio, fim) {
  const lista = [];
  for (const o of store.todos('ordens')) {
    if (o.status === 'cancelada') continue;
    for (const p of o.pagamentos || []) {
      const d = diaDe(p.data);
      if ((!inicio || d >= inicio) && (!fim || d <= fim)) lista.push({ ...p, data: d, os: o });
    }
  }
  return ordenarPor(lista, (x) => x.data, true);
}

export function despesasPagas(inicio, fim) {
  return store.todos('despesas').filter((d) => {
    if (!d.pago) return false;
    const dia = diaDe(d.pagoEm || d.vencimento);
    return (!inicio || dia >= inicio) && (!fim || dia <= fim);
  });
}

// ---------- Cliente / veículo ----------
export function clienteDuplicado({ id, documento, telefone }) {
  const doc = String(documento || '').replace(/\D/g, '');
  const tel = String(telefone || '').replace(/\D/g, '');
  return store.todos('clientes').find((c) => c.id !== id && ((doc && c.documento?.replace(/\D/g, '') === doc) || (tel.length >= 10 && c.telefone?.replace(/\D/g, '') === tel)));
}

export function placaDuplicada(placa, id) {
  const p = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!p) return null;
  return store.todos('veiculos').find((v) => v.id !== id && v.placa === p);
}

export function normalizarCliente(d) {
  return { ...d, nome: capitalizar(d.nome), email: (d.email || '').toLowerCase() };
}

export function textoPlaca(p) {
  return p ? mascaraPlaca(p) : 'sem placa';
}

export function nomeStatus(s) {
  return infoStatus(s).nome;
}
