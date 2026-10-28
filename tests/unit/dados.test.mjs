// Camada de dados (modo navegador), migração da versão antiga, demonstração e lista do modo offline.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// O store usa localStorage e window: simulamos o mínimo no Node.
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { store, criarAdaptadorLocal, incremento, aplicarPatch, COLECOES } = await import('../../app/js/store.js');
const { converterDadosAntigos, separarVeiculo } = await import('../../app/js/migracao.js');
const { gerarDemo } = await import('../../app/js/demo.js');

describe('camada de dados no navegador', () => {
  test('grava, altera com incremento, apaga e persiste', async () => {
    memoria.clear();
    await store.conectar(criarAdaptadorLocal('teste'), { modo: 'demo', usuario: { nome: 'Teste', papel: 'dono' }, oficinaId: 'x' });
    const avisos = [];
    const sair = store.inscrever((cols) => avisos.push([...cols]));
    const p = store.adicionar('pecas', { descricao: 'Filtro', qtd: 5 });
    assert.ok(p.id);
    assert.ok(p.criadoEm);
    store.atualizar('pecas', p.id, { qtd: incremento(-2) });
    assert.equal(store.porId('pecas', p.id).qtd, 3);
    store.lote([
      { op: 'alterar', col: 'pecas', id: p.id, dados: { qtd: incremento(10) } },
      { op: 'gravar', col: 'movimentos', dados: { id: 'm1', pecaId: p.id, qtd: 10 } },
    ]);
    assert.equal(store.porId('pecas', p.id).qtd, 13);
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(avisos.some((c) => c.includes('pecas')));
    sair();
    // O que foi para o "disco" (localStorage) bate com a memória
    const disco = JSON.parse(memoria.get('mp:teste:pecas'));
    assert.equal(disco[0].qtd, 13);
    assert.equal(JSON.parse(memoria.get('mp:teste:movimentos')).length, 1);
    store.remover('pecas', p.id);
    assert.equal(JSON.parse(memoria.get('mp:teste:pecas')).length, 0);
    store.desconectar();
  });

  test('aplicarPatch soma incrementos e ignora undefined', () => {
    assert.deepEqual(aplicarPatch({ a: 1, b: 2 }, { a: incremento(2.5), b: undefined, c: 'x' }), { a: 3.5, b: 2, c: 'x' });
  });

  test('backup exportado tem todas as coleções', async () => {
    memoria.clear();
    await store.conectar(criarAdaptadorLocal('teste'), { modo: 'demo', usuario: { nome: 'T', papel: 'dono' }, oficinaId: 'x' });
    const b = store.exportar();
    assert.equal(b.sistema, 'Mecânica Pro');
    for (const c of COLECOES) assert.ok(Array.isArray(b.dados[c]), c);
    store.desconectar();
  });
});

describe('migração da versão antiga', () => {
  test('separa placa e modelo', () => {
    assert.deepEqual(separarVeiculo('GOL 1.6 ABC-1234'), { placa: 'ABC1234', modelo: 'Gol 1.6' });
    assert.deepEqual(separarVeiculo('abc1d23 / onix'), { placa: 'ABC1D23', modelo: 'Onix' });
    assert.deepEqual(separarVeiculo('Palio'), { placa: '', modelo: 'Palio' });
  });

  test('converte clientes e serviços em clientes, veículos e OS', () => {
    const r = converterDadosAntigos(
      [{ nome: 'joão silva', documento: '529.982.247-25', telefone: '(11) 9', dataCadastro: '01/09/2026' }],
      [
        { cliente: 'João Silva', veiculo: 'GOL ABC1234', servico: 'troca de óleo', valor: 150, status: 'finalizado', data: '03/09/2026' },
        { cliente: 'João Silva', veiculo: 'gol abc-1234', servico: 'alinhamento', valor: 80, status: 'pendente', data: '02/09/2026' },
        { cliente: 'Maria Nova', veiculo: 'Palio', servico: 'freio', valor: 200, status: 'cancelado', data: '04/09/2026' },
      ],
    );
    assert.equal(r.clientes.length, 2); // João (já cadastrado) + Maria (criada a partir da OS)
    assert.equal(r.veiculos.length, 2); // o Gol aparece duas vezes, mas é o mesmo carro
    assert.equal(r.ordens.length, 3);
    assert.deepEqual(r.ordens.map((o) => o.numero), [1, 2, 3]); // em ordem de data
    const [alinhamento, oleo, freio] = r.ordens;
    assert.equal(alinhamento.status, 'aprovada');
    assert.equal(oleo.status, 'entregue');
    assert.equal(oleo.pagamentos[0].valor, 150);
    assert.equal(freio.status, 'cancelada');
    assert.equal(oleo.veiculoId, alinhamento.veiculoId);
    assert.equal(oleo.itens[0].descricao, 'Troca de Óleo');
    assert.equal(r.clientes[0].tipo, 'PF');
  });
});

describe('demonstração', () => {
  test('gera dados consistentes', () => {
    const d = gerarDemo();
    assert.ok(d.config.nome);
    assert.ok(d.dados.ordens.length > 50);
    const clientes = new Set(d.dados.clientes.map((c) => c.id));
    const veiculos = new Set(d.dados.veiculos.map((v) => v.id));
    for (const o of d.dados.ordens) {
      assert.ok(clientes.has(o.clienteId), 'OS com cliente que não existe');
      assert.ok(veiculos.has(o.veiculoId), 'OS com veículo que não existe');
    }
    const numeros = d.dados.ordens.map((o) => o.numero);
    assert.equal(new Set(numeros).size, numeros.length, 'números de OS repetidos');
  });
});

describe('modo offline (service worker)', () => {
  test('todos os arquivos do app estão na lista do sw.js', () => {
    const raiz = fileURLToPath(new URL('../../app/', import.meta.url));
    const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
    const listar = (dir) => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? listar(p) : [p];
    });
    const faltando = ['js', 'css', 'img']
      .flatMap((d) => listar(join(raiz, d)))
      .map((p) => `./${relative(raiz, p).split('\\').join('/')}`)
      .filter((p) => !sw.includes(`'${p}'`));
    assert.deepEqual(faltando, [], `Inclua no ARQUIVOS do sw.js: ${faltando.join(', ')}`);
  });

  test('a versão do app e a do service worker andam juntas', () => {
    const raiz = fileURLToPath(new URL('../../app/', import.meta.url));
    const versaoApp = readFileSync(join(raiz, 'js/app.js'), 'utf8').match(/VERSAO_APP = '([^']+)'/)[1];
    const versaoSW = readFileSync(join(raiz, 'sw.js'), 'utf8').match(/VERSAO = 'mecanica-pro-v([^'-]+)/)[1];
    assert.equal(versaoSW, versaoApp);
  });
});
