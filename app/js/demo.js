// Dados de exemplo para o modo demonstração. Tudo fictício (nomes, documentos e telefones inventados).
import { SERVICOS_COMUNS } from './dominio.js';
import { CONFIG_PADRAO } from './store.js';
import { addDias, alvoEstoque, dataISO, hojeISO, uid } from './utils.js';

// Gerador pseudoaleatório com semente: a demonstração sai sempre igual.
function gerador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cpfFicticio(r) {
  const n = Array.from({ length: 9 }, () => Math.floor(r() * 10));
  const dv = (base) => {
    const s = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const x = (s * 10) % 11;
    return x === 10 ? 0 : x;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join('');
}

function cnpjFicticio(r) {
  const n = [...Array.from({ length: 8 }, () => Math.floor(r() * 10)), 0, 0, 0, 1];
  const calc = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + base[i] * p, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  n.push(calc(n));
  n.push(calc(n));
  return n.join('');
}

function placaFicticia(r, mercosul) {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l = () => L[Math.floor(r() * L.length)];
  const d = () => Math.floor(r() * 10);
  return mercosul ? `${l()}${l()}${l()}${d()}${l()}${d()}${d()}` : `${l()}${l()}${l()}${d()}${d()}${d()}${d()}`;
}

function telFicticio(r) {
  return `119${String(Math.floor(r() * 90000000) + 10000000)}`;
}

function horaLocal(diaISO, h, m) {
  return `${diaISO}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isoDe(diaISO, h = 10, m = 0) {
  const [a, mm, d] = diaISO.split('-').map(Number);
  return new Date(a, mm - 1, d, h, m).toISOString();
}

export function gerarDemo() {
  const r = gerador(20261023);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const hoje = hojeISO();
  const agora = new Date().toISOString();

  // ---------- Equipe ----------
  const equipe = [
    { id: uid(), nome: 'Paulo Henrique', funcao: 'Mecânico chefe', telefone: telFicticio(r), comissao: 10, ativo: true },
    { id: uid(), nome: 'Diego Santos', funcao: 'Mecânico', telefone: telFicticio(r), comissao: 8, ativo: true },
    { id: uid(), nome: 'Lucas Oliveira', funcao: 'Eletricista', telefone: telFicticio(r), comissao: 8, ativo: true },
    { id: uid(), nome: 'Bruna Carvalho', funcao: 'Atendente', telefone: telFicticio(r), comissao: 0, ativo: true },
  ];
  const mecanicos = equipe.slice(0, 3);

  // ---------- Serviços ----------
  const servicos = SERVICOS_COMUNS.map(([descricao, categoria, preco, tempo]) => ({ id: uid(), descricao, categoria, preco, tempo, criadoEm: agora }));
  const serv = (nome) => servicos.find((s) => s.descricao.startsWith(nome));

  // ---------- Peças ----------
  const P = [
    ['OL-5W30', 'Óleo 5W30 sintético 1L', 'Mobil', 'Óleos e fluidos', 'L', 32, 55, 46, 12],
    ['OL-15W40', 'Óleo 15W40 semissintético 1L', 'Lubrax', 'Óleos e fluidos', 'L', 22, 38, 28, 10],
    ['FO-140', 'Filtro de óleo', 'Tecfil', 'Filtros', 'un', 18, 35, 22, 6],
    ['FA-220', 'Filtro de ar do motor', 'Tecfil', 'Filtros', 'un', 25, 48, 12, 4],
    ['FC-310', 'Filtro de combustível', 'Mann', 'Filtros', 'un', 22, 45, 8, 3],
    ['FCB-77', 'Filtro de cabine (ar-condicionado)', 'Wega', 'Filtros', 'un', 20, 42, 9, 4],
    ['PF-1120', 'Pastilha de freio dianteira (jogo)', 'Cobreq', 'Freios', 'jogo', 70, 140, 7, 3],
    ['DF-450', 'Disco de freio dianteiro (par)', 'Fremax', 'Freios', 'par', 180, 320, 4, 2],
    ['FL-DOT4', 'Fluido de freio DOT4 500ml', 'Bosch', 'Óleos e fluidos', 'un', 18, 35, 14, 5],
    ['VL-BKR6', 'Vela de ignição', 'NGK', 'Ignição', 'un', 18, 35, 24, 8],
    ['CD-5520', 'Correia dentada', 'Gates', 'Motor', 'un', 95, 180, 3, 2],
    ['TN-0410', 'Tensor da correia dentada', 'SKF', 'Motor', 'un', 110, 210, 1, 2],
    ['AM-2270', 'Amortecedor dianteiro', 'Cofap', 'Suspensão', 'un', 230, 420, 4, 2],
    ['BT-60AH', 'Bateria 60Ah', 'Moura', 'Elétrica', 'un', 420, 650, 3, 2],
    ['LP-H4', 'Lâmpada H4 12V', 'Philips', 'Iluminação', 'un', 15, 35, 18, 6],
    ['PL-0045', 'Palheta do limpador (par)', 'Bosch', 'Acessórios', 'par', 45, 89, 6, 4],
    ['AD-RAD1', 'Aditivo para radiador 1L', 'Paraflu', 'Arrefecimento', 'L', 18, 35, 12, 4],
    ['KE-6200', 'Kit de embreagem', 'LuK', 'Transmissão', 'kit', 520, 890, 1, 1],
    ['BA-1180', 'Bomba d’água', 'Urba', 'Arrefecimento', 'un', 140, 260, 2, 1],
    ['BI-3300', 'Bieleta da suspensão', 'Nakata', 'Suspensão', 'un', 45, 90, 6, 2],
    ['PV-1020', 'Pivô de suspensão', 'Nakata', 'Suspensão', 'un', 60, 120, 4, 2],
    ['TD-0870', 'Terminal de direção', 'Viemar', 'Direção', 'un', 55, 110, 2, 2],
    ['GS-R134', 'Gás refrigerante R134a', 'DuPont', 'Ar-condicionado', 'kg', 90, 180, 5, 2],
    ['LB-500', 'Limpa bicos injetores 500ml', 'Wurth', 'Motor', 'un', 28, 60, 8, 3],
  ];
  const pecas = P.map(([codigo, descricao, marca, categoria, unidade, custo, preco, qtd, minimo]) => ({
    id: uid(), codigo, descricao, marca, categoria, unidade, custo, preco, qtd, minimo, local: `Prateleira ${String.fromCharCode(65 + Math.floor(r() * 5))}${1 + Math.floor(r() * 6)}`, fornecedor: pick(['Distribuidora Auto Peças Centro', 'Rede Peças Express', 'Atacadão das Peças']), criadoEm: agora,
  }));
  const peca = (cod) => pecas.find((p) => p.codigo === cod);

  // ---------- Clientes e veículos ----------
  const C = [
    ['Carlos Eduardo Mendes', 'PF'], ['Fernanda Lima Rocha', 'PF'], ['Ricardo Alves Pereira', 'PF'], ['Juliana Martins Costa', 'PF'],
    ['Marcos Vinícius Souza', 'PF'], ['Patrícia Gomes Ribeiro', 'PF'], ['André Luiz Fernandes', 'PF'], ['Camila Rodrigues Dias', 'PF'],
    ['Roberto Carlos Nunes', 'PF'], ['Aline Barbosa Teixeira', 'PF'], ['Thiago Henrique Araújo', 'PF'],
    ['Transportes Rota Sul Ltda', 'PJ'], ['Padaria Pão Dourado ME', 'PJ'], ['Floricultura Jardim Bela Vista', 'PJ'],
    ['Gustavo Pereira Lima', 'PF'], ['Larissa Moreira Santos', 'PF'], ['Eduardo Ferreira Gomes', 'PF'], ['Vanessa Cristina Alves', 'PF'],
    ['Rafael Nogueira Barros', 'PF'], ['Simone Batista Cardoso', 'PF'], ['Leandro Augusto Pinto', 'PF'], ['Construtora Horizonte Ltda', 'PJ'],
  ];
  const ruas = ['Rua das Acácias', 'Av. Brasil', 'Rua São João', 'Rua XV de Novembro', 'Av. Paulista', 'Rua dos Ipês', 'Rua Sete de Setembro'];
  const bairros = ['Centro', 'Jardim América', 'Vila Nova', 'Santa Cecília', 'Bela Vista'];
  const clientes = C.map(([nome, tipo], i) => ({
    id: uid(), nome, tipo, documento: tipo === 'PJ' ? cnpjFicticio(r) : cpfFicticio(r), telefone: telFicticio(r),
    email: `${nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}${i}@exemplo.com`,
    cep: '', endereco: pick(ruas), numero: String(10 + Math.floor(r() * 1900)), bairro: pick(bairros), cidade: 'São Paulo', uf: 'SP',
    criadoEm: isoDe(addDias(hoje, -200 + i * 6)), contato: tipo === 'PJ' ? pick(['Sr. Antônio', 'Dona Márcia', 'Rafael']) : '',
  }));

  const V = [
    [0, 'Chevrolet', 'Onix 1.0 LT', '2020', 'Prata', 'Flex', 48200],
    [1, 'Volkswagen', 'Gol 1.6', '2015', 'Branco', 'Flex', 112400],
    [2, 'Fiat', 'Strada Freedom 1.3', '2022', 'Vermelho', 'Flex', 31800],
    [3, 'Hyundai', 'HB20 1.0 Comfort', '2019', 'Preto', 'Flex', 67300],
    [4, 'Toyota', 'Corolla 2.0 XEi', '2018', 'Cinza', 'Flex', 89100],
    [5, 'Honda', 'Civic 2.0 EXL', '2017', 'Preto', 'Flex', 95400],
    [6, 'Renault', 'Kwid 1.0 Zen', '2021', 'Branco', 'Flex', 38900],
    [7, 'Jeep', 'Renegade 1.8 Sport', '2020', 'Verde', 'Flex', 61200],
    [8, 'Ford', 'Ka 1.0 SE', '2016', 'Prata', 'Flex', 104300],
    [9, 'Nissan', 'Kicks 1.6 SV', '2022', 'Azul', 'Flex', 27400],
    [10, 'Fiat', 'Argo 1.3 Drive', '2021', 'Cinza', 'Flex', 44100],
    [11, 'Mercedes-Benz', 'Sprinter 415 CDI', '2018', 'Branco', 'Diesel', 187000],
    [11, 'Volkswagen', 'Delivery 9.170', '2016', 'Branco', 'Diesel', 243500],
    [12, 'Volkswagen', 'Saveiro 1.6 Robust', '2014', 'Branco', 'Flex', 156200],
    [13, 'Fiat', 'Fiorino 1.4 Endurance', '2019', 'Branco', 'Flex', 98700],
    [0, 'Chevrolet', 'S10 2.8 LTZ Diesel', '2019', 'Prata', 'Diesel', 121500],
    [14, 'Volkswagen', 'Polo 1.0 TSI', '2021', 'Branco', 'Flex', 36700],
    [15, 'Toyota', 'Hilux 2.8 SRV', '2020', 'Prata', 'Diesel', 98300],
    [16, 'Chevrolet', 'Tracker 1.0 Turbo', '2022', 'Vermelho', 'Flex', 29800],
    [17, 'Fiat', 'Uno 1.0 Way', '2012', 'Prata', 'Flex', 168400],
    [18, 'Honda', 'HR-V 1.8 EXL', '2019', 'Cinza', 'Flex', 72600],
    [19, 'Hyundai', 'Creta 1.6 Action', '2021', 'Branco', 'Flex', 41900],
    [20, 'Renault', 'Duster 1.6 Expression', '2018', 'Marrom', 'Flex', 88200],
    [21, 'Ford', 'Ranger 3.2 XLT', '2017', 'Branco', 'Diesel', 176900],
    [21, 'Volkswagen', 'T-Cross 1.0 TSI', '2022', 'Cinza', 'Flex', 33100],
  ];
  const veiculos = V.map(([ci, marca, modelo, ano, cor, combustivel, km], i) => ({
    id: uid(), clienteId: clientes[ci].id, placa: placaFicticia(r, Number(ano) >= 2019), marca, modelo, ano, cor, combustivel, km, chassi: '',
    criadoEm: clientes[ci].criadoEm, _i: i,
  }));

  // ---------- Ordens de serviço ----------
  const ordens = [];
  const movimentos = [];
  const formas = ['PIX', 'PIX', 'PIX', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro'];
  const relatos = [
    'Barulho na suspensão dianteira ao passar em buracos.', 'Fazer revisão dos 50 mil km.', 'Luz da injeção acesa no painel.',
    'Freio rangendo e pedal baixo.', 'Ar-condicionado não está gelando.', 'Troca de óleo e verificação geral.',
    'Carro falhando quando frio.', 'Vazamento de água embaixo do motor.', 'Embreagem patinando na subida.', 'Bateria descarregando.',
  ];
  const combos = [
    { s: ['Troca de óleo'], p: [['OL-5W30', 4], ['FO-140', 1]], rev: true },
    { s: ['Troca de óleo'], p: [['OL-15W40', 4], ['FO-140', 1], ['FA-220', 1]], rev: true },
    { s: ['Revisão completa'], p: [['OL-5W30', 4], ['FO-140', 1], ['FA-220', 1], ['FC-310', 1], ['FCB-77', 1]], rev: true },
    { s: ['Troca de pastilhas', 'Troca de fluido'], p: [['PF-1120', 1], ['FL-DOT4', 1]] },
    { s: ['Troca de discos'], p: [['DF-450', 1], ['PF-1120', 1]] },
    { s: ['Alinhamento', 'Balanceamento'], p: [] },
    { s: ['Troca de amortecedores', 'Alinhamento'], p: [['AM-2270', 2], ['BI-3300', 2]] },
    { s: ['Diagnóstico', 'Troca de velas'], p: [['VL-BKR6', 4]] },
    { s: ['Higienização', 'Recarga de gás'], p: [['GS-R134', 1], ['FCB-77', 1]] },
    { s: ['Troca de correia'], p: [['CD-5520', 1], ['TN-0410', 1], ['BA-1180', 1]] },
    { s: ['Troca de bateria'], p: [['BT-60AH', 1]] },
    { s: ['Troca de embreagem'], p: [['KE-6200', 1]] },
    { s: ['Limpeza de bicos'], p: [['LB-500', 1]] },
  ];

  function montarItens(combo) {
    const itens = [];
    for (const nome of combo.s) {
      const s = serv(nome);
      if (s) itens.push({ id: uid(), tipo: 'servico', refId: s.id, descricao: s.descricao, qtd: 1, valor: s.preco });
    }
    for (const [cod, qtd] of combo.p) {
      const p = peca(cod);
      itens.push({ id: uid(), tipo: 'peca', refId: p.id, codigo: p.codigo, descricao: p.descricao, qtd, valor: p.preco, custo: p.custo, unidade: p.unidade });
    }
    return itens;
  }

  // Plano: [dias atrás, status]. Mais antigas primeiro (o número da OS segue a ordem).
  const plano = [];
  for (let i = 0; i < 118; i++) plano.push([Math.max(1, 179 - Math.round(i * 1.5) - Math.floor(r() * 2)), 'entregue']);
  plano.push([2, 'cancelada'], [40, 'cancelada'], [95, 'cancelada']);
  plano.push([4, 'pronta'], [3, 'pronta'], [6, 'aguardando_peca'], [5, 'execucao'], [2, 'execucao'], [1, 'aprovada'], [1, 'orcamento'], [5, 'orcamento'], [0, 'orcamento'], [0, 'aprovada']);
  plano.sort((a, b) => b[0] - a[0]);

  let numero = 0;
  plano.forEach(([diasAtras, status], k) => {
    const v = veiculos[(k * 7 + Math.floor(r() * 3)) % veiculos.length];
    const combo = combos[(k * 5 + Math.floor(r() * 4)) % combos.length];
    const dia = addDias(hoje, -diasAtras);
    const mec = mecanicos[k % mecanicos.length];
    const itens = montarItens(combo);
    numero += 1;
    const entrada = horaLocal(dia, 8 + Math.floor(r() * 8), Math.floor(r() * 4) * 15);
    const kmEntrada = Math.max(1000, (v.km || 0) - diasAtras * 40);
    const os = {
      id: uid(), numero, status, clienteId: v.clienteId, veiculoId: v.id, mecanicoId: mec.id, km: kmEntrada, entrada,
      previsao: addDias(dia, 1 + Math.floor(r() * 3)), relato: relatos[k % relatos.length], diagnostico: '',
      checklist: { combustivel: pick(['reserva', '1/4', '1/2', '3/4', 'cheio']), itens: { estepe: true, macaco: true, chave_roda: true, documento: r() > 0.3, tapetes: r() > 0.4 }, avarias: r() > 0.7 ? 'Risco no para-choque traseiro.' : '' },
      itens, desconto: r() > 0.8 ? 20 : 0, descontoPct: 0, pagamentos: [], garantiaDias: 90, observacoes: '', obsInternas: '',
      proximaRevisao: combo.rev ? { data: addDias(dia, 180), km: kmEntrada + 10000 } : { data: '', km: null },
      historico: [{ em: isoDe(dia, 9), status: 'orcamento', por: 'Bruna Carvalho', texto: 'OS criada' }], estoqueAplicado: {}, criadoEm: isoDe(dia, 9),
    };
    const cli = clientes.find((c) => c.id === v.clienteId);
    os.clienteNome = cli.nome;
    os.telefone = cli.telefone;
    os.veiculoDesc = `${v.marca} ${v.modelo} ${v.ano}`;
    os.placa = v.placa;
    if (status === 'execucao' || status === 'aguardando_peca') os.diagnostico = 'Peças avaliadas e aprovadas pelo cliente por telefone.';
    if (status === 'aguardando_peca') os.previsao = addDias(hoje, -1); // atrasada de propósito
    if (['aprovada', 'execucao', 'aguardando_peca', 'pronta', 'entregue'].includes(status)) os.historico.push({ em: isoDe(dia, 10), status: 'aprovada', por: 'Bruna Carvalho' });
    if (['execucao', 'aguardando_peca', 'pronta', 'entregue'].includes(status)) os.historico.push({ em: isoDe(dia, 11), status: 'execucao', por: mec.nome });
    if (status === 'aguardando_peca') os.historico.push({ em: isoDe(dia, 15), status: 'aguardando_peca', por: mec.nome });
    if (['pronta', 'entregue'].includes(status)) {
      const fim = addDias(dia, diasAtras > 1 ? 1 : 0);
      os.concluidaEm = isoDe(fim, 16);
      os.historico.push({ em: os.concluidaEm, status: 'pronta', por: mec.nome });
      os.estoqueAplicado = alvoEstoque({ ...os, status: 'pronta' });
      for (const [pecaId, qtd] of Object.entries(os.estoqueAplicado)) {
        movimentos.push({ id: uid(), pecaId, tipo: 'saida', qtd, data: fim, motivo: `Usada na OS ${String(numero).padStart(4, '0')}`, osId: os.id, por: mec.nome });
      }
    }
    // Totais para pagamentos
    let total = itens.reduce((s, it) => s + it.qtd * it.valor, 0) - os.desconto;
    total = Math.round(total * 100) / 100;
    if (status === 'entregue') {
      const fim = addDias(dia, 1);
      os.entregueEm = isoDe(fim, 17);
      os.historico.push({ em: os.entregueEm, status: 'entregue', por: 'Bruna Carvalho' });
      // Alguns clientes ainda devendo (aparecem em "A receber")
      const devedor = diasAtras >= 8 && diasAtras <= 35 && k % 6 === 0;
      if (!devedor) os.pagamentos.push({ id: uid(), valor: total, forma: pick(formas), data: fim, obs: '' });
      else if (k % 12 === 0) os.pagamentos.push({ id: uid(), valor: Math.round(total * 0.5), forma: 'PIX', data: fim, obs: 'Sinal de 50%' });
    }
    if (status === 'pronta' && k % 2 === 0) os.pagamentos.push({ id: uid(), valor: Math.round(total * 0.3), forma: 'PIX', data: dia, obs: 'Sinal' });
    if (status === 'cancelada') os.historico.push({ em: isoDe(dia, 12), status: 'cancelada', por: 'Bruna Carvalho' });
    ordens.push(os);
  });

  // Alguns carros com revisão chegando (aparecem em "Revisões chegando" no painel).
  const ultimaPorVeiculo = new Map();
  for (const o of ordens) {
    if (o.status === 'cancelada') continue;
    const a = ultimaPorVeiculo.get(o.veiculoId);
    if (!a || o.entrada > a.entrada) ultimaPorVeiculo.set(o.veiculoId, o);
  }
  const candidatas = [...ultimaPorVeiculo.values()].filter((o) => o.status === 'entregue');
  [5, 12, 21, -3].forEach((d, i) => {
    if (candidatas[i]) candidatas[i].proximaRevisao = { data: addDias(hoje, d), km: (candidatas[i].km || 0) + 10000 };
  });

  // Compras de estoque
  for (const p of pecas.slice(0, 10)) {
    movimentos.push({ id: uid(), pecaId: p.id, tipo: 'entrada', qtd: Math.max(4, Math.round(p.qtd * 1.5)), custo: p.custo, data: addDias(hoje, -150 + Math.floor(r() * 30)), motivo: `Compra · ${p.fornecedor}`, por: 'Bruna Carvalho' });
  }

  // ---------- Agenda (semana atual) ----------
  const agenda = [];
  const horas = ['08:00', '09:30', '10:00', '13:30', '14:00', '15:30', '16:00'];
  const motivos = ['Revisão', 'Troca de óleo e filtro', 'Alinhamento e balanceamento', 'Barulho na suspensão', 'Ar-condicionado', 'Diagnóstico de injeção'];
  // Dias úteis (sem domingo) de 3 dias atrás até 6 dias à frente
  const diasAgenda = [];
  for (let d = -4; d <= 7; d++) {
    const dia = addDias(hoje, d);
    const [a, mm, dd] = dia.split('-').map(Number);
    if (new Date(a, mm - 1, dd).getDay() !== 0) diasAgenda.push(dia);
  }
  let n = 0;
  for (const dia of diasAgenda) {
    const qtd = dia === hoje ? 3 : 1 + Math.floor(r() * 2);
    for (let j = 0; j < qtd; j++) {
      const v = veiculos[(n * 5 + 3) % veiculos.length];
      const passado = dia < hoje;
      agenda.push({
        id: uid(), data: dia, hora: horas[(n + j * 2) % horas.length], clienteId: v.clienteId, veiculoId: v.id, servico: motivos[n % motivos.length],
        status: passado ? (n % 7 === 3 ? 'faltou' : 'concluido') : dia === hoje ? 'confirmado' : n % 3 === 0 ? 'confirmado' : 'agendado',
        mecanicoId: mecanicos[n % 3].id, obs: '', telefone: clientes.find((c) => c.id === v.clienteId).telefone,
      });
      n += 1;
    }
  }
  const amanha = diasAgenda.find((d) => d > hoje) || addDias(hoje, 1);
  agenda.push({ id: uid(), data: amanha, hora: '11:00', clienteId: '', clienteNome: 'Sérgio Ramos', telefone: telFicticio(r), veiculoId: '', veiculoDesc: 'Palio prata', servico: 'Orçamento de embreagem', status: 'agendado', obs: 'Cliente novo, indicação do Carlos.' });

  // ---------- Despesas ----------
  const despesas = [];
  const mesAtual = hoje.slice(0, 7);
  for (let m = -3; m <= 0; m++) {
    const d = new Date(Number(mesAtual.slice(0, 4)), Number(mesAtual.slice(5, 7)) - 1 + m, 1);
    const mes = dataISO(d).slice(0, 7);
    const fixas = [
      ['Aluguel do galpão', 'Aluguel', 3200, 10, 'Imobiliária Central'],
      ['Conta de energia', 'Energia elétrica', 520 + Math.round(r() * 120), 15, 'Distribuidora de energia'],
      ['Conta de água', 'Água', 95 + Math.round(r() * 40), 18, 'Saneamento'],
      ['Internet e telefone', 'Internet e telefone', 129.9, 20, 'Operadora'],
      ['Honorários do contador', 'Contador', 420, 5, 'Escritório Contábil'],
      ['Salário do auxiliar', 'Salários e comissões', 1850, 5, 'Folha de pagamento'],
      ['Compra de peças (reposição)', 'Compra de peças', 2600 + Math.round(r() * 900), 25, 'Distribuidora Auto Peças Centro'],
    ];
    for (const [descricao, categoria, valor, dia, fornecedor] of fixas) {
      const venc = `${mes}-${String(dia).padStart(2, '0')}`;
      const pago = venc < hoje;
      despesas.push({ id: uid(), descricao, categoria, valor, vencimento: venc, pago, pagoEm: pago ? venc : '', forma: pago ? 'PIX' : '', fornecedor, obs: '' });
    }
  }
  // Uma conta vencida e não paga (aparece em alerta)
  despesas.push({ id: uid(), descricao: 'Manutenção do elevador automotivo', categoria: 'Manutenção da oficina', valor: 680, vencimento: addDias(hoje, -2), pago: false, pagoEm: '', forma: '', fornecedor: 'Elevadores Técnica', obs: '' });

  for (const v of veiculos) delete v._i;

  return {
    config: {
      ...CONFIG_PADRAO,
      nome: 'Auto Center Exemplo',
      razaoSocial: 'Auto Center Exemplo Serviços Automotivos Ltda',
      cnpj: cnpjFicticio(r),
      telefone: '1140000000',
      whatsapp: '11900000000',
      email: 'contato@exemplo.com',
      endereco: 'Av. das Oficinas, 1500 — Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      chavePix: 'contato@exemplo.com',
      migracaoV1: 'demo',
    },
    dados: { clientes, veiculos, ordens, pecas, movimentos, servicos, equipe, agenda, despesas },
  };
}
