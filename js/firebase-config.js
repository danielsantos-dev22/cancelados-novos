// ============================================================================
// js/firebase-config.js
// Configuração centralizada do Firebase (Authentication + Firestore).
//
// IMPORTANTE: substitua os valores abaixo pelas credenciais REAIS do seu
// projeto Firebase (Console Firebase > Configurações do projeto > Seus apps).
// Os valores atuais são apenas placeholders de exemplo.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Mantém o usuário conectado entre sessões do navegador.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Não foi possível definir a persistência de autenticação:", err);
});

export const NOME_EMPRESA = "InforwNet Telecom";
