// Camada de dados: guarda tudo em memória, avisa as telas quando algo muda
// e repassa as gravações para o "adaptador" (navegador = demonstração, ou Firebase = nuvem).
import { agoraISO, arred, limparObjeto, uid } from './utils.js';

export const COLECOES = ['clientes', 'veiculos', 'ordens', 'pecas', 'movimentos', 'servicos', 'equipe', 'agenda', 'despesas'];

export const MENSAGENS_PADRAO = {
  orcamento:
    'Olá, {cliente}! Aqui é da {oficina}.\nSegue o orçamento da OS nº {numero} do seu {veiculo} ({placa}):\n\n{itens}\n\n*Total: {total}*\nVálido até {validade}.\n\nPodemos seguir com o serviço?',
  pronto:
    'Olá, {cliente}! Seu {veiculo} ({placa}) já está pronto para retirada aqui na {oficina}.\nTotal do serviço: {total}.{pix}\nQualquer dúvida, é só chamar!',
  revisao:
    'Olá, {cliente}! Tudo bem? Aqui é da {oficina}.\nEstá chegando a hora da revisão do seu {veiculo} ({placa}){quando}. Quer agendar um horário?',
  agendamento:
    'Olá, {cliente}! Confirmando seu horário na {oficina}: {data} às {hora}{servico}.\nSe precisar remarcar, é só avisar por aqui.',
  cobranca:
    'Olá, {cliente}! Aqui é da {oficina}.\nConsta em aberto o valor de {saldo} referente à OS nº {numero} ({veiculo}).{pix}\nAssim que pagar, pode enviar o comprovante por aqui. Obrigado!',
};

export const CONFIG_PADRAO = {
  nome: '',
  razaoSocial: '',
  cnpj: '',
  telefone: '',
  whatsapp: '',
  email: '',
  endereco: '',
  cidade: '',
  uf: '',
  site: '',
  chavePix: '',
  logo: '',
  garantiaDias: 90,
  validadeOrcamentoDias: 7,
  termoGarantia:
    'Garantia dos serviços executados e das peças fornecidas pela oficina pelo prazo indicado, contado a partir da entrega do veículo. A garantia não cobre desgaste natural, mau uso, peças fornecidas pelo cliente nem veículos reparados por terceiros após o serviço.',
  rodapeOS: 'Obrigado pela preferência!',
  imprimirChecklist: true,
  mensagens: { ...MENSAGENS_PADRAO },
};

const estado = {
  modo: null, // 'demo' | 'nuvem'
  usuario: null, // { uid, email, nome, papel }
  oficinaId: null,
  conectado: false,
  dados: Object.fromEntries(COLECOES.map((c) => [c, []])),
  config: { ...CONFIG_PADRAO },
  membros: [],
  convites: [],
};

const indices = {};
const ouvintes = new Set();
let alteradas = new Set();
let agendado = false;
let adaptador = null;
const pendentes = new Set();

function notificar(col) {
  alteradas.add(col);
  if (agendado) return;
  agendado = true;
  queueMicrotask(() => {
    agendado = false;
    const cols = alteradas;
    alteradas = new Set();
    for (const fn of ouvintes) {
      try {
        fn(cols);
      } catch (e) {
        console.error(e);
      }
    }
  });
}

// Valor especial: soma ao número atual (ex.: estoque). No Firebase vira increment().
export function incremento(n) {
  return { __incremento: Number(n) || 0 };
}
export function ehIncremento(v) {
  return v && typeof v === 'object' && '__incremento' in v;
}

export function aplicarPatch(obj, patch) {
  const r = { ...obj };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (ehIncremento(v)) r[k] = arred((Number(r[k]) || 0) + v.__incremento);
    else r[k] = v;
  }
  return r;
}

function aplicarLocal(col, obj) {
  const arr = estado.dados[col];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj;
  else arr.push(obj);
  indices[col] = null;
  notificar(col);
}

function removerLocal(col, id) {
  const arr = estado.dados[col];
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
  indices[col] = null;
  notificar(col);
}

function acompanhar(promessa, oque) {
  const p = Promise.resolve(promessa)
    .catch((e) => {
      console.error('Falha ao gravar', oque, e);
      store.aoErroGravacao?.(e, oque);
    })
    .finally(() => {
      pendentes.delete(p);
      notificar('_sincronia');
    });
  pendentes.add(p);
  notificar('_sincronia');
  return p;
}

function assinatura() {
  return { atualizadoEm: agoraISO(), atualizadoPor: estado.usuario?.nome || estado.usuario?.email || '' };
}

