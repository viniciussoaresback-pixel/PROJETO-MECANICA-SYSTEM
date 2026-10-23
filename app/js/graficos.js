// Gráficos leves em HTML/CSS (sem biblioteca): colunas por período e barras de ranking.
import { html } from './ui.js';
import { fmtCompacto, fmtMoeda } from './utils.js';

function escalaMaxima(max) {
  if (max <= 0) return 1;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pot >= max) return m * pot;
  return 10 * pot;
}

// dados: [{ rotulo, valor, detalhe? }] — uma série só (sem legenda: o título do cartão diz o que é).
// destaque: índice da coluna que recebe o valor escrito em cima (normalmente o período atual).
export function graficoColunas(dados, { formatar = fmtMoeda, destaque = dados.length - 1, altura = 200, rotuloAria = 'Gráfico' } = {}) {
  const max = escalaMaxima(Math.max(0, ...dados.map((d) => Number(d.valor) || 0)));
  const ticks = [max, max / 2, 0];
  return html`<figure class="graf-colunas" style="--altura:${altura}px" role="img" aria-label="${rotuloAria}">
    <div class="graf-eixo">${ticks.map((t) => html`<span>${fmtCompacto(t)}</span>`)}</div>
    <div class="graf-area">
      <div class="graf-grade"><i></i><i></i><i></i></div>
      ${dados.map((d, i) => {
        const pct = Math.max(0, Math.min(100, ((Number(d.valor) || 0) / max) * 100));
        return html`<div class="graf-col ${i === destaque ? 'atual' : ''}" tabindex="0" data-dica="${d.rotulo}: ${formatar(d.valor)}${d.detalhe ? ` · ${d.detalhe}` : ''}">
          <div class="graf-barra-wrap">
            ${i === destaque ? html`<span class="graf-valor">${fmtCompacto(d.valor)}</span>` : ''}
            <div class="graf-barra" style="height:${pct}%"></div>
          </div>
          <span class="graf-rotulo">${d.rotulo}</span>
        </div>`;
      })}
    </div>
    <table class="sr-only"><caption>${rotuloAria}</caption>${dados.map((d) => html`<tr><th>${d.rotulo}</th><td>${formatar(d.valor)}</td></tr>`)}</table>
  </figure>`;
}

// Ranking horizontal: [{ rotulo, valor, detalhe }]
export function graficoBarras(dados, { formatar = fmtMoeda } = {}) {
  const max = Math.max(0, ...dados.map((d) => Number(d.valor) || 0)) || 1;
  return html`<div class="graf-barras">${dados.map((d) => html`<div class="graf-linha">
    <div class="graf-linha-topo"><span class="graf-linha-rotulo">${d.rotulo}</span><span class="graf-linha-valor">${formatar(d.valor)}</span></div>
    <div class="graf-trilho"><div style="width:${Math.max(2, ((Number(d.valor) || 0) / max) * 100)}%"></div></div>
    ${d.detalhe ? html`<small class="texto-3">${d.detalhe}</small>` : ''}
  </div>`)}</div>`;
}

// Dica flutuante para os gráficos (um ouvinte só para a página).
let dica = null;
function mostrarDica(alvo) {
  if (!dica) {
    dica = document.createElement('div');
    dica.className = 'graf-dica';
    document.body.appendChild(dica);
  }
  dica.textContent = alvo.dataset.dica;
  dica.hidden = false;
  const r = alvo.querySelector('.graf-barra')?.getBoundingClientRect() || alvo.getBoundingClientRect();
  const w = dica.offsetWidth;
  dica.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  dica.style.top = `${Math.max(8, r.top - dica.offsetHeight - 8)}px`;
}
function esconderDica() {
  if (dica) dica.hidden = true;
}
document.addEventListener('mouseover', (e) => {
  const alvo = e.target.closest?.('[data-dica]');
  if (alvo) mostrarDica(alvo);
  else esconderDica();
});
document.addEventListener('focusin', (e) => {
  const alvo = e.target.closest?.('[data-dica]');
  if (alvo) mostrarDica(alvo);
});
document.addEventListener('focusout', esconderDica);
window.addEventListener('scroll', esconderDica, true);
