# Documentation Web API Prios E - Contexte du Projet

## 1. Contexte & Objectifs
Migration d'une documentation technique de services web SOAP historique (issue d'un PDF initial de 200 pages) vers une application web interactive, moderne et ergonomique pour fluidifier la consultation, la recherche et l'intégration par les prestataires externes et équipes internes[cite: 7, 8].

## 2. Architecture des Fichiers
- **index.html** : Structure squelette (intégration du CDN Bootstrap 5, conteneurs des onglets de navigation, menu latéral gauche et modale d'impact)[cite: 7, 8].
- **style.css** : Feuille de style dédiée (menu latéral sombre sobre et aéré, cartes d'API, scrollbars personnalisées, effet d'illumination/surbrillance `highlight` lors de la navigation).
- **app.js** : Moteur logique complet en JavaScript Vanilla, largement documenté (chargement dynamique du JSON, construction du DOM, maillage hypertexte `linkify`, gestion des retours simples et multi-listes scrollables, accordéons d'erreurs, modale d'impact et initialisation des infobulles Bootstrap)[cite: 7, 8].
- **api_data.json** : Base de données documentaire hiérarchisée en 10 grands domaines (services), méthodes détaillées (paramètres, notes, retours simples ou composites, comportements nominaux, anomalies et erreurs) et types de données réutilisables[cite: 7, 8].

## 3. Environnement & Outillage
- **Framework UI** : Bootstrap 5 (CDN) pour le responsive, les onglets, fenêtres modales, collapses et infobulles (*tooltips*)[cite: 8].
- **Éditeur de code** : Visual Studio / Visual Studio Code[cite: 8].
- **Environnement de test** : Serveur web local (Python `http.server`)[cite: 8].
- **Gestionnaire de versions** : Git / GitHub[cite: 8].

## 4. Fonctionnalités et Ergonomie Réalisées
- **Navigation par onglets figés (Sticky)** : Accès rapide aux 10 grands domaines de l'API en haut de page (Référence, Stock, Commande, Tiers, Supply Chain, Ventes, Offres, CRM, Cross canal, Annexe)[cite: 7, 8].
- **Menu latéral gauche dynamique** : Sommaire interactif sombre actualisé automatiquement selon l'onglet actif (liste des méthodes et des types avec surbrillance au survol)[cite: 4, 8].
- **Maillage hypertextuel intelligent (`linkify`)** : Détection et conversion automatique des types métiers dans les paramètres ou les retours en liens cliquables pointant directement vers leur structure[cite: 7, 8].
- **Navigation fluide et ciblée** : Défilement animé vers la méthode ou le type demandé avec compensation de 130 px pour l'en-tête figé et effet de surbrillance visuelle temporaire (`highlight`)[cite: 4, 8].
- **Gestion des champs obligatoires & Notes contextuelles** :
  - Exposants numérotés dans la colonne obligation (`obl_note`)[cite: 7, 8].
  - Infobulles interactives (*tooltips* Bootstrap) au survol de la souris sur les exposants[cite: 7, 8].
  - Récapitulatif contextuel des notes sous le tableau des paramètres[cite: 7, 8].
- **Gestion des retours de méthodes** :
  - Support des retours simples et des retours composites multi-listes (cartes avec en-têtes neutres et types en liens bleus).
  - Tableaux de propriétés avec hauteur optimisée (`max-height: 260px`), barre de défilement verticale et en-tête figé (`sticky-top`) pour les structures volumineuses.
- **Gestion des anomalies et codes erreurs** :
  - Encadré d'information pour le comportement nominal (`return_behavior`, ex. ligne `#INF`).
  - Bouton dépliable (*collapse* Bootstrap) répertoriant les messages d'erreurs possibles (`codeTraitement = 'X'`) et leurs causes[cite: 7].
- **Analyse d'impact croisée ("Où est-ce utilisé ?")** : Fenêtre modale scannant l'ensemble de la documentation (paramètres entrants, retours simples ou multi-listes, types imbriqués) pour lister toutes les dépendances d'un type[cite: 7, 8].