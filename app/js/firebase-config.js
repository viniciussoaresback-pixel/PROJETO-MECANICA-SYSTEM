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

// true  = qualquer pessoa pode criar a conta de uma oficina nova na tela de entrada.
// false = só entra quem foi convidado por uma oficina já existente.
export const PERMITIR_NOVAS_OFICINAS = true;

// Versão do Firebase carregada do CDN oficial.
export const FIREBASE_VERSAO = '10.12.2';
