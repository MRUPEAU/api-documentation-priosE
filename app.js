let apiData = {};

// Récupération des données depuis le fichier JSON externe
fetch('api_data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.json();
    })
    .then(data => {
        apiData = data;
        document.getElementById('doc-date').textContent = apiData.doc_date || "Non spécifiée";
        render();
    })
    .catch(error => {
        console.error("Erreur lors du chargement:", error);
        document.getElementById('doc-date').textContent = "Erreur";
        document.getElementById('error-container').innerHTML = `
            <div class="alert alert-danger">
                <strong>Erreur :</strong> Impossible de charger le fichier <code>api_data.json</code>.<br>
                Vérifiez qu'il est bien présent et accessible.
            </div>`;
    });

function escapeHtml(unsafe) {
    return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanTypeName(typeStr) {
    if(!typeStr) return "";
    return typeStr.replace('List<', '').replace('Liste de ', '').replace('>', '').replace('Objet de type ', '').trim();
}

function linkify(typeStr) {
    if (!typeStr) return "";
    let cleanType = cleanTypeName(typeStr);
    let escapedType = escapeHtml(typeStr);
    
    let exists = false;
    let targetTab = '';
    for(let i=0; i<apiData.services.length; i++) {
        if(apiData.services[i].types && apiData.services[i].types.find(t => t.name === cleanType)) {
            exists = true; 
            targetTab = apiData.services[i].id;
            break;
        }
    }
    
    if (exists) {
        return escapedType.replace(cleanType, `<a class="type-link" href="javascript:void(0)" onclick="navigateTo('${targetTab}', 'type-${cleanType}')">${cleanType}</a>`);
    }
    return escapedType;
}

function render() {
    const tabsNav = document.getElementById('mainTabs');
    const tabsContent = document.getElementById('mainTabsContent');
    
    let tabsHtml = '';
    let contentHtml = '';

    apiData.services.forEach((service, index) => {
        const isActive = index === 0 ? 'active' : '';
        const isShow = index === 0 ? 'show active' : '';

        tabsHtml += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive}" id="${service.id}-tab" data-bs-toggle="tab" data-bs-target="#${service.id}" type="button" role="tab" onclick="updateSidebar('${service.id}')">
                    ${service.title}
                </button>
            </li>
        `;

        let serviceContent = '';
        
        if((!service.methods || service.methods.length === 0) && (!service.types || service.types.length === 0)) {
            serviceContent = `<div class="alert alert-secondary">Aucune méthode ou type répertorié dans cette section.</div>`;
        } else {
            if(service.methods && service.methods.length > 0) {
                serviceContent += '<h2 class="mb-4 pb-2 border-bottom">Méthodes</h2>';
                service.methods.forEach(m => {
                    serviceContent += `
                    <div class="card" id="method-${m.name}">
                        <div class="card-header bg-success text-white d-flex align-items-center">
                            <h5 class="mb-0 me-2">${m.name}</h5>
                        </div>
                        <div class="card-body">
                            <p class="card-text">${m.description}</p>`;
                    
                    if(m.params && m.params.length > 0) {
                        serviceContent += `
                            <h6 class="mt-3 text-secondary">Paramètres:</h6>
                            <table class="table table-hover table-bordered mb-4">
                                <thead class="table-light"><tr><th class="w-25">Nom</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                <tbody>
                                    ${m.params.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center"><strong>${p.obl || ''}</strong></td><td>${p.comment || ''}</td></tr>`).join('')}
                                </tbody>
                            </table>`;

                        // Affichage des notes pour la méthode ---
                        if (m.notes && m.notes.length > 0) {
                            serviceContent += `
                                        <div class="p-2 mb-4 bg-light text-muted border rounded" style="font-size: 0.9em;">
                                            <ul class="mb-0 ps-3" style="list-style-type: none; padding-left: 0 !important;">
                                                ${m.notes.map(note => `<li><small>${escapeHtml(note)}</small></li>`).join('')}
                                            </ul>
                                        </div>`;
                        } else {
                            serviceContent += `<div class="mb-4"></div>`; // Espace si pas de note
                        }
                    } else {
                        serviceContent += `<p class="text-muted"><em>Aucun paramètre entrant.</em></p>`;
                    }

                    let returnTypeRaw = m.returns || m.returns_type;
                    let cleanRetType = cleanTypeName(returnTypeRaw);
                    let matchedType = null;
                    for(let s of apiData.services) {
                        if(s.types) {
                            let found = s.types.find(t => t.name === cleanRetType);
                            if(found) { matchedType = found; break; }
                        }
                    }

                    serviceContent += `<h6 class="text-secondary mt-4">Retourne:</h6>`;
                    
                    if (matchedType) {
                        serviceContent += `
                            <div class="alert alert-light border">
                                <strong>Type de retour : </strong> ${linkify(returnTypeRaw)}<br><br>
                                <table class="table table-sm table-bordered bg-white mb-0">
                                    <thead class="table-light"><tr><th class="w-25">Propriété</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                    <tbody>
                                        ${matchedType.props.map(p => `<tr><td><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center"><strong>${p.obl || ''}</strong></td><td>${p.comment || ''}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
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
                            </div>
                        `;
                    } else if (returnTypeRaw) {
                        serviceContent += `<p class="fs-6">${linkify(returnTypeRaw)}</p>`;
                    }

                    serviceContent += `</div></div>`;
                });
            }

            if(service.types && service.types.length > 0) {
                serviceContent += '<h2 class="mt-5 mb-4 pb-2 border-bottom">Types de Données</h2>';
                service.types.forEach(t => {
                    serviceContent += `
                    <div class="card" id="type-${t.name}">
                        <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">${t.name}</h5>
                            <button class="btn btn-outline-light btn-sm" onclick="showUsages('${t.name}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search me-1" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                                Où est-ce utilisé ?
                            </button>
                        </div>
                        <div class="card-body p-0">
                            <table class="table table-striped table-hover mb-0">
                                <thead class="table-light"><tr><th class="ps-4 w-25">Propriété</th><th>Type</th><th>Obl.</th><th>Commentaires</th></tr></thead>
                                <tbody>
                                    ${t.props.map(p => `<tr><td class="ps-4"><code>${p.name}</code></td><td>${linkify(p.type)}</td><td class="text-center"><strong>${p.obl || ''}</strong></td><td>${p.comment || ''}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;

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

        contentHtml += `
            <div class="tab-pane fade ${isShow}" id="${service.id}" role="tabpanel">
                ${serviceContent}
            </div>
        `;
    });

    tabsNav.innerHTML = tabsHtml;
    tabsContent.innerHTML = contentHtml;
    
    updateSidebar(apiData.services[0].id);
}

function updateSidebar(serviceId) {
    const service = apiData.services.find(s => s.id === serviceId);
    const sidebar = document.getElementById('sidebar-content');
    
    if(!service || ( (!service.methods || service.methods.length === 0) && (!service.types || service.types.length === 0) )) {
        sidebar.innerHTML = '<p class="text-muted">Aucune donnée pour cette section.</p>';
        return;
    }

    let sbHtml = '';
    if(service.methods && service.methods.length > 0) {
        sbHtml += '<h6 class="text-uppercase text-muted mt-3">Méthodes</h6><div class="mb-4">';
        service.methods.forEach(m => {
            sbHtml += `<a href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a>`;
        });
        sbHtml += '</div>';
    }
    
    if(service.types && service.types.length > 0) {
        sbHtml += '<h6 class="text-uppercase text-muted">Types de données</h6><div>';
        service.types.forEach(t => {
            sbHtml += `<a href="javascript:void(0)" onclick="navigateTo('${service.id}', 'type-${t.name}')">${t.name}</a>`;
        });
        sbHtml += '</div>';
    }

    sidebar.innerHTML = sbHtml;
}

function activateTab(tabId) {
    var tabTriggerEl = document.getElementById(tabId + '-tab');
    if(tabTriggerEl) {
        var tab = new bootstrap.Tab(tabTriggerEl);
        tab.show();
        updateSidebar(tabId);
    }
}

function navigateTo(serviceId, elementId) {
    var modalEl = document.getElementById('usageModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    let delay = 0;
    if (modal) {
        modal.hide();
        delay = 350;
    }

    setTimeout(() => {
        activateTab(serviceId);
        const target = document.getElementById(elementId);
        if (target) {
            const y = target.getBoundingClientRect().top + window.pageYOffset - 130;
            window.scrollTo({top: y, behavior: 'smooth'});
            
            target.classList.add('highlight');
            setTimeout(() => target.classList.remove('highlight'), 2000);
        }
    }, delay);
}

function showUsages(targetType) {
    let usages = [];
    
    apiData.services.forEach(service => {
        if(service.methods) {
            service.methods.forEach(m => {
                if(m.returns_type && cleanTypeName(m.returns_type) === targetType) {
                    usages.push(`<li><strong>${service.title}</strong> : Retourné par la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                } else if (m.returns && cleanTypeName(m.returns) === targetType) {
                    usages.push(`<li><strong>${service.title}</strong> : Retourné par la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                }
                if(m.params) {
                    m.params.forEach(p => {
                        if(cleanTypeName(p.type) === targetType) {
                            usages.push(`<li><strong>${service.title}</strong> : Paramètre <code>${p.name}</code> dans la méthode <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'method-${m.name}')">${m.name}</a></li>`);
                        }
                    });
                }
            });
        }

        if(service.types) {
            service.types.forEach(t => {
                t.props.forEach(p => {
                    if(cleanTypeName(p.type) === targetType) {
                        usages.push(`<li><strong>${service.title}</strong> : Propriété <code>${p.name}</code> dans la structure <a class="type-link" href="javascript:void(0)" onclick="navigateTo('${service.id}', 'type-${t.name}')">${t.name}</a></li>`);
                    }
                });
            });
        }
    });

    const body = document.getElementById('usageModalBody');
    document.getElementById('usageModalLabel').innerText = "Utilisation de " + targetType;

    if(usages.length > 0) {
        body.innerHTML = '<ul class="mb-0">' + usages.join('<br><br>') + '</ul>';
    } else {
        body.innerHTML = '<div class="alert alert-secondary mb-0">Ce type n\\'est pas directement référencé en tant que dépendance.</div>';
    }
    
    var myModal = new bootstrap.Modal(document.getElementById('usageModal'));
    myModal.show();
}