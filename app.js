/**
 * ====================================================================
 * DOCUMENTATION INTERACTIVE API PRIOS E - app.js
 * ====================================================================
 */

let apiData = {};
let currentServiceId = '';
let currentMethodName = '';
let currentView = 'method'; // 'method' ou 'type'
let lastConsultedMethod = '';

// ====================================================================
// 1. CHARGEMENT ASYNCHRONE DES DONNÉES
// ====================================================================
fetch('api_data.json')
    .then(response => {
        if (!response.ok) throw new Error("Erreur HTTP " + response.status);
        return response.json();
    })
    .then(data => {
        apiData = data;
        const docDateEl = document.getElementById('doc-date');
        if (docDateEl) docDateEl.textContent = apiData.doc_date || "Non spécifiée";
        initApp();
    })
    .catch(error => {
        console.error("Erreur de chargement :", error);
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-danger shadow-sm my-4">
                    <strong>Erreur :</strong> Impossible de charger <code>api_data.json</code>.<br>
                    <small>Vérifiez la syntaxe JSON et assurez-vous d'utiliser un serveur web local.</small>
                </div>
            `;
        }
    });

// ====================================================================
// 2. UTILITAIRES & FORMATAGE
// ====================================================================
function escapeHtml(unsafe) {
    return (unsafe || '')
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cleanTypeName(typeStr) {
    if (!typeStr || typeof typeStr !== 'string') return "";
    return typeStr
        .replace(/^List</, '')
        .replace(/^Liste de /, '')
        .replace(/>$/, '')
        .replace(/^Objet de type /, '')
        .trim();
}

// Convertit un type en lien cliquable qui ouvre la fiche du type au centre
function linkify(typeStr) {
    if (!typeStr || typeof typeStr !== 'string') return "";

    const cleanType = cleanTypeName(typeStr);
    const escapedType = escapeHtml(typeStr);

    let exists = false;
    let targetServiceId = '';

    if (apiData.services && Array.isArray(apiData.services)) {
        for (let s of apiData.services) {
            if (s.types && s.types.some(t => t.name === cleanType)) {
                exists = true;
                targetServiceId = s.id;
                break;
            }
        }
    }

    if (exists) {
        const cleanTypeEscaped = escapeHtml(cleanType);
        return escapedType.replace(
            cleanTypeEscaped,
            `<a class="type-link" href="javascript:void(0)" onclick="selectType('${cleanTypeEscaped}', '${targetServiceId}')">${cleanTypeEscaped}</a>`
        );
    }

    return escapedType;
}

function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        const existingInstance = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (existingInstance) existingInstance.dispose();
        new bootstrap.Tooltip(tooltipTriggerEl, { delay: { show: 150, hide: 100 } });
    });
}

function toggleDescription(btn) {
    const container = btn.previousElementSibling;
    container.classList.toggle('expanded');
    btn.textContent = container.classList.contains('expanded') ? 'Voir moins' : 'Voir plus...';
}

// ====================================================================
// 3. CONTRÔLE DES VOLETS LATÉRAUX (Languettes)
// ====================================================================
function toggleLeftSidebar(forceState) {
    const body = document.body;
    if (typeof forceState === 'boolean') {
        body.classList.toggle('sidebar-left-collapsed', !forceState);
    } else {
        body.classList.toggle('sidebar-left-collapsed');
    }
    const isCollapsed = body.classList.contains('sidebar-left-collapsed');
    document.getElementById('leftTabIndicator').textContent = isCollapsed ? '▶' : '◀';
}

function toggleRightSidebar(forceState) {
    const body = document.body;
    if (typeof forceState === 'boolean') {
        body.classList.toggle('sidebar-right-collapsed', !forceState);
    } else {
        body.classList.toggle('sidebar-right-collapsed');
    }
    const isCollapsed = body.classList.contains('sidebar-right-collapsed');
    document.getElementById('rightTabIndicator').textContent = isCollapsed ? '◀' : '▶';
}

// ====================================================================
// 4. NAVIGATION GLOBALE & ONGLETS
// ====================================================================
function initApp() {
    if (!apiData.services || apiData.services.length === 0) return;

    const tabsNav = document.getElementById('mainTabs');
    tabsNav.innerHTML = apiData.services.map((service, index) => `
        <li class="nav-item" role="presentation">
            <button class="nav-link ${index === 0 ? 'active' : ''}" 
                    id="${service.id}-tab" 
                    type="button" 
                    role="tab" 
                    onclick="selectService('${service.id}')">
                ${escapeHtml(service.title)}
            </button>
        </li>
    `).join('');

    selectService(apiData.services[0].id);
}

function selectService(serviceId, preferredMethodName) {
    currentServiceId = serviceId;

    document.querySelectorAll('#mainTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    const activeTabBtn = document.getElementById(`${serviceId}-tab`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    const service = apiData.services.find(s => s.id === serviceId);
    if (!service) return;

    updateLeftSidebar(service);
    updateRightSidebar(service);

    let targetMethod = null;
    if (preferredMethodName && service.methods) {
        targetMethod = service.methods.find(m => m.name === preferredMethodName);
    }
    if (!targetMethod && service.methods && service.methods.length > 0) {
        targetMethod = service.methods[0];
    }

    if (targetMethod) {
        selectMethod(targetMethod.name);
    } else {
        document.getElementById('breadcrumbContainer').innerHTML = '';
        document.getElementById('activeContentContainer').innerHTML = `
            <div class="alert alert-secondary text-center my-4">
                Aucune méthode n'est disponible dans ce domaine métier.
            </div>
        `;
    }
}

// ====================================================================
// 5. RENDU DU MENU GAUCHE (MÉTHODES) & DU MENU DROIT (TYPES)
// ====================================================================
function updateLeftSidebar(service) {
    const listContainer = document.getElementById('methodsList');
    const countEl = document.getElementById('methodsCount');
    const methods = service.methods || [];

    countEl.textContent = `${methods.length} méthode${methods.length > 1 ? 's' : ''}`;

    if (methods.length === 0) {
        listContainer.innerHTML = '<p class="text-muted small p-2">Aucune méthode.</p>';
        return;
    }

    listContainer.innerHTML = methods.map(m => `
        <a href="javascript:void(0)" 
           class="sidebar-item-link" 
           id="menu-method-${m.name}"
           title="${escapeHtml(m.name)}"
           onclick="selectMethod('${m.name}')">
           <span class="text-truncate">${escapeHtml(m.name)}</span>
        </a>
    `).join('');
}

function updateRightSidebar(service) {
    const listContainer = document.getElementById('typesList');
    const countEl = document.getElementById('typesCount');
    const types = service.types || [];

    countEl.textContent = `${types.length} type${types.length > 1 ? 's' : ''}`;

    if (types.length === 0) {
        listContainer.innerHTML = '<p class="text-muted small p-2">Aucun type de données.</p>';
        return;
    }

    listContainer.innerHTML = types.map(t => `
        <a href="javascript:void(0)" 
           class="sidebar-item-link" 
           id="menu-type-${t.name}"
           title="${escapeHtml(t.name)}"
           onclick="selectType('${t.name}', '${service.id}')">
           <span class="text-truncate">${escapeHtml(t.name)}</span>
           <span class="badge bg-secondary-subtle text-dark border ms-1">${(t.props || []).length}</span>
        </a>
    `).join('');
}

// ====================================================================
// 6. GESTION DU FIL D'ARIANE
// ====================================================================
function updateBreadcrumb(serviceTitle, itemName, isTypeView, returnMethodName) {
    const container = document.getElementById('breadcrumbContainer');

    if (!isTypeView) {
        container.innerHTML = `
            <ol class="breadcrumb mb-0 align-items-center">
                <li class="breadcrumb-item"><span class="text-secondary">${escapeHtml(serviceTitle)}</span></li>
                <li class="breadcrumb-item active fw-bold text-success" aria-current="page">${escapeHtml(itemName)}</li>
            </ol>
        `;
    } else {
        const backBtnHtml = returnMethodName ? `
            <button class="btn btn-sm btn-outline-primary me-2 py-0 px-2 fw-semibold" onclick="selectMethod('${returnMethodName}')">
                ← Revenir à ${escapeHtml(returnMethodName)}
            </button>
        ` : '';

        container.innerHTML = `
            <div class="d-flex align-items-center justify-content-between bg-light p-2 rounded border">
                <ol class="breadcrumb mb-0 p-0 bg-transparent">
                    <li class="breadcrumb-item"><span class="text-secondary">${escapeHtml(serviceTitle)}</span></li>
                    ${returnMethodName ? `<li class="breadcrumb-item"><a href="javascript:void(0)" onclick="selectMethod('${returnMethodName}')">${escapeHtml(returnMethodName)}</a></li>` : ''}
                    <li class="breadcrumb-item active fw-bold text-primary" aria-current="page">${escapeHtml(itemName)}</li>
                </ol>
                ${backBtnHtml}
            </div>
        `;
    }
}

// ====================================================================
// 7. SÉLECTION ET RENDU AU CENTRE : FICHE MÉTHODE
// ====================================================================
function selectMethod(methodName) {
    currentView = 'method';
    currentMethodName = methodName;
    lastConsultedMethod = methodName;

    // Mise en surbrillance menu gauche, déselection menu droit
    document.querySelectorAll('.sidebar-item-link').forEach(el => el.classList.remove('active-method', 'active-type'));
    const activeMethodLink = document.getElementById(`menu-method-${methodName}`);
    if (activeMethodLink) activeMethodLink.classList.add('active-method');

    const service = apiData.services.find(s => s.id === currentServiceId);
    const method = service ? service.methods.find(m => m.name === methodName) : null;

    if (service && method) {
        updateBreadcrumb(service.title, method.name, false);
        renderMethodDetail(method);
    }
}

function renderMethodDetail(m) {
    const container = document.getElementById('activeContentContainer');

    const descContent = Array.isArray(m.description) ? m.description.join('\n') : (m.description || '');
    const isLongDesc = descContent && (descContent.length > 160 || descContent.includes('<ul>') || descContent.includes('<p'));

    let html = `
        <div class="card shadow-sm border-0 mb-4" id="method-${m.name}">
            <div class="card-header bg-success text-white py-3">
                <h5 class="mb-0 fw-bold font-monospace">${escapeHtml(m.name)}</h5>
            </div>
            <div class="card-body p-4">
    `;

    // Descriptif
    if (isLongDesc) {
        html += `
            <div class="method-desc-container">
                <div class="card-text text-secondary mb-0">${descContent}</div>
            </div>
            <a href="javascript:void(0)" class="btn-toggle-desc mb-3" onclick="toggleDescription(this)">
                Voir plus...
            </a>
        `;
    } else {
        html += `<div class="card-text text-secondary mb-3">${descContent || 'Aucune description disponible.'}</div>`;
    }

    // Paramètres entrants
    if (m.params && m.params.length > 0) {
        html += `
            <h6 class="mt-4 mb-2 text-secondary fw-bold small text-uppercase">Paramètres entrants :</h6>
            <div class="table-responsive">
                <table class="table table-hover table-bordered mb-2 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th class="w-25">Nom</th>
                            <th>Type</th>
                            <th class="text-center" style="width: 80px;">Obl.</th>
                            <th>Commentaires</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${m.params.map(p => {
            let oblContent = escapeHtml(p.obl || '');
            if (p.obl_note) {
                const noteText = (m.notes && m.notes[p.obl_note])
                    ? m.notes[p.obl_note]
                    : `Note ${p.obl_note}`;
                oblContent += ` <sup class="text-danger fw-bold" 
                                                    data-bs-toggle="tooltip" 
                                                    data-bs-placement="top" 
                                                    title="${escapeHtml(noteText)}" 
                                                    style="cursor: pointer; text-decoration: underline dotted;">(${escapeHtml(p.obl_note)})</sup>`;
            }
            return `
                                <tr>
                                    <td><code>${escapeHtml(p.name)}</code></td>
                                    <td>${linkify(p.type)}</td>
                                    <td class="text-center text-danger fw-bold">${oblContent}</td>
                                    <td class="small text-secondary">${escapeHtml(p.comment || '')}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (m.notes && Object.keys(m.notes).length > 0) {
            html += `
                <div class="p-2 mt-2 mb-3 bg-light border rounded text-muted small">
                    <strong class="d-block mb-1 text-dark">Notes :</strong>
                    <ul class="mb-0 ps-3">
                        ${Object.entries(m.notes).map(([k, v]) => `<li><strong>(${escapeHtml(k)})</strong> :${escapeHtml(v)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    } else {
        html += `<p class="text-muted mb-3"><em>Aucun paramètre entrant.</em></p>`;
    }

    // Informations retournées (avec intégration des tableaux de propriétés comme avant)
    html += `<h6 class="text-secondary fw-bold small text-uppercase mt-4 mb-2">Retourne :</h6>`;
    const multiReturns = Array.isArray(m.returns_types) ? m.returns_types : (Array.isArray(m.returns_type) ? m.returns_type : null);

    if (multiReturns && multiReturns.length > 0) {
        html += `<div class="mb-3">`;
        multiReturns.forEach(retItem => {
            const cleanType = cleanTypeName(retItem.type);
            let matchedType = null;
            for (let s of apiData.services) {
                if (s.types) {
                    matchedType = s.types.find(t => t.name === cleanType);
                    if (matchedType) break;
                }
            }

            html += `
                <div class="card mb-3 border">
                    <div class="card-header bg-light text-dark d-flex justify-content-between align-items-center py-2">
                        <span class="fw-semibold">${escapeHtml(retItem.label || 'Liste')} : ${linkify(retItem.type)}</span>
                        ${retItem.comment ? `<small class="text-muted">${escapeHtml(retItem.comment)}</small>` : ''}
                    </div>
                    ${matchedType ? `
                    <div class="card-body p-0">
                        <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                            <table class="table table-striped table-hover table-bordered mb-0 align-middle">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th class="ps-3 w-25">Propriété</th>
                                        <th>Type</th>
                                        <th class="text-center" style="width: 80px;">Obl.</th>
                                        <th>Commentaires</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${matchedType.props.map(p => `
                                        <tr>
                                            <td class="ps-3"><code>${escapeHtml(p.name)}</code></td>
                                            <td>${linkify(p.type)}</td>
                                            <td class="text-center text-danger fw-bold">${escapeHtml(p.obl || '')}</td>
                                            <td class="small text-secondary">${escapeHtml(p.comment || '')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>` : ''}
                </div>
            `;
        });
        html += `</div>`;
    } else {
        const returnTypeRaw = m.returns || m.returns_type;
        if (typeof returnTypeRaw === 'string') {
            const cleanRetType = cleanTypeName(returnTypeRaw);
            let matchedType = null;

            for (let s of apiData.services) {
                if (s.types) {
                    matchedType = s.types.find(t => t.name === cleanRetType);
                    if (matchedType) break;
                }
            }

            if (matchedType) {
                html += `
                    <div class="card mb-3 border">
                        <div class="card-header bg-light text-dark py-2">
                            <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                <table class="table table-striped table-hover table-bordered mb-0 align-middle">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th class="ps-3 w-25">Propriété</th>
                                            <th>Type</th>
                                            <th class="text-center" style="width: 80px;">Obl.</th>
                                            <th>Commentaires</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${matchedType.props.map(p => `
                                            <tr>
                                                <td class="ps-3"><code>${escapeHtml(p.name)}</code></td>
                                                <td>${linkify(p.type)}</td>
                                                <td class="text-center text-danger fw-bold">${escapeHtml(p.obl || '')}</td>
                                                <td class="small text-secondary">${escapeHtml(p.comment || '')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            } else if (m.returns_props && m.returns_props.length > 0) {
                html += `
                    <div class="card mb-3 border">
                        <div class="card-header bg-light text-dark py-2">
                            <strong>Type de retour : </strong> ${linkify(m.returns_type || 'Objet détaillé')}
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                <table class="table table-striped table-hover table-bordered mb-0 align-middle">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th class="ps-3 w-25">Propriété</th>
                                            <th>Type</th>
                                            <th>Commentaires</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${m.returns_props.map(p => `
                                            <tr>
                                                <td class="ps-3"><code>${escapeHtml(p.name)}</code></td>
                                                <td>${linkify(p.type)}</td>
                                                <td class="small text-secondary">${escapeHtml(p.comment || '')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            } else if (returnTypeRaw) {
                html += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
            }
        }
    }

    // Comportement nominal
    if (m.return_behavior) {
        html += `
            <div class="alert alert-info py-2 px-3 my-3 small d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle-fill me-2 flex-shrink-0" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>
                <div>${escapeHtml(m.return_behavior)}</div>
            </div>
        `;
    }

    // Catalogue anomalies
    if (m.errors && m.errors.length > 0) {
        const errorCollapseId = `errors-${m.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        html += `
            <div class="mt-3">
                <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center" 
                        type="button" 
                        data-bs-toggle="collapse" 
                        data-bs-target="#${errorCollapseId}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-exclamation-triangle-fill me-1" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
                    Anomalies & Erreurs possibles (${m.errors.length})
                </button>
                <div class="collapse mt-2" id="${errorCollapseId}">
                    <div class="card card-body p-0 border-danger-subtle shadow-sm">
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="table table-sm table-hover table-striped mb-0 align-middle">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th class="ps-3 w-50">Message</th>
                                        <th>Commentaires / Causes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${m.errors.map(err => `
                                        <tr>
                                            <td class="ps-3"><code class="text-danger fw-semibold">${escapeHtml(err.message)}</code></td>
                                            <td class="small text-secondary">${escapeHtml(err.comment)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
    initTooltips();
}

// ====================================================================
// 8. SÉLECTION ET RENDU AU CENTRE : FICHE TYPE DE DONNÉES
// ====================================================================
function selectType(typeName, targetServiceId) {
    currentView = 'type';

    // Bascule d'onglet si le type provient d'un autre domaine
    if (targetServiceId && targetServiceId !== currentServiceId) {
        currentServiceId = targetServiceId;
        document.querySelectorAll('#mainTabs .nav-link').forEach(btn => btn.classList.remove('active'));
        const activeTabBtn = document.getElementById(`${targetServiceId}-tab`);
        if (activeTabBtn) activeTabBtn.classList.add('active');

        const service = apiData.services.find(s => s.id === targetServiceId);
        if (service) {
            updateLeftSidebar(service);
            updateRightSidebar(service);
        }
    }

    // Mise en surbrillance menu droit, déselection menu gauche
    document.querySelectorAll('.sidebar-item-link').forEach(el => el.classList.remove('active-method', 'active-type'));
    const activeTypeLink = document.getElementById(`menu-type-${typeName}`);
    if (activeTypeLink) activeTypeLink.classList.add('active-type');

    let matchedType = null;
    let foundService = null;

    for (let s of apiData.services) {
        if (s.types) {
            matchedType = s.types.find(t => t.name === typeName);
            if (matchedType) {
                foundService = s;
                break;
            }
        }
    }

    if (matchedType && foundService) {
        updateBreadcrumb(foundService.title, matchedType.name, true, lastConsultedMethod);
        renderTypeDetail(matchedType);
    }
}

function renderTypeDetail(t) {
    const container = document.getElementById('activeContentContainer');

    let html = `
        <div class="card shadow-sm border-0 mb-4" id="type-${t.name}">
            <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
                <h5 class="mb-0 font-monospace">${escapeHtml(t.name)}</h5>
                <button class="btn btn-outline-light btn-sm" onclick="showUsages('${escapeHtml(t.name)}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-search me-1" viewBox="0 0 16 16">
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>
                    Où est-ce utilisé ? (Impact)
                </button>
            </div>
            <div class="card-body p-0">
                <!-- Tableau complet : aucune limitation de hauteur, aucune scrollbar interne -->
                <div class="table-responsive">
                    <table class="table table-striped table-hover mb-0 align-middle">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4 w-25">Propriété</th>
                                <th>Type</th>
                                <th class="text-center" style="width: 80px;">Obl.</th>
                                <th>Commentaires</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(t.props || []).map(p => `
                                <tr>
                                    <td class="ps-4"><code>${escapeHtml(p.name)}</code></td>
                                    <td>${linkify(p.type)}</td>
                                    <td class="text-center text-danger fw-bold">${escapeHtml(p.obl || '')}</td>
                                    <td class="small text-secondary">${escapeHtml(p.comment || '')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    if (t.notes && t.notes.length > 0) {
        html += `
            <div class="p-3 mb-4 bg-light text-muted border rounded small">
                <ul class="mb-0 ps-3">
                    ${t.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    container.innerHTML = html;
}

// ====================================================================
// 9. ANALYSE D'IMPACT ("Où est-ce utilisé ?")
// ====================================================================
function showUsages(targetType) {
    const usages = [];

    if (apiData.services) {
        apiData.services.forEach(service => {
            if (service.methods) {
                service.methods.forEach(m => {
                    const multiReturns = Array.isArray(m.returns_types) ? m.returns_types : (Array.isArray(m.returns_type) ? m.returns_type : null);
                    if (multiReturns) {
                        multiReturns.forEach(rt => {
                            if (cleanTypeName(rt.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Retourné dans la méthode 
                                        <a class="type-link" href="javascript:void(0)" onclick="selectService('${service.id}', '${m.name}')">${escapeHtml(m.name)}</a>
                                    </li>
                                `);
                            }
                        });
                    } else {
                        const ret = m.returns_type || m.returns;
                        if (typeof ret === 'string' && cleanTypeName(ret) === targetType) {
                            usages.push(`
                                <li class="mb-2">
                                    <strong>${escapeHtml(service.title)}</strong> : Retourné par la méthode 
                                    <a class="type-link" href="javascript:void(0)" onclick="selectService('${service.id}', '${m.name}')">${escapeHtml(m.name)}</a>
                                </li>
                            `);
                        }
                    }

                    if (m.params) {
                        m.params.forEach(p => {
                            if (cleanTypeName(p.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Paramètre <code>${escapeHtml(p.name)}</code> dans la méthode 
                                        <a class="type-link" href="javascript:void(0)" onclick="selectService('${service.id}', '${m.name}')">${escapeHtml(m.name)}</a>
                                    </li>
                                `);
                            }
                        });
                    }
                });
            }

            if (service.types) {
                service.types.forEach(t => {
                    if (t.name !== targetType && t.props) {
                        t.props.forEach(p => {
                            if (cleanTypeName(p.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Propriété <code>${escapeHtml(p.name)}</code> du type 
                                        <a class="type-link" href="javascript:void(0)" onclick="selectType('${t.name}', '${service.id}')">${escapeHtml(t.name)}</a>
                                    </li>
                                `);
                            }
                        });
                    }
                });
            }
        });
    }

    const body = document.getElementById('usageModalBody');
    const title = document.getElementById('usageModalLabel');
    if (title) title.textContent = `Utilisation de : ${targetType}`;

    if (body) {
        body.innerHTML = usages.length > 0
            ? `<ul class="list-unstyled mb-0">${usages.join('')}</ul>`
            : `<div class="alert alert-secondary mb-0 text-center">Ce type de données n'est pas directement référencé en tant que dépendance.</div>`;
    }

    const modalEl = document.getElementById('usageModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}