// Testes das funções puras (cálculos, máscaras, validações).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addDias, addMeses, alvoEstoque, calcularOS, capitalizar, contemTermo, diasEntre, diffEstoque, erroDocumento, fmtData, fmtMoeda,
  gerarCSV, limparObjeto, linkWhatsApp, mascaraCEP, mascaraDocumento, mascaraPlaca, mascaraTelefone, nomeMes, normalizar,
  parseMoeda, preencherModelo, proximoNumero, totalItem, ultimoDiaMes, validarCNPJ, validarCPF, validarEmail, validarPlaca,
  valorPorExtenso,
} from '../../app/js/utils.js';

describe('dinheiro', () => {
  test('formata em reais', () => {
    assert.equal(fmtMoeda(1234.5), 'R$ 1.234,50');
    assert.equal(fmtMoeda(0), 'R$ 0,00');
    assert.equal(fmtMoeda(-10), '-R$ 10,00');
  });
  test('entende valores digitados de vários jeitos', () => {
    assert.equal(parseMoeda('1.234,56'), 1234.56);
    assert.equal(parseMoeda('1234,5'), 1234.5);
    assert.equal(parseMoeda('R$ 80,00'), 80);
    assert.equal(parseMoeda('1234.56'), 1234.56);
    assert.equal(parseMoeda('1.500'), 1500);
    assert.equal(parseMoeda('1.000.000'), 1000000);
    assert.equal(parseMoeda(''), 0);
    assert.equal(parseMoeda('abc'), 0);
    assert.equal(parseMoeda(42), 42);
  });
});

describe('valor por extenso (recibo)', () => {
  const casos = [
    [1, 'um real'],
    [2, 'dois reais'],
    [100, 'cem reais'],
    [101, 'cento e um reais'],
    [115.5, 'cento e quinze reais e cinquenta centavos'],
    [0.01, 'um centavo'],
    [1000, 'mil reais'],
    [1200, 'mil e duzentos reais'],
    [1234.56, 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],
    [2050, 'dois mil e cinquenta reais'],
    [21000, 'vinte e um mil reais'],
    [1000000, 'um milhão de reais'],
    [0, 'zero real'],
  ];
  for (const [v, txt] of casos) test(`${v} → ${txt}`, () => assert.equal(valorPorExtenso(v), txt));
});

describe('documentos', () => {
  test('CPF', () => {
    assert.equal(validarCPF('529.982.247-25'), true);
    assert.equal(validarCPF('52998224724'), false);
    assert.equal(validarCPF('111.111.111-11'), false);
    assert.equal(validarCPF('123'), false);
  });
  test('CNPJ', () => {
    assert.equal(validarCNPJ('11.222.333/0001-81'), true);
    assert.equal(validarCNPJ('11.222.333/0001-80'), false);
    assert.equal(validarCNPJ('00000000000000'), false);
  });
  test('mensagem de erro', () => {
    assert.equal(erroDocumento(''), '');
    assert.equal(erroDocumento('529.982.247-25'), '');
    assert.equal(erroDocumento('529.982.247-24'), 'CPF inválido');
    assert.equal(erroDocumento('11.222.333/0001-80'), 'CNPJ inválido');
    assert.match(erroDocumento('1234'), /11 dígitos/);
  });
  test('máscaras', () => {
    assert.equal(mascaraDocumento('52998224725'), '529.982.247-25');
    assert.equal(mascaraDocumento('11222333000181'), '11.222.333/0001-81');
    assert.equal(mascaraTelefone('11987654321'), '(11) 98765-4321');
    assert.equal(mascaraTelefone('1140001234'), '(11) 4000-1234');
    assert.equal(mascaraTelefone('11'), '(11');
    assert.equal(mascaraCEP('01001000'), '01001-000');
  });
});

describe('placas', () => {
  test('antiga e Mercosul', () => {
    assert.equal(validarPlaca('ABC-1234'), true);
    assert.equal(validarPlaca('abc1d23'), true);
    assert.equal(validarPlaca('AB12345'), false);
    assert.equal(validarPlaca('ABCD123'), false);
    assert.equal(mascaraPlaca('abc1234'), 'ABC-1234');
    assert.equal(mascaraPlaca('abc1d23'), 'ABC1D23');
  });
});

describe('textos', () => {
  test('nomes com maiúsculas certas', () => {
    assert.equal(capitalizar('JOÃO DA SILVA'), 'João da Silva');
    assert.equal(capitalizar('  maria   dos  santos '), 'Maria dos Santos');
    assert.equal(capitalizar('padaria pão dourado me'), 'Padaria Pão Dourado ME');
  });
  test('busca sem acento e com várias palavras', () => {
    assert.equal(normalizar('Ação Çedilha'), 'acao cedilha');
    assert.equal(contemTermo(['João Silva', 'Gol'], 'joao gol'), true);
    assert.equal(contemTermo(['João Silva'], 'maria'), false);
  });
  test('modelo de mensagem', () => {
    assert.equal(preencherModelo('Olá, {cliente}! {x}', { cliente: 'Ana' }), 'Olá, Ana! ');
  });
  test('e-mail', () => {
    assert.equal(validarEmail('a@b.com'), true);
    assert.equal(validarEmail('a@b'), false);
  });
  test('link do WhatsApp com DDI do Brasil', () => {
    assert.equal(linkWhatsApp('(11) 98765-4321', 'Oi'), 'https://wa.me/5511987654321?text=Oi');
    assert.equal(linkWhatsApp('', 'Oi'), 'https://wa.me/?text=Oi');
  });
  test('CSV abre certo no Excel (ponto e vírgula e aspas)', () => {
    const csv = gerarCSV([['a', 'b;c'], ['d"e', 'f']]);
    assert.equal(csv, '\ufeffa;"b;c"\r\n"d""e";f');
  });
  test('CSV não deixa texto virar fórmula do Excel', () => {
    assert.equal(gerarCSV([['=HYPERLINK("x")', '-10,50', '+55']]), `\ufeff"'=HYPERLINK(""x"")";-10,50;'+55`);
  });
});

