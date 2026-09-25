const STORAGE_KEY = "rmslogis:data";

const menuItems = [
    ["dashboard", "Dashboard", "dashboard.html"],
    ["entregadores", "Entregadores", "entregadores.html"],
    ["nova-saida", "Nova Saida", "nova_Saida.html"],
    ["fechamento", "Fechamento", "fechamento.html"],
    ["historico", "Historico", "historico.html"],
    ["fechamento-semanal", "Fechamento Semanal", "fechamento_Semanal.html"],
    ["pagamentos", "Pagamentos", "pagamentos.html"],
    ["configuracoes", "Configuracoes", "configuracoes.html"]
];

const today = new Date().toISOString().slice(0, 10);

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const seedData = {
    settings: {
        empresa: "RMSLogis",
        operador: "Operador 01",
        valorPacote: 1
    },
    user: null,
    drivers: [
        { id: makeId(), nome: "Joao Silva", telefone: "(21) 98888-0101", veiculo: "Moto", status: "Ativo" },
        { id: makeId(), nome: "Pedro Santos", telefone: "(21) 97777-0202", veiculo: "Moto", status: "Ativo" },
        { id: makeId(), nome: "Carlos Souza", telefone: "(21) 96666-0303", veiculo: "Carro", status: "Ativo" }
    ],
    routes: []
};

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        saveData(seedData);
        return JSON.parse(JSON.stringify(seedData));
    }

    try {
        const data = JSON.parse(raw);
        return {
            ...JSON.parse(JSON.stringify(seedData)),
            ...data,
            settings: { ...seedData.settings, ...data.settings }
        };
    } catch {
        saveData(seedData);
        return JSON.parse(JSON.stringify(seedData));
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let state = loadData();

function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
    if (!value) return "-";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function getDriver(id) {
    return state.drivers.find((driver) => driver.id === id);
}

function routeTotal(route) {
    return Math.max(0, Number(route.entregues || 0) * Number(route.valorPacote || 0) - Number(route.desconto || 0));
}

function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
        element.textContent = value;
    });
}

function toast(message) {
    const oldToast = document.querySelector(".toast");
    if (oldToast) oldToast.remove();

    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2800);
}

function renderShell(page) {
    const menu = document.querySelector(".menu");
    if (menu) {
        menu.innerHTML = menuItems.map(([key, label, href]) => (
            `<a href="${href}" class="${key === page ? "active" : ""}">${label}</a>`
        )).join("");
    }

    setText("[data-user]", state.user || state.settings.operador);
}

function ensureLogged(page) {
    if (page !== "login" && !state.user) {
        state.user = state.settings.operador;
        saveData(state);
    }
}

function renderEmpty(tbody, columns, message) {
    tbody.innerHTML = `<tr><td class="empty-row" colspan="${columns}">${message}</td></tr>`;
}

function dashboardMetrics() {
    const todaysRoutes = state.routes.filter((route) => route.data === today);
    const closedToday = todaysRoutes.filter((route) => route.status === "Fechado");

    return {
        activeDrivers: state.drivers.filter((driver) => driver.status === "Ativo").length,
        packagesOut: todaysRoutes.reduce((sum, route) => sum + Number(route.saida || 0), 0),
        delivered: closedToday.reduce((sum, route) => sum + Number(route.entregues || 0), 0),
        returned: closedToday.reduce((sum, route) => sum + Number(route.retornados || 0), 0),
        totalValue: closedToday.reduce((sum, route) => sum + routeTotal(route), 0)
    };
}

function renderDashboard() {
    const metrics = dashboardMetrics();
    setText('[data-metric="activeDrivers"]', metrics.activeDrivers);
    setText('[data-metric="packagesOut"]', metrics.packagesOut);
    setText('[data-metric="delivered"]', metrics.delivered);
    setText('[data-metric="returned"]', metrics.returned);
    setText('[data-metric="totalValue"]', money(metrics.totalValue));
    setText("[data-today-title]", `Resumo de hoje - ${formatDate(today)}`);

    const tbody = document.querySelector("[data-dashboard-table]");
    if (!tbody) return;

    const todaysRoutes = state.routes.filter((route) => route.data === today);
    setText("[data-record-count]", `${todaysRoutes.length} registros`);

    if (!todaysRoutes.length) {
        renderEmpty(tbody, 6, "Nenhuma saida registrada hoje.");
        return;
    }

    tbody.innerHTML = todaysRoutes.map((route) => {
        const driver = getDriver(route.driverId);
        const statusClass = route.status === "Fechado" ? "status-fechado" : "status-aberto";
        return `
            <tr>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${route.saida}</td>
                <td>${route.entregues || 0}</td>
                <td>${route.retornados || 0}</td>
                <td>${money(routeTotal(route))}</td>
                <td><span class="status ${statusClass}">${route.status}</span></td>
            </tr>
        `;
    }).join("");
}

