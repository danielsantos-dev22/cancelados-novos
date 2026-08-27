// ============================================================================
// js/historico.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth } from "./app-shell.js";
import { formatDateTimeBR, escapeHtml } from "./utils.js";
import {
  collectionGroup,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

requireAuth(() => {
  const shell = mountShell("historico", "Histórico");
  const tpl = document.getElementById("tpl-historico");
  shell.contentEl.appendChild(tpl.content.cloneNode(true));
  init();
});

function init() {
  const q = query(collectionGroup(db, "historico"), orderBy("data", "desc"), limit(150));
  onSnapshot(
    q,
    (snap) => {
      const el = document.getElementById("timelineGlobal");
      if (snap.empty) {
        el.innerHTML = '<p style="color:var(--color-gray-500);font-size:13.5px;">Nenhuma atividade registrada ainda.</p>';
        return;
      }
      el.innerHTML = snap.docs
        .map((d) => {
          const h = d.data();
          const clienteId = d.ref.parent.parent?.id;
          return `
          <a class="timeline-item" href="cliente-detalhes.html?id=${clienteId}" style="text-decoration:none;color:inherit;">
            <div class="timeline-dot"></div>
            <div class="timeline-body">
              <div class="t-desc">${escapeHtml(h.descricao || h.acao || "Atualização")}</div>
              <div class="t-meta">${formatDateTimeBR(h.data)} · ${escapeHtml(h.usuario || "")}</div>
            </div>
          </a>`;
        })
        .join("");
    },
    (err) => {
      console.error(err);
      document.getElementById("timelineGlobal").innerHTML =
        '<p style="color:var(--color-gray-500);font-size:13.5px;">Não foi possível carregar o histórico. Verifique se o índice do Firestore para a consulta em grupo de coleções ("historico", ordenado por "data") foi criado.</p>';
    }
  );
}
