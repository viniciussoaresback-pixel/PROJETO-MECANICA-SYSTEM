// Modo nuvem de verdade (Firebase), usando os emuladores locais do Firebase.
// Roda com: npm run e2e:nuvem  (sobe os emuladores, roda os testes e desliga)
import { expect, test } from '@playwright/test';
import { bloquearExternos, janela, lerStore, rotearFirebase, vigiarErros } from '../ajuda.js';

const PROJETO = 'mecanicapro-11853';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJETO}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';

test.describe.configure({ mode: 'serial' });

async function limparEmuladores() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: 'DELETE' });
}

// Lê um documento ignorando as regras (acesso de administrador do emulador).
async function lerDocAdmin(caminho) {
  const r = await fetch(`${FS}/${caminho.split('/').map(encodeURIComponent).join('/')}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? r.json() : null;
}
async function listarAdmin(caminho) {
  const r = await fetch(`${FS}/${caminho}`, { headers: { Authorization: 'Bearer owner' } });
  const j = await r.json();
  return j.documents || [];
}
async function gravarDocAdmin(colecao, id, campos) {
  const fields = {};
  for (const [k, v] of Object.entries(campos)) fields[k] = typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) };
  const r = await fetch(`${FS}/${colecao}?documentId=${id}`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(await r.text());
}
async function criarUsuarioAuth(email, senha) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=teste`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: senha, returnSecureToken: true }) });
  return (await r.json()).localId;
}

async function prepararPagina(page) {
  await bloquearExternos(page);
  await rotearFirebase(page);
  await page.addInitScript(() => {
    localStorage.setItem('mp:emulador', '1');
  });
}

async function criarConta(page, { oficina, nome, email, senha = 'segredo123' }) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  if (oficina) await page.getByLabel('Nome da oficina').fill(oficina);
  await page.getByLabel('Seu nome').fill(nome);
  await page.locator('[data-form=criar]').getByLabel('E-mail').fill(email);
  await page.locator('[data-form=criar] input[name=senha]').fill(senha);
  await page.locator('[data-form=criar]').getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.locator('.lateral')).toBeVisible({ timeout: 20_000 });
}

async function entrar(page, email, senha = 'segredo123') {
  await page.goto('/');
  await page.locator('#ent-email').fill(email);
  await page.locator('#ent-senha').fill(senha);
  await page.locator('[data-form=entrar]').getByRole('button', { name: 'Entrar' }).click();
}

let uidDono = '';

test.beforeAll(async () => {
  await limparEmuladores();
});

test('cria a conta da oficina e os dados ficam salvos na nuvem', async ({ page }) => {
  const erros = vigiarErros(page);
  await prepararPagina(page);
  await criarConta(page, { oficina: 'Oficina Nuvem Teste', nome: 'Dono Teste', email: 'dono@teste.com' });
  await expect(page.locator('[data-nome-oficina]')).toHaveText('Oficina Nuvem Teste');
  uidDono = await lerStore(page, '(s) => s.estado.oficinaId');
  expect(uidDono).toBeTruthy();

  // Cadastra um cliente
  await page.evaluate(() => {
    location.hash = '#/clientes?novo=1';
  });
  const m = janela(page);
  await m.getByLabel('Nome completo').fill('maria da nuvem');
  await m.getByLabel('Celular / WhatsApp').fill('11987654321');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(page.locator('.detalhe-cab h2')).toContainText('Maria da Nuvem');
  await lerStore(page, '(s) => s.aguardarGravacoes()');

  // O documento existe no Firestore, dentro da oficina
  const clientes = await listarAdmin(`oficinas/${uidDono}/clientes`);
  expect(clientes.map((d) => d.fields.nome.stringValue)).toContain('Maria da Nuvem');
  const membro = await lerDocAdmin(`oficinas/${uidDono}/membros/${uidDono}`);
  expect(membro.fields.papel.stringValue).toBe('dono');

  // Recarregou: continua logado e com os dados
  await page.reload();
  await expect(page.locator('.lateral')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    location.hash = '#/clientes';
  });
  await expect(page.getByText('Maria da Nuvem')).toBeVisible();
  expect(erros).toEqual([]);
});

