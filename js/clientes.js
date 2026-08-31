// ============================================================================
// js/clientes.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth, currentUserInfo } from "./app-shell.js";
import {
  formatDateBR,
  formatMoedaBR,
  calcularStatusPromessa,
  escapeHtml,
  debounce,
  confirmModal,
  showToast,
  registrarHistorico,
  exportarClientesExcel,
} from "./utils.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let TODOS_CLIENTES = [];
let FILTRO_ATUAL = "todos";
let BUSCA_ATUAL = "";
let usuarioAtual = null;

requireAuth((user) => {
  usuarioAtual = currentUserInfo(user);
  const shell = mountShell(getActiveNavKey(), "Clientes Cancelados");
  const tpl = document.getElementById("tpl-clientes");
  shell.contentEl.appendChild(tpl.content.cloneNode(true));
  init();
});

function getActiveNavKey() {
  const filtro = new URLSearchParams(window.location.search).get("filtro");
  if (filtro === "spc") return "spc";
  if (filtro === "equipamento-pendente") return "pendentes";
  return "clientes";
}

function init() {
  const params = new URLSearchParams(window.location.search);
  FILTRO_ATUAL = params.get("filtro") || "todos";

  document.querySelectorAll(".chip").forEach((chip) => {
    if (chip.dataset.filtro === FILTRO_ATUAL) chip.classList.add("active");
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      FILTRO_ATUAL = chip.dataset.filtro;
      renderLista();
    });
  });

  document.getElementById("searchInput").addEventListener(
    "input",
    debounce((e) => {
      BUSCA_ATUAL = e.target.value.trim().toLowerCase();
      renderLista();
    }, 220)
  );

  document.getElementById("btnExportarExcel").addEventListener("click", handleExportarExcel);

  const clientesRef = collection(db, "clientes_cancelados");
  const qAtivos = query(clientesRef, where("ativo", "==", true));

  onSnapshot(
    qAtivos,
    (snap) => {
      TODOS_CLIENTES = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      TODOS_CLIENTES.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderLista();
      avisarPromessasPendentes();
    },
    (err) => {
      console.error(err);
      document.getElementById("tableBody").innerHTML =
        '<tr><td colspan="7"><p style="color:var(--color-gray-500);padding:20px;">Não foi possível carregar os clientes.</p></td></tr>';
    }
  );
}

let AVISO_PROMESSAS_MOSTRADO = false;

function avisarPromessasPendentes() {
  if (AVISO_PROMESSAS_MOSTRADO) return;

  const hojeList = TODOS_CLIENTES.filter((c) => calcularStatusPromessa(c)?.hoje);
  const atrasadasList = TODOS_CLIENTES.filter((c) => calcularStatusPromessa(c)?.vencida);

  if (hojeList.length === 0 && atrasadasList.length === 0) return;
  AVISO_PROMESSAS_MOSTRADO = true;

  if (hojeList.length > 0) {
    const nomes = hojeList.map((c) => c.nome).slice(0, 3).join(", ");
    const resto = hojeList.length > 3 ? ` e mais ${hojeList.length - 3}` : "";
    showToast(`Promessa de pagamento vence hoje: ${nomes}${resto}.`, "info", 8000);
  }
  if (atrasadasList.length > 0) {
    const nomes = atrasadasList.map((c) => c.nome).slice(0, 3).join(", ");
    const resto = atrasadasList.length > 3 ? ` e mais ${atrasadasList.length - 3}` : "";
    showToast(`Promessa de pagamento atrasada: ${nomes}${resto}.`, "error", 8000);
  }
}

function aplicarFiltro(lista) {
  const agora = Date.now();
  return lista.filter((c) => {
    if (BUSCA_ATUAL) {
      const nomeMatch = (c.nome || "").toLowerCase().includes(BUSCA_ATUAL);
      const cpfMatch = (c.cpf || "").replace(/\D/g, "").includes(BUSCA_ATUAL.replace(/\D/g, ""));
      const buscaDigits = BUSCA_ATUAL.replace(/\D/g, "");
      const telMatch =
        buscaDigits.length > 0 &&
        ((c.telefone1 || c.telefone || "").replace(/\D/g, "").includes(buscaDigits) ||
          (c.telefone2 || "").replace(/\D/g, "").includes(buscaDigits));
      if (!nomeMatch && !cpfMatch && !telMatch) return false;
    }
    switch (FILTRO_ATUAL) {
      case "spc":
        return c.spcSerasa === true;
      case "sem-spc":
        return c.spcSerasa !== true;
      case "equipamento-devolvido":
        return c.equipamentoDevolvido === "sim";
      case "equipamento-pendente":
        return c.equipamentoDevolvido === "nao";
      case "parcial":
        return c.equipamentoDevolvido === "parcial";
      case "promessa-hoje": {
        const st = calcularStatusPromessa(c);
        return Boolean(st?.hoje);
      }
      case "promessa-atrasada": {
        const st = calcularStatusPromessa(c);
        return Boolean(st?.vencida);
      }
      case "promessa-pendente":
        return c.prometeuPagamento === true && !c.pagamentoRecebido;
      case "recentes": {
        const t = c.dataCancelamento ? new Date(c.dataCancelamento).getTime() : 0;
        return t && agora - t <= 30 * 24 * 60 * 60 * 1000;
      }
      default:
        return true;
    }
  });
}

