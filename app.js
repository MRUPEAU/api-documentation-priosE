/**
 * app.js
 * Ce fichier contient toute la logique interactive de la documentation.
 * Il se charge de lire le fichier de données (api_data.json) et de construire 
 * l'interface visuelle (les onglets, les tableaux, le menu latéral) automatiquement.
 */

// Variable globale qui va contenir toutes nos données une fois chargées
let apiData = {};

// 1. CHARGEMENT DES DONNÉES
// On va chercher le fichier JSON qui contient toute la doc
fetch('api_data.json')
    .then(response => {
        // Si le fichier n'est pas trouvé (erreur 404 par exemple)
        if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status);
        }
        return response.json(); // On transforme le texte en objet manipulable
    })
    .then(data => {
        // Une fois les données chargées avec succès :
        apiData = data;
        // On met à jour la date affichée en haut de la page
        document.getElementById('doc-date').textContent = apiData.doc_date || "Non spécifiée";
        // On lance la construction de la page
        render();
    })
    .catch(error => {
        // S'il y a un problème (fichier absent, erreur de syntaxe dans le JSON, etc.)
        console.error("Erreur lors du chargement:", error);
        document.getElementById('doc-date').textContent = "Erreur";
        document.getElementById('error-container').innerHTML = `
            <div class="alert alert-danger">
                <strong>Erreur :</strong> Impossible de charger le fichier <code>api_data.json</code>.<br>
                Assurez-vous qu'il ne contient pas d'erreurs de syntaxe et que vous utilisez un serveur web local.
            </div>`;
    });

// 2. FONCTIONS UTILITAIRES (Aides)

