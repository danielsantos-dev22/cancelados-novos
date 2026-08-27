// ============================================================================
// js/app-shell.js — sidebar, topbar, guarda de autenticação e logout
// Usado por: dashboard.html, clientes.html, cliente-form.html,
//            cliente-detalhes.html, historico.html
// ============================================================================
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getInitials, showToast, confirmModal } from "./utils.js";

const ICONS = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  clientes:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  equip:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M6 11v2M10 11v2M14 11v2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  spc:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>',
  historico:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 1 0 .5-4.5"/><path d="M12 7v5l3 3"/></svg>',
  sair:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: ICONS.dashboard },
  { key: "clientes", label: "Clientes Cancelados", href: "clientes.html", icon: ICONS.clientes },
  { key: "pendentes", label: "Equipamentos Pendentes", href: "clientes.html?filtro=equipamento-pendente", icon: ICONS.equip },
  { key: "spc", label: "SPC/SERASA", href: "clientes.html?filtro=spc", icon: ICONS.spc },
  { key: "historico", label: "Histórico", href: "historico.html", icon: ICONS.historico },
];

/**
 * Monta a casca do app (sidebar + topbar) dentro do elemento #app-shell
 * já presente na página, e devolve os elementos de conteúdo/usuário.
 * @param {string} activeKey uma das chaves de NAV_ITEMS
 * @param {string} pageTitle título mostrado na topbar
 */
export function mountShell(activeKey, pageTitle) {
  const root = document.getElementById("app-shell");
  if (!root) return null;

  root.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="logo-dot">IN</div>
        <div class="brand-text"><strong>InforwNet Telecom</strong><span>Clientes Cancelados</span></div>
      </div>
      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(
          (item) => `
          <a href="${item.href}" class="${item.key === activeKey ? "active" : ""}">
            ${item.icon}<span>${item.label}</span>
          </a>`
        ).join("")}
      </nav>
      <div class="sidebar-foot">
        <button type="button" id="btnLogout">${ICONS.sair}<span>Sair</span></button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button type="button" class="hamburger" id="btnHamburger">${ICONS.menu}</button>
          <h1 class="topbar-title">${pageTitle}</h1>
        </div>
        <div class="topbar-greeting">
          <div class="who"><strong id="greetName">Olá</strong><span id="greetEmail"></span></div>
          <div class="avatar" id="greetAvatar">--</div>
        </div>
      </header>
      <div class="content" id="pageContent"></div>
    </div>`;

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("btnHamburger")?.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  });
  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    const ok = await confirmModal({
      title: "Sair do sistema",
      message: "Deseja realmente encerrar sua sessão?",
      confirmLabel: "Sair",
      cancelLabel: "Cancelar",
      danger: false,
    });
    if (!ok) return;
    await signOut(auth);
    window.location.href = "index.html";
  });

  return {
    contentEl: document.getElementById("pageContent"),
  };
}

/** Preenche a saudação do usuário na topbar. */
function paintUser(user) {
  const nome = user.displayName || user.email.split("@")[0];
  const nameEl = document.getElementById("greetName");
  const emailEl = document.getElementById("greetEmail");
  const avatarEl = document.getElementById("greetAvatar");
  if (nameEl) nameEl.textContent = `Olá, ${nome}`;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = getInitials(nome);
}

/**
 * Garante que a página só é usada por usuários autenticados.
 * Redireciona para index.html caso não haja sessão.
 * @param {(user:import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js").User)=>void} onReady
 */
export function requireAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    paintUser(user);
    onReady(user);
  });
}

export function currentUserInfo(user) {
  return {
    nome: user.displayName || user.email.split("@")[0],
    email: user.email,
  };
}

export { showToast };
