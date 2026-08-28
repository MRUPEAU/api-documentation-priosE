/**
 * ====================================================================
 * DOCUMENTATION INTERACTIVE API PRIOS E - app.js
 * ====================================================================
 * Ce fichier gère toute la logique dynamique de la documentation :
 * 1. Chargement et parsing asynchrone du fichier api_data.json.
 * 2. Génération automatique du DOM (onglets de navigation, cartes, tableaux).
 * 3. Maillage hypertexte automatique des types de données (linkify).
 * 4. Gestion des notes contextuelles et des infobulles interactives (tooltips).
 * 5. Moteur d'analyse d'impact croisé ("Où est-ce utilisé ?").
 * 6. Navigation fluide avec compensation de l'en-tête fixe et surbrillance.
 */

// Stockage global des données de l'API
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
 * Sécurise les textes HTML pour éviter les failles XSS et les erreurs de chevrons.
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

        // --- A. Onglets supérieurs ---
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

        // --- B. Panneaux de contenu ---
        let serviceContent = '';
        const hasMethods = service.methods && service.methods.length > 0;
        const hasTypes = service.types && service.types.length > 0;

        if (!hasMethods && !hasTypes) {
            serviceContent = `<div class="alert alert-secondary">Aucune méthode ou structure de données répertoriée dans cette section.</div>`;
        } else {
            // --- B.1. Méthodes ---
            if (hasMethods) {
                serviceContent += `<h2 class="mb-4 pb-2 border-bottom">Méthodes</h2>`;

                service.methods.forEach(m => {
                    serviceContent += `
                        <div class="card mb-4 shadow-sm" id="method-${m.name}">
                            <div class="card-header bg-success text-white d-flex align-items-center">
                                <h5 class="mb-0 me-2 fw-semibold">${escapeHtml(m.name)}</h5>
                            </div>
                            <div class="card-body">
                                <p class="card-text text-muted">${escapeHtml(m.description || 'Aucune description disponible.')}</p>
                    `;

                    // Tableau des paramètres
                    if (m.params && m.params.length > 0) {
                        serviceContent += `
                            <h6 class="mt-4 mb-2 text-secondary fw-bold text-uppercase small">Paramètres :</h6>
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

                        // Notes sous les paramètres
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

                    // Section Retour (Gestion Retours Multiples ou Simples)
                    serviceContent += `<h6 class="text-secondary fw-bold text-uppercase small mt-3">Retourne :</h6>`;

                    const multiReturns = Array.isArray(m.returns_types) ? m.returns_types : (Array.isArray(m.returns_type) ? m.returns_type : null);

                    if (multiReturns && multiReturns.length > 0) {
                        serviceContent += `<div class="multi-returns-container mb-3">`;
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
                            <div class="card border-primary-subtle mb-3 shadow-sm">
                                <div class="card-header bg-light-subtle d-flex justify-content-between align-items-center py-2">
                                    <span class="fw-semibold text-primary">
                                        ${escapeHtml(retItem.label || 'Liste')} : ${linkify(retItem.type)}
                                    </span>
                                    ${retItem.comment ? `<small class="text-muted">${escapeHtml(retItem.comment)}</small>` : ''}
                                </div>
                                ${matchedType ? `
                                <div class="card-body p-0">
                                    <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                                        <table class="table table-sm table-hover table-bordered mb-0 align-middle">
                                            <thead class="table-light sticky-top">
                                                <tr>
                                                    <th class="ps-3 w-25">Propriété</th>
                                                    <th>Type</th>
                                                    <th class="text-center">Obl.</th>
                                                    <th>Commentaires</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${matchedType.props.map(p => `
                                                    <tr>
                                                        <td class="ps-3"><code>${escapeHtml(p.name)}</code></td>
                                                        <td>${linkify(p.type)}</td>
                                                        <td class="text-center text-danger fw-bold">${escapeHtml(p.obl || '')}</td>
                                                        <td>${escapeHtml(p.comment || '')}</td>
                                                    </tr>`).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>` : ''}
                            </div>`;
                        });
                        serviceContent += `</div>`;
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
                                serviceContent += `
                                    <div class="alert alert-light border">
                                        <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}<br><br>
                                        <table class="table table-sm table-bordered bg-white mb-0 align-middle">
                                            <thead class="table-light">
                                                <tr>
                                                    <th class="w-25">Propriété</th>
                                                    <th>Type</th>
                                                    <th class="text-center">Obl.</th>
                                                    <th>Commentaires</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${matchedType.props.map(p => `
                                                    <tr>
                                                        <td><code>${escapeHtml(p.name)}</code></td>
                                                        <td>${linkify(p.type)}</td>
                                                        <td class="text-center text-danger fw-bold">${escapeHtml(p.obl || '')}</td>
                                                        <td>${escapeHtml(p.comment || '')}</td>
                                                    </tr>`).join('')}
                                            </tbody>
                                        </table>
                                    </div>`;
                            } else if (m.returns_props && m.returns_props.length > 0) {
                                serviceContent += `
                                    <div class="alert alert-light border">
                                        <strong>Type de retour : </strong> ${linkify(m.returns_type || 'Objet détaillé')}<br><br>
                                        <table class="table table-sm table-bordered bg-white mb-0 align-middle">
                                            <thead class="table-light">
                                                <tr>
                                                    <th class="w-25">Propriété</th>
                                                    <th>Type</th>
                                                    <th>Commentaires</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${m.returns_props.map(p => `
                                                    <tr>
                                                        <td><code>${escapeHtml(p.name)}</code></td>
                                                        <td>${linkify(p.type)}</td>
                                                        <td>${escapeHtml(p.comment || '')}</td>
                                                    </tr>`).join('')}
                                            </tbody>
                                        </table>
                                    </div>`;
                            } else if (returnTypeRaw) {
                                serviceContent += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
                            }
                        }
                    }

                    serviceContent += `</div></div>`;
                });
            }

            // --- B.2. Types de Données ---
            if (hasTypes) {
                serviceContent += `<h2 class="mt-5 mb-4 pb-2 border-bottom">Types de Données</h2>`;

                service.types.forEach(t => {
                    serviceContent += `
                        <div class="card mb-4 shadow-sm" id="type-${t.name}">
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

    if (service.methods && service.methods.length > 0) {
        sbHtml += `<h6 class="text-uppercase text-muted fw-bold small mt-2 mb-2">Méthodes</h6><div class="list-group list-group-flush mb-4">`;
        service.methods.forEach(m => {
            sbHtml += `
                <a href="javascript:void(0)" 
                   class="list-group-item list-group-item-action border-0 py-1 ps-2 small text-truncate" 
                   onclick="navigateTo('${service.id}', 'method-${m.name}')">
                   ${escapeHtml(m.name)}
                </a>
            `;
        });
        sbHtml += `</div>`;
    }

    if (service.types && service.types.length > 0) {
        sbHtml += `<h6 class="text-uppercase text-muted fw-bold small mt-3 mb-2">Types de données</h6><div class="list-group list-group-flush mb-2">`;
        service.types.forEach(t => {
            sbHtml += `
                <a href="javascript:void(0)" 
                   class="list-group-item list-group-item-action border-0 py-1 ps-2 small text-truncate" 
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