// Sécurise les textes pour éviter que des balises HTML (<, >) cassent l'affichage
function escapeHtml(unsafe) {
    return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Nettoie les noms de types complexes. Ex: "List<ClientExterne>" devient "ClientExterne"
function cleanTypeName(typeStr) {
    if (!typeStr) return "";
    return typeStr.replace('List<', '').replace('Liste de ', '').replace('>', '').replace('Objet de type ', '').trim();
}

// Transforme un nom de type en un lien cliquable s'il est défini dans notre documentation
function linkify(typeStr) {
    if (!typeStr) return "";
    let cleanType = cleanTypeName(typeStr); // On récupère le nom propre
    let escapedType = escapeHtml(typeStr);  // On sécurise le texte original

    let exists = false;
    let targetTab = '';

    // On cherche dans toutes les parties si ce type existe
    for (let i = 0; i < apiData.services.length; i++) {
        if (apiData.services[i].types && apiData.services[i].types.find(t => t.name === cleanType)) {
            exists = true;
            targetTab = apiData.services[i].id; // On mémorise dans quel onglet il se trouve
            break;
        }
    }

    // S'il existe, on remplace le texte par un lien HTML (<a>)
    if (exists) {
        return escapedType.replace(cleanType, `<a class="type-link" href="javascript:void(0)" onclick="navigateTo('${targetTab}', 'type-${cleanType}')">${cleanType}</a>`);
    }
    return escapedType; // Sinon, on renvoie juste le texte
}

// 3. FONCTION PRINCIPALE DE CONSTRUCTION DE LA PAGE
function render() {
    const tabsNav = document.getElementById('mainTabs');
    const tabsContent = document.getElementById('mainTabsContent');

    let tabsHtml = '';
    let contentHtml = '';

    // On parcourt chaque grande partie (Ventes, CRM, etc.)
    apiData.services.forEach((service, index) => {
        // Le premier onglet est actif par défaut
        const isActive = index === 0 ? 'active' : '';
        const isShow = index === 0 ? 'show active' : '';

        // --- A. Construction des boutons d'onglets en haut ---
        tabsHtml += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive}" id="${service.id}-tab" data-bs-toggle="tab" data-bs-target="#${service.id}" type="button" role="tab" onclick="updateSidebar('${service.id}')">
                    ${service.title}
                </button>
            </li>
        `;

        // --- B. Construction du contenu de l'onglet ---
        let serviceContent = '';

        // Si la partie est vide
        if ((!service.methods || service.methods.length === 0) && (!service.types || service.types.length === 0)) {
            serviceContent = `<div class="alert alert-secondary">Aucune méthode ou type répertorié dans cette section.</div>`;
        } else {

            // --- B.1. Génération des Méthodes ---
            if (service.methods && service.methods.length > 0) {
                serviceContent += '<h2 class="mb-4 pb-2 border-bottom">Méthodes</h2>';

                service.methods.forEach(m => {
                    // Création d'une "carte" visuelle pour chaque méthode
                    serviceContent += `
                    <div class="card" id="method-${m.name}">
                        <div class="card-header bg-success text-white d-flex align-items-center">
                            <h5 class="mb-0 me-2">${m.name}</h5>
                        </div>
                        <div class="card-body">
                            <p class="card-text">${m.description}</p>`;

                    // Tableau des paramètres entrants
                    if (m.params && m.params.length > 0) {
                        serviceContent += `
                            <h6 class="mt-3 text-secondary">Paramètres:</h6>
                            <table class="table table-hover table-bordered mb-2">
                                <thead class="table-light"><tr><th class="w-25">Nom</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                <tbody>
                                    ${m.params.map(p => {
                                        // On ajoute l'exposant si l'attribut obl_note est renseigné dans le JSON
                                        // Si une note existe pour cet exposant, on cherche son texte dans m.notes
                                        let sup = '';
                                        if (p.obl_note && m.notes && m.notes[p.obl_note]) {
                                            let noteText = escapeHtml(m.notes[p.obl_note]);
                                            // On ajoute les attributs Bootstrap data-bs-toggle="tooltip" et title
                                            sup = `<sup data-bs-toggle="tooltip" data-bs-placement="top" title="${noteText}" style="cursor: pointer; text-decoration: underline dotted;">(${p.obl_note})</sup>`;
                                        } else if (p.obl_note) {
                                            sup = `<sup>(${p.obl_note})</sup>`;
                                        }

                                        //let sup = p.obl_note ? `<sup>(${p.obl_note})</sup>` : '';
                                        return `<tr>
                                            <td><code>${p.name}</code></td>
                                            <td>${linkify(p.type)}</td>
                                            <td class="text-center fw-bold">${p.obl || ''} ${sup}</td>
                                            <td>${p.comment || ''}</td>
                                        </tr>`;
                                            }).join('')}
                                </tbody>
                            </table>`;

                        // Affichage des notes contextuelles de la méthode (si présentes)
                        if (m.notes && Object.keys(m.notes).length > 0) {
                            serviceContent += `
                                <div class="p-2 mb-4 bg-light text-muted border rounded" style="font-size: 0.9em;">
                                    <ul class="mb-0 ps-3" style="list-style-type: none; padding-left: 0 !important;">
                                        ${Object.entries(m.notes).map(([key, text]) => `
                                            <li><small><sup>(${key})</sup> ${escapeHtml(text)}</small></li>
                                        `).join('')}
                                    </ul>
                                </div>`;
                        } else {
                            serviceContent += `<div class="mb-4"></div>`; // Espace si pas de notes
                        }
                    } else {
                        serviceContent += `<p class="text-muted mb-4"><em>Aucun paramètre entrant.</em></p>`;
                    }

                    // Analyse et affichage de ce que la méthode Retourne
                    // Analyse et affichage de ce que la méthode Retourne
                    serviceContent += `<h6 class="text-secondary">Retourne:</h6>`;

                    if (m.returns_types && m.returns_types.length > 0) {
                        // Cas multi-listes : Rendu professionnel par cartes/onglets avec maillage et tableaux complets
                        serviceContent += `<div class="multi-returns-container mb-3">`;

                        m.returns_types.forEach((retItem, rIdx) => {
                            let cleanType = cleanTypeName(retItem.type);
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
                    <i class="bi bi-collection me-1"></i> ${escapeHtml(retItem.label || 'Liste')} : ${linkify(retItem.type)}
                </span>
                ${retItem.comment ? `<small class="text-muted">${escapeHtml(retItem.comment)}</small>` : ''}
            </div>
            ${matchedType ? `
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 260px; overflow-y: auto;">
                    <table class="table table-sm table-hover table-bordered mb-0 align-middle">
                        <thead class="table-light sticky-top">
                            <tr><th class="ps-3 w-25">Propriété</th><th>Type</th><th class="text-center">Obl.</th><th>Commentaires</th></tr>
                        </thead>
                        <tbody>
                            ${matchedType.props.map(p => `
                                <tr>
                                    <td class="ps-3"><code>${p.name}</code></td>
                                    <td>${linkify(p.type)}</td>
                                    <td class="text-center text-danger fw-bold">${p.obl || ''}</td>
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
                        // Cas standard (type unique existant)
                        let returnTypeRaw = m.returns || m.returns_type;
                        let cleanRetType = cleanTypeName(returnTypeRaw);
                        let matchedType = null;

                        for (let s of apiData.services) {
                            if (s.types) {
                                let found = s.types.find(t => t.name === cleanRetType);
                                if (found) { matchedType = found; break; }
                            }
                        }

                        if (matchedType) {
                            serviceContent += `
                                <div class="alert alert-light border">
                                    <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}<br><br>
                                    <table class="table table-sm table-bordered bg-white mb-0">
                                        <thead class="table-light"><tr><th class="w-25">Propriété</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                        <tbody>
                                            ${matchedType.props.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center text-danger fw-bold">${p.obl || ''}</td><td>${escapeHtml(p.comment || '')}</td></tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>`;
                                            } else if (m.returns_props && m.returns_props.length > 0) {
                                                serviceContent += `
                                <div class="alert alert-light border">
                                    <strong>Type de retour : </strong> ${linkify(m.returns_type || 'Objet détaillé')}<br><br>
                                    <table class="table table-sm table-bordered bg-white mb-0">
                                        <thead class="table-light"><tr><th class="w-25">Propriété</th><th>Type</th><th>Commentaires</th></tr></thead>
                                        <tbody>
                                            ${m.returns_props.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td>${escapeHtml(p.comment || '')}</td></tr>`).join('')}
                                        </tbody>
                                    </table>
                                </div>`;
                        } else if (returnTypeRaw) {
                            serviceContent += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
                        }
                    }

                    // Si le type retourné est un objet connu, on dessine son tableau de propriétés
                    if (matchedType) {
                        serviceContent += `
                            <div class="alert alert-light border">
                                <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}<br><br>
                                <table class="table table-sm table-bordered bg-white mb-0">
                                    <thead class="table-light"><tr><th class="w-25">Propriété</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                    <tbody>
                                        ${matchedType.props.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center text-danger fw-bold">${p.obl || ''}</td><td>${p.comment || ''}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>`;
                        // Sinon, si les propriétés de retour sont définies manuellement dans la méthode
                    } else if (m.returns_props && m.returns_props.length > 0) {
                        serviceContent += `
                            <div class="alert alert-light border">
                                <strong>Type de retour : </strong> ${linkify(m.returns_type || 'Objet détaillé')}<br><br>
                                <table class="table table-sm table-bordered bg-white mb-0">
                                    <thead class="table-light"><tr><th class="w-25">Propriété</th><th>Type</th><th>Commentaires</th></tr></thead>
                                    <tbody>
                                        ${m.returns_props.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td>${p.comment || ''}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>`;
                        // Sinon, on affiche juste la phrase brute
                    } else if (returnTypeRaw) {
                        serviceContent += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
                    }

                    serviceContent += `</div></div>`;
                });
            }

            // --- B.2. Génération des Types de Données ---
            if (service.types && service.types.length > 0) {
                serviceContent += '<h2 class="mt-5 mb-4 pb-2 border-bottom">Types de Données</h2>';

                service.types.forEach(t => {
                    serviceContent += `
                    <div class="card" id="type-${t.name}">
                        <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">${t.name}</h5>
                            <!-- Bouton pour déclencher la recherche d'utilisation -->
                            <button class="btn btn-outline-light btn-sm" onclick="showUsages('${t.name}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search me-1" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                                Où est-ce utilisé ?
                            </button>
                        </div>
                        <div class="card-body p-0">
                            <table class="table table-striped table-hover mb-0">
                                <thead class="table-light"><tr><th class="ps-4 w-25">Propriété</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                <tbody>
                                    ${t.props.map(p => `<tr><td class="ps-4"><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center fw-bold">${p.obl || ''}</td><td>${p.comment || ''}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;

                    // Affichage des Notes pour le type de données (si elles existent)
                    if (t.notes && t.notes.length > 0) {
                        serviceContent += `
                            <div class="p-2 mb-4 bg-light text-muted border rounded" style="font-size: 0.9em; margin-top: -20px;">
                                <ul class="mb-0 ps-3" style="list-style-type: none; padding-left: 0 !important;">
                                    ${t.notes.map(note => `<li><small>${escapeHtml(note)}</small></li>`).join('')}
                                </ul>
                            </div>`;
                    }
                });
            }
        }

        // On ajoute tout ce contenu dans la grande boite des onglets
        contentHtml += `
            <div class="tab-pane fade ${isShow}" id="${service.id}" role="tabpanel">
                ${serviceContent}
            </div>
        `;
    });

    // Injection dans le HTML
    tabsNav.innerHTML = tabsHtml;
    tabsContent.innerHTML = contentHtml;

    // Met à jour le menu latéral pour le premier onglet actif
    updateSidebar(apiData.services[0].id);

    // Active les infobulles Bootstrap nouvellement créées
    initTooltips();
}