function renderDrivers() {
    const tbody = document.querySelector("[data-drivers-table]");
    if (!tbody) return;

    setText("[data-driver-count]", `${state.drivers.length} cadastrados`);

    if (!state.drivers.length) {
        renderEmpty(tbody, 5, "Nenhum entregador cadastrado.");
        return;
    }

    tbody.innerHTML = state.drivers.map((driver) => `
        <tr>
            <td>${driver.nome}</td>
            <td>${driver.telefone}</td>
            <td>${driver.veiculo}</td>
            <td><span class="status ${driver.status === "Ativo" ? "status-ativo" : "status-inativo"}">${driver.status}</span></td>
            <td>
                <button class="btn btn-small btn-muted" data-toggle-driver="${driver.id}" type="button">
                    ${driver.status === "Ativo" ? "Inativar" : "Ativar"}
                </button>
            </td>
        </tr>
    `).join("");
}

function fillDriverSelects() {
    document.querySelectorAll("[data-driver-select]").forEach((select) => {
        const activeDrivers = state.drivers.filter((driver) => driver.status === "Ativo");
        select.innerHTML = activeDrivers.length
            ? activeDrivers.map((driver) => `<option value="${driver.id}">${driver.nome}</option>`).join("")
            : '<option value="">Cadastre um entregador ativo</option>';
    });
}

function fillRouteSelects() {
    document.querySelectorAll("[data-route-select]").forEach((select) => {
        const openRoutes = state.routes.filter((route) => route.status === "Aberto");
        select.innerHTML = openRoutes.length
            ? openRoutes.map((route) => {
                const driver = getDriver(route.driverId);
                return `<option value="${route.id}">${formatDate(route.data)} - ${driver?.nome || "Entregador"} - ${route.saida} pacotes</option>`;
            }).join("")
            : '<option value="">Nenhuma saida em aberto</option>';
    });
}

function renderOpenRoutes() {
    const tbody = document.querySelector("[data-open-routes-table]");
    if (!tbody) return;

    const openRoutes = state.routes.filter((route) => route.status === "Aberto");
    setText("[data-open-count]", `${openRoutes.length} abertas`);

    if (!openRoutes.length) {
        renderEmpty(tbody, 5, "Nenhuma saida em aberto.");
        return;
    }

    tbody.innerHTML = openRoutes.map((route) => {
        const driver = getDriver(route.driverId);
        return `
            <tr>
                <td>${formatDate(route.data)}</td>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${route.saida}</td>
                <td>${money(route.valorPacote)}</td>
                <td><span class="status status-aberto">Aberto</span></td>
            </tr>
        `;
    }).join("");
}

function renderClosedRoutes() {
    const tbody = document.querySelector("[data-closed-table]");
    if (!tbody) return;

    const closedRoutes = state.routes.filter((route) => route.status === "Fechado").slice().reverse();
    setText("[data-closed-count]", `${closedRoutes.length} fechados`);

    if (!closedRoutes.length) {
        renderEmpty(tbody, 6, "Nenhum fechamento realizado.");
        return;
    }

    tbody.innerHTML = closedRoutes.map((route) => {
        const driver = getDriver(route.driverId);
        return `
            <tr>
                <td>${formatDate(route.data)}</td>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${route.saida}</td>
                <td>${route.entregues}</td>
                <td>${route.retornados}</td>
                <td>${money(routeTotal(route))}</td>
            </tr>
        `;
    }).join("");
}

function renderHistory(filter = "") {
    const tbody = document.querySelector("[data-history-table]");
    if (!tbody) return;

    const term = filter.toLowerCase().trim();
    const rows = state.routes.filter((route) => {
        const driver = getDriver(route.driverId);
        const text = `${driver?.nome || ""} ${route.data} ${route.status}`.toLowerCase();
        return text.includes(term);
    }).slice().reverse();

    setText("[data-history-count]", `${rows.length} registros`);

    if (!rows.length) {
        renderEmpty(tbody, 7, "Nenhum registro encontrado.");
        return;
    }

    tbody.innerHTML = rows.map((route) => {
        const driver = getDriver(route.driverId);
        const statusClass = route.status === "Fechado" ? "status-fechado" : "status-aberto";
        return `
            <tr>
                <td>${formatDate(route.data)}</td>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${route.saida}</td>
                <td>${route.entregues || 0}</td>
                <td>${route.retornados || 0}</td>
                <td>${money(routeTotal(route))}</td>
                <td><span class="status ${statusClass}">${route.status}</span></td>
            </tr>
        `;
    }).join("");
}

