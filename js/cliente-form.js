// ============================================================================
// js/cliente-form.js
// ============================================================================
import { db } from "./firebase-config.js";
import { mountShell, requireAuth, currentUserInfo } from "./app-shell.js";
import {
  attachCpfCnpjMask,
  isValidCpfCnpj,
  attachTelefoneMask,
  attachMoedaMask,
  moedaParaNumero,
  isoToBR,
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

let syncTel1Flags = () => {};
let syncTel2Flags = () => {};

let syncObsValor = () => {};

function wireObsValor() {
  const valorInput = document.getElementById("fValor");
  const bloco = document.getElementById("obsValorBlock");
  const sync = () => bloco.classList.toggle("hidden", valorInput.value.trim().length === 0);
  valorInput.addEventListener("input", sync);
  sync();
  return sync;
}

function wirePhoneFlags(inputId, semWhatsId, naoFuncId) {
  const input = document.getElementById(inputId);
  const semWhats = document.getElementById(semWhatsId);
  const naoFunc = document.getElementById(naoFuncId);

  function sync() {
    const hasValue = input.value.trim().length > 0;
    naoFunc.disabled = !hasValue;
    if (!hasValue) {
      naoFunc.checked = false;
      semWhats.checked = false;
    }
    if (naoFunc.checked) semWhats.checked = true;
    semWhats.disabled = !hasValue || naoFunc.checked;
  }

  input.addEventListener("input", sync);
  naoFunc.addEventListener("change", sync);
  semWhats.addEventListener("change", sync);
  sync();
  return sync;
}

function wireAccordion() {
  const sections = document.querySelectorAll(".accordion-section");
  sections.forEach((section) => {
    const toggle = section.querySelector(".accordion-toggle");
    toggle.addEventListener("click", () => {
      const isOpen = section.classList.contains("open");
      sections.forEach((s) => s.classList.remove("open"));
      if (!isOpen) section.classList.add("open");
    });
  });
  atualizarConclusaoSecoes();
}

function abrirSecao(numero) {
  document.querySelectorAll(".accordion-section").forEach((s) => {
    s.classList.toggle("open", s.dataset.section === String(numero));
  });
  document
    .querySelector(`.accordion-section[data-section="${numero}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Marca com um "check" verde as seções cujos campos obrigatórios já estão preenchidos. */
let checarSecao1 = () => {};

function atualizarConclusaoSecoes() {
  const marcar = (numero, ok) => {
    const check = document.querySelector(`.accordion-section[data-section="${numero}"] [data-check]`);
    if (check) check.classList.toggle("done", ok);
  };

  checarSecao1 = () => {
    const ok =
      document.getElementById("fNome").value.trim().length > 0 &&
      document.getElementById("fCpf").value.trim().length > 0 &&
      document.getElementById("fDataCancelamento").value.length > 0;
    marcar(1, ok);
  };
  checarSecao1();

  ["fNome", "fCpf", "fDataCancelamento", "fEndereco", "fTelefone1", "fTelefone2", "fValor"].forEach((id) => {
    document.getElementById(id).addEventListener("input", checarSecao1);
  });
}

function wireStaticUI() {
  wireAccordion();
  attachCpfCnpjMask(document.getElementById("fCpf"));
  attachTelefoneMask(document.getElementById("fTelefone1"));
  attachTelefoneMask(document.getElementById("fTelefone2"));
  syncTel1Flags = wirePhoneFlags("fTelefone1", "fTel1SemWhats", "fTel1NaoFunciona");
  syncTel2Flags = wirePhoneFlags("fTelefone2", "fTel2SemWhats", "fTel2NaoFunciona");
  attachMoedaMask(document.getElementById("fValor"));
  syncObsValor = wireObsValor();

  wireRadioGroup("spcGroup", "spc", "spcCondicional");
  wireRadioGroup("devolucaoGroup", "devolucao", "devolucaoCondicional");
  wireRadioGroup("promessaGroup", "promessa", "promessaCondicional");

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
    document.getElementById("fEndereco").value = c.endereco || "";
    document.getElementById("fTelefone1").value = c.telefone1 || c.telefone || "";
    document.getElementById("fTelefone2").value = c.telefone2 || "";
    document.getElementById("fTel1SemWhats").checked = Boolean(c.telefone1SemWhatsapp);
    document.getElementById("fTel1NaoFunciona").checked = Boolean(c.telefone1NaoFunciona);
    document.getElementById("fTel2SemWhats").checked = Boolean(c.telefone2SemWhatsapp);
    document.getElementById("fTel2NaoFunciona").checked = Boolean(c.telefone2NaoFunciona);
    syncTel1Flags();
    syncTel2Flags();
    document.getElementById("fDataCancelamento").value = toDateInputValue(c.dataCancelamento);
    document.getElementById("fValor").value =
      c.valor !== undefined && c.valor !== null
        ? Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
    document.getElementById("fObsValor").value = c.observacaoValor || "";
    syncObsValor();

    const spcValue = c.spcSerasa ? "sim" : "nao";
    document.querySelector(`input[name="spc"][value="${spcValue}"]`).checked = true;
    document.getElementById("fDataSpc").value = toDateInputValue(c.dataSpcSerasa);
    document.getElementById("fObsSpc").value = c.observacaoSpc || "";

    const devValue = c.equipamentoDevolvido || "nao";
    document.querySelector(`input[name="devolucao"][value="${devValue}"]`).checked = true;
    document.getElementById("fDataDevolucao").value = toDateInputValue(c.dataDevolucao);
    document.getElementById("fObsDevolucao").value = c.observacaoDevolucao || "";

    const promessaValue = c.prometeuPagamento ? "sim" : "nao";
    document.querySelector(`input[name="promessa"][value="${promessaValue}"]`).checked = true;
    document.getElementById("fDataPromessa").value = toDateInputValue(c.dataPromessaPagamento);
    document.getElementById("fPagamentoRecebido").checked = Boolean(c.pagamentoRecebido);
    document.getElementById("fObsPromessa").value = c.observacaoPromessa || "";

    document.getElementById("spcGroup").querySelectorAll("input").forEach((i) => i.dispatchEvent(new Event("change")));
    document.getElementById("devolucaoGroup").querySelectorAll("input").forEach((i) => i.dispatchEvent(new Event("change")));
    document.getElementById("promessaGroup").querySelectorAll("input").forEach((i) => i.dispatchEvent(new Event("change")));

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
    checarSecao1();
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
  let secaoComErro = null;
  const nome = document.getElementById("fNome").value.trim();
  const cpf = document.getElementById("fCpf").value.trim();
  const dataCancelamento = document.getElementById("fDataCancelamento").value;

  setFieldError("fNome", "errNome", nome.length < 3);
  if (nome.length < 3) { valid = false; secaoComErro = secaoComErro || 1; }

  const cpfOk = isValidCpfCnpj(cpf);
  setFieldError("fCpf", "errCpf", !cpfOk);
  if (!cpfOk) { valid = false; secaoComErro = secaoComErro || 1; }

  const telefone1 = document.getElementById("fTelefone1").value.trim();
  const telefone1Digits = telefone1.replace(/\D/g, "");
  const telefone1Ok = telefone1Digits.length === 0 || telefone1Digits.length >= 10;
  setFieldError("fTelefone1", "errTelefone1", !telefone1Ok);
  if (!telefone1Ok) { valid = false; secaoComErro = secaoComErro || 1; }

  const telefone2 = document.getElementById("fTelefone2").value.trim();
  const telefone2Digits = telefone2.replace(/\D/g, "");
  const telefone2Ok = telefone2Digits.length === 0 || telefone2Digits.length >= 10;
  setFieldError("fTelefone2", "errTelefone2", !telefone2Ok);
  if (!telefone2Ok) { valid = false; secaoComErro = secaoComErro || 1; }

  setFieldError("fDataCancelamento", "errData", !dataCancelamento);
  if (!dataCancelamento) { valid = false; secaoComErro = secaoComErro || 1; }

  const prometeu = document.querySelector('input[name="promessa"]:checked').value === "sim";
  const dataPromessa = document.getElementById("fDataPromessa").value;
  setFieldError("fDataPromessa", "errDataPromessa", prometeu && !dataPromessa);
  if (prometeu && !dataPromessa) { valid = false; secaoComErro = secaoComErro || 4; }

  document.querySelectorAll(".accordion-section").forEach((s) => s.classList.remove("has-error"));
  if (secaoComErro) {
    abrirSecao(secaoComErro);
    document.querySelector(`.accordion-section[data-section="${secaoComErro}"]`)?.classList.add("has-error");
  }

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
  const prometeuPagamento = document.querySelector('input[name="promessa"]:checked').value === "sim";
  const pagamentoRecebido = prometeuPagamento && document.getElementById("fPagamentoRecebido").checked;

  const payload = {
    nome,
    cpf: document.getElementById("fCpf").value.trim(),
    endereco: document.getElementById("fEndereco").value.trim(),
    telefone1: document.getElementById("fTelefone1").value.trim(),
    telefone1SemWhatsapp: document.getElementById("fTel1SemWhats").checked,
    telefone1NaoFunciona: document.getElementById("fTel1NaoFunciona").checked,
    telefone2: document.getElementById("fTelefone2").value.trim(),
    telefone2SemWhatsapp: document.getElementById("fTel2SemWhats").checked,
    telefone2NaoFunciona: document.getElementById("fTel2NaoFunciona").checked,
    valor: moedaParaNumero(document.getElementById("fValor").value.trim()),
    observacaoValor: document.getElementById("fValor").value.trim() ? document.getElementById("fObsValor").value.trim() : "",
    dataCancelamento: document.getElementById("fDataCancelamento").value,
    spcSerasa,
    dataSpcSerasa: spcSerasa ? document.getElementById("fDataSpc").value || null : null,
    observacaoSpc: spcSerasa ? document.getElementById("fObsSpc").value.trim() : "",
    equipamentoDevolvido,
    dataDevolucao: equipamentoDevolvido !== "nao" ? document.getElementById("fDataDevolucao").value || null : null,
    observacaoDevolucao: equipamentoDevolvido !== "nao" ? document.getElementById("fObsDevolucao").value.trim() : "",
    prometeuPagamento,
    dataPromessaPagamento: prometeuPagamento ? document.getElementById("fDataPromessa").value || null : null,
    pagamentoRecebido,
    observacaoPromessa: prometeuPagamento ? document.getElementById("fObsPromessa").value.trim() : "",
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
  if (payload.prometeuPagamento) {
    await registrarHistorico(
      ref.id,
      usuarioAtual,
      "Promessa de pagamento registrada",
      `Registrou promessa de pagamento de ${payload.nome} para ${isoToBR(payload.dataPromessaPagamento)}.`
    );
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
    if (Boolean(originalCliente.prometeuPagamento) !== payload.prometeuPagamento) {
      await registrarHistorico(
        id,
        usuarioAtual,
        "Promessa de pagamento atualizada",
        payload.prometeuPagamento
          ? `Registrou promessa de pagamento de ${payload.nome} para ${isoToBR(payload.dataPromessaPagamento)}.`
          : `Removeu a promessa de pagamento de ${payload.nome}.`
      );
    } else if (
      payload.prometeuPagamento &&
      (originalCliente.dataPromessaPagamento || null) !== payload.dataPromessaPagamento
    ) {
      await registrarHistorico(
        id,
        usuarioAtual,
        "Data da promessa atualizada",
        `Alterou a data prometida de ${payload.nome} para ${isoToBR(payload.dataPromessaPagamento)}.`
      );
    } else if (payload.prometeuPagamento && Boolean(originalCliente.pagamentoRecebido) !== payload.pagamentoRecebido) {
      await registrarHistorico(
        id,
        usuarioAtual,
        "Pagamento registrado",
        payload.pagamentoRecebido
          ? `Marcou o pagamento de ${payload.nome} como recebido.`
          : `Marcou o pagamento de ${payload.nome} como não recebido.`
      );
    }
    if (
      originalCliente.nome !== payload.nome ||
      originalCliente.cpf !== payload.cpf ||
      (originalCliente.endereco || "") !== (payload.endereco || "") ||
      (originalCliente.telefone1 || originalCliente.telefone || "") !== (payload.telefone1 || "") ||
      (originalCliente.telefone2 || "") !== (payload.telefone2 || "") ||
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
