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

/* ----------------------------- Telefone --------------------------------- */

/** Aplica a máscara (00) 00000-0000 / (00) 0000-0000 conforme o usuário digita. */
export function maskTelefone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

/** Anexa a um <input> a máscara de telefone em tempo real. */
export function attachTelefoneMask(input) {
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const before = input.value.length;
    input.value = maskTelefone(input.value);
    const after = input.value.length;
    const diff = after - before;
    if (pos !== null) input.setSelectionRange(pos + diff, pos + diff);
  });
}

/* ----------------------------- Valor (moeda) ----------------------------- */

/** Aplica máscara de moeda (000,00) conforme o usuário digita, tratando os dígitos como centavos. */
export function maskMoeda(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Anexa a um <input> a máscara de moeda em tempo real (o input guarda o valor formatado tipo "1.234,56"). */
export function attachMoedaMask(input) {
  input.addEventListener("input", () => {
    input.value = maskMoeda(input.value);
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

/** Converte uma string "1.234,56" (pt-BR) para Number 1234.56. Retorna null se vazio/ inválido. */
export function moedaParaNumero(valorBR) {
  if (!valorBR) return null;
  const limpo = String(valorBR).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n;
}

/** Formata um número como "R$ 1.234,56". */
export function formatMoedaBR(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = typeof valor === "number" ? valor : moedaParaNumero(valor);
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ----------------------------- Promessa de pagamento ---------------------- */

/** Retorna a data de hoje no formato 'YYYY-MM-DD', no fuso de Belém. */
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(new Date());
}

/**
 * Calcula o status da promessa de pagamento de um cliente.
 * Retorna null se o cliente não tem promessa registrada.
 * Caso contrário: { label, badgeClass, vencida, hoje }
 */
export function calcularStatusPromessa(c) {
  if (!c || !c.prometeuPagamento) return null;
  if (c.pagamentoRecebido) {
    return { label: "Pagamento recebido", badgeClass: "badge-green", vencida: false, hoje: false };
  }
  if (!c.dataPromessaPagamento) {
    return { label: "Promessa sem data", badgeClass: "badge-gray", vencida: false, hoje: false };
  }
  const hoje = hojeISO();
  if (c.dataPromessaPagamento < hoje) {
    return { label: "Promessa atrasada", badgeClass: "badge-red", vencida: true, hoje: false };
  }
  if (c.dataPromessaPagamento === hoje) {
    return { label: "Vence hoje", badgeClass: "badge-amber", vencida: false, hoje: true };
  }
  return { label: "Aguardando", badgeClass: "badge-blue", vencida: false, hoje: false };
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

/* ----------------------------- Exportar para Excel ------------------------ */

let _xlsxLoadPromise = null;

/** Carrega a biblioteca SheetJS (xlsx) via CDN sob demanda, apenas uma vez. */
function carregarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoadPromise) return _xlsxLoadPromise;
  _xlsxLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Não foi possível carregar a biblioteca de exportação."));
    document.head.appendChild(script);
  });
  return _xlsxLoadPromise;
}

/**
 * Exporta uma lista de clientes para um arquivo .xlsx e inicia o download.
 * @param {Array<object>} clientes lista de clientes (já filtrada, se aplicável)
 * @param {string} nomeArquivo nome do arquivo, sem extensão
 */
export async function exportarClientesExcel(clientes, nomeArquivo = "clientes-cancelados") {
  const XLSX = await carregarXLSX();

  const linhas = clientes.map((c) => ({
    Nome: c.nome || "",
    CPF: c.cpf || "",
    Telefone: c.telefone || "",
    "Data do cancelamento": formatDateBR(c.dataCancelamento),
    "Valor (R$)": c.valor !== undefined && c.valor !== null ? Number(c.valor) : "",
    "SPC/SERASA": c.spcSerasa ? "Sim" : "Não",
    "Data inclusão SPC": c.spcSerasa ? formatDateBR(c.dataSpcSerasa) : "",
    "Observação SPC": c.observacaoSpc || "",
    "Devolução de equipamento":
      c.equipamentoDevolvido === "sim" ? "Devolvido" : c.equipamentoDevolvido === "parcial" ? "Parcialmente devolvido" : "Pendente",
    "Data da devolução": c.equipamentoDevolvido !== "nao" ? formatDateBR(c.dataDevolucao) : "",
    "Observação devolução": c.observacaoDevolucao || "",
    "Promessa de pagamento": c.prometeuPagamento ? "Sim" : "Não",
    "Data prometida": c.prometeuPagamento ? formatDateBR(c.dataPromessaPagamento) : "",
    "Pagamento recebido": c.prometeuPagamento ? (c.pagamentoRecebido ? "Sim" : "Não") : "",
    "Observação promessa": c.observacaoPromessa || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(linhas);
  worksheet["!cols"] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 30 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 30 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");

  const dataStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `${nomeArquivo}-${dataStr}.xlsx`);
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