function renderWeek() {
    const closedRoutes = state.routes.filter((route) => route.status === "Fechado");
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekRoutes = closedRoutes.filter((route) => new Date(`${route.data}T00:00:00`) >= weekStart);
    const byDriver = new Map();

    weekRoutes.forEach((route) => {
        const item = byDriver.get(route.driverId) || { saidas: 0, entregues: 0, retornados: 0, total: 0 };
        item.saidas += Number(route.saida || 0);
        item.entregues += Number(route.entregues || 0);
        item.retornados += Number(route.retornados || 0);
        item.total += routeTotal(route);
        byDriver.set(route.driverId, item);
    });

    setText('[data-week="delivered"]', weekRoutes.reduce((sum, route) => sum + Number(route.entregues || 0), 0));
    setText('[data-week="returned"]', weekRoutes.reduce((sum, route) => sum + Number(route.retornados || 0), 0));
    setText('[data-week="value"]', money(weekRoutes.reduce((sum, route) => sum + routeTotal(route), 0)));
    setText('[data-week="drivers"]', byDriver.size);

    const tbody = document.querySelector("[data-week-table]");
    if (!tbody) return;

    if (!byDriver.size) {
        renderEmpty(tbody, 5, "Nenhum fechamento nos ultimos 7 dias.");
        return;
    }

    tbody.innerHTML = [...byDriver.entries()].map(([driverId, item]) => {
        const driver = getDriver(driverId);
        return `
            <tr>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${item.saidas}</td>
                <td>${item.entregues}</td>
                <td>${item.retornados}</td>
                <td>${money(item.total)}</td>
            </tr>
        `;
    }).join("");
}

