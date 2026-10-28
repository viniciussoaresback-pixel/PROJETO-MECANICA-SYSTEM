// Financeiro, agenda, relatórios, configurações e backup.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { abrirDemo, irPara, janela, lerStore, vigiarErros } from '../ajuda.js';

test('financeiro: lança despesa repetida, paga e o saldo muda', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page, '#/financeiro');
  const saidasAntes = await page.locator('.kpi').filter({ has: page.locator('.kpi-rotulo', { hasText: 'Saídas' }) }).locator('.kpi-valor').innerText();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const m = janela(page);
  await m.getByLabel('Descrição').fill('Seguro da oficina');
  await m.getByLabel('Categoria').selectOption('Outros');
  await m.getByLabel('Valor').fill('300');
  await m.getByLabel('Repetir nos próximos meses').selectOption('2');
  await m.getByRole('button', { name: 'Lançar despesa' }).click();
  expect(await lerStore(page, "(s) => s.todos('despesas').filter((d) => d.descricao === 'Seguro da oficina').length")).toBe(3);
  await expect(page.locator('[data-aba=pagar]')).toHaveClass(/ativa/);
  const linha = page.locator('tbody tr', { hasText: 'Seguro da oficina' }).first();
  await linha.getByRole('button', { name: 'Pagar' }).click();
  await janela(page).getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(linha).toContainText('Paga');
  const saidasDepois = await page.locator('.kpi').filter({ has: page.locator('.kpi-rotulo', { hasText: 'Saídas' }) }).locator('.kpi-valor').innerText();
  expect(saidasDepois).not.toBe(saidasAntes);
  // Navegar entre meses
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page.locator('tbody tr', { hasText: 'Seguro da oficina' })).toHaveCount(1);
  expect(erros).toEqual([]);
});

test('financeiro: recebe uma OS em aberto pela aba "A receber"', async ({ page }) => {
  await abrirDemo(page, '#/financeiro?aba=receber');
  const antes = await page.locator('[data-receber]').count();
  expect(antes).toBeGreaterThan(0);
  await page.locator('[data-receber]').first().click();
  await janela(page).getByRole('button', { name: 'Registrar' }).click();
  await expect(page.locator('[data-receber]')).toHaveCount(antes - 1);
});

