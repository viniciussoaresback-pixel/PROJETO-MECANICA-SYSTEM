// Clientes, veículos, estoque, serviços e equipe.
import { expect, test } from '@playwright/test';
import { abrirDemo, escolherNoMenu, irPara, janela, lerStore, vigiarErros } from '../ajuda.js';

test('cliente: valida CPF, avisa duplicado, edita, exclui e desfaz', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page, '#/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  let m = janela(page);
  await m.getByLabel('Nome completo').fill('ana paula de souza');
  await m.getByLabel('CPF').fill('111.111.111-11');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(m.locator('.campo-erro', { hasText: 'CPF inválido' })).toBeVisible();
  await m.getByLabel('CPF').fill('52998224725');
  await expect(m.getByLabel('CPF')).toHaveValue('529.982.247-25');
  await m.getByLabel('Celular / WhatsApp').fill('1199887');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(m.locator('.campo-erro', { hasText: 'Telefone incompleto' })).toBeVisible();
  await m.getByLabel('Celular / WhatsApp').fill('11998877665');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(page.locator('.detalhe-cab h2')).toContainText('Ana Paula de Souza');

  // Mesmo telefone: avisa
  await irPara(page, '#/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  m = janela(page);
  await m.getByLabel('Nome completo').fill('Outra Pessoa');
  await m.getByLabel('Celular / WhatsApp').fill('11998877665');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(janela(page).locator('h2')).toHaveText('Cliente parecido já cadastrado');
  await janela(page).getByRole('button', { name: 'Cancelar' }).click();
  // Fechar com dados digitados pede confirmação
  await m.getByRole('button', { name: 'Cancelar' }).click();
  await expect(janela(page).locator('h2')).toHaveText('Descartar alterações?');
  await janela(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('.modal-fundo:not(.saindo)')).toHaveCount(0);

  // Busca, editar e excluir com desfazer
  await page.locator('[data-busca]').fill('ana paula');
  await expect(page.locator('[data-cliente]')).toHaveCount(1);
  await page.locator('[data-menu]').first().click();
  await escolherNoMenu(page, 'Editar');
  m = janela(page);
  await m.getByLabel('E-mail').fill('ana@exemplo.com');
  await m.getByRole('button', { name: 'Salvar alterações' }).click();
  expect(await lerStore(page, "(s) => s.todos('clientes').find((c) => c.nome === 'Ana Paula de Souza').email")).toBe('ana@exemplo.com');
  await page.locator('[data-menu]').first().click();
  await escolherNoMenu(page, 'Excluir');
  await janela(page).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.locator('[data-cliente]')).toHaveCount(0);
  await page.locator('.toast-acao', { hasText: 'Desfazer' }).click();
  await expect(page.locator('[data-cliente]')).toHaveCount(1);
  expect(erros).toEqual([]);
});

test('veículo: placa inválida, placa repetida e cadastro', async ({ page }) => {
  await abrirDemo(page, '#/veiculos');
  const existente = await lerStore(page, "(s) => s.todos('veiculos')[0].placa");
  await page.getByRole('button', { name: 'Novo veículo' }).click();
  const m = janela(page);
  await m.getByLabel('Placa').fill('AB12');
  await m.getByLabel('Modelo').fill('Corsa');
  await m.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(m.locator('.campo-erro', { hasText: 'Placa inválida' })).toBeVisible();
  await m.getByLabel('Placa').fill(existente);
  await m.locator('[data-campo-cliente]').fill('Fernanda');
  await page.locator('.seletor-item', { hasText: 'Fernanda Lima Rocha' }).click();
  await m.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(m.locator('.campo-erro', { hasText: 'Placa já cadastrada' })).toBeVisible();
  await m.getByLabel('Placa').fill('ABC1234');
  await expect(m.getByLabel('Placa')).toHaveValue('ABC-1234');
  await m.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(page.locator('.detalhe-cab h2')).toContainText('Corsa');
  await expect(page.locator('.detalhe-cab')).toContainText('Fernanda Lima Rocha');
});