function renderPayments() {
    const tbody = document.querySelector("[data-payments-table]");
    if (!tbody) return;

    const closedRoutes = state.routes.filter((route) => route.status === "Fechado");
    const pending = closedRoutes.filter((route) => route.pagamento !== "Pago");
    const paid = closedRoutes.filter((route) => route.pagamento === "Pago");

    setText('[data-payments="pending"]', money(pending.reduce((sum, route) => sum + routeTotal(route), 0)));
    setText('[data-payments="paid"]', money(paid.reduce((sum, route) => sum + routeTotal(route), 0)));
    setText("[data-payment-count]", `${closedRoutes.length} itens`);

    if (!closedRoutes.length) {
        renderEmpty(tbody, 5, "Nenhum fechamento disponivel para pagamento.");
        return;
    }

    tbody.innerHTML = closedRoutes.slice().reverse().map((route) => {
        const driver = getDriver(route.driverId);
        const isPaid = route.pagamento === "Pago";
        return `
            <tr>
                <td>${formatDate(route.data)}</td>
                <td>${driver?.nome || "Entregador removido"}</td>
                <td>${money(routeTotal(route))}</td>
                <td><span class="status ${isPaid ? "status-pago" : "status-pendente"}">${isPaid ? "Pago" : "Pendente"}</span></td>
                <td>
                    <button class="btn btn-small ${isPaid ? "btn-muted" : "btn-primary"}" data-pay-route="${route.id}" type="button">
                        ${isPaid ? "Desfazer" : "Marcar pago"}
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderSettings() {
    const form = document.querySelector('[data-form="settings"]');
    if (!form) return;

    form.empresa.value = state.settings.empresa;
    form.operador.value = state.settings.operador;
    form.valorPacote.value = state.settings.valorPacote;
}

function setupForms() {
    const loginForm = document.querySelector("#loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            state.user = new FormData(loginForm).get("username").trim() || state.settings.operador;
            saveData(state);
            window.location.href = "dashboard.html";
        });
    }

    const driverForm = document.querySelector('[data-form="driver"]');
    if (driverForm) {
        driverForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(driverForm));
            state.drivers.push({ id: makeId(), ...data });
            saveData(state);
            driverForm.reset();
            renderDrivers();
            fillDriverSelects();
            toast("Entregador cadastrado.");
        });
    }

    const routeForm = document.querySelector('[data-form="route"]');
    if (routeForm) {
        routeForm.data.value = today;
        routeForm.valorPacote.value = state.settings.valorPacote;
        routeForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(routeForm));
            if (!data.driverId) {
                toast("Cadastre um entregador ativo antes de registrar saida.");
                return;
            }

            state.routes.push({
                id: makeId(),
                data: data.data,
                driverId: data.driverId,
                saida: Number(data.saida),
                valorPacote: Number(data.valorPacote),
                observacao: data.observacao,
                status: "Aberto",
                entregues: 0,
                retornados: 0,
                desconto: 0,
                pagamento: "Pendente"
            });
            saveData(state);
            routeForm.reset();
            routeForm.data.value = today;
            routeForm.valorPacote.value = state.settings.valorPacote;
            renderOpenRoutes();
            toast("Saida registrada.");
        });
    }

    const closeForm = document.querySelector('[data-form="close-route"]');
    if (closeForm) {
        closeForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(closeForm));
            const route = state.routes.find((item) => item.id === data.routeId);
            if (!route) {
                toast("Nenhuma saida em aberto selecionada.");
                return;
            }

            const entregues = Number(data.entregues);
            const retornados = Number(data.retornados);
            if (entregues + retornados !== Number(route.saida)) {
                toast("Entregues + retornados precisa bater com a saida.");
                return;
            }

            route.entregues = entregues;
            route.retornados = retornados;
            route.desconto = Number(data.desconto || 0);
            route.status = "Fechado";
            route.pagamento = "Pendente";
            saveData(state);
            closeForm.reset();
            fillRouteSelects();
            renderClosedRoutes();
            toast("Fechamento salvo.");
        });
    }

    const settingsForm = document.querySelector('[data-form="settings"]');
    if (settingsForm) {
        settingsForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(settingsForm));
            state.settings = {
                empresa: data.empresa,
                operador: data.operador,
                valorPacote: Number(data.valorPacote)
            };
            if (!state.user) state.user = state.settings.operador;
            saveData(state);
            renderShell(document.body.dataset.page);
            toast("Configuracoes salvas.");
        });
    }
}

function setupActions() {
    document.addEventListener("click", (event) => {
        const toggleDriverButton = event.target.closest("[data-toggle-driver]");
        if (toggleDriverButton) {
            const driver = getDriver(toggleDriverButton.dataset.toggleDriver);
            if (driver) {
                driver.status = driver.status === "Ativo" ? "Inativo" : "Ativo";
                saveData(state);
                renderDrivers();
                toast("Status atualizado.");
            }
        }

        const payButton = event.target.closest("[data-pay-route]");
        if (payButton) {
            const route = state.routes.find((item) => item.id === payButton.dataset.payRoute);
            if (route) {
                route.pagamento = route.pagamento === "Pago" ? "Pendente" : "Pago";
                saveData(state);
                renderPayments();
                toast("Pagamento atualizado.");
            }
        }

        const resetButton = event.target.closest("[data-reset-system]");
        if (resetButton && confirm("Deseja apagar todos os dados locais do sistema?")) {
            localStorage.removeItem(STORAGE_KEY);
            state = loadData();
            renderSettings();
            renderShell(document.body.dataset.page);
            toast("Base local reiniciada.");
        }

        const exportButton = event.target.closest("[data-export-history]");
        if (exportButton) {
            exportHistory();
        }
    });

    const search = document.querySelector("[data-search-history]");
    if (search) {
        search.addEventListener("input", () => renderHistory(search.value));
    }
}

function exportHistory() {
    const header = ["Data", "Entregador", "Saida", "Entregues", "Retornados", "Valor", "Status"];
    const rows = state.routes.map((route) => {
        const driver = getDriver(route.driverId);
        return [
            formatDate(route.data),
            driver?.nome || "Entregador removido",
            route.saida,
            route.entregues || 0,
            route.retornados || 0,
            routeTotal(route).toFixed(2).replace(".", ","),
            route.status
        ];
    });

    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historico-rmslogis.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function renderPage() {
    const page = document.body.dataset.page;
    ensureLogged(page);
    renderShell(page);
    setupForms();
    setupActions();
    fillDriverSelects();
    fillRouteSelects();
    renderDashboard();
    renderDrivers();
    renderOpenRoutes();
    renderClosedRoutes();
    renderHistory();
    renderWeek();
    renderPayments();
    renderSettings();
}

document.addEventListener("DOMContentLoaded", renderPage);