// 4. FONCTION POUR METTRE À JOUR LE MENU GAUCHE
function updateSidebar(serviceId) {
    const service = apiData.services.find(s => s.id === serviceId);
    const sidebar = document.getElementById('sidebar-content');

    // Si la section est vide
    if (!service || ((!service.methods || service.methods.length === 0) && (!service.types || service.types.length === 0))) {
        sidebar.innerHTML = '<p class="text-muted">Aucune donnée pour cette section.</p>';
        return;
    }

    let sbHtml = '';

    // On liste les méthodes
    if (service.methods && service.methods.length > 0) {
        sbHtml += '<h6 class="text-uppercase text-muted mt-3">Méthodes</h6><div class="mb-4">';
        service.methods.forEach(m => {
            sbHtml += `<a href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a>`;
        });
        sbHtml += '</div>';
    }

    // On liste les types
    if (service.types && service.types.length > 0) {
        sbHtml += '<h6 class="text-uppercase text-muted">Types de données</h6><div>';
        service.types.forEach(t => {
            sbHtml += `<a href="javascript:void(0)" onclick="navigateTo('${service.id}', 'type-${t.name}')">${t.name}</a>`;
        });
        sbHtml += '</div>';
    }

    // On affiche le menu
    sidebar.innerHTML = sbHtml;
}