export const store = {
  estado,
  aoErroGravacao: null,

  todos(col) {
    return estado.dados[col] || [];
  },

  porId(col, id) {
    if (!id) return null;
    if (!indices[col]) indices[col] = new Map(this.todos(col).map((x) => [x.id, x]));
    return indices[col].get(id) || null;
  },

  // Cria um registro novo. Retorna o objeto já com id (a gravação no banco continua em segundo plano).
  adicionar(col, dados) {
    const id = dados.id || uid();
    const obj = limparObjeto({ ...dados, id, criadoEm: dados.criadoEm || agoraISO(), ...assinatura() });
    aplicarLocal(col, obj);
    acompanhar(adaptador.gravar(col, id, obj), `${col}/${id}`);
    return obj;
  },

  // Grava o registro inteiro (cria ou substitui).
  salvar(col, obj) {
    const id = obj.id || uid();
    const anterior = this.porId(col, id);
    const novo = limparObjeto({ ...obj, id, criadoEm: obj.criadoEm || anterior?.criadoEm || agoraISO(), ...assinatura() });
    aplicarLocal(col, novo);
    acompanhar(adaptador.gravar(col, id, novo), `${col}/${id}`);
    return novo;
  },

  atualizar(col, id, patch) {
    const atual = this.porId(col, id);
    if (!atual) return null;
    const p = limparObjeto({ ...patch, ...assinatura() });
    const novo = aplicarPatch(atual, p);
    aplicarLocal(col, novo);
    acompanhar(adaptador.alterar(col, id, p), `${col}/${id}`);
    return novo;
  },

  remover(col, id) {
    const atual = this.porId(col, id);
    removerLocal(col, id);
    acompanhar(adaptador.apagar(col, id), `${col}/${id}`);
    return atual;
  },

  // Várias gravações juntas (no Firebase vão num único lote).
  // ops: [{ op: 'gravar'|'alterar'|'apagar', col, id, dados }]
  lote(ops) {
    const prontas = [];
    for (const o of ops) {
      if (o.op === 'apagar') {
        removerLocal(o.col, o.id);
        prontas.push(o);
      } else if (o.op === 'alterar') {
        const atual = this.porId(o.col, o.id);
        if (!atual) continue;
        const p = limparObjeto({ ...o.dados, ...assinatura() });
        aplicarLocal(o.col, aplicarPatch(atual, p));
        prontas.push({ ...o, dados: p });
      } else {
        const id = o.id || o.dados.id || uid();
        const anterior = this.porId(o.col, id);
        const obj = limparObjeto({ ...o.dados, id, criadoEm: o.dados.criadoEm || anterior?.criadoEm || agoraISO(), ...assinatura() });
        aplicarLocal(o.col, obj);
        prontas.push({ op: 'gravar', col: o.col, id, dados: obj });
      }
    }
    if (prontas.length) acompanhar(adaptador.lote(prontas), `lote(${prontas.length})`);
    return prontas;
  },

  salvarConfig(patch) {
    estado.config = { ...estado.config, ...patch };
    notificar('config');
    acompanhar(adaptador.gravarConfig(limparObjeto(patch)), 'config');
  },

  inscrever(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },

  gravacoesPendentes() {
    return pendentes.size;
  },

  async aguardarGravacoes(limiteMs = 20000) {
    const todas = Promise.allSettled([...pendentes]);
    await Promise.race([todas, new Promise((r) => setTimeout(r, limiteMs))]);
  },

  get adaptador() {
    return adaptador;
  },

  // Liga a um adaptador e carrega os dados. Resolve quando a primeira leitura terminar.
  async conectar(novoAdaptador, { modo, usuario, oficinaId }) {
    adaptador = novoAdaptador;
    estado.modo = modo;
    estado.usuario = usuario;
    estado.oficinaId = oficinaId;
    for (const c of COLECOES) {
      estado.dados[c] = [];
      indices[c] = null;
    }
    estado.config = { ...CONFIG_PADRAO };
    await adaptador.iniciar({
      aoColecao(col, docs) {
        estado.dados[col] = docs;
        indices[col] = null;
        notificar(col);
      },
      aoConfig(cfg) {
        estado.config = { ...CONFIG_PADRAO, ...(cfg || {}), mensagens: { ...MENSAGENS_PADRAO, ...(cfg?.mensagens || {}) } };
        notificar('config');
      },
      aoMembros(lista) {
        estado.membros = lista;
        notificar('membros');
      },
      aoConvites(lista) {
        estado.convites = lista;
        notificar('convites');
      },
      aoErro(e) {
        store.aoErroLeitura?.(e);
      },
    });
    estado.conectado = true;
    notificar('*');
  },

  desconectar() {
    try {
      adaptador?.parar?.();
    } catch (e) {
      console.error(e);
    }
    adaptador = null;
    estado.conectado = false;
    estado.usuario = null;
    estado.modo = null;
  },

  // Tudo da oficina num objeto só (backup).
  exportar() {
    const dados = {};
    for (const c of COLECOES) dados[c] = this.todos(c);
    return {
      sistema: 'Mecânica Pro',
      versao: 2,
      geradoEm: agoraISO(),
      config: estado.config,
      dados,
    };
  },
};

