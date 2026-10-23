// Ações sobre uma OS usadas no editor e no quadro: mudar status, receber, excluir.
import { removerOS, salvarOS, telefoneOS } from './dominio.js';
import { formPagamento } from './formularios.js';
import { confirmar, escolher, toast } from './ui.js';
import { calcularOS, fmtMoeda, fmtNumeroOS, infoStatus } from './utils.js';

// Muda o status (salvando tudo o que está em `os`). Devolve a OS salva ou null se a pessoa desistiu.
export async function mudarStatusOS(os, novo, { silencioso = false } = {}) {
  if (novo === os.status) return os;
  const dados = structuredClone(os);
  if (novo === 'cancelada') {
    const ok = await confirmar({
      titulo: `Cancelar a OS ${fmtNumeroOS(os.numero)}?`,
      texto: 'A OS fica guardada como cancelada. Se alguma peça já tinha saído do estoque, ela volta.',
      ok: 'Cancelar OS',
      cancelar: 'Voltar',
      perigo: true,
    });
    if (!ok) return null;
  }
  if (novo === 'entregue') {
    const c = calcularOS(dados);
    if (c.saldo > 0.009) {
      const r = await escolher({
        titulo: 'Entregar o veículo',
        texto: `Ainda falta receber ${fmtMoeda(c.saldo)} desta OS.`,
        opcoes: [
          { id: 'depois', texto: 'Entregar e receber depois' },
          { id: 'pagar', texto: 'Registrar pagamento', classe: 'btn-primario', icone: 'banknote' },
        ],
      });
      if (!r) return null;
      if (r === 'pagar') {
        const p = await formPagamento({ saldo: c.saldo });
        if (!p) return null;
        dados.pagamentos = [...(dados.pagamentos || []), p];
      }
    }
  }
  dados.status = novo;
  const salvo = salvarOS(dados);
  if (!silencioso) toast(`OS ${fmtNumeroOS(salvo.numero)}: ${infoStatus(novo).nome}`);
  if (novo === 'pronta' && telefoneOS(salvo)) {
    const r = await escolher({
      titulo: 'Serviço concluído!',
      texto: 'Quer avisar o cliente pelo WhatsApp que o carro está pronto para retirada?',
      opcoes: [
        { id: 'nao', texto: 'Agora não' },
        { id: 'sim', texto: 'Avisar no WhatsApp', classe: 'btn-whats', icone: 'message-circle' },
      ],
    });
    if (r === 'sim') {
      const { whatsOS } = await import('./mensagens.js');
      whatsOS(salvo, 'pronto');
    }
  }
  return salvo;
}

export async function receberOS(os) {
  const c = calcularOS(os);
  const p = await formPagamento({ saldo: Math.max(0, c.saldo) });
  if (!p) return null;
  const salvo = salvarOS({ ...structuredClone(os), pagamentos: [...(os.pagamentos || []), p] });
  toast(`Pagamento de ${fmtMoeda(p.valor)} registrado`, 'ok', {
    acao: {
      texto: 'Imprimir recibo',
      fn: async () => {
        const { imprimirRecibo } = await import('./impressao.js');
        imprimirRecibo(salvo, p);
      },
    },
  });
  return salvo;
}

export async function excluirOS(os) {
  const ok = await confirmar({
    titulo: `Excluir a OS ${fmtNumeroOS(os.numero)}?`,
    texto: 'A OS será apagada de vez, com os pagamentos registrados nela. Para guardar o histórico, prefira “Cancelar”.',
    ok: 'Excluir',
    perigo: true,
  });
  if (!ok) return false;
  removerOS(os);
  toast(`OS ${fmtNumeroOS(os.numero)} excluída`);
  return true;
}