// 5. FONCTIONS DE NAVIGATION (Clics, Scrolls, Animations)

// Active un onglet spécifique (ex: quand on clique sur un lien d'un autre onglet)
function activateTab(tabId) {
    var tabTriggerEl = document.getElementById(tabId + '-tab');
    if (tabTriggerEl) {
        var tab = new bootstrap.Tab(tabTriggerEl);
        tab.show();
        updateSidebar(tabId);
    }
}

// Fait défiler la page jusqu'à un élément spécifique
function navigateTo(serviceId, elementId) {
    // 1. Fermer la fenêtre pop-up "Où est-ce utilisé" si elle est ouverte
    var modalEl = document.getElementById('usageModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    let delay = 0;

    if (modal) {
        modal.hide();
        delay = 350; // On attend 350ms que l'animation de fermeture se termine
    }

    // 2. Effectuer la navigation
    setTimeout(() => {
        activateTab(serviceId); // Ouvre le bon onglet
        const target = document.getElementById(elementId);

        if (target) {
            // Calcule la position en compensant les 130px du menu du haut (qui est fixe)
            const y = target.getBoundingClientRect().top + window.pageYOffset - 130;
            // Défilement en douceur
            window.scrollTo({ top: y, behavior: 'smooth' });

            // Ajoute la classe CSS "highlight" pour faire clignoter l'encart en bleu
            target.classList.add('highlight');
            // Retire la classe après 2 secondes
            setTimeout(() => target.classList.remove('highlight'), 2000);
        }
    }, delay);
}

// 6. FENÊTRE POP-UP (Modal) "OÙ EST-CE UTILISÉ ?"
function showUsages(targetType) {
    let usages = []; // Tableau qui va contenir toutes nos phrases de résultat

    // On cherche dans chaque service et chaque méthode
    apiData.services.forEach(service => {
        if (service.methods) {
            service.methods.forEach(m => {
                // Détection dans returns_types (multiples)
                if (m.returns_types) {
                    m.returns_types.forEach(rt => {
                        if (cleanTypeName(rt.type) === targetType) {
                            usages.push(`<li><strong>${service.title}</strong> : Retourné dans la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a> (<em>${escapeHtml(rt.label || 'Liste')}</em>)</li>`);
                        }
                    });
                }

                // Détection dans returns_type / returns simple
                if (m.returns_type && cleanTypeName(m.returns_type) === targetType) {
                    usages.push(`<li><strong>${service.title}</strong> : Retourné par la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                } else if (m.returns && cleanTypeName(m.returns) === targetType) {
                    usages.push(`<li><strong>${service.title}</strong> : Retourné par la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                }

                // Paramètres d'entrée
                if (m.params) {
                    m.params.forEach(p => {
                        if (cleanTypeName(p.type) === targetType) {
                            usages.push(`<li><strong>${service.title}</strong> : Paramètre <code>${p.name}</code> dans la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                        }
                    });
                }
            });
        }

        // Est-ce qu'une propriété à l'intérieur d'un AUTRE type correspond ?
        if (service.types) {
            service.types.forEach(t => {
                t.props.forEach(p => {
                    if (cleanTypeName(p.type) === targetType) {
                        usages.push(`<li><strong>${service.title}</strong> : Propriété <code>${p.name}</code> dans la structure <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'type-${t.name}')">${t.name}</a></li>`);
                    }
                });
            });
        }
    });

    // On affiche le résultat dans le corps de la fenêtre modale HTML
    const body = document.getElementById('usageModalBody');
    document.getElementById('usageModalLabel').innerText = "Utilisation de " + targetType;

    if (usages.length > 0) {
        body.innerHTML = '<ul class="mb-0">' + usages.join('<br><br>') + '</ul>';
    } else {
        body.innerHTML = `<div class="alert alert-secondary mb-0">Ce type n'est pas directement référencé en tant que dépendance.</div > `;
    }

    // Commande Bootstrap pour afficher la fenêtre
    var myModal = new bootstrap.Modal(document.getElementById('usageModal'));
    myModal.show();
}

// Fonction pour activer les tooltips Bootstrap sur toute la page
function initTooltips() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}