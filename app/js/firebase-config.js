// Configuração do projeto Firebase da oficina.
// Estes dados NÃO são secretos (o Firebase foi feito para eles ficarem no site);
// quem protege os dados são as regras do arquivo firestore.rules — publique-as no console do Firebase.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDClow-K02n-Eytg9zjU-6tWGqKY1nQaBQ',
  authDomain: 'mecanicapro-11853.firebaseapp.com',
  projectId: 'mecanicapro-11853',
  storageBucket: 'mecanicapro-11853.firebasestorage.app',
  messagingSenderId: '482231204593',
  appId: '1:482231204593:web:5afc025124b67d17a0c750',
};

// Mostra a opção de abrir oficina nova na tela "Criar conta". Quem decide de verdade são as regras
// do banco: só abre oficina nova quem foi liberado (ver SEGURANCA.md → "Liberar uma oficina nova").
// false = a tela só aceita quem tem convite.
export const PERMITIR_NOVAS_OFICINAS = true;

// App Check (proteção contra robôs): cole aqui a "chave do site" do reCAPTCHA v3 depois de ativar
// em Firebase → App Check. Vazio = desligado. Passo a passo em SEGURANCA.md.
export const APP_CHECK_CHAVE = '';

// Versão do Firebase carregada do CDN oficial.
export const FIREBASE_VERSAO = '10.12.2';