test('convida um mecânico: ele entra na oficina e não vê o financeiro', async ({ browser }) => {
  const ctxDono = await browser.newContext();
  const dono = await ctxDono.newPage();
  await prepararPagina(dono);
  await entrar(dono, 'dono@teste.com');
  await expect(dono.locator('.lateral')).toBeVisible({ timeout: 20_000 });
  // Uma despesa (o mecânico não pode ver)
  await lerStore(dono, "(s) => { s.adicionar('despesas', { descricao: 'Aluguel', valor: 1000, vencimento: '2026-10-10', pago: false, categoria: 'Aluguel' }); return s.aguardarGravacoes(); }");
  await dono.evaluate(() => {
    location.hash = '#/config?aba=usuarios';
  });
  await dono.getByRole('button', { name: 'Convidar pessoa' }).click();
  const m = janela(dono);
  await m.getByLabel('Nome').fill('Mecânico Teste');
  await m.getByLabel('E-mail').fill('Mec@Teste.com');
  await m.getByLabel('Perfil').selectOption('mecanico');
  await m.getByRole('button', { name: 'Convidar' }).click();
  await expect(dono.getByText('Convites aguardando')).toBeVisible();
  // A tela mostra o convite antes do servidor confirmar (Firestore é otimista): espera chegar lá.
  await expect.poll(async () => (await lerDocAdmin('convites/mec@teste.com'))?.fields.oficinaId.stringValue).toBe(uidDono);

  // O mecânico cria a conta com o e-mail do convite
  const ctxMec = await browser.newContext();
  const mec = await ctxMec.newPage();
  const erros = vigiarErros(mec);
  await prepararPagina(mec);
  await criarConta(mec, { nome: 'Mecânico Teste', email: 'mec@teste.com' });
  await expect(mec.locator('[data-nome-oficina]')).toHaveText('Oficina Nuvem Teste');
  await expect(mec.locator('.nav-item', { hasText: 'Financeiro' })).toHaveCount(0);
  await expect(mec.locator('.nav-item', { hasText: 'Relatórios' })).toHaveCount(0);
  await mec.evaluate(() => {
    location.hash = '#/clientes';
  });
  await expect(mec.getByText('Maria da Nuvem')).toBeVisible();

  // As regras do banco bloqueiam despesas para o mecânico
  const resultado = await mec.evaluate(async (of) => {
    const n = await import('/js/nuvem.js');
    const { db, F } = await n.carregarFirebase();
    try {
      await F.getDocs(F.collection(db, 'oficinas', of, 'despesas'));
      return 'leu';
    } catch (e) {
      return e.code;
    }
  }, uidDono);
  expect(resultado).toBe('permission-denied');
  // …nem apagar clientes
  const apagar = await mec.evaluate(async (of) => {
    const n = await import('/js/nuvem.js');
    const { db, F } = await n.carregarFirebase();
    const snap = await F.getDocs(F.collection(db, 'oficinas', of, 'clientes'));
    try {
      await F.deleteDoc(snap.docs[0].ref);
      return 'apagou';
    } catch (e) {
      return e.code;
    }
  }, uidDono);
  expect(apagar).toBe('permission-denied');
  // …mas ele consegue criar uma OS
  await mec.evaluate(() => {
    location.hash = '#/os/nova';
  });
  await mec.locator('[data-cli-busca]').fill('Maria');
  await mec.locator('.seletor-item', { hasText: 'Maria da Nuvem' }).click();
  await mec.getByRole('button', { name: 'Salvar OS' }).click();
  await expect(mec.locator('[data-titulo]')).toContainText('OS 0001');
  await lerStore(mec, '(s) => s.aguardarGravacoes()');
  const ordens = await listarAdmin(`oficinas/${uidDono}/ordens`);
  expect(ordens).toHaveLength(1);
  expect(erros).toEqual([]);

  // O dono vê a OS criada pelo mecânico em tempo real
  await dono.evaluate(() => {
    location.hash = '#/os?visao=lista';
  });
  await expect(dono.getByText('OS 0001')).toBeVisible();

  // O dono remove o acesso do mecânico
  await dono.evaluate(() => {
    location.hash = '#/config?aba=usuarios';
  });
  await dono.getByRole('button', { name: 'Remover acesso' }).click();
  await janela(dono).getByRole('button', { name: 'Remover' }).click();
  await expect(dono.getByText('Acesso removido')).toBeVisible();
  // Ao abrir de novo, o mecânico é avisado
  await mec.reload();
  await expect(mec.getByText(/acesso a esta oficina foi removido/i)).toBeVisible({ timeout: 20_000 });
  await ctxDono.close();
  await ctxMec.close();
});

