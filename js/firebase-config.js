// ============================================================================
// js/firebase-config.js
// Configuração centralizada do Firebase (Authentication + Firestore).
//
// IMPORTANTE: substitua os valores abaixo pelas credenciais REAIS do seu
// projeto Firebase (Console Firebase > Configurações do projeto > Seus apps).
// Os valores atuais são apenas placeholders de exemplo.
// ============================================================================

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAE6P-sZ5TwkvZMv5qRp3yvemvxfvXpH4",
  authDomain: "clientes-cancelados-inforwnet.firebaseapp.com",
  projectId: "clientes-cancelados-inforwnet",
  storageBucket: "clientes-cancelados-inforwnet.firebasestorage.app",
  messagingSenderId: "1062572730215",
  appId: "1:1062572730215:web:35678f04acc353caa6b1c2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