test('agenda: agenda cliente sem cadastro e abre a OS a partir do horário', async ({ page }) => {
  await abrirDemo(page, '#/agenda');
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  let m = janela(page);
  await m.getByLabel('Horário').fill('17:30');
  await m.locator('[data-campo-cliente]').fill('Visitante Novo');
  await m.getByLabel('Telefone').fill('11955554444');
  await m.getByLabel('Veículo (se não cadastrado)').fill('Celta prata');
  await m.getByLabel('Serviço / motivo').fill('Barulho no motor');
  await m.getByRole('button', { name: 'Agendar' }).click();
  const card = page.locator('.ag-card', { hasText: 'Visitante Novo' });
  await expect(card).toContainText('17:30');
  await card.click();
  m = janela(page);
  await m.getByRole('button', { name: 'Abrir OS' }).click();
  await expect(page).toHaveURL(/#\/os\/nova\?agenda=/);
  await expect(page.locator('#os-rel')).toHaveValue(/Barulho no motor/);
  await expect(page.locator('[data-cli-busca]')).toHaveValue('Visitante Novo');
});

test('relatórios: períodos, impressão e planilha', async ({ page }) => {
  await abrirDemo(page, '#/relatorios');
  await expect(page.locator('.kpi-rotulo', { hasText: 'Faturado (OS entregues)' })).toBeVisible();
  await page.getByRole('button', { name: 'Últimos 6 meses' }).click();
  await expect(page.locator('.graf-colunas')).toBeVisible();
  await expect(page.locator('.graf-col')).toHaveCount(6);
  await page.getByRole('button', { name: 'Escolher datas' }).click();
  await expect(page.locator('[data-ini]')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar OS' }).click();
  const arq = await download;
  expect(arq.suggestedFilename()).toMatch(/^ordens-de-servico-.*\.csv$/);
  await page.getByRole('button', { name: 'Imprimir' }).click();
  await expect(page.locator('.folha')).toContainText('Relatório gerencial');
  await expect(page.locator('.folha')).toContainText('Desempenho e comissão por mecânico');
});

test('configurações: salva dados da oficina e mensagens', async ({ page }) => {
  await abrirDemo(page, '#/config');
  await page.getByLabel('Nome da oficina').fill('Oficina do Teste');
  await page.getByLabel('CNPJ (ou CPF)').fill('11.111.111/1111-11');
  await page.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(page.locator('.campo-erro', { hasText: 'CNPJ inválido' })).toBeVisible();
  await page.getByLabel('CNPJ (ou CPF)').fill('');
  await page.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(page.locator('[data-nome-oficina]')).toHaveText('Oficina do Teste');
  await page.locator('[data-secao=mensagens]').click();
  await page.locator('[name=pronto]').fill('Pronto, {cliente}!');
  await page.locator('[data-var=placa][data-alvo=msg-pronto]').click();
  await page.getByRole('button', { name: 'Salvar mensagens' }).click();
  expect(await lerStore(page, '(s) => s.estado.config.mensagens.pronto')).toBe('Pronto, {cliente}!{placa}');
  await page.locator('[data-secao=aparencia]').click();
  await page.locator('[data-tema-op=escuro]').click();
  expect(await page.evaluate(() => document.documentElement.dataset.tema)).toBe('escuro');
});

test('backup: baixa o arquivo e restaura os dados', async ({ page }) => {
  await abrirDemo(page, '#/config?aba=backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar backup' }).click();
  const arq = await download;
  const caminho = await arq.path();
  const pacote = JSON.parse(readFileSync(caminho, 'utf8'));
  expect(pacote.sistema).toBe('Mecânica Pro');
  expect(pacote.dados.clientes.length).toBeGreaterThan(5);
  const total = pacote.dados.clientes.length;

  // Apaga um cliente e restaura o backup
  await lerStore(page, "(s) => s.remover('clientes', s.todos('clientes')[0].id)");
  expect(await lerStore(page, "(s) => s.todos('clientes').length")).toBe(total - 1);
  await page.locator('[data-importar]').setInputFiles(caminho);
  await janela(page).getByRole('button', { name: 'Substituir dados' }).click();
  await expect(page.getByText(/Backup restaurado/)).toBeVisible();
  expect(await lerStore(page, "(s) => s.todos('clientes').length")).toBe(total);

  // Arquivo errado é recusado
  await page.locator('[data-importar]').setInputFiles({ name: 'errado.json', mimeType: 'application/json', buffer: Buffer.from('{"oi":1}') });
  await expect(page.getByText(/não é um backup do Mecânica Pro/)).toBeVisible();
});

test('painel: lembrete de revisão pelo WhatsApp marca como avisado', async ({ page }) => {
  await abrirDemo(page);
  await page.evaluate(() => {
    window.open = () => ({});
  });
  const botao = page.locator('[data-lembrar]').first();
  await expect(botao).toBeVisible();
  const id = await botao.getAttribute('data-lembrar');
  await botao.click();
  await expect(janela(page).locator('#wa-txt')).toHaveValue(/revisão/);
  await janela(page).getByRole('button', { name: 'Abrir no WhatsApp' }).click();
  await expect.poll(() => lerStore(page, `(s) => !!s.porId('ordens', '${id}').lembreteAvisadoEm`)).toBe(true);
  await irPara(page, '#/painel');
  await expect(page.locator(`[data-lembrar="${id}"]`)).toContainText('Avisar de novo');
});

test('aparência: tema pronto, cor própria e opções valem para a oficina e continuam depois de reabrir', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page, '#/config?aba=aparencia');
  const acento = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acento').trim());
  const antes = await acento();
  await page.locator('[data-pronto=racing]').click();
  await expect(page.locator('[data-pronto=racing]')).toHaveClass(/ativo/);
  expect(await acento()).not.toBe(antes);
  expect(await page.evaluate(() => document.documentElement.dataset.cantos)).toBe('reto');
  await page.locator('label', { hasText: 'Na cor da oficina' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.lateral)).toBe('marca');
  await page.locator('[data-cor-livre]').evaluate((el) => {
    el.value = '#10b981';
    el.dispatchEvent(new Event('change'));
  });
  await page.locator('label', { hasText: 'Compacto' }).click();
  const ap = await lerStore(page, '(s) => s.estado.config.aparencia');
  expect(ap).toMatchObject({ cor: '#10b981', lateral: 'marca', cantos: 'reto', densidade: 'compacta' });
  await page.reload();
  await expect(page.locator('.lateral')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.lateral)).toBe('marca');
  expect(await page.evaluate(() => document.documentElement.dataset.densidade)).toBe('compacta');
  // Volta ao original
  await page.evaluate(() => {
    location.hash = '#/config?aba=aparencia';
  });
  await page.getByRole('button', { name: /Voltar ao tema original/ }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.lateral)).toBe('escura');
  expect(erros).toEqual([]);
});
