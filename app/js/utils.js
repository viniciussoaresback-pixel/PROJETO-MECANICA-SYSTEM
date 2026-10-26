// Funções puras (sem tela e sem banco). Testadas em tests/unit/utils.test.mjs.

// ---------- Identificadores ----------
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// ---------- Texto ----------
export function soDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

// Para busca: minúsculo e sem acento.
export function normalizar(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'a', 'o']);

// "JOÃO DA SILVA" -> "João da Silva". Mantém siglas curtas digitadas em maiúsculo (ex.: "ME", "LTDA").
export function capitalizar(nome) {
  const limpo = String(nome ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) return '';
  return limpo
    .split(' ')
    .map((p, i) => {
      const min = p.toLowerCase();
      if (i > 0 && MINUSCULAS.has(min)) return min;
      if (/^(ltda|me|mei|epp|s\/a|sa|cia)\.?$/i.test(p)) return p.toUpperCase();
      return min.charAt(0).toUpperCase() + min.slice(1);
    })
    .join(' ');
}

// "outubro de 2026" -> "Outubro de 2026"
export function maiuscula(v) {
  const s = String(v ?? '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function escHTML(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Substitui {chave} pelos valores. Chave inexistente vira texto vazio.
export function preencherModelo(modelo, vars) {
  return String(modelo ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '') + '');
}

// ---------- Números e dinheiro ----------
export function arred(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const FMT_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FMT_NUM = new Intl.NumberFormat('pt-BR');
const FMT_DEC = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoeda(n) {
  // Intl usa espaço não separável depois do "R$"; trocamos por espaço comum (melhor em PDF/WhatsApp).
  return FMT_MOEDA.format(arred(n)).replace(/ /g, ' ');
}
export function fmtNumero(n) {
  return FMT_NUM.format(Number(n) || 0);
}
export function fmtDecimal(n) {
  return FMT_DEC.format(arred(n));
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 12", número… Retorna número (0 se inválido).
export function parseMoeda(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  } else if (/^\d{1,3}\.\d{3}$/.test(s)) {
    // "1.500" digitado no padrão brasileiro = mil e quinhentos
    s = s.replace('.', '');
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function fmtCompacto(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} mi`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1).replace('.', ',').replace(',0', '')} mil`;
  return FMT_NUM.format(Math.round(v));
}

// ---------- Datas (sempre no fuso local, formato ISO "AAAA-MM-DD") ----------
function dois(n) {
  return String(n).padStart(2, '0');
}

export function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
export function hojeISO() {
  return dataISO(new Date());
}
export function agoraISO() {
  return new Date().toISOString();
}
export function horaAtual() {
  const d = new Date();
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// Converte "AAAA-MM-DD" (ou ISO completo) em Date local.
export function paraData(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [a, m, d] = s.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Parte "AAAA-MM-DD" de qualquer data (ISO completo é convertido para o dia local).
export function diaDe(v) {
  const d = paraData(v);
  return d ? dataISO(d) : '';
}

export function fmtData(v) {
  const d = paraData(v);
  if (!d) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function fmtDataHora(v) {
  const d = paraData(v);
  if (!d) return '';
  return `${fmtData(d)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
export function fmtDataCurta(v) {
  const d = paraData(v);
  if (!d) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
}

export function addDias(v, n) {
  const d = new Date(paraData(v) || new Date());
  d.setDate(d.getDate() + n);
  return dataISO(d);
}

// Diferença em dias entre duas datas (b - a), ignorando horário.
export function diasEntre(a, b) {
  const da = paraData(diaDe(a));
  const db = paraData(diaDe(b));
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
}

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// "2026-10" (mês de referência)
export function mesDe(v) {
  return diaDe(v).slice(0, 7);
}
export function mesAtual() {
  return hojeISO().slice(0, 7);
}
export function addMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
}
export function nomeMes(mes, curto = false) {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1] || '';
  return curto ? `${nome.slice(0, 3)}/${String(a).slice(2)}` : `${nome} de ${a}`;
}
export function primeiroDiaMes(mes) {
  return `${mes}-01`;
}
export function ultimoDiaMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return dataISO(new Date(a, m, 0));
}
export function dentroPeriodo(v, inicio, fim) {
  const d = diaDe(v);
  if (!d) return false;
  return (!inicio || d >= inicio) && (!fim || d <= fim);
}

// ---------- Máscaras ----------
export function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraDocumento(v) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function mascaraCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Placa antiga (ABC-1234) ou Mercosul (ABC1D23).
export function mascaraPlaca(v) {
  const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (s.length === 7 && /^[A-Z]{3}\d{4}$/.test(s)) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return s;
}

export function placaLimpa(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------- Validações ----------
export function validarCPF(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

export function validarCNPJ(v) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

// Vazio é válido (campo opcional). Retorna mensagem de erro ou ''.
export function erroDocumento(v) {
  const d = soDigitos(v);
  if (!d) return '';
  if (d.length === 11) return validarCPF(d) ? '' : 'CPF inválido';
  if (d.length === 14) return validarCNPJ(d) ? '' : 'CNPJ inválido';
  return 'Informe 11 dígitos (CPF) ou 14 (CNPJ)';
}

export function validarPlaca(v) {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placaLimpa(v));
}

export function validarEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());
}

export function validarTelefone(v) {
  const d = soDigitos(v);
  return d.length === 10 || d.length === 11;
}

// ---------- Ordem de serviço ----------
export const STATUS_OS = [
  { id: 'orcamento', nome: 'Orçamento', curto: 'Orçamento', cor: 'violeta', icone: 'file-text' },
  { id: 'aprovada', nome: 'Aprovada', curto: 'Aprovada', cor: 'azul', icone: 'badge-check' },
  { id: 'execucao', nome: 'Em execução', curto: 'Executando', cor: 'ciano', icone: 'wrench' },
  { id: 'aguardando_peca', nome: 'Aguardando peça', curto: 'Aguard. peça', cor: 'amarelo', icone: 'package' },
  { id: 'pronta', nome: 'Pronta p/ retirada', curto: 'Pronta', cor: 'verde', icone: 'circle-check' },
  { id: 'entregue', nome: 'Entregue', curto: 'Entregue', cor: 'cinza', icone: 'car-front' },
  { id: 'cancelada', nome: 'Cancelada', curto: 'Cancelada', cor: 'vermelho', icone: 'circle-x' },
];
export const STATUS_ABERTOS = ['orcamento', 'aprovada', 'execucao', 'aguardando_peca', 'pronta'];
export const STATUS_BAIXA_ESTOQUE = ['pronta', 'entregue'];

export function infoStatus(id) {
  return STATUS_OS.find((s) => s.id === id) || STATUS_OS[0];
}

export const FORMAS_PAGAMENTO = ['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Boleto', 'Transferência', 'Outro'];

export function totalItem(it) {
  const bruto = (Number(it.qtd) || 0) * (Number(it.valor) || 0);
  return arred(Math.max(0, bruto - (Number(it.desconto) || 0)));
}

// Totais da OS. Desconto geral em R$ (desconto) ou em % (descontoPct).
export function calcularOS(os) {
  const itens = os?.itens || [];
  let servicos = 0;
  let pecas = 0;
  let custoPecas = 0;
  for (const it of itens) {
    const t = totalItem(it);
    if (it.tipo === 'peca') {
      pecas += t;
      custoPecas += (Number(it.qtd) || 0) * (Number(it.custo) || 0);
    } else servicos += t;
  }
  servicos = arred(servicos);
  pecas = arred(pecas);
  const subtotal = arred(servicos + pecas);
  let desconto = Number(os?.desconto) || 0;
  if (os?.descontoPct) desconto = (subtotal * Number(os.descontoPct)) / 100;
  desconto = arred(Math.min(Math.max(desconto, 0), subtotal));
  const total = arred(subtotal - desconto);
  const pago = arred((os?.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0));
  const saldo = arred(total - pago);
  let situacao = 'pendente';
  if (total > 0 && saldo <= 0) situacao = 'pago';
  else if (pago > 0) situacao = 'parcial';
  if (total === 0 && pago === 0) situacao = 'sem_valor';
  return { servicos, pecas, subtotal, desconto, total, pago, saldo, situacao, custoPecas: arred(custoPecas) };
}

// Quanto de cada peça a OS deve ter tirado do estoque, conforme o status.
export function alvoEstoque(os) {
  const alvo = {};
  if (!STATUS_BAIXA_ESTOQUE.includes(os?.status)) return alvo;
  for (const it of os.itens || []) {
    if (it.tipo !== 'peca' || !it.refId) continue;
    alvo[it.refId] = (alvo[it.refId] || 0) + (Number(it.qtd) || 0);
  }
  return alvo;
}

// Diferença entre o que já saiu do estoque (aplicado) e o que deveria ter saído (alvo).
// Retorna { pecaId: quantidadeASairAgora } — negativo = devolver ao estoque.
export function diffEstoque(aplicado = {}, alvo = {}) {
  const diff = {};
  const ids = new Set([...Object.keys(aplicado || {}), ...Object.keys(alvo || {})]);
  for (const id of ids) {
    const d = arred((alvo[id] || 0) - (aplicado[id] || 0));
    if (d !== 0) diff[id] = d;
  }
  return diff;
}

export function proximoNumero(lista, campo = 'numero') {
  let max = 0;
  for (const x of lista || []) max = Math.max(max, Number(x?.[campo]) || 0);
  return max + 1;
}

export function fmtNumeroOS(n) {
  return String(Number(n) || 0).padStart(4, '0');
}

// ---------- WhatsApp ----------
export function telefoneWhatsApp(v) {
  let d = soDigitos(v);
  if (!d) return '';
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function linkWhatsApp(telefone, texto) {
  const num = telefoneWhatsApp(telefone);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return num ? `https://wa.me/${num}${q}` : `https://wa.me/${q}`;
}

// ---------- Valor por extenso (recibos) ----------
const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function extensoAte999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c) partes.push(CEN[c]);
  if (r) {
    if (r < 20) partes.push(UNI[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DEZ[d]} e ${UNI[u]}` : DEZ[d]);
    }
  }
  return partes.join(' e ');
}

function extensoInteiro(n) {
  if (n === 0) return 'zero';
  const grupos = [];
  let x = n;
  while (x > 0) {
    grupos.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const nomes = [
    ['', ''],
    ['mil', 'mil'],
    ['milhão', 'milhões'],
    ['bilhão', 'bilhões'],
  ];
  const partes = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    let txt = i === 1 && g === 1 ? 'mil' : extensoAte999(g);
    if (i >= 1 && !(i === 1 && g === 1)) txt += ` ${g === 1 ? nomes[i][0] : nomes[i][1]}`;
    partes.push({ txt, g, i });
  }
  // "e" antes do último grupo quando ele é < 100 ou centena redonda (ex.: "mil e duzentos")
  return partes
    .map((p, k) => {
      if (k === 0) return p.txt;
      const ultimo = k === partes.length - 1;
      const usaE = ultimo && p.i === 0 && (p.g < 100 || p.g % 100 === 0);
      return (usaE ? ' e ' : ', ') + p.txt;
    })
    .join('')
    .replace(/, /g, ' ');
}

export function valorPorExtenso(valor) {
  const v = arred(Math.abs(Number(valor) || 0));
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  const partes = [];
  if (reais > 0) {
    let t = extensoInteiro(reais);
    // "um milhão de reais", "dois milhões de reais"
    if (reais % 1000000 === 0) t += ' de';
    partes.push(`${t} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) partes.push(`${extensoInteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) return 'zero real';
  return partes.join(' e ');
}

// ---------- CSV ----------
export function gerarCSV(linhas) {
  const cel = (v) => {
    let s = v == null ? '' : String(v);
    // Texto começando com = + - @ vira fórmula no Excel: neutraliza (menos números negativos).
    if (/^[=+\-@\t\r]/.test(s) && !/^-?[\d.,]+$/.test(s)) s = `'${s}`;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula: o Excel em português abre direto nas colunas certas.
  return `﻿${linhas.map((l) => l.map(cel).join(';')).join('\r\n')}`;
}

// ---------- Ordenação / agrupamento ----------
export function ordenarPor(lista, fn, desc = false) {
  const c = [...lista];
  c.sort((a, b) => {
    const va = fn(a);
    const vb = fn(b);
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });
  return c;
}

export function contemTermo(textos, termo) {
  const t = normalizar(termo);
  if (!t) return true;
  const alvo = normalizar(textos.filter(Boolean).join(' '));
  return t.split(/\s+/).every((p) => alvo.includes(p));
}

// Remove chaves com undefined (o Firestore não aceita).
export function limparObjeto(obj) {
  if (Array.isArray(obj)) return obj.map(limparObjeto);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const r = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) r[k] = limparObjeto(v);
    return r;
  }
  return obj;
}