async function handleExportarExcel() {
  const btn = document.getElementById("btnExportarExcel");
  const label = document.getElementById("btnExportarExcelLabel");
  const lista = aplicarFiltro(TODOS_CLIENTES);

  if (lista.length === 0) {
    showToast("Não há clientes para exportar com os filtros atuais.", "info");
    return;
  }

  btn.disabled = true;
  const textoOriginal = label.textContent;
  label.innerHTML = '<span class="spinner"></span>';

  try {
    await exportarClientesExcel(lista, "clientes-cancelados");
    showToast(`Exportação concluída (${lista.length} cliente(s)).`, "success");
  } catch (err) {
    console.error(err);
    showToast("Não foi possível exportar para Excel.", "error");
  } finally {
    btn.disabled = false;
    label.textContent = textoOriginal;
  }
}

function statusBadge(c) {
  if (c.equipamentoDevolvido === "sim") return '<span class="badge badge-green">Concluído</span>';
  if (c.equipamentoDevolvido === "parcial") return '<span class="badge badge-amber">Parcial</span>';
  return '<span class="badge badge-red">Pendente</span>';
}

function telefonesTexto(c) {
  const t1 = c.telefone1 || c.telefone || "";
  const t2 = c.telefone2 || "";
  if (t1 && t2) return `${t1} / ${t2}`;
  return t1 || t2 || "—";
}

function equipBadge(c) {
  const cls = c.equipamentoDevolvido === "sim" ? "badge-green" : c.equipamentoDevolvido === "parcial" ? "badge-amber" : "badge-red";
  return `<span class="badge ${cls}">${escapeHtml(equipTexto(c))}</span>`;
}

function promessaBadge(c) {
  const st = calcularStatusPromessa(c);
  if (!st) return '<span class="badge badge-gray">—</span>';
  return `<span class="badge ${st.badgeClass}">${escapeHtml(st.label)}</span>`;
}

function equipTexto(c) {
  if (c.equipamentoDevolvido === "sim") return "Devolvido";
  if (c.equipamentoDevolvido === "parcial") return "Parcialmente devolvido";
  return "Pendente";
}

function renderLista() {
  const lista = aplicarFiltro(TODOS_CLIENTES);
  const tbody = document.getElementById("tableBody");
  const cardList = document.getElementById("cardList");

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <strong>Nenhum cliente encontrado</strong>
        Ajuste a pesquisa ou os filtros, ou cadastre um novo cliente.
      </div></td></tr>`;
    cardList.innerHTML = "";
    return;
  }

  tbody.innerHTML = lista
    .map(
      (c) => `
    <tr>
      <td class="cell-name">
        <div>${escapeHtml(c.nome || "—")}</div>
        <div class="cpf-sub">${escapeHtml([c.cpf, c.telefone1 || c.telefone, c.telefone2].filter(Boolean).join(" · ") || "—")}</div>
      </td>
      <td>${formatDateBR(c.dataCancelamento)}</td>
      <td>${formatMoedaBR(c.valor)}</td>
      <td>${c.spcSerasa ? '<span class="badge badge-red">Sim</span>' : '<span class="badge badge-gray">Não</span>'}</td>
      <td>${equipBadge(c)}</td>
      <td>${promessaBadge(c)}</td>
      <td>
        <div class="row-actions">
          <a class="btn-icon" title="Visualizar" href="cliente-detalhes.html?id=${c.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
          <a class="btn-icon" title="Editar" href="cliente-form.html?id=${c.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </a>
          <button class="btn-icon" title="Excluir" data-del="${c.id}" data-nome="${escapeHtml(c.nome || "")}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  cardList.innerHTML = lista
    .map(
      (c) => `
    <div class="client-card">
      <div class="cc-head">
        <div>
          <div class="cc-name">${escapeHtml(c.nome || "—")}</div>
          <div class="cc-cpf">${escapeHtml(c.cpf || "—")}</div>
        </div>
        ${statusBadge(c)}
      </div>
      <div class="cc-row"><span>Telefone</span><span>${escapeHtml(telefonesTexto(c))}</span></div>
      <div class="cc-row"><span>Cancelamento</span><span>${formatDateBR(c.dataCancelamento)}</span></div>
      <div class="cc-row"><span>Valor</span><span>${formatMoedaBR(c.valor)}</span></div>
      <div class="cc-row"><span>SPC/SERASA</span><span>${c.spcSerasa ? "Sim" : "Não"}</span></div>
      <div class="cc-row"><span>Equipamento</span><span>${equipTexto(c)}</span></div>
      <div class="cc-row"><span>Promessa</span><span>${promessaBadge(c)}</span></div>
      <div class="cc-actions">
        <a class="btn btn-outline btn-sm" href="cliente-detalhes.html?id=${c.id}">Ver</a>
        <a class="btn btn-outline btn-sm" href="cliente-form.html?id=${c.id}">Editar</a>
        <button class="btn btn-danger btn-sm" data-del="${c.id}" data-nome="${escapeHtml(c.nome || "")}">Excluir</button>
      </div>
    </div>`
    )
    .join("");

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => handleExcluir(btn.dataset.del, btn.dataset.nome));
  });
}

async function handleExcluir(id, nome) {
  const ok = await confirmModal({
    title: "Tem certeza que deseja excluir este cliente?",
    message: "Esta ação não poderá ser desfeita.",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  try {
    const ref = doc(db, "clientes_cancelados", id);
    await updateDoc(ref, {
      ativo: false,
      updatedAt: serverTimestamp(),
      updatedBy: usuarioAtual?.email || "",
    });
    await registrarHistorico(id, usuarioAtual, "Cliente removido", `Removeu o cadastro de ${nome || "cliente"} (exclusão lógica).`);
    showToast("Cliente excluído com sucesso.", "success");
  } catch (err) {
    console.error(err);
    showToast("Não foi possível excluir o cliente.", "error");
  }
}
