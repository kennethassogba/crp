# Fin · Warrants

[Application](https://fin.keff.uk/) · [Méthode](https://fin.keff.uk/methode/) · [Journal](https://fin.keff.uk/research/tracker.json) · [API](https://fin.keff.uk/openapi.json)

Chaque jour ouvré, jusqu’à trois nouveaux warrants BoursoBank sont classés puis suivis. Une simulation indépendante de 1 000 € par sélection, achat à l’ask, suivi au bid, spread et courtage inclus. Sortie après vingt séances ou au premier relevé à +100 % / −50 %.

Sélection → Positions → Résultats. Chaque entrée et sa prévision restent figées. Aucun résultat antérieur reconstitué, aucune rentabilité prouvée. [Protocole complet](docs/warrants-method.md).

## Développement

Node.js 24, Python 3.

    npm ci
    npm run check
    npm test
    npm run build
    npm run dev
    npm run test:fin
    npm run test:ui
    npm run test:theme
    npm run test:install
    npm run test:pwa
    npm run smoke

Le serveur écoute sur http://127.0.0.1:5185. L’interface est sombre et installable. Les tests d’interface incluent clavier, mobile, graphiques, panne de données et reprise hors ligne.

## Mise à jour

Le workflow `.github/workflows/research-daily.yml` collecte les nouvelles fiches et les prix, actualise les positions ouvertes, clôture les sorties constatées, puis fige le nouveau lot. Il est planifié à 21 h 30 UTC lundi–vendredi ; les retards GitHub restent possibles. Le déploiement Cloudflare suit les commits sur main.

    npm run research:quotes
    npm run research:collect
    npm run research:track
    npm run research:package

Le journal n’est pas réinitialisé lors d’une mise à jour. Un prix absent reste indisponible. Les 1 000 € sont par sélection, pas un capital global réinvesti.

## Sources et modèle

`lib/warrant-tracker.mjs` contient les filtres, la réévaluation avant échéance, le classement, les règles de sortie et les statistiques. `public/research/tracker.json` conserve les cohortes et les prix observés ; `snapshot.json` conserve le catalogue et les historiques de marché. Le moteur de référence à échéance et ses tests indépendants restent dans `lib/warrants.mjs`. Le jeu de référence du 16 octobre est figé.

Prix publics indicatifs, horaires de lecture, caractéristiques extraites des fiches Bourso. Le DIC reste à vérifier avant un achat réel. Le modèle suppose taux et dividendes nuls, spread et change constants ; il n’a pas de validation prospective suffisante.

Graphiques [TradingView Lightweight Charts](https://www.tradingview.com/), licence Apache-2.0, attribution conservée dans l’application. Voir `THIRD_PARTY_NOTICES.md`.

## Accès agent

MCP en lecture seule : https://fin.keff.uk/mcp. Outils : `get_warrant_selections`, `get_warrant_positions`, `get_warrant_results`, `get_warrant_catalog`. Aucun achat, clé privée ou appel payant.

CRP a été retiré. Ses anciennes routes et API répondent 410. L’ancien domaine redirige vers Fin. Le Worker conserve son identifiant historique et le stockage D1 existant, sans lecture ni exécution de CRP. Les anciens journaux ne sont pas effacés.
