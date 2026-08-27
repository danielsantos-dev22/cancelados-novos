// ============================================================================
// js/utils.js — funções utilitárias compartilhadas por todas as páginas
// ============================================================================
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ----------------------------- CPF ------------------------------------- */

/** Aplica a máscara 000.000.000-00 conforme o usuário digita. */
export function maskCPF(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Anexa a um <input> a máscara de CPF em tempo real. */
export function attachCPFMask(input) {
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const before = input.value.length;
    input.value = maskCPF(input.value);
    const after = input.value.length;
    const diff = after - before;
    if (pos !== null) input.setSelectionRange(pos + diff, pos + diff);
  });
}

/** Valida CPF (algoritmo dos dígitos verificadores). */
export function isValidCPF(cpfRaw) {
  const cpf = String(cpfRaw).replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10], 10);
}

/* ----------------------------- Datas ------------------------------------ */

/** Converte um valor 'YYYY-MM-DD' (input type=date) para 'DD/MM/AAAA'. */
export function isoToBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Converte 'DD/MM/AAAA' para 'YYYY-MM-DD'. */
export function brToISO(br) {
  if (!br) return "";
  const [d, m, y] = br.split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Formata um Timestamp do Firestore (ou Date) como 'DD/MM/AAAA'. */
export function formatDateBR(value) {
  const date = toJSDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Belem" });
}

/** Formata um Timestamp do Firestore (ou Date) como 'DD/MM/AAAA HH:mm'. */
export function formatDateTimeBR(value) {
  const date = toJSDate(value);
  if (!date) return "—";
  return (
    date.toLocaleDateString("pt-BR", { timeZone: "America/Belem" }) +
    " " +
    date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Belem",
    })
  );
}

function toJSDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    // Aceita tanto 'YYYY-MM-DD' quanto ISO completo
    const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    return isNaN(d) ? null : d;
  }
  return null;
}

/* ----------------------------- Texto / segurança ------------------------ */

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ----------------------------- Toasts ------------------------------------ */

const ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

function ensureToastStack() {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

/** Exibe um toast temporário. type: 'success' | 'error' | 'info' */
export function showToast(message, type = "info", duration = 4200) {
  const stack = ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .2s";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ----------------------------- Modal de confirmação ----------------------- */

/**
 * Exibe um modal de confirmação e retorna uma Promise<boolean>.
 * options: { title, message, confirmLabel, cancelLabel, danger }
 */
export function confirmModal(options = {}) {
  const {
    title = "Tem certeza?",
    message = "Esta ação não poderá ser desfeita.",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = true,
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
          </svg>
        </div>
        <h3 id="modalTitle">${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    function close(result) {
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    }

    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => close(false));
    overlay.querySelector('[data-act="confirm"]').addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    document.addEventListener(
      "keydown",
      function esc(e) {
        if (e.key === "Escape") {
          close(false);
          document.removeEventListener("keydown", esc);
        }
      },
      { once: true }
    );
  });
}

/* ----------------------------- Histórico --------------------------------- */

/**
 * Registra uma entrada no histórico (subcoleção) de um cliente.
 * @param {string} clienteId
 * @param {{nome:string,email:string}} usuario
 * @param {string} acao curto, ex: "Status do equipamento alterado"
 * @param {string} descricao detalhada, ex: "Alterou o status de Pendente para Devolvido."
 */
export async function registrarHistorico(clienteId, usuario, acao, descricao) {
  try {
    const ref = collection(db, "clientes_cancelados", clienteId, "historico");
    await addDoc(ref, {
      data: serverTimestamp(),
      usuario: usuario?.nome || "Usuário",
      usuarioEmail: usuario?.email || "",
      acao,
      descricao,
    });
  } catch (err) {
    console.error("Falha ao registrar histórico:", err);
  }
}

/* ----------------------------- Mensagens de erro Firebase ----------------- */

export function traduzErroFirebase(code) {
  const map = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/weak-password": "A senha deve ter no mínimo 6 caracteres.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/missing-email": "Informe um e-mail.",
    "auth/user-disabled": "Esta conta foi desativada.",
  };
  return map[code] || "Ocorreu um erro. Tente novamente.";
}