test('outra oficina não consegue ler os dados desta', async ({ page }) => {
  await prepararPagina(page);
  await criarConta(page, { oficina: 'Oficina Concorrente', nome: 'Outro Dono', email: 'outro@teste.com' });
  const resultado = await page.evaluate(async (of) => {
    const n = await import('/js/nuvem.js');
    const { db, F } = await n.carregarFirebase();
    const r = {};
    for (const col of ['clientes', 'ordens', 'config', 'membros']) {
      try {
        await F.getDocs(F.collection(db, 'oficinas', of, col));
        r[col] = 'leu';
      } catch (e) {
        r[col] = e.code;
      }
    }
    try {
      await F.setDoc(F.doc(db, 'oficinas', of, 'membros', 'intruso'), { papel: 'dono' });
      r.invadir = 'gravou';
    } catch (e) {
      r.invadir = e.code;
    }
    return r;
  }, uidDono);
  expect(resultado).toEqual({ clientes: 'permission-denied', ordens: 'permission-denied', config: 'permission-denied', membros: 'permission-denied', invadir: 'permission-denied' });
  await expect(page.getByText('Maria da Nuvem')).toHaveCount(0);
});

test('traz automaticamente os dados da versão antiga do sistema', async ({ page }) => {
  const uid = await criarUsuarioAuth('antigo@teste.com', 'segredo123');
  await gravarDocAdmin('clientes', 'c1', { userId: uid, nome: 'joão antigo', documento: '529.982.247-25', telefone: '(11) 91234-5678', dataCadastro: '01/09/2026' });
  await gravarDocAdmin('servicos', 's1', { userId: uid, cliente: 'joão antigo', veiculo: 'GOL 1.6 ABC1234', servico: 'troca de óleo', valor: 150, status: 'finalizado', data: '02/09/2026' });
  await gravarDocAdmin('servicos', 's2', { userId: uid, cliente: 'Ana Sem Cadastro', veiculo: 'Palio', servico: 'alinhamento', valor: 80, status: 'pendente', data: '05/09/2026' });
  // Dado de outra pessoa: não pode vir junto
  await gravarDocAdmin('servicos', 's3', { userId: 'outra-pessoa', cliente: 'Não Deve Aparecer', veiculo: 'X', servico: 'y', valor: 1, status: 'pendente', data: '05/09/2026' });

  const erros = vigiarErros(page);
  await prepararPagina(page);
  await entrar(page, 'antigo@teste.com');
  await expect(page.locator('.lateral')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Trouxemos da versão anterior: 2 clientes, 2 veículos e 2 ordens/)).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    location.hash = '#/os?visao=lista&status=todas';
  });
  await expect(page.getByRole('cell', { name: 'João Antigo' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Ana Sem Cadastro' })).toBeVisible();
  await expect(page.getByText('Não Deve Aparecer')).toHaveCount(0);
  const veiculo = await lerStore(page, "(s) => s.todos('veiculos').find((v) => v.placa === 'ABC1234')");
  expect(veiculo.modelo).toBe('Gol 1.6');
  // A migração só roda uma vez
  await lerStore(page, '(s) => s.aguardarGravacoes()');
  await page.reload();
  await expect(page.locator('.lateral')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  expect(await lerStore(page, "(s) => s.todos('ordens').length")).toBe(2);
  expect(erros).toEqual([]);
});

test('botão Sair desloga e volta para a tela de entrada', async ({ page }) => {
  await prepararPagina(page);
  await entrar(page, 'outro@teste.com');
  await expect(page.locator('.lateral')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-menu-usuario]').click();
  await page.locator('.menu-suspenso button', { hasText: 'Sair' }).click();
  await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible({ timeout: 20_000 });
  // Continua deslogado depois de recarregar
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible({ timeout: 20_000 });
});

test('mensagens de erro de login em português', async ({ page }) => {
  await prepararPagina(page);
  await entrar(page, 'dono@teste.com', 'senha-errada');
  await expect(page.locator('[data-form=entrar] .form-erro')).toHaveText(/incorret/i);
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByLabel('Seu nome').fill('Repetido');
  await page.locator('[data-form=criar]').getByLabel('E-mail').fill('dono@teste.com');
  await page.locator('[data-form=criar] input[name=senha]').fill('segredo123');
  await page.locator('[data-form=criar]').getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.locator('[data-form=criar] .form-erro')).toHaveText(/Já existe uma conta/);
});