test('estoque: nova peça com margem, entrada de nota com despesa e ajuste', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page, '#/estoque');
  await page.getByRole('button', { name: 'Nova peça' }).click();
  let m = janela(page);
  await m.getByLabel('Descrição').fill('Correia do alternador');
  await m.getByLabel('Código / referência').fill('CA-900');
  await m.getByLabel('Quantidade inicial').fill('3');
  await m.getByLabel('Estoque mínimo').fill('2');
  await m.getByLabel('Custo (compra)').fill('40');
  await m.getByRole('button', { name: '+50%' }).click();
  await expect(m.getByLabel('Preço de venda')).toHaveValue('60,00');
  await expect(m.locator('[data-margem]')).toContainText('33%');
  await m.getByRole('button', { name: 'Cadastrar peça' }).click();
  await page.locator('[data-busca]').fill('CA-900');
  const linha = page.locator('tbody tr', { hasText: 'Correia do alternador' });
  await expect(linha).toContainText('3 un');

  // Entrada de nota lançando despesa
  const despesasAntes = await lerStore(page, "(s) => s.todos('despesas').length");
  await linha.getByRole('button', { name: 'Entrada' }).click();
  m = janela(page);
  await m.getByLabel(/Quantidade/).fill('5');
  await m.getByLabel('Custo unitário').fill('42');
  await m.getByLabel(/Lançar o valor da compra/).check();
  await m.getByRole('button', { name: 'Dar entrada' }).click();
  await expect(linha).toContainText('8 un');
  expect(await lerStore(page, "(s) => s.todos('despesas').length")).toBe(despesasAntes + 1);
  expect(await lerStore(page, "(s) => s.todos('despesas').find((d) => d.descricao.includes('Correia do alternador')).valor")).toBe(210);

  // Ajuste de inventário
  await linha.locator('[data-menu]').click();
  await escolherNoMenu(page, 'Ajustar quantidade');
  m = janela(page);
  await m.getByLabel('Quantidade correta').fill('1');
  await m.getByRole('button', { name: 'Ajustar' }).click();
  await expect(linha).toContainText('1 un');
  // Abaixo do mínimo: entra no filtro de estoque baixo
  await page.locator('[data-busca]').fill('');
  await page.locator('[data-baixo]').click();
  await expect(page.locator('tbody tr', { hasText: 'Correia do alternador' })).toBeVisible();
  // Histórico de movimentações
  await page.locator('tbody tr', { hasText: 'Correia do alternador' }).locator('[data-menu]').click();
  await escolherNoMenu(page, 'Ver movimentações');
  await expect(janela(page)).toContainText('Estoque inicial');
  await expect(janela(page)).toContainText('Compra');
  await expect(janela(page)).toContainText('Ajuste');
  expect(erros).toEqual([]);
});

test('serviços: cadastro e reajuste de preços', async ({ page }) => {
  await abrirDemo(page, '#/servicos');
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const m = janela(page);
  await m.getByLabel('Nome do serviço').fill('Troca de lâmpada');
  await m.getByLabel('Preço (mão de obra)').fill('20');
  await m.getByRole('button', { name: 'Cadastrar serviço' }).click();
  await expect(page.locator('tbody tr', { hasText: 'Troca de lâmpada' })).toContainText('R$ 20,00');
  await page.getByRole('button', { name: 'Reajustar preços' }).click();
  await janela(page).getByLabel('Percentual (%)').fill('10');
  await janela(page).getByRole('button', { name: 'Aplicar reajuste' }).click();
  await janela(page).getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.locator('tbody tr', { hasText: 'Troca de lâmpada' })).toContainText('R$ 22,00');
});

test('equipe: cadastra e desativa funcionário', async ({ page }) => {
  await abrirDemo(page, '#/equipe');
  await page.getByRole('button', { name: 'Novo funcionário' }).click();
  const m = janela(page);
  await m.getByLabel('Nome').fill('joana mecânica');
  await m.getByLabel(/Comissão/).fill('12');
  await m.getByRole('button', { name: 'Cadastrar' }).click();
  const card = page.locator('.cartao', { hasText: 'Joana Mecânica' });
  await expect(card).toContainText('Comissão (12%)');
  await card.locator('[data-menu]').click();
  await escolherNoMenu(page, 'Desativar');
  await expect(card).toContainText('Inativo');
});
