// Contas de cor (sem tela): a partir de uma cor escolhida pela oficina, gera os tons
// do tema garantindo contraste para leitura. Testado em tests/unit/cores.test.mjs.

export function hexParaRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

export function rgbParaHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbParaHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
}

export function hslParaRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function luminancia([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contraste(a, b) {
  const la = luminancia(typeof a === 'string' ? hexParaRgb(a) : a);
  const lb = luminancia(typeof b === 'string' ? hexParaRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Muda a luminosidade (0–1) mantendo o tom.
export function comLuz(hex, l) {
  const [h, s] = rgbParaHsl(hexParaRgb(hex));
  return rgbParaHex(hslParaRgb([h, s, Math.max(0, Math.min(1, l))]));
}

// Escurece (ou clareia) aos poucos até atingir o contraste pedido com o fundo.
export function ajustarContraste(hex, fundo, minimo = 4.5) {
  const [h, s, l0] = rgbParaHsl(hexParaRgb(hex));
  const escurecer = luminancia(hexParaRgb(fundo)) > 0.4;
  let l = l0;
  for (let i = 0; i < 60; i++) {
    const cor = rgbParaHex(hslParaRgb([h, s, l]));
    if (contraste(cor, fundo) >= minimo) return cor;
    l += escurecer ? -0.02 : 0.02;
    if (l <= 0 || l >= 1) break;
  }
  return escurecer ? '#000000' : '#ffffff';
}

// Mistura duas cores (peso 0–1 da primeira). Usado no lugar de color-mix(), que não funciona em todo navegador.
export function misturar(a, b, peso) {
  const A = hexParaRgb(a);
  const B = hexParaRgb(b);
  return rgbParaHex(A.map((v, i) => v * peso + B[i] * (1 - peso)));
}

export function rgba(hex, alfa) {
  const [r, g, b] = hexParaRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

// Texto que fica legível sobre a cor (branco ou quase preto).
export function textoSobre(hex) {
  return contraste('#ffffff', hex) >= contraste('#111827', hex) ? '#ffffff' : '#111827';
}

// Gera todos os tons do tema (claro e escuro) a partir da cor principal.
export function paletaDoTema(cor) {
  const base = hexParaRgb(cor) ? cor : '#2563eb';
  const [, s, l] = rgbParaHsl(hexParaRgb(base));
  // Tema claro: botão com bom contraste (texto branco, ou escuro se a cor for clara demais)
  let botao = base;
  if (contraste('#ffffff', botao) < 4.5 && contraste('#111827', botao) < 4.5) botao = ajustarContraste(base, '#ffffff', 4.5);
  const claro = {
    acento: botao,
    acento2: comLuz(botao, rgbParaHsl(hexParaRgb(botao))[2] - 0.07),
    suave: misturar(base, '#ffffff', 0.1),
    texto: ajustarContraste(base, '#ffffff', 4.5),
    sobre: textoSobre(botao),
    foco: rgba(base, 0.35),
    grafico: base,
    graficoAtual: comLuz(base, Math.max(0.2, l - 0.15)),
  };
  // Tema escuro: a cor fica um pouco mais clara para aparecer no fundo escuro
  let escuroBase = l < 0.5 ? comLuz(base, Math.min(0.62, Math.max(0.52, l + 0.12))) : base;
  // Cores "do meio" (ex.: grafite) não dão contraste nem com texto branco nem escuro: clareia mais um pouco.
  if (contraste(escuroBase, textoSobre(escuroBase)) < 4.5) escuroBase = ajustarContraste(escuroBase, '#111827', 4.6);
  const escuro = {
    acento: escuroBase,
    acento2: comLuz(escuroBase, Math.min(0.75, rgbParaHsl(hexParaRgb(escuroBase))[2] + 0.07)),
    suave: rgba(escuroBase, 0.16),
    texto: ajustarContraste(escuroBase, '#111a2e', 5),
    sobre: textoSobre(escuroBase),
    foco: rgba(escuroBase, 0.45),
    grafico: escuroBase,
    graficoAtual: ajustarContraste(escuroBase, '#111a2e', 7),
  };
  // Menu lateral "na cor da marca": tom bem escuro da própria cor
  const lateralMarca = rgbParaHex(hslParaRgb([rgbParaHsl(hexParaRgb(base))[0], Math.min(s, 0.7), 0.17]));
  return { claro, escuro, lateralMarca, translucido: rgba(escuroBase, 0.22), impressao: ajustarContraste(base, '#ffffff', 5.5) };
}