describe('datas', () => {
  test('somar dias e meses', () => {
    assert.equal(addDias('2026-01-31', 1), '2026-02-01');
    assert.equal(addMeses('2026-12', 1), '2027-01');
    assert.equal(addMeses('2026-01', -1), '2025-12');
    assert.equal(ultimoDiaMes('2028-02'), '2028-02-29');
    assert.equal(diasEntre('2026-10-01', '2026-10-23'), 22);
    assert.equal(fmtData('2026-10-23'), '23/10/2026');
    assert.equal(fmtData('05/09/2026'), '05/09/2026');
    assert.equal(nomeMes('2026-10'), 'outubro de 2026');
    assert.equal(nomeMes('2026-10', true), 'out/26');
  });
});

describe('cálculo da OS', () => {
  const os = {
    itens: [
      { tipo: 'servico', descricao: 'Troca de óleo', qtd: 1, valor: 80 },
      { tipo: 'peca', descricao: 'Óleo', qtd: 4, valor: 55, custo: 32 },
      { tipo: 'peca', descricao: 'Filtro', qtd: 1, valor: 35, custo: 18, desconto: 5 },
    ],
    desconto: 10,
    pagamentos: [{ valor: 100 }],
  };
  test('totais, desconto e saldo', () => {
    const c = calcularOS(os);
    assert.equal(c.servicos, 80);
    assert.equal(c.pecas, 250);
    assert.equal(c.subtotal, 330);
    assert.equal(c.desconto, 10);
    assert.equal(c.total, 320);
    assert.equal(c.pago, 100);
    assert.equal(c.saldo, 220);
    assert.equal(c.situacao, 'parcial');
    assert.equal(c.custoPecas, 146);
  });
  test('desconto em porcentagem e limite', () => {
    assert.equal(calcularOS({ ...os, desconto: 0, descontoPct: 10 }).total, 297);
    assert.equal(calcularOS({ ...os, desconto: 9999 }).total, 0);
  });
  test('situação do pagamento', () => {
    assert.equal(calcularOS({ itens: [{ qtd: 1, valor: 50 }], pagamentos: [{ valor: 50 }] }).situacao, 'pago');
    assert.equal(calcularOS({ itens: [{ qtd: 1, valor: 50 }] }).situacao, 'pendente');
    assert.equal(calcularOS({ itens: [] }).situacao, 'sem_valor');
  });
  test('total do item não fica negativo', () => {
    assert.equal(totalItem({ qtd: 1, valor: 10, desconto: 50 }), 0);
    assert.equal(totalItem({ qtd: 0.5, valor: 33.33 }), 16.67);
  });
  test('número da próxima OS', () => {
    assert.equal(proximoNumero([{ numero: 3 }, { numero: 10 }, {}]), 11);
    assert.equal(proximoNumero([]), 1);
  });
});

describe('baixa de estoque', () => {
  const itens = [
    { tipo: 'peca', refId: 'p1', qtd: 2 },
    { tipo: 'peca', refId: 'p1', qtd: 1 },
    { tipo: 'peca', refId: 'p2', qtd: 1 },
    { tipo: 'peca', qtd: 5 }, // avulsa: não mexe no estoque
    { tipo: 'servico', refId: 's1', qtd: 1 },
  ];
  test('só tira do estoque quando a OS fica pronta ou é entregue', () => {
    assert.deepEqual(alvoEstoque({ status: 'execucao', itens }), {});
    assert.deepEqual(alvoEstoque({ status: 'pronta', itens }), { p1: 3, p2: 1 });
    assert.deepEqual(alvoEstoque({ status: 'entregue', itens }), { p1: 3, p2: 1 });
    assert.deepEqual(alvoEstoque({ status: 'cancelada', itens }), {});
  });
  test('diferença: tira só o que falta e devolve o que sobrou', () => {
    assert.deepEqual(diffEstoque({}, { p1: 3 }), { p1: 3 });
    assert.deepEqual(diffEstoque({ p1: 3 }, { p1: 3 }), {});
    assert.deepEqual(diffEstoque({ p1: 3, p2: 1 }, { p1: 1 }), { p1: -2, p2: -1 });
    assert.deepEqual(diffEstoque({ p1: 3 }, {}), { p1: -3 });
  });
});

test('limparObjeto tira campos undefined (o Firestore não aceita)', () => {
  assert.deepEqual(limparObjeto({ a: 1, b: undefined, c: { d: undefined, e: [1, { f: undefined }] } }), { a: 1, c: { e: [1, {}] } });
});
