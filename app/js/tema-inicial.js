// Aplica o tema (claro/escuro e cores da oficina) antes de desenhar a página, para não "piscar".
// Script comum (não módulo), carregado no <head>.
(() => {
  let p = 'auto';
  try {
    p = localStorage.getItem('mp:tema') || 'auto';
  } catch {
    /* ok */
  }
  const escuro = p === 'escuro' || (p === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
})();
