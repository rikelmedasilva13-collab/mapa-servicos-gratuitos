"use strict";

const lista = document.getElementById("lista-servicos");
const busca = document.getElementById("busca");
const categoria = document.getElementById("categoria");
const municipio = document.getElementById("municipio");
const contador = document.getElementById("contador");
const formAdd = document.getElementById("formAdd");
const erro = document.getElementById("erro");
const CHAVE_PESSOAIS = "servicosPessoaisV2";

let oficiais = [];
let pessoais = carregarPessoais();

function normalizar(valor) {
    return String(valor || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function carregarPessoais() {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_PESSOAIS) || "[]");
        return Array.isArray(salvo) ? salvo : [];
    } catch (e) {
        console.warn("Cadastros locais não puderam ser lidos:", e);
        return [];
    }
}

function salvarPessoais() {
    try {
        localStorage.setItem(CHAVE_PESSOAIS, JSON.stringify(pessoais));
        return true;
    } catch (e) {
        console.warn("Não foi possível salvar no navegador:", e);
        return false;
    }
}

function todosServicos() { return [...oficiais, ...pessoais]; }

function texto(tag, valor, classe = "") {
    const el = document.createElement(tag);
    el.textContent = valor;
    if (classe) el.className = classe;
    return el;
}

function linhaRotulada(rotulo, valor, classe = "") {
    const p = document.createElement("p");
    if (classe) p.className = classe;
    const strong = texto("strong", `${rotulo}: `);
    p.append(strong, document.createTextNode(valor || "Não informado"));
    return p;
}

