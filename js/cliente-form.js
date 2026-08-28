// ============================================================================
// js/cliente-form.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth, currentUserInfo } from "./app-shell.js";
import {
  attachCPFMask,
  isValidCPF,
  attachTelefoneMask,
  attachMoedaMask,
  moedaParaNumero,
  showToast,
  registrarHistorico,
} from "./utils.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let usuarioAtual = null;
let clienteId = null; // null = criação
let equipCounter = 0;
let originalCliente = null;
let originalEquipMap = new Map(); // id -> data original

requireAuth((user) => {
  usuarioAtual = currentUserInfo(user);
  const shell = mountShell("clientes", "Cliente");
  const tpl = document.getElementById("tpl-form");
  shell.contentEl.appendChild(tpl.content.cloneNode(true));

  clienteId = new URLSearchParams(window.location.search).get("id");
  wireStaticUI();

  if (clienteId) {
    document.getElementById("formTitle").textContent = "Editar Cliente";
    document.getElementById("formSub").textContent = "Atualize os dados do cliente cancelado.";
    document.getElementById("btnSalvarLabel").textContent = "Salvar alterações";
    carregarCliente(clienteId);
  } else {
    adicionarEquipamento(); // inicia com um item em branco
  }

  document.getElementById("clienteForm").addEventListener("submit", handleSubmit);
});

/* --------------------------------------------------------------------- */

function wireStaticUI() {
  attachCPFMask(document.getElementById("fCpf"));
  attachTelefoneMask(document.getElementById("fTelefone"));
  attachMoedaMask(document.getElementById("fValor"));

  wireRadioGroup("spcGroup", "spc", "spcCondicional");
  wireRadioGroup("devolucaoGroup", "devolucao", "devolucaoCondicional");

  document.getElementById("btnAddEquip").addEventListener("click", () => adicionarEquipamento());
}

function wireRadioGroup(groupId, name, conditionalId) {
  const group = document.getElementById(groupId);
  const conditional = document.getElementById(conditionalId);
  const inputs = group.querySelectorAll(`input[name="${name}"]`);

  function sync() {
    inputs.forEach((input) => {
      input.closest(".radio-pill").classList.toggle("checked", input.checked);
    });
    const selecionado = group.querySelector(`input[name="${name}"]:checked`)?.value;
    conditional.classList.toggle("hidden", selecionado === "nao");
  }

  inputs.forEach((input) => input.addEventListener("change", sync));
  sync();
}

/* --------------------------------------------------------------------- */

function adicionarEquipamento(dados = null) {
  const tpl = document.getElementById("tpl-equip-item");
  const node = tpl.content.cloneNode(true);
  const item = node.querySelector("[data-equip-item]");
  equipCounter++;
  item.dataset.uid = `novo-${equipCounter}`;
  if (dados?.id) item.dataset.docId = dados.id;

  item.querySelector("[data-equip-title]").textContent = `Equipamento ${document.querySelectorAll("#equipList [data-equip-item]").length + 1}`;

  if (dados) {
    item.querySelector('[data-f="tipo"]').value = dados.tipo || "ONU/ONT";
    item.querySelector('[data-f="marca"]').value = dados.marca || "";
    item.querySelector('[data-f="modelo"]').value = dados.modelo || "";
    item.querySelector('[data-f="numeroSerie"]').value = dados.numeroSerie || "";
    item.querySelector('[data-f="macAddress"]').value = dados.macAddress || "";
    item.querySelector('[data-f="status"]').value = dados.status || "Pendente";
    item.querySelector('[data-f="observacao"]').value = dados.observacao || "";
  }

  item.querySelector("[data-remove-equip]").addEventListener("click", () => {
    item.remove();
    renumerarEquipamentos();
  });

  document.getElementById("equipList").appendChild(node);
}

function renumerarEquipamentos() {
  document.querySelectorAll("#equipList [data-equip-item]").forEach((item, idx) => {
    item.querySelector("[data-equip-title]").textContent = `Equipamento ${idx + 1}`;
  });
}

function lerEquipamentosDoDOM() {
  return Array.from(document.querySelectorAll("#equipList [data-equip-item]")).map((item) => ({
    docId: item.dataset.docId || null,
    tipo: item.querySelector('[data-f="tipo"]').value,
    marca: item.querySelector('[data-f="marca"]').value.trim(),
    modelo: item.querySelector('[data-f="modelo"]').value.trim(),
    numeroSerie: item.querySelector('[data-f="numeroSerie"]').value.trim(),
    macAddress: item.querySelector('[data-f="macAddress"]').value.trim().toUpperCase(),
    status: item.querySelector('[data-f="status"]').value,
    observacao: item.querySelector('[data-f="observacao"]').value.trim(),
  }));
}

/* --------------------------------------------------------------------- */

