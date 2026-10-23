// Funções de apoio para os testes no navegador.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

const PASTA_FIREBASE = new URL('./node_modules/firebase/', import.meta.url);

// Junta erros de JavaScript da página (o teste falha se houver algum).
export function vigiarErros(page) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(`Erro de JavaScript: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|net::ERR|ERR_FAILED/.test(t)) return;
    erros.push(`Console: ${t}`);
  });
  return erros;
}

// Sem internet nos testes: fontes e busca de CEP ficam bloqueadas (o sistema tem que funcionar assim mesmo).
export async function bloquearExternos(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/viacep\.com\.br/, (r) => r.abort());
}

// O Firebase vem do CDN (gstatic); nos testes servimos a mesma versão a partir do node_modules.
export async function rotearFirebase(page) {
  await page.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/, (route) => {
    const nome = new URL(route.request().url()).pathname.split('/').pop();
    route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body: readFileSync(new URL(nome, PASTA_FIREBASE)),
    });
  });
}

export async function abrirDemo(page, hash = '') {
  await bloquearExternos(page);
  await page.goto(`/?demo${hash}`);
  await expect(page.locator('.lateral')).toBeVisible();
  await expect(page.locator('#conteudo > *').first()).toBeVisible();
  await expect(page.locator('#conteudo .esqueleto-lista')).toHaveCount(0);
}

export async function irPara(page, hash) {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await expect(page.locator('#conteudo .esqueleto-lista')).toHaveCount(0);
}

// Lê dados direto da camada de dados do sistema (mesmo módulo que a página usa).
export async function lerStore(page, fnTexto) {
  return page.evaluate(async (corpo) => {
    const { store } = await import('/js/store.js');
    return new Function('store', `return (${corpo})(store)`)(store);
  }, fnTexto);
}

// Clica numa opção de um menu suspenso aberto.
export async function escolherNoMenu(page, texto) {
  await page.locator('.menu-suspenso button', { hasText: texto }).first().click();
}

export function janela(page) {
  return page.locator('.modal-fundo:not(.saindo) .modal').last();
}
