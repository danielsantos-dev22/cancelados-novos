// ============================================================================
// js/cliente-detalhes.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth, currentUserInfo } from "./app-shell.js";
import {
  formatDateBR,
  formatDateTimeBR,
  formatMoedaBR,
  escapeHtml,
  confirmModal,
  showToast,
  registrarHistorico,
} from "./utils.js";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let usuarioAtual = null;
let clienteId = null;
let nomeClienteAtual = "";

requireAuth((user) => {
  usuarioAtual = currentUserInfo(user);
  const shell = mountShell("clientes", "Detalhes do Cliente");
  const tpl = document.getElementById("tpl-detalhes");
  shell.contentEl.appendChild(tpl.content.cloneNode(true));

  clienteId = new URLSearchParams(window.location.search).get("id");
  if (!clienteId) {
    window.location.href = "clientes.html";
    return;
  }
  document.getElementById("btnEditar").href = `cliente-form.html?id=${clienteId}`;

  observarCliente();
  observarEquipamentos();
  observarHistorico();
});

function statusBadgeHtml(c) {
  if (c.equipamentoDevolvido === "sim") return '<span class="badge badge-green">Concluído</span>';
  if (c.equipamentoDevolvido === "parcial") return '<span class="badge badge-amber">Parcial</span>';
  return '<span class="badge badge-red">Pendente</span>';
}

function rotuloDevolucao(v) {
  if (v === "sim") return "Devolvido";
  if (v === "parcial") return "Parcialmente devolvido";
  return "Pendente";
}

function observarCliente() {
  const ref = doc(db, "clientes_cancelados", clienteId);
  onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        showToast("Cliente não encontrado.", "error");
        window.location.href = "clientes.html";
        return;
      }
      const c = snap.data();
      nomeClienteAtual = c.nome || "";
      renderInfo(c);
    },
    () => showToast("Não foi possível carregar o cliente.", "error")
  );
}

function renderInfo(c) {
  const container = document.getElementById("detalhesContent");
  if (!container.querySelector(".detail-grid")) {
    const tpl = document.getElementById("tpl-detalhes-conteudo");
    container.innerHTML = "";
    container.appendChild(tpl.content.cloneNode(true));
    document.getElementById("btnExcluirCliente").addEventListener("click", handleExcluir);
  }

  document.querySelector("[data-status-badge]").innerHTML = statusBadgeHtml(c);
  document.querySelector("[data-nome]").textContent = c.nome || "—";
  document.querySelector("[data-cpf]").textContent = c.cpf || "—";
  document.querySelector("[data-telefone]").textContent = c.telefone || "—";
  document.querySelector("[data-cancelamento]").textContent = formatDateBR(c.dataCancelamento);
  document.querySelector("[data-valor]").textContent = formatMoedaBR(c.valor);
  document.querySelector("[data-spc]").innerHTML = c.spcSerasa
    ? '<span class="badge badge-red">Sim</span>'
    : '<span class="badge badge-gray">Não</span>';

  document.querySelector("[data-linha-spc-data]").classList.toggle("hidden", !c.spcSerasa);
  document.querySelector("[data-spc-data]").textContent = formatDateBR(c.dataSpcSerasa);
  document.querySelector("[data-linha-spc-obs]").classList.toggle("hidden", !c.observacaoSpc);
  document.querySelector("[data-spc-obs]").textContent = c.observacaoSpc || "—";

  document.querySelector("[data-devolucao]").textContent = rotuloDevolucao(c.equipamentoDevolvido);
  const temDevData = c.equipamentoDevolvido !== "nao";
  document.querySelector("[data-linha-dev-data]").classList.toggle("hidden", !temDevData);
  document.querySelector("[data-dev-data]").textContent = formatDateBR(c.dataDevolucao);
  document.querySelector("[data-linha-dev-obs]").classList.toggle("hidden", !c.observacaoDevolucao);
  document.querySelector("[data-dev-obs]").textContent = c.observacaoDevolucao || "—";
}

function observarEquipamentos() {
  const ref = collection(db, "clientes_cancelados", clienteId, "equipamentos");
  onSnapshot(ref, (snap) => {
    const container = document.getElementById("equipContainer");
    if (!container) return;
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhum equipamento cadastrado.</p>';
      return;
    }
    container.innerHTML = snap.docs
      .map((d) => {
        const eq = d.data();
        return `
        <div class="equip-card">
          <div class="ec-head">
            <span class="ec-title">${escapeHtml(eq.tipo || "Equipamento")}${eq.marca ? " · " + escapeHtml(eq.marca) : ""}${eq.modelo ? " " + escapeHtml(eq.modelo) : ""}</span>
            ${equipStatusBadge(eq.status)}
          </div>
          <div class="ec-sub">
            ${eq.numeroSerie ? `S/N: ${escapeHtml(eq.numeroSerie)}<br>` : ""}
            ${eq.macAddress ? `MAC: ${escapeHtml(eq.macAddress)}<br>` : ""}
            ${eq.observacao ? escapeHtml(eq.observacao) : ""}
          </div>
        </div>`;
      })
      .join("");
  });
}

function equipStatusBadge(status) {
  const map = {
    Pendente: "badge-red",
    Devolvido: "badge-green",
    Danificado: "badge-amber",
    Extraviado: "badge-gray",
  };
  return `<span class="badge ${map[status] || "badge-gray"}">${escapeHtml(status || "—")}</span>`;
}

function observarHistorico() {
  const ref = query(collection(db, "clientes_cancelados", clienteId, "historico"), orderBy("data", "desc"));
  onSnapshot(ref, (snap) => {
    const container = document.getElementById("timelineContainer");
    if (!container) return;
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhuma alteração registrada ainda.</p>';
      return;
    }
    container.innerHTML = snap.docs
      .map((d) => {
        const h = d.data();
        return `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-body">
            <div class="t-desc">${escapeHtml(h.descricao || h.acao || "Atualização")}</div>
            <div class="t-meta">${formatDateTimeBR(h.data)} · ${escapeHtml(h.usuario || "")}</div>
          </div>
        </div>`;
      })
      .join("");
  });
}

async function handleExcluir() {
  const ok = await confirmModal({
    title: "Tem certeza que deseja excluir este cliente?",
    message: "Esta ação não poderá ser desfeita.",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  try {
    const ref = doc(db, "clientes_cancelados", clienteId);
    await updateDoc(ref, {
      ativo: false,
      updatedAt: serverTimestamp(),
      updatedBy: usuarioAtual?.email || "",
    });
    await registrarHistorico(clienteId, usuarioAtual, "Cliente removido", `Removeu o cadastro de ${nomeClienteAtual || "cliente"} (exclusão lógica).`);
    showToast("Cliente excluído com sucesso.", "success");
    setTimeout(() => (window.location.href = "clientes.html"), 900);
  } catch (err) {
    console.error(err);
    showToast("Não foi possível excluir o cliente.", "error");
  }
}
