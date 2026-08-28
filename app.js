/**
 * ====================================================================
 * DOCUMENTATION INTERACTIVE API PRIOS E - app.js
 * ====================================================================
 * Ce fichier gère toute la logique dynamique de la documentation :
 * 1. Chargement et parsing asynchrone du fichier api_data.json.
 * 2. Génération automatique du DOM (onglets, cartes, tableaux scrollables).
 * 3. Maillage hypertexte automatique des types de données (linkify).
 * 4. Gestion des notes contextuelles et des infobulles interactives (tooltips).
 * 5. Moteur d'analyse d'impact croisé ("Où est-ce utilisé ?").
 * 6. Navigation fluide avec compensation de l'en-tête fixe et surbrillance.
 */

// Variable globale contenant toutes les données de l'API chargées
let apiData = {};

// ====================================================================
// 1. CHARGEMENT ASYNCHRONE DES DONNÉES (FETCH)
// ====================================================================
fetch('api_data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status + " : impossible de récupérer api_data.json");
        }
        return response.json();
    })
    .then(data => {
        apiData = data;

        // Mise à jour de la date dans le bandeau supérieur
        const docDateEl = document.getElementById('doc-date');
        if (docDateEl) {
            docDateEl.textContent = apiData.doc_date || "Non spécifiée";
        }

        // Lancement de la construction de la page
        render();
    })
    .catch(error => {
        console.error("Erreur critique lors du chargement des données :", error);

        const docDateEl = document.getElementById('doc-date');
        if (docDateEl) docDateEl.textContent = "Erreur";

        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-danger shadow-sm my-4" role="alert">
                    <h5 class="alert-heading fw-bold">Erreur de chargement</h5>
                    <p class="mb-1">Impossible de charger le fichier <code>api_data.json</code>.</p>
                    <hr>
                    <p class="mb-0 small text-muted">Vérifiez la syntaxe du fichier JSON et assurez-vous d'exécuter la page depuis un serveur web local.</p>
                </div>
            `;
        }
    });

// ====================================================================
// 2. FONCTIONS UTILITAIRES & ASSISTANCE
// ====================================================================

/**
 * Sécurise les textes HTML pour éviter les failles XSS et les erreurs de balises.
 */
function escapeHtml(unsafe) {
    return (unsafe || '')
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Extrait le nom propre d'un type (ex: "Liste de MSW..." -> "MSW...").
 */
function cleanTypeName(typeStr) {
    if (!typeStr || typeof typeStr !== 'string') return "";
    return typeStr
        .replace(/^List</, '')
        .replace(/^Liste de /, '')
        .replace(/>$/, '')
        .replace(/^Objet de type /, '')
        .trim();
}

/**
 * Transforme le nom d'un type en lien cliquable s'il est répertorié dans la documentation.
 */
function linkify(typeStr) {
    if (!typeStr || typeof typeStr !== 'string') return "";

    const cleanType = cleanTypeName(typeStr);
    const escapedType = escapeHtml(typeStr);

    let exists = false;
    let targetTab = '';

    if (apiData.services && Array.isArray(apiData.services)) {
        for (let i = 0; i < apiData.services.length; i++) {
            const currentService = apiData.services[i];
            if (currentService.types && currentService.types.some(t => t.name === cleanType)) {
                exists = true;
                targetTab = currentService.id;
                break;
            }
        }
    }

    if (exists) {
        const cleanTypeEscaped = escapeHtml(cleanType);
        const linkHtml = `<a class="type-link" href="javascript:void(0)" onclick="navigateTo('${targetTab}', 'type-${cleanTypeEscaped}')">${cleanTypeEscaped}</a>`;
        return escapedType.replace(cleanTypeEscaped, linkHtml);
    }

    return escapedType;
}

/**
 * Initialise l'ensemble des infobulles Bootstrap (Tooltips) de la page.
 */
function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => {
        const existingInstance = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (existingInstance) {
            existingInstance.dispose();
        }
        new bootstrap.Tooltip(tooltipTriggerEl, {
            delay: { show: 150, hide: 100 }
        });
    });
}

// ====================================================================
// 3. GÉNÉRATION DE L'INTERFACE (render)
// ====================================================================
function render() {
    const tabsNav = document.getElementById('mainTabs');
    const tabsContent = document.getElementById('mainTabsContent');

    if (!tabsNav || !tabsContent || !apiData.services) return;

    let tabsHtml = '';
    let contentHtml = '';

    apiData.services.forEach((service, index) => {
        const isActive = index === 0 ? 'active' : '';
        const isShow = index === 0 ? 'show active' : '';

        // --- A. Boutons d'onglets supérieurs ---
        tabsHtml += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive}" 
                        id="${service.id}-tab" 
                        data-bs-toggle="tab" 
                        data-bs-target="#${service.id}" 
                        type="button" 
                        role="tab" 
                        onclick="updateSidebar('${service.id}')">
                    ${escapeHtml(service.title)}
                </button>
            </li>
        `;

        // --- B. Contenu de la section active ---
        let serviceContent = '';
        const hasMethods = service.methods && service.methods.length > 0;
        const hasTypes = service.types && service.types.length > 0;

        if (!hasMethods && !hasTypes) {
            serviceContent = `<div class="alert alert-secondary">Aucune méthode ou structure répertoriée dans cette section.</div>`;
        } else {
            // ========================================================
            // B.1. Méthodes
            // ========================================================
            if (hasMethods) {
                serviceContent += `<h2 class="mb-4 pb-2 border-bottom">Méthodes</h2>`;

                service.methods.forEach(m => {
                    serviceContent += `
                        <div class="card mb-4" id="method-${m.name}">
                            <div class="card-header bg-success text-white d-flex align-items-center">
                                <h5 class="mb-0 me-2 fw-semibold">${escapeHtml(m.name)}</h5>
                            </div>
                            <div class="card-body">
                                <p class="card-text">${escapeHtml(m.description || '')}</p>
                    `;

                    // Tableau des paramètres entrants
                    if (m.params && m.params.length > 0) {
                        serviceContent += `
                            <h6 class="mt-4 mb-2 text-secondary fw-bold small text-uppercase">Paramètres :</h6>
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

                        // Notes sous paramètres
                        if (m.notes && Object.keys(m.notes).length > 0) {
                            serviceContent += `
                                <div class="p-2 mt-2 mb-3 bg-light border rounded text-muted small">
                                    <strong class="d-block mb-1 text-dark">Notes :</strong>
                                    <ul class="mb-0 ps-3">
                                        ${Object.entries(m.notes).map(([key, val]) => `
                                            <li><strong>(${escapeHtml(key)})</strong> : ${escapeHtml(val)}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            `;
                        }
                    } else {
                        serviceContent += `<p class="text-muted mb-3"><em>Aucun paramètre entrant.</em></p>`;
                    }

                    // Section Retour
                    serviceContent += `<h6 class="text-secondary fw-bold small text-uppercase mt-4 mb-2">Retourne :</h6>`;

                    // CAS 1 : Retours composites multi-listes (tableau returns_types ou returns_type)
                    const multiReturns = Array.isArray(m.returns_types) ? m.returns_types : (Array.isArray(m.returns_type) ? m.returns_type : null);

                    if (multiReturns && multiReturns.length > 0) {
                        serviceContent += `<div class="mb-3">`;
                        multiReturns.forEach(retItem => {
                            const cleanType = cleanTypeName(retItem.type);
                            let matchedType = null;

                            for (let s of apiData.services) {
                                if (s.types) {
                                    matchedType = s.types.find(t => t.name === cleanType);
                                    if (matchedType) break;
                                }
                            }

                            serviceContent += `
                            <div class="card mb-3 border">
                                <div class="card-header bg-light text-dark d-flex justify-content-between align-items-center py-2">
                                    <span class="fw-semibold">
                                        ${escapeHtml(retItem.label || 'Liste')} : ${linkify(retItem.type)}
                                    </span>
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
                                                    </tr>`).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>` : ''}
                            </div>`;
                        });
                        serviceContent += `</div>`;
                    } else {
                        // CAS 2 : Retour simple (type unitaire)
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
                                serviceContent += `
                                    <div class="card mb-3 border">
                                        <div class="card-header bg-light text-dark py-2">
                                            <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}
                                        </div>
                                        <div class="card-body p-0">
                                            <!-- Limitation de la hauteur à 260px avec scrollbar et en-tête figé -->
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
                                                            </tr>`).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>`;
                            } else if (m.returns_props && m.returns_props.length > 0) {
                                serviceContent += `
                                    <div class="card mb-3 border">
                                        <div class="card-header bg-light text-dark py-2">
                                            <strong>Type de retour : </strong> ${linkify(m.returns_type || 'Objet détaillé')}
                                        </div>
                                        <div class="card-body p-0">
                                            <!-- Limitation de la hauteur pour les retours détaillés inline -->
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
                                                            </tr>`).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>`;
                            } else if (returnTypeRaw) {
                                serviceContent += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
                            }
                        }
                    }

                    // ============================================================
                    // Comportement du retour (Message de synthèse #INF, etc.)
                    // ============================================================
                    if (m.return_behavior) {
                        serviceContent += `
                            <div class="alert alert-info py-2 px-3 my-3 small d-flex align-items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle-fill me-2 flex-shrink-0" viewBox="0 0 16 16">
                                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                                </svg>
                                <div>${escapeHtml(m.return_behavior)}</div>
                            </div>
                        `;
                    }

                    // ============================================================
                    // Anomalies & Erreurs possibles (codeTraitement = 'X')
                    // ============================================================
                    if (m.errors && m.errors.length > 0) {
                        const errorCollapseId = `errors-${m.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                        serviceContent += `
                            <div class="mt-3">
                                <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center" 
                                        type="button" 
                                        data-bs-toggle="collapse" 
                                        data-bs-target="#${errorCollapseId}" 
                                        aria-expanded="false" 
                                        aria-controls="${errorCollapseId}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-exclamation-triangle-fill me-1" viewBox="0 0 16 16">
                                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                                    </svg>
                                    Anomalies & Erreurs possibles (${m.errors.length})
                                </button>
                                
                                <div class="collapse mt-2" id="${errorCollapseId}">
                                    <div class="card card-body p-0 border-danger-subtle shadow-sm">
                                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                                            <table class="table table-sm table-hover table-striped mb-0 align-middle">
                                                <thead class="table-light sticky-top">
                                                    <tr>
                                                        <th class="ps-3 w-50">Message retourné (<code>message</code>)</th>
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

                    serviceContent += `</div></div>`;
                });
            }


            // ========================================================
            // B.2. Types de Données (Définitions complètes)
            // ========================================================
            if (hasTypes) {
                serviceContent += `<h2 class="mt-5 mb-4 pb-2 border-bottom">Types de Données</h2>`;

                service.types.forEach(t => {
                    serviceContent += `
                        <div class="card mb-4" id="type-${t.name}">
                            <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 font-monospace">${escapeHtml(t.name)}</h5>
                                <button class="btn btn-outline-light btn-sm" onclick="showUsages('${escapeHtml(t.name)}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-search me-1" viewBox="0 0 16 16">
                                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                                    </svg>
                                    Où est-ce utilisé ?
                                </button>
                            </div>
                            <div class="card-body p-0">
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
                                                </tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;

                    if (t.notes && t.notes.length > 0) {
                        serviceContent += `
                            <div class="p-3 mb-4 bg-light text-muted border rounded small" style="margin-top: -15px;">
                                <ul class="mb-0 ps-3">
                                    ${t.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}
                                </ul>
                            </div>
                        `;
                    }
                });
            }
        }

        contentHtml += `
            <div class="tab-pane fade ${isShow}" id="${service.id}" role="tabpanel" aria-labelledby="${service.id}-tab">
                ${serviceContent}
            </div>
        `;
    });

    tabsNav.innerHTML = tabsHtml;
    tabsContent.innerHTML = contentHtml;

    if (apiData.services.length > 0) {
        updateSidebar(apiData.services[0].id);
    }

    initTooltips();
}

// ====================================================================
// 4. MENU LATÉRAL DYNAMIQUE (Sidebar)
// ====================================================================
function updateSidebar(serviceId) {
    const service = apiData.services ? apiData.services.find(s => s.id === serviceId) : null;
    const sidebar = document.getElementById('sidebar-content');

    if (!sidebar) return;

    if (!service || ((!service.methods || service.methods.length === 0) && (!service.types || service.types.length === 0))) {
        sidebar.innerHTML = '<p class="text-muted small p-2">Aucun élément dans cette section.</p>';
        return;
    }

    let sbHtml = '';

    // Méthodes
    if (service.methods && service.methods.length > 0) {
        sbHtml += `<h6 class="text-uppercase text-secondary fw-bold small mt-3 mb-2 ps-1">Méthodes</h6><div class="mb-4">`;
        service.methods.forEach(m => {
            sbHtml += `
                <a href="javascript:void(0)" 
                   class="sidebar-link" 
                   title="${escapeHtml(m.name)}"
                   onclick="navigateTo('${service.id}', 'method-${m.name}')">
                   ${escapeHtml(m.name)}
                </a>
            `;
        });
        sbHtml += `</div>`;
    }

    // Types de données
    if (service.types && service.types.length > 0) {
        sbHtml += `<h6 class="text-uppercase text-secondary fw-bold small mt-3 mb-2 ps-1">Types de données</h6><div>`;
        service.types.forEach(t => {
            sbHtml += `
                <a href="javascript:void(0)" 
                   class="sidebar-link" 
                   title="${escapeHtml(t.name)}"
                   onclick="navigateTo('${service.id}', 'type-${t.name}')">
                   ${escapeHtml(t.name)}
                </a>
            `;
        });
        sbHtml += `</div>`;
    }

    sidebar.innerHTML = sbHtml;
}

// ====================================================================
// 5. NAVIGATION & DÉFILEMENT FLUIDE
// ====================================================================
function activateTab(tabId) {
    const tabTriggerEl = document.getElementById(tabId + '-tab');
    if (tabTriggerEl) {
        const tab = bootstrap.Tab.getOrCreateInstance(tabTriggerEl);
        tab.show();
        updateSidebar(tabId);
    }
}

function navigateTo(serviceId, elementId) {
    const modalEl = document.getElementById('usageModal');
    let delay = 0;

    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
            modalInstance.hide();
            delay = 350;
        }
    }

    setTimeout(() => {
        activateTab(serviceId);

        setTimeout(() => {
            const target = document.getElementById(elementId);
            if (target) {
                const headerOffset = 130;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                target.classList.remove('highlight');
                void target.offsetWidth;
                target.classList.add('highlight');

                setTimeout(() => {
                    target.classList.remove('highlight');
                }, 2000);
            }
        }, 100);
    }, delay);
}

// ====================================================================
// 6. ANALYSE D'IMPACT ("Où est-ce utilisé ?")
// ====================================================================
function showUsages(targetType) {
    const usages = [];

    if (apiData.services && Array.isArray(apiData.services)) {
        apiData.services.forEach(service => {
            // A. Analyse des méthodes
            if (service.methods) {
                service.methods.forEach(m => {
                    // Multi-retours
                    const multiReturns = Array.isArray(m.returns_types) ? m.returns_types : (Array.isArray(m.returns_type) ? m.returns_type : null);
                    if (multiReturns) {
                        multiReturns.forEach(rt => {
                            if (cleanTypeName(rt.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Retourné dans la méthode 
                                        <a class="type-link fw-semibold" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${escapeHtml(m.name)}</a>
                                        (<em>${escapeHtml(rt.label || 'Liste')}</em>)
                                    </li>
                                `);
                            }
                        });
                    } else {
                        // Retours simples
                        const ret = m.returns_type || m.returns;
                        if (typeof ret === 'string' && cleanTypeName(ret) === targetType) {
                            usages.push(`
                                <li class="mb-2">
                                    <strong>${escapeHtml(service.title)}</strong> : Retourné par la méthode 
                                    <a class="type-link fw-semibold" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${escapeHtml(m.name)}</a>
                                </li>
                            `);
                        }
                    }

                    // Paramètres d'entrée
                    if (m.params) {
                        m.params.forEach(p => {
                            if (cleanTypeName(p.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Paramètre <code>${escapeHtml(p.name)}</code> dans la méthode 
                                        <a class="type-link fw-semibold" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${escapeHtml(m.name)}</a>
                                    </li>
                                `);
                            }
                        });
                    }
                });
            }

            // B. Analyse des types imbriqués
            if (service.types) {
                service.types.forEach(t => {
                    if (t.name !== targetType && t.props) {
                        t.props.forEach(p => {
                            if (cleanTypeName(p.type) === targetType) {
                                usages.push(`
                                    <li class="mb-2">
                                        <strong>${escapeHtml(service.title)}</strong> : Propriété <code>${escapeHtml(p.name)}</code> du type 
                                        <a class="type-link fw-semibold" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'type-${t.name}')">${escapeHtml(t.name)}</a>
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

    if (title) title.textContent = `Utilisation du type : ${targetType}`;

    if (body) {
        if (usages.length > 0) {
            body.innerHTML = `<ul class="list-unstyled mb-0">${usages.join('')}</ul>`;
        } else {
            body.innerHTML = `
                <div class="alert alert-secondary mb-0 text-center">
                    Ce type de données n'est pas directement référencé en tant que dépendance.
                </div>
            `;
        }
    }

    const modalEl = document.getElementById('usageModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}