function urlSegura(valor) {
    try {
        const url = new URL(valor);
        return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

function iconeCategoria(categoriaServico) {
    const cat = normalizar(categoriaServico);
    if (cat.includes("saude")) return "heart-pulse";
    if (cat.includes("educacao")) return "graduation-cap";
    if (cat.includes("emprego")) return "briefcase-business";
    if (cat.includes("assistencia social")) return "hand-heart";
    return "map-pin";
}

function excluirServicoPessoal(item) {
    if (!window.confirm(`Excluir o serviço "${item.nome}" deste navegador?`)) return;
    const indice = pessoais.indexOf(item);
    if (indice < 0) return;
    pessoais.splice(indice, 1);
    if (!salvarPessoais()) {
        pessoais.splice(indice, 0, item);
        window.alert("Não foi possível excluir o serviço. Tente novamente.");
        return;
    }
    filtrar();
}

function criarCard(item) {
    const card = document.createElement("article");
    card.className = "card";
    const cabecalho = document.createElement("div");
    cabecalho.className = "card-cabecalho";
    const simbolo = document.createElement("i");
    simbolo.setAttribute("data-lucide", iconeCategoria(item.categoria));
    simbolo.className = "card-icone";
    simbolo.setAttribute("aria-hidden", "true");
    cabecalho.appendChild(simbolo);
    cabecalho.appendChild(texto("h2", item.nome));
    card.appendChild(cabecalho);
    card.appendChild(linhaRotulada("Categoria", item.categoria));
    card.appendChild(linhaRotulada("Município", item.municipio, "cidade"));
    card.appendChild(linhaRotulada("Endereço", item.endereco));
    card.appendChild(texto("p", item.descricao));
    if (item.pessoal) card.appendChild(texto("p", "Cadastro salvo neste navegador", "pessoal"));

    const links = document.createElement("div");
    links.className = "card-links";
    const externo = urlSegura(item.link);
    if (externo) {
        const a = texto("a", "Mais informações");
        a.href = externo;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        links.appendChild(a);
    }
    if (item.endereco && item.municipio) {
        const enderecoCompleto = `${item.endereco}, ${item.municipio}, SP, Brasil`;
        const maps = texto("a", "Ver localização");
        maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
        maps.target = "_blank";
        maps.rel = "noopener noreferrer";
        links.appendChild(maps);
    }
    card.appendChild(links);
    if (item.pessoal) {
        const excluir = texto("button", "Excluir serviço", "btn-excluir");
        excluir.type = "button";
        excluir.setAttribute("aria-label", `Excluir ${item.nome}`);
        excluir.addEventListener("click", () => excluirServicoPessoal(item));
        card.appendChild(excluir);
    }
    return card;
}

function filtrar() {
    const termo = normalizar(busca.value);
    const cat = normalizar(categoria.value);
    const cidade = normalizar(municipio.value);
    const filtrados = todosServicos().filter(item => {
        const textoBusca = normalizar(`${item.nome} ${item.descricao} ${item.endereco} ${item.categoria} ${item.municipio}`);
        const categorias = String(item.categoria || "").split("/").map(normalizar);
        return textoBusca.includes(termo)
            && (!cat || categorias.some(parte => parte === cat || parte.startsWith(cat + " ")))
            && (!cidade || normalizar(item.municipio) === cidade);
    });
    lista.replaceChildren();
    if (!filtrados.length) {
        lista.appendChild(texto("p", "Nenhum serviço encontrado para esses filtros."));
    } else {
        const fragmento = document.createDocumentFragment();
        filtrados.forEach(item => fragmento.appendChild(criarCard(item)));
        lista.appendChild(fragmento);
    }
    if (window.lucide) window.lucide.createIcons({ nodes: [lista] });
    contador.textContent = `${filtrados.length} serviço(s) encontrado(s)`;
}

function migrarCadastrosAntigos() {
    // A versão anterior armazenava também uma cópia do JSON no localStorage.
    // Importamos somente itens que não correspondem aos serviços oficiais.
    if (localStorage.getItem("migracaoServicosV2") === "ok") return;
    try {
        const antigos = JSON.parse(localStorage.getItem("dadosServicos") || "[]");
        if (Array.isArray(antigos)) {
            for (const item of antigos) {
                if (!item || !item.nome || !item.endereco) continue;
                const municipioInferido = item.municipio ||
                    (normalizar(item.endereco).includes("salesopolis") ? "Salesópolis" : "Biritiba Mirim");
                const existe = todosServicos().some(atual =>
                    normalizar(atual.nome) === normalizar(item.nome) &&
                    normalizar(atual.municipio) === normalizar(municipioInferido));
                if (!existe) pessoais.push({ ...item, municipio: municipioInferido, pessoal: true });
            }
            if (!salvarPessoais()) return;
        }
        localStorage.setItem("migracaoServicosV2", "ok");
    } catch (e) { console.warn("Não foi possível migrar cadastros anteriores:", e); }
}

async function iniciar() {
    try {
        const resposta = await fetch("dados.json");
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        oficiais = await resposta.json();
        if (!Array.isArray(oficiais)) throw new Error("Formato do JSON inválido");
        migrarCadastrosAntigos();
        filtrar();
    } catch (e) {
        console.error("Erro ao carregar os serviços:", e);
        lista.replaceChildren(texto("p", "Não foi possível carregar os serviços. Abra o projeto pelo Live Server."));
        contador.textContent = "";
    }
}

busca.addEventListener("input", filtrar);
categoria.addEventListener("change", filtrar);
municipio.addEventListener("change", filtrar);
document.getElementById("btnLimpar").addEventListener("click", () => {
    busca.value = ""; categoria.value = ""; municipio.value = ""; filtrar();
});

document.getElementById("btnAdd").addEventListener("click", () => {
    formAdd.classList.toggle("hidden");
    document.getElementById("btnAdd").setAttribute("aria-expanded", String(!formAdd.classList.contains("hidden")));
});

document.getElementById("btnSalvar").addEventListener("click", () => {
    erro.textContent = "";
    const nome = document.getElementById("addNome").value.trim();
    const municipioVal = document.getElementById("addMunicipio").value;
    const categoriaVal = document.getElementById("addCategoria").value;
    const endereco = document.getElementById("addEndereco").value.trim();
    const descricao = document.getElementById("addDescricao").value.trim();
    const link = document.getElementById("addLink").value.trim();

    if (!nome || !municipioVal || !categoriaVal || !endereco || !descricao) {
        erro.textContent = "Preencha todos os campos obrigatórios."; return;
    }
    if (link && !urlSegura(link)) {
        erro.textContent = "O link deve começar com https:// ou http://"; return;
    }
    const duplicado = todosServicos().some(item =>
        normalizar(item.nome) === normalizar(nome) && normalizar(item.municipio) === normalizar(municipioVal));
    if (duplicado) { erro.textContent = "Já existe um serviço com esse nome nesse município."; return; }

    pessoais.push({ nome, municipio: municipioVal, categoria: categoriaVal, endereco, descricao, link, pessoal: true });
    if (!salvarPessoais()) {
        pessoais.pop(); erro.textContent = "Não foi possível salvar no navegador."; return;
    }
    document.querySelectorAll("#formAdd input").forEach(input => input.value = "");
    document.getElementById("addCategoria").value = "";
    document.getElementById("addMunicipio").value = "";
    formAdd.classList.add("hidden");
    document.getElementById("btnAdd").setAttribute("aria-expanded", "false");
    filtrar();
});

iniciar();
