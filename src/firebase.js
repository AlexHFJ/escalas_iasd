// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// 1. Acesse https://console.firebase.google.com/
// 2. Crie um novo projeto
// 3. Adicione um app Web ao projeto
// 4. Copie as configurações abaixo e substitua os valores
// 5. Ative Authentication (Email/Senha) no console
// 6. Ative o Firestore Database (modo produção ou teste)
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