// ---------- Perfis de acesso ----------
// dono: tudo. atendente: tudo menos usuários e restaurar backup. mecanico: só a parte operacional.
const PERMISSOES = {
  atendente: new Set(['financeiro', 'relatorios', 'equipe', 'config-oficina', 'excluir', 'valores', 'backup-exportar']),
  mecanico: new Set(['valores']),
};

export function pode(acao) {
  const papel = estado.usuario?.papel || 'dono';
  if (papel === 'dono') return true;
  return PERMISSOES[papel]?.has(acao) || false;
}

export const PAPEIS = {
  dono: { nome: 'Dono / administrador', descricao: 'Acesso total, inclusive usuários e backup.' },
  atendente: { nome: 'Atendente / gerente', descricao: 'Tudo, menos gerenciar usuários e restaurar backup.' },
  mecanico: { nome: 'Mecânico', descricao: 'Ordens de serviço, agenda, clientes, veículos e estoque. Não vê o financeiro.' },
};

// ---------- Adaptador do navegador (demonstração) ----------
export function criarAdaptadorLocal(ns = 'demo') {
  const K = (c) => `mp:${ns}:${c}`;
  const mem = {};
  let cbs = null;
  let ouvinte = null;

  function ler(c) {
    try {
      const v = JSON.parse(localStorage.getItem(K(c)) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function lerConfig() {
    try {
      return JSON.parse(localStorage.getItem(K('config')) || 'null');
    } catch {
      return null;
    }
  }
  function gravarDisco(c) {
    try {
      localStorage.setItem(K(c), JSON.stringify(mem[c]));
    } catch {
      throw new Error('O navegador está sem espaço para guardar os dados.');
    }
  }
  function aplicarOp(o) {
    const arr = mem[o.col];
    const i = arr.findIndex((x) => x.id === o.id);
    if (o.op === 'apagar') {
      if (i >= 0) arr.splice(i, 1);
    } else if (o.op === 'alterar') {
      if (i >= 0) arr[i] = aplicarPatch(arr[i], o.dados);
    } else if (i >= 0) arr[i] = { ...o.dados, id: o.id };
    else arr.push({ ...o.dados, id: o.id });
  }

  return {
    tipo: 'local',
    async iniciar(callbacks) {
      cbs = callbacks;
      for (const c of COLECOES) {
        mem[c] = ler(c);
        cbs.aoColecao(c, mem[c].map((x) => ({ ...x })));
      }
      cbs.aoConfig(lerConfig());
      cbs.aoMembros([]);
      // Outra aba mexeu nos dados? Recarrega aqui também.
      ouvinte = (e) => {
        if (!e.key?.startsWith(`mp:${ns}:`)) return;
        const c = e.key.slice(`mp:${ns}:`.length);
        if (c === 'config') cbs.aoConfig(lerConfig());
        else if (COLECOES.includes(c)) {
          mem[c] = ler(c);
          cbs.aoColecao(c, mem[c].map((x) => ({ ...x })));
        }
      };
      window.addEventListener('storage', ouvinte);
    },
    async gravar(col, id, dados) {
      aplicarOp({ op: 'gravar', col, id, dados });
      gravarDisco(col);
    },
    async alterar(col, id, patch) {
      aplicarOp({ op: 'alterar', col, id, dados: patch });
      gravarDisco(col);
    },
    async apagar(col, id) {
      aplicarOp({ op: 'apagar', col, id });
      gravarDisco(col);
    },
    async lote(ops) {
      const tocadas = new Set();
      for (const o of ops) {
        aplicarOp(o);
        tocadas.add(o.col);
      }
      for (const c of tocadas) gravarDisco(c);
    },
    async gravarConfig(patch) {
      const cfg = { ...(lerConfig() || {}), ...patch };
      try {
        localStorage.setItem(K('config'), JSON.stringify(cfg));
      } catch {
        throw new Error('O navegador está sem espaço para guardar os dados (a logo pode ser grande demais).');
      }
    },
    parar() {
      if (ouvinte) window.removeEventListener('storage', ouvinte);
    },
    existeDados() {
      return localStorage.getItem(K('ordens')) !== null;
    },
    apagarTudo() {
      for (const c of [...COLECOES, 'config']) localStorage.removeItem(K(c));
    },
  };
}

// Grava um conjunto completo de dados (demonstração inicial ou backup) direto no navegador.
export function gravarDadosLocais(ns, pacote) {
  const K = (c) => `mp:${ns}:${c}`;
  for (const c of COLECOES) localStorage.setItem(K(c), JSON.stringify(pacote.dados?.[c] || []));
  localStorage.setItem(K('config'), JSON.stringify(pacote.config || {}));
}
