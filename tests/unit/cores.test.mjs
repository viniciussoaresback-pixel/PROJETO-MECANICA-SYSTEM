// Temas: qualquer cor escolhida precisa gerar botões e textos legíveis.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contraste, hexParaRgb, misturar, paletaDoTema, rgbParaHex } from '../../app/js/cores.js';

test('conversão de cores', () => {
  assert.deepEqual(hexParaRgb('#ff6a00'), [255, 106, 0]);
  assert.deepEqual(hexParaRgb('fff'), [255, 255, 255]);
  assert.equal(hexParaRgb('xyz'), null);
  assert.equal(rgbParaHex([255, 106, 0]), '#ff6a00');
  assert.equal(misturar('#000000', '#ffffff', 0.5), '#808080');
});

test('qualquer cor gera tema legível (claro e escuro)', () => {
  for (const cor of ['#2563eb', '#eab308', '#ffff00', '#00ff00', '#16a34a', '#ffffff', '#000000', '#7c3aed', '#f9a8d4', '#475569']) {
    const p = paletaDoTema(cor);
    assert.ok(contraste(p.claro.acento, p.claro.sobre) >= 4.5, `botão claro ${cor}`);
    assert.ok(contraste(p.claro.texto, '#ffffff') >= 4.5, `link claro ${cor}`);
    assert.ok(contraste(p.escuro.acento, p.escuro.sobre) >= 4.5, `botão escuro ${cor}`);
    assert.ok(contraste(p.escuro.texto, '#111a2e') >= 4.5, `link escuro ${cor}`);
    assert.ok(contraste(p.impressao, '#ffffff') >= 4.5, `impressão ${cor}`);
    assert.ok(contraste(p.lateralMarca, '#ffffff') >= 4.5, `menu na cor da marca ${cor}`);
  }
});
