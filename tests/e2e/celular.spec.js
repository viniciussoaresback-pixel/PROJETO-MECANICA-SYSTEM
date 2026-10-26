// Uso no celular: nenhuma tela pode "vazar" para os lados, o menu abre e a OS funciona com o dedo.
import { expect, test } from '@playwright/test';
import { abrirDemo, irPara, janela, vigiarErros } from '../ajuda.js';

const TELAS = ['#/painel', '#/os?visao=lista', '#/os?visao=quadro', '#/os/nova', '#/agenda', '#/clientes', '#/veiculos', '#/estoque', '#/servicos', '#/equipe', '#/financeiro', '#/relatorios', '#/config'];

test('nenhuma tela tem rolagem para os lados', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page);
  for (const hash of TELAS) {
    await irPara(page, hash);
    const largura = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: window.innerWidth }));
    expect(largura.doc, `tela ${hash} mais larga que o celular`).toBeLessThanOrEqual(largura.tela + 1);
  }
  expect(erros).toEqual([]);
});

test('menu lateral abre pelo botão e fecha ao escolher uma tela', async ({ page }) => {
  await abrirDemo(page);
  const lateral = page.locator('.lateral');
  await expect(lateral).not.toBeInViewport();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(lateral).toBeInViewport();
  await page.locator('.nav-item', { hasText: 'Clientes' }).click();
  await expect(page.locator('#titulo-pagina')).toHaveText('Clientes');
  await expect(lateral).not.toBeInViewport();
});

test('cria uma OS pelo celular', async ({ page }) => {
  await abrirDemo(page, '#/os/nova');
  await page.locator('[data-cli-busca]').tap();
  await page.locator('[data-cli-busca]').fill('Fernanda');
  await page.locator('.seletor-item', { hasText: 'Fernanda Lima Rocha' }).first().tap();
  await page.locator('[data-add-item]').fill('Alinhamento');
  await page.locator('.seletor-item', { hasText: 'Alinhamento' }).first().tap();
  await expect(page.locator('[data-total-os]')).toHaveText('R$ 80,00');
  await page.getByRole('button', { name: 'Salvar OS' }).tap();
  await expect(page.locator('[data-titulo]')).toContainText(/OS \d{4}/);
  // Janela abre como "gaveta" de baixo para cima
  await page.getByRole('button', { name: 'Registrar pagamento' }).tap();
  const caixa = await janela(page).boundingBox();
  const vp = page.viewportSize();
  expect(Math.round(caixa.y + caixa.height)).toBeGreaterThanOrEqual(vp.height - 2);
  await janela(page).getByRole('button', { name: 'Registrar' }).tap();
  await expect(page.locator('[data-selo-pag]')).toContainText('Pago');
});

test('lista de clientes vira cartões no celular', async ({ page }) => {
  await abrirDemo(page, '#/clientes');
  await expect(page.locator('.tabela.responsiva thead')).toBeHidden();
  const linha = page.locator('[data-cliente]').first();
  await expect(linha.locator('td[data-rotulo="Telefone"]')).toBeVisible();
});
