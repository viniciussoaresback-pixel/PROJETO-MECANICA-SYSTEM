// Converte os dados da primeira versão do sistema (coleções "clientes" e "servicos" com userId)
// para o formato novo. Função pura — testada em tests/unit/migracao.test.mjs.
import { capitalizar, normalizar, paraData, placaLimpa, soDigitos, uid } from './utils.js';

const STATUS_ANTIGO = {
  pendente: 'aprovada',
  'em-andamento': 'execucao',
  finalizado: 'entregue',
  cancelado: 'cancelada',
};

function isoDe(dataBR) {
  const d = paraData(dataBR);
  return d ? d.toISOString() : new Date().toISOString();
}

// "GOL 1.0 ABC-1234" -> { placa: 'ABC1234', modelo: 'Gol 1.0' }
export function separarVeiculo(texto) {
  const t = String(texto || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const m = t.match(/\b([A-Z]{3})[-\s]?(\d[A-Z0-9]\d{2})\b/);
  const placa = m ? placaLimpa(m[1] + m[2]) : '';
  let modelo = m ? t.replace(m[0], '') : t;
  modelo = modelo.replace(/[-/|]+\s*$/, '').replace(/^\s*[-/|]+/, '').replace(/\s+/g, ' ').trim();
  return { placa, modelo: capitalizar(modelo) };
}

export function converterDadosAntigos(clientesAntigos = [], servicosAntigos = []) {
  const clientes = [];
  const veiculos = [];
  const ordens = [];
  const porNome = new Map();

  for (const c of clientesAntigos) {
    const doc = soDigitos(c.documento);
    const novo = {
      id: uid(),
      nome: capitalizar(c.nome || 'Cliente sem nome'),
      tipo: doc.length === 14 ? 'PJ' : 'PF',
      documento: c.documento || '',
      telefone: c.telefone || '',
      criadoEm: isoDe(c.dataCadastro),
      origem: 'versao-1',
    };
    clientes.push(novo);
    porNome.set(normalizar(novo.nome), novo);
  }

  const ordenados = [...servicosAntigos].sort((a, b) => (paraData(a.data)?.getTime() || 0) - (paraData(b.data)?.getTime() || 0));
  const veicPorChave = new Map();
  let numero = 0;

  for (const s of ordenados) {
    const nome = capitalizar(s.cliente || 'Cliente sem nome');
    let cliente = porNome.get(normalizar(nome));
    if (!cliente) {
      cliente = { id: uid(), nome, tipo: 'PF', documento: '', telefone: '', criadoEm: isoDe(s.data), origem: 'versao-1' };
      clientes.push(cliente);
      porNome.set(normalizar(nome), cliente);
    }
    let veiculo = null;
    if (s.veiculo) {
      const { placa, modelo } = separarVeiculo(s.veiculo);
      const chave = `${cliente.id}|${placa || normalizar(modelo)}`;
      veiculo = veicPorChave.get(chave);
      if (!veiculo) {
        veiculo = { id: uid(), clienteId: cliente.id, placa, modelo: modelo || 'Veículo', marca: '', criadoEm: isoDe(s.data), origem: 'versao-1' };
        veiculos.push(veiculo);
        veicPorChave.set(chave, veiculo);
      }
    }
    const valor = Number(s.valor) || 0;
    const status = STATUS_ANTIGO[s.status] || 'aprovada';
    const entrada = isoDe(s.data);
    numero += 1;
    ordens.push({
      id: uid(),
      numero,
      status,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      veiculoId: veiculo?.id || '',
      veiculoDesc: veiculo?.modelo || '',
      placa: veiculo?.placa || '',
      entrada,
      itens: [{ id: uid(), tipo: 'servico', descricao: capitalizar(s.servico || 'Serviço'), qtd: 1, valor }],
      desconto: 0,
      // Na versão antiga, "finalizado" contava como faturado: entra como pago.
      pagamentos: status === 'entregue' && valor > 0 ? [{ id: uid(), data: entrada.slice(0, 10), valor, forma: 'Outro' }] : [],
      entregueEm: status === 'entregue' ? entrada : '',
      historico: [{ em: entrada, status, por: 'Importado da versão anterior' }],
      estoqueAplicado: {},
      criadoEm: entrada,
      origem: 'versao-1',
    });
  }
  return { clientes, veiculos, ordens };
}