async function carregarCliente(id) {
  try {
    const ref = doc(db, "clientes_cancelados", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      showToast("Cliente não encontrado.", "error");
      window.location.href = "clientes.html";
      return;
    }
    const c = snap.data();
    originalCliente = c;

    document.getElementById("fNome").value = c.nome || "";
    document.getElementById("fCpf").value = c.cpf || "";
    document.getElementById("fTelefone").value = c.telefone || "";
    document.getElementById("fDataCancelamento").value = toDateInputValue(c.dataCancelamento);
    document.getElementById("fValor").value =
      c.valor !== undefined && c.valor !== null
        ? Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

    const spcValue = c.spcSerasa ? "sim" : "nao";
    document.querySelector(`input[name="spc"][value="${spcValue}"]`).checked = true;
    document.getElementById("fDataSpc").value = toDateInputValue(c.dataSpcSerasa);
    document.getElementById("fObsSpc").value = c.observacaoSpc || "";

    const devValue = c.equipamentoDevolvido || "nao";
    document.querySelector(`input[name="devolucao"][value="${devValue}"]`).checked = true;
    document.getElementById("fDataDevolucao").value = toDateInputValue(c.dataDevolucao);
    document.getElementById("fObsDevolucao").value = c.observacaoDevolucao || "";

    document.getElementById("spcGroup").querySelectorAll("input").forEach((i) => i.dispatchEvent(new Event("change")));
    document.getElementById("devolucaoGroup").querySelectorAll("input").forEach((i) => i.dispatchEvent(new Event("change")));

    const equipSnap = await getDocs(collection(db, "clientes_cancelados", id, "equipamentos"));
    document.getElementById("equipList").innerHTML = "";
    if (equipSnap.empty) {
      adicionarEquipamento();
    } else {
      equipSnap.forEach((d) => {
        originalEquipMap.set(d.id, d.data());
        adicionarEquipamento({ id: d.id, ...d.data() });
      });
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar dados do cliente.", "error");
  }
}

function toDateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.includes("T") ? value.split("T")[0] : value;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return d.toISOString().split("T")[0];
  }
  return "";
}

/* --------------------------------------------------------------------- */

function setFieldError(inputId, errId, show) {
  document.getElementById(inputId).classList.toggle("invalid", show);
  document.getElementById(errId).classList.toggle("show", show);
}

function validarFormulario() {
  let valid = true;
  const nome = document.getElementById("fNome").value.trim();
  const cpf = document.getElementById("fCpf").value.trim();
  const dataCancelamento = document.getElementById("fDataCancelamento").value;

  setFieldError("fNome", "errNome", nome.length < 3);
  if (nome.length < 3) valid = false;

  const cpfOk = isValidCPF(cpf);
  setFieldError("fCpf", "errCpf", !cpfOk);
  if (!cpfOk) valid = false;

  const telefone = document.getElementById("fTelefone").value.trim();
  const telefoneDigits = telefone.replace(/\D/g, "");
  const telefoneOk = telefoneDigits.length === 0 || telefoneDigits.length >= 10;
  setFieldError("fTelefone", "errTelefone", !telefoneOk);
  if (!telefoneOk) valid = false;

  setFieldError("fDataCancelamento", "errData", !dataCancelamento);
  if (!dataCancelamento) valid = false;

  return valid;
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validarFormulario()) {
    showToast("Verifique os campos destacados no formulário.", "error");
    return;
  }

  const btn = document.getElementById("btnSalvar");
  const btnLabel = document.getElementById("btnSalvarLabel");
  btn.disabled = true;
  btnLabel.innerHTML = '<span class="spinner"></span>';

  const nome = document.getElementById("fNome").value.trim();
  const spcSerasa = document.querySelector('input[name="spc"]:checked').value === "sim";
  const equipamentoDevolvido = document.querySelector('input[name="devolucao"]:checked').value;

  const payload = {
    nome,
    cpf: document.getElementById("fCpf").value.trim(),
    telefone: document.getElementById("fTelefone").value.trim(),
    valor: moedaParaNumero(document.getElementById("fValor").value.trim()),
    dataCancelamento: document.getElementById("fDataCancelamento").value,
    spcSerasa,
    dataSpcSerasa: spcSerasa ? document.getElementById("fDataSpc").value || null : null,
    observacaoSpc: spcSerasa ? document.getElementById("fObsSpc").value.trim() : "",
    equipamentoDevolvido,
    dataDevolucao: equipamentoDevolvido !== "nao" ? document.getElementById("fDataDevolucao").value || null : null,
    observacaoDevolucao: equipamentoDevolvido !== "nao" ? document.getElementById("fObsDevolucao").value.trim() : "",
    status: equipamentoDevolvido,
    ativo: true,
    updatedAt: serverTimestamp(),
    updatedBy: usuarioAtual.email,
  };

  try {
    if (clienteId) {
      await salvarEdicao(clienteId, payload);
      showToast("Cliente atualizado com sucesso.", "success");
    } else {
      payload.createdAt = serverTimestamp();
      payload.createdBy = usuarioAtual.email;
      const novoId = await salvarNovo(payload);
      clienteId = novoId;
      showToast("Cliente cadastrado com sucesso.", "success");
    }
    window.location.href = `cliente-detalhes.html?id=${clienteId}`;
  } catch (err) {
    console.error(err);
    showToast("Não foi possível salvar o cliente.", "error");
    btn.disabled = false;
    btnLabel.textContent = "Salvar cliente";
  }
}

