// ============================================================================
// js/dashboard.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth } from "./app-shell.js";
import { formatDateBR, formatDateTimeBR, escapeHtml } from "./utils.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  collectionGroup,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

requireAuth(() => {
  const shell = mountShell("dashboard", "Dashboard");
  const tpl = document.getElementById("tpl-dashboard");
  shell.contentEl.appendChild(tpl.content.cloneNode(true));
  initDashboard();
});

function initDashboard() {
  const clientesRef = collection(db, "clientes_cancelados");
  const qAtivos = query(clientesRef, where("ativo", "==", true));

  onSnapshot(
    qAtivos,
    (snap) => {
      let total = 0;
      let spc = 0;
      let pendentes = 0;
      let devolvidos = 0;
      const docs = [];

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        total++;
        if (d.spcSerasa === true) spc++;
        if (d.equipamentoDevolvido === "sim") devolvidos++;
        if (d.equipamentoDevolvido === "nao" || d.equipamentoDevolvido === "parcial") pendentes++;
        docs.push({ id: docSnap.id, ...d });
      });

      document.getElementById("statTotal").textContent = total;
      document.getElementById("statSpc").textContent = spc;
      document.getElementById("statPendentes").textContent = pendentes;
      document.getElementById("statDevolvidos").textContent = devolvidos;

      docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderRecentClientes(docs.slice(0, 6));
    },
    (err) => {
      console.error(err);
      document.getElementById("recentClientes").innerHTML =
        '<p style="color:var(--color-gray-500);font-size:13.5px;">Não foi possível carregar os dados. Verifique a configuração do Firebase.</p>';
    }
  );

  const historicoQuery = query(collectionGroup(db, "historico"), orderBy("data", "desc"), limit(6));
  onSnapshot(
    historicoQuery,
    (snap) => {
      if (snap.empty) {
        document.getElementById("recentHistorico").innerHTML =
          '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhuma atividade registrada ainda.</p>';
        return;
      }
      const rows = snap.docs
        .map((d) => d.data())
        .map(
          (h) => `
        <div class="mini-row">
          <div>
            <div class="who">${escapeHtml(h.acao || "Atualização")}</div>
            <div class="meta">${escapeHtml(h.descricao || "")}</div>
          </div>
          <div class="meta" style="text-align:right;white-space:nowrap;">
            ${escapeHtml(h.usuario || "")}<br>${formatDateTimeBR(h.data)}
          </div>
        </div>`
        )
        .join("");
      document.getElementById("recentHistorico").innerHTML = rows;
    },
    () => {
      document.getElementById("recentHistorico").innerHTML =
        '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhuma atividade disponível.</p>';
    }
  );
}

function renderRecentClientes(docs) {
  const el = document.getElementById("recentClientes");
  if (docs.length === 0) {
    el.innerHTML =
      '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhum cliente cadastrado ainda.</p>';
    return;
  }
  el.innerHTML = docs
    .map((c) => {
      const spcBadge = c.spcSerasa
        ? '<span class="badge badge-red">SPC/SERASA</span>'
        : '<span class="badge badge-gray">Sem SPC</span>';
      return `
      <a class="mini-row" href="cliente-detalhes.html?id=${c.id}" style="text-decoration:none;color:inherit;">
        <div>
          <div class="who">${escapeHtml(c.nome || "—")}</div>
          <div class="meta">Cancelado em ${formatDateBR(c.dataCancelamento)}</div>
        </div>
        ${spcBadge}
      </a>`;
    })
    .join("");
}
