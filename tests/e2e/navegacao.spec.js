// Abre o sistema na demonstração e passa por todas as telas: nenhuma pode dar erro de JavaScript.
import { expect, test } from '@playwright/test';
import { abrirDemo, bloquearExternos, irPara, rotearFirebase, vigiarErros } from '../ajuda.js';

const TELAS = [
  ['#/painel', 'Painel'],
  ['#/os', 'Ordens de serviço'],
  ['#/os/nova', 'Ordens de serviço'],
  ['#/agenda', 'Agenda'],
  ['#/clientes', 'Clientes'],
  ['#/veiculos', 'Veículos'],
  ['#/estoque', 'Estoque'],
  ['#/servicos', 'Serviços'],
  ['#/equipe', 'Equipe'],
  ['#/financeiro', 'Financeiro'],
  ['#/relatorios', 'Relatórios'],
  ['#/config', 'Configurações'],
];

test('tela de entrada: abas, validação e botão de demonstração', async ({ page }) => {
  const erros = vigiarErros(page);
  await bloquearExternos(page);
  await rotearFirebase(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /sistema completo da sua oficina/i })).toBeVisible();
  await page.locator('[data-form=entrar]').getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('[data-form=entrar] .form-erro')).toHaveText('Informe um e-mail válido.');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await expect(page.getByLabel('Nome da oficina')).toBeVisible();
  await page.locator('[data-form=criar]').getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.locator('[data-form=criar] .form-erro')).toHaveText('Informe seu nome.');
  await page.getByRole('button', { name: /Conhecer o sistema/ }).click();
  await expect(page.locator('.faixa-demo')).toBeVisible();
  expect(erros).toEqual([]);
});

test('sem internet para o Firebase: mostra aviso e ainda permite a demonstração', async ({ page }) => {
  await bloquearExternos(page);
  await page.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
  await page.goto('/');
  await expect(page.getByText(/Não foi possível conectar ao servidor/)).toBeVisible();
  await page.getByRole('button', { name: /Conhecer o sistema/ }).click();
  await expect(page.locator('.lateral')).toBeVisible();
});

test('todas as telas abrem sem erro', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page);
  for (const [hash, titulo] of TELAS) {
    await irPara(page, hash);
    await expect(page.locator('#titulo-pagina')).toHaveText(titulo);
    await expect(page.locator('#conteudo')).not.toContainText('Algo deu errado');
  }
  // Detalhes de cliente e veículo (primeiro da lista)
  await irPara(page, '#/clientes');
  await page.locator('[data-cliente]').first().click();
  await expect(page.locator('.detalhe-cab h2')).toBeVisible();
  await irPara(page, '#/veiculos');
  await page.locator('[data-veiculo]').first().click();
  await expect(page.locator('.linha-tempo, .vazio-mini').first()).toBeVisible();
  // Todas as abas das configurações e do financeiro
  await irPara(page, '#/config');
  for (const b of await page.locator('[data-secao]').all()) {
    await b.click();
    await expect(page.locator('[data-painel] .cartao').first()).toBeVisible();
  }
  await irPara(page, '#/financeiro');
  for (const b of await page.locator('[data-aba]').all()) {
    await b.click();
    await expect(b).toHaveClass(/ativa/);
  }
  expect(erros).toEqual([]);
});

test('menu lateral marca a tela atual e mostra contadores', async ({ page }) => {
  await abrirDemo(page);
  await page.locator('.nav-item', { hasText: 'Estoque' }).click();
  await expect(page.locator('.nav-item.ativo')).toHaveText(/Estoque/);
  await expect(page.locator('[data-contador=os]')).toBeVisible();
  await expect(page).toHaveTitle(/Estoque · Auto Center Exemplo/);
});

test('busca global (Ctrl+K) encontra cliente, OS e veículo', async ({ page }) => {
  await abrirDemo(page);
  await page.keyboard.press('Control+k');
  const busca = page.locator('.modal-busca input');
  await expect(busca).toBeFocused();
  await busca.fill('Fernanda');
  await expect(page.locator('.busca-item', { hasText: 'Fernanda Lima Rocha' }).first()).toBeVisible();
  await busca.fill('1');
  await expect(page.locator('.busca-grupo', { hasText: 'Ordens de serviço' })).toBeVisible();
  await busca.fill('Fernanda Lima');
  await page.locator('.busca-item', { hasText: /^Fernanda Lima Rocha/ }).last().click();
  await expect(page.locator('.detalhe-cab h2')).toContainText('Fernanda Lima Rocha');
  // Tecla "/" também abre
  await expect(page.locator('.modal-fundo')).toHaveCount(0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('/');
  await expect(page.locator('.modal-busca')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-busca')).toHaveCount(0);
});

test('tema escuro: alterna e continua depois de recarregar', async ({ page }) => {
  await abrirDemo(page);
  const tema = () => page.evaluate(() => document.documentElement.dataset.tema);
  const antes = await tema();
  await page.getByRole('button', { name: 'Mudar tema claro/escuro' }).click();
  const depois = await tema();
  expect(depois).not.toBe(antes);
  await page.reload();
  await expect(page.locator('.lateral')).toBeVisible();
  expect(await tema()).toBe(depois);
});

test('sair da demonstração volta para a tela de entrada', async ({ page }) => {
  await abrirDemo(page);
  await rotearFirebase(page);
  await page.getByRole('button', { name: 'Sair da demonstração' }).click();
  await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible();
});