async function salvarNovo(payload) {
  const ref = await addDoc(collection(db, "clientes_cancelados"), payload);
  const equipamentos = lerEquipamentosDoDOM();
  for (const eq of equipamentos) {
    await addDoc(collection(db, "clientes_cancelados", ref.id, "equipamentos"), {
      tipo: eq.tipo,
      marca: eq.marca,
      modelo: eq.modelo,
      numeroSerie: eq.numeroSerie,
      macAddress: eq.macAddress,
      status: eq.status,
      observacao: eq.observacao,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await registrarHistorico(
    ref.id,
    usuarioAtual,
    "Cliente cadastrado",
    `Cadastrou o cliente ${payload.nome} no sistema${equipamentos.length ? ` com ${equipamentos.length} equipamento(s)` : ""}.`
  );
  if (payload.spcSerasa) {
    await registrarHistorico(ref.id, usuarioAtual, "SPC/SERASA", `Registrou a inclusão de ${payload.nome} no SPC/SERASA.`);
  }
  return ref.id;
}

async function salvarEdicao(id, payload) {
  const ref = doc(db, "clientes_cancelados", id);
  await updateDoc(ref, payload);

  // Diferenças relevantes no cliente
  if (originalCliente) {
    if (Boolean(originalCliente.spcSerasa) !== payload.spcSerasa) {
      await registrarHistorico(
        id,
        usuarioAtual,
        "Situação SPC/SERASA atualizada",
        payload.spcSerasa
          ? `Registrou a inclusão de ${payload.nome} no SPC/SERASA.`
          : `Removeu ${payload.nome} do SPC/SERASA.`
      );
    }
    if ((originalCliente.equipamentoDevolvido || "nao") !== payload.equipamentoDevolvido) {
      await registrarHistorico(
        id,
        usuarioAtual,
        "Devolução de equipamentos atualizada",
        `Alterou a devolução de equipamentos de "${rotuloDevolucao(originalCliente.equipamentoDevolvido)}" para "${rotuloDevolucao(payload.equipamentoDevolvido)}".`
      );
    }
    if (
      originalCliente.nome !== payload.nome ||
      originalCliente.cpf !== payload.cpf ||
      (originalCliente.telefone || "") !== (payload.telefone || "") ||
      (originalCliente.valor ?? null) !== (payload.valor ?? null) ||
      toDateInputValue(originalCliente.dataCancelamento) !== payload.dataCancelamento
    ) {
      await registrarHistorico(id, usuarioAtual, "Dados do cliente atualizados", `Atualizou os dados cadastrais de ${payload.nome}.`);
    }
  }

  // Equipamentos: diff entre o que existia e o que está no formulário
  const equipamentosAtuais = lerEquipamentosDoDOM();
  const idsPresentes = new Set();

  for (const eq of equipamentosAtuais) {
    const label = `${eq.tipo}${eq.modelo ? " " + eq.modelo : ""}`;
    if (eq.docId) {
      idsPresentes.add(eq.docId);
      const original = originalEquipMap.get(eq.docId);
      const equipRef = doc(db, "clientes_cancelados", id, "equipamentos", eq.docId);
      await updateDoc(equipRef, {
        tipo: eq.tipo,
        marca: eq.marca,
        modelo: eq.modelo,
        numeroSerie: eq.numeroSerie,
        macAddress: eq.macAddress,
        status: eq.status,
        observacao: eq.observacao,
        updatedAt: serverTimestamp(),
      });
      if (original && original.status !== eq.status) {
        await registrarHistorico(
          id,
          usuarioAtual,
          "Status do equipamento alterado",
          `Alterou o status do equipamento ${label} de "${original.status}" para "${eq.status}".`
        );
      }
    } else {
      const novoRef = await addDoc(collection(db, "clientes_cancelados", id, "equipamentos"), {
        tipo: eq.tipo,
        marca: eq.marca,
        modelo: eq.modelo,
        numeroSerie: eq.numeroSerie,
        macAddress: eq.macAddress,
        status: eq.status,
        observacao: eq.observacao,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      idsPresentes.add(novoRef.id);
      await registrarHistorico(id, usuarioAtual, "Equipamento adicionado", `Adicionou o equipamento ${label} com status "${eq.status}".`);
    }
  }

  for (const [oldId, oldData] of originalEquipMap.entries()) {
    if (!idsPresentes.has(oldId)) {
      await deleteDoc(doc(db, "clientes_cancelados", id, "equipamentos", oldId));
      const label = `${oldData.tipo}${oldData.modelo ? " " + oldData.modelo : ""}`;
      await registrarHistorico(id, usuarioAtual, "Equipamento removido", `Removeu o equipamento ${label} do cadastro.`);
    }
  }
}

function rotuloDevolucao(v) {
  if (v === "sim") return "Devolvido";
  if (v === "parcial") return "Parcialmente devolvido";
  return "Pendente";
}
