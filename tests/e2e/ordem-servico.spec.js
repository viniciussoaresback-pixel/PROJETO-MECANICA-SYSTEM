// Fluxo completo de uma OS: cliente novo, veículo, itens do catálogo, desconto, status,
// baixa automática no estoque, pagamento, impressão e cancelamento.
import { expect, test } from '@playwright/test';
import { abrirDemo, irPara, janela, lerStore, vigiarErros } from '../ajuda.js';

const qtdFiltro = (page) => lerStore(page, "(s) => s.todos('pecas').find((p) => p.codigo === 'FO-140').qtd");

test('da abertura à entrega, com estoque e pagamento', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirDemo(page, '#/os/nova');
  const estoqueInicial = await qtdFiltro(page);

  // Cliente novo direto do campo de busca
  await page.locator('[data-cli-busca]').fill('carlos teste e2e');
  await page.locator('.seletor-item', { hasText: 'Cadastrar cliente' }).click();
  let m = janela(page);
  await expect(m.getByLabel('Nome completo')).toHaveValue('Carlos Teste E2e');
  await m.getByLabel('Celular / WhatsApp').fill('11912345678');
  await m.getByRole('button', { name: 'Cadastrar cliente' }).click();
  // Sem veículo: o formulário de veículo abre em seguida
  m = janela(page);
  await expect(m.locator('h2')).toHaveText('Novo veículo');
  await m.getByLabel('Placa').fill('tst1e23');
  await expect(m.getByLabel('Placa')).toHaveValue('TST1E23');
  await m.getByLabel('Marca').fill('Volkswagen');
  await m.getByLabel('Modelo').fill('Gol 1.6');
  await m.getByRole('button', { name: 'Cadastrar veículo' }).click();
  await expect(page.locator('[data-veiculo]')).toHaveValue(/.+/);
  await expect(page.locator('[data-info-cliente]')).toContainText('(11) 91234-5678');

  await page.locator('#os-km').fill('50000');
  await page.locator('#os-rel').fill('Troca de óleo e revisão do filtro');

  // Itens do catálogo
  const add = page.locator('[data-add-item]');
  await add.fill('Troca de óleo e filtro');
  await page.locator('.seletor-item', { hasText: 'Troca de óleo e filtro' }).first().click();
  await add.fill('FO-140');
  await page.locator('.seletor-item', { hasText: 'Filtro de óleo' }).first().click();
  await expect(page.locator('[data-itens] tr')).toHaveCount(2);
  await expect(page.locator('[data-total-os]')).toHaveText('R$ 115,00');
  // Desconto
  await page.locator('[data-desconto]').fill('15');
  await expect(page.locator('[data-total-os]')).toHaveText('R$ 100,00');
  await expect(page.locator('[data-estado]')).toContainText('não salvas');

  // Salvar
  await page.getByRole('button', { name: 'Salvar OS' }).click();
  await expect(page).toHaveURL(/#\/os\/[a-z0-9]{10,}$/);
  await expect(page.locator('[data-titulo]')).toContainText(/OS \d{4}/);
  await expect(page.locator('[data-estado]')).toContainText('Salvo');
  const numero = (await page.locator('[data-titulo]').innerText()).match(/OS (\d{4})/)[1];
  expect(await qtdFiltro(page)).toBe(estoqueInicial); // orçamento ainda não tira do estoque

  // Pronta: peça sai do estoque e oferece avisar no WhatsApp
  await page.locator('[data-etapa=pronta]').click();
  await expect(janela(page).locator('h2')).toHaveText('Serviço concluído!');
  await janela(page).getByRole('button', { name: 'Agora não' }).click();
  await expect(page.locator('.etapa.atual')).toContainText('Pronta');
  expect(await qtdFiltro(page)).toBe(estoqueInicial - 1);
  const mov = await lerStore(page, "(s) => s.todos('movimentos').filter((m) => m.tipo === 'saida' && m.motivo.includes('OS')).length");
  expect(mov).toBeGreaterThan(0);

  // Pagamento
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  m = janela(page);
  await expect(m.getByLabel('Valor recebido')).toHaveValue('100,00');
  await m.getByLabel('Forma de pagamento').selectOption('PIX');
  await m.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.locator('[data-selo-pag]')).toContainText('Pago');

  // Entregue (já pago: não pergunta nada)
  await page.locator('[data-etapa=entregue]').click();
  await expect(page.locator('.etapa.atual')).toContainText('Entregue');
  expect(await qtdFiltro(page)).toBe(estoqueInicial - 1);

  // Impressão
  await page.evaluate(() => {
    window.__impressoes = 0;
    window.print = () => {
      window.__impressoes += 1;
    };
  });
  await page.locator('.os-cab [data-imprimir]').click();
  await page.locator('.menu-suspenso button', { hasText: 'Ordem de serviço' }).click();
  const folha = page.locator('.folha');
  await expect(folha).toContainText('Ordem de serviço');
  await expect(folha).toContainText(`Nº ${numero}`);
  await expect(folha).toContainText('Carlos Teste E2e');
  await expect(folha).toContainText('TST1E23');
  await expect(folha).toContainText('R$ 100,00');
  await expect(folha).toContainText('Termo de garantia');
  await janela(page).getByRole('button', { name: 'Imprimir / PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__impressoes)).toBe(1);
  await expect(page.locator('#area-impressao')).toContainText('Carlos Teste E2e');
  await page.keyboard.press('Escape');

  // Recibo com valor por extenso
  await page.locator('.os-cab [data-imprimir]').click();
  await page.locator('.menu-suspenso button', { hasText: 'Recibo' }).click();
  await expect(page.locator('.folha')).toContainText('cem reais');
  await page.keyboard.press('Escape');

  // Cancelar devolve a peça ao estoque
  await page.locator('[data-etapa=cancelada]').click();
  await janela(page).getByRole('button', { name: 'Cancelar OS' }).click();
  await expect(page.locator('.etapa.atual')).toContainText('Cancelar');
  expect(await qtdFiltro(page)).toBe(estoqueInicial);

  // Aparece na lista de OS
  await irPara(page, '#/os?visao=lista&status=todas');
  await expect(page.locator('[data-os]', { hasText: `OS ${numero}` })).toContainText('Carlos Teste E2e');
  expect(erros).toEqual([]);
});

test('OS sem cliente não salva e avisa', async ({ page }) => {
  await abrirDemo(page, '#/os/nova');
  await page.getByRole('button', { name: 'Salvar OS' }).click();
  await expect(page.locator('[data-campo-cli] .campo-erro')).toBeVisible();
  await expect(page).toHaveURL(/#\/os\/nova/);
});

test('busca pela placa preenche cliente e veículo; aviso ao sair sem salvar', async ({ page }) => {
  await abrirDemo(page);
  const v = await lerStore(page, "(s) => { const v = s.todos('veiculos')[0]; return { placa: v.placa, dono: s.porId('clientes', v.clienteId).nome }; }");
  await irPara(page, '#/os/nova');
  await page.locator('[data-cli-busca]').fill(v.placa.slice(0, 5));
  await page.locator('.seletor-item', { hasText: v.dono }).first().click();
  await expect(page.locator('[data-cli-busca]')).toHaveValue(v.dono);
  await expect(page.locator('[data-veiculo] option:checked')).toContainText(v.placa.slice(0, 3));
  // Item avulso
  await page.getByRole('button', { name: 'Serviço avulso' }).click();
  await page.locator('[data-itens] [data-campo=descricao]').fill('Regulagem do freio de mão');
  await page.locator('[data-itens] [data-campo=valor]').fill('45');
  await expect(page.locator('[data-total-os]')).toHaveText('R$ 45,00');
  // Tentou sair: pergunta
  await page.locator('.nav-item', { hasText: 'Clientes' }).click();
  await expect(janela(page).locator('h2')).toHaveText('Alterações não salvas');
  await janela(page).getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page).toHaveURL(/#\/os\/nova/);
  await expect(page.locator('[data-total-os]')).toHaveText('R$ 45,00');
  await page.keyboard.press('Control+s');
  await expect(page).toHaveURL(/#\/os\/[a-z0-9]{10,}$/);
  await page.locator('.nav-item', { hasText: 'Clientes' }).click();
  await expect(page.locator('#titulo-pagina')).toHaveText('Clientes');
});

test('quadro: arrastar a OS para outra coluna muda o status', async ({ page }) => {
  await abrirDemo(page, '#/os?visao=quadro');
  const card = page.locator('[data-coluna=aprovada] [data-card]').first();
  const id = await card.getAttribute('data-card');
  await card.dragTo(page.locator('[data-coluna=execucao] .coluna-corpo'));
  await expect(page.locator(`[data-coluna=execucao] [data-card="${id}"]`)).toBeVisible();
  expect(await lerStore(page, `(s) => s.porId('ordens', '${id}').status`)).toBe('execucao');
});

test('entregar com saldo em aberto oferece registrar pagamento', async ({ page }) => {
  await abrirDemo(page);
  const id = await lerStore(page, "(s) => s.todos('ordens').find((o) => o.status === 'pronta').id");
  await irPara(page, `#/os/${id}`);
  await page.locator('[data-etapa=entregue]').click();
  const m = janela(page);
  await expect(m).toContainText('Ainda falta receber');
  await m.getByRole('button', { name: 'Entregar e receber depois' }).click();
  await expect(page.locator('.etapa.atual')).toContainText('Entregue');
  await expect(page.locator('[data-selo-pag]')).toContainText(/A receber|Parcial/);
  // Aparece em "A receber" no financeiro
  await irPara(page, '#/financeiro?aba=receber');
  await expect(page.locator(`a[href="#/os/${id}"]`)).toBeVisible();
});

test('WhatsApp: monta a mensagem do orçamento para conferir antes de enviar', async ({ page }) => {
  await abrirDemo(page);
  const id = await lerStore(page, "(s) => s.todos('ordens').find((o) => o.status === 'orcamento' && o.itens.length).id");
  await irPara(page, `#/os/${id}`);
  await page.evaluate(() => {
    window.__links = [];
    window.open = (u) => {
      window.__links.push(u);
      return {};
    };
  });
  await page.getByRole('button', { name: 'WhatsApp' }).click();
  await page.locator('.menu-suspenso button', { hasText: 'Enviar orçamento' }).click();
  const texto = await janela(page).locator('#wa-txt').inputValue();
  expect(texto).toContain('Auto Center Exemplo');
  expect(texto).toMatch(/\*Total: R\$ [\d.,]+\*/);
  expect(texto).toContain('Válido até');
  await janela(page).getByRole('button', { name: 'Abrir no WhatsApp' }).click();
  const links = await page.evaluate(() => window.__links);
  expect(links[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
});
