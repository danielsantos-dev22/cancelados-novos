// ============================================================================
// js/firebase-config.js
// Configuração centralizada do Firebase (Authentication + Firestore).
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAE6P-sZ5TwkvZMv5qRp3yvemvxfvXpH4",
  authDomain: "clientes-cancelados-inforwnet.firebaseapp.com",
  projectId: "clientes-cancelados-inforwnet",
  storageBucket: "clientes-cancelados-inforwnet.firebasestorage.app",
  messagingSenderId: "1062572730215",
  appId: "1:1062572730215:web:35678f04acc353caa6b1c2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Mantém o usuário conectado entre sessões do navegador.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Não foi possível definir a persistência de autenticação:", err);
});

export const NOME_EMPRESA = "InforwNet Telecom";
