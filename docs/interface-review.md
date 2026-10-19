# Revue Fin — CRP à 100 € et mode sombre, 20 octobre 2026

## Scope and coverage

Périmètre : comparaison CRP, décisions détaillées, historique et règles, thème sombre partagé avec Warrants, navigation et PWA. Les parcours Warrants existants ont été rejoués sur les neuf routes. React 19, TypeScript, CSS partagé, Public Sans et Lucide conservés. Conventions : `AGENTS.md`, `DESIGN.md` et demande explicite de mode sombre du 20 octobre. Les six compétences better-* ont été chargées dans cette conversation ; elles ont guidé la revue. Textes français relus avec avoid-ai-writing, sans réécrire les réponses archivées des modèles.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `src/fin/Comparison.tsx:107`, dialogues natifs, scans axe, restauration du focus, clavier, toucher dans `scripts/check-ui.mjs` | Aucun problème critical/serious dans les états Chromium contrôlés |
| Layout | Neuf routes × quatre largeurs, trois largeurs CRP, texte CRP à 200 % et miroir RTL | Aucun débordement dans les cas testés ; grille adaptée à la taille du texte |
| Writing | Base de 100 €, montants clôturés/en cours, dates, prix manquants, erreur modèle, méthode et budget | Distinctions explicites ; raisons archivées préservées |
| Typography | Public Sans partagé, valeurs tabulaires, échelles, champs mobiles et captures | Police conservée ; pas de Geist ni de titre en serif |
| Color | Mode sombre forcé, dix paires dans `output/playwright/contrast-dark.json`, scans axe | Texte et contrôles contrôlés conformes aux seuils AA ; aucun vert |
| UI polish | Graphique comparatif, trois tracés nommés avec styles distincts, survol/toucher/clavier, fermeture du volet et PWA | Interactions testées ; aucune animation nécessaire à la compréhension |

## Findings

Constats résolus pendant cette révision. Le choix du mode sombre suit le brief ; le thème clair antérieur n’est pas traité comme une faute d’accessibilité.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Layout | `src/fin/style.css:1952`, `src/fin/Comparison.tsx:107` | La première grille mobile débordait à 320 px avec texte à 200 % | Requête de conteneur fondée sur la taille de texte et onglets repliables sur plusieurs lignes | Les valeurs et actions doivent rester atteignables |
| HIGH | Accessibility | `src/fin/Comparison.tsx:299`, `src/fin/Charts.tsx` | La sortie du pointeur tactile effaçait la valeur choisie après un tap | Réinitialisation seulement au départ de la souris ; lecture tactile persistante | Le toucher doit laisser le temps de lire les données |
| MEDIUM | Writing | `lib/crp-performance.mjs:16`, `src/fin/Comparison.tsx:107` | Le gain réalisé de zéro masquait la présence de positions non clôturées | Capital estimé, gain net total et part en cours ; cours manquant affiché comme indisponible | Un résultat non encore clôturé doit être identifiable |
| MEDIUM | Layout | `src/fin/Crp.tsx`, `src/fin/main.tsx` | Décisions et résultats répartis entre deux vues, cinq modèles | Un comparatif initial avec trois portefeuilles à 100 €, détails à la demande | Comparer les modèles sans changer de page |
| MEDIUM | Writing | `lib/crp-performance.mjs:3`, règles CRP et API | Montants du journal USD à 10 000, sans base commune en euros à l’écran | Référence de 100 €, normalisation documentée, change et coûts modèles séparés | Éviter de présenter une conversion de devises ou un compte réel qui n’existe pas |

## Verification

Contrôles locaux exécutés :

- `npm run check`, `npm test` : typage et 37 tests, dont neuf nouveaux contrôles de normalisation, valorisation, coûts, causalité, sources, stops, liquidation et relève quotidienne sans double comptage. La valorisation à l’horizon reproduit exactement le règlement du moteur existant.
- `npm run test:fin` : 36 combinaisons de routes/largeurs, détail Warrants, simulateur, import, sauvegarde/annulation, persistance, navigation et récupération d’erreur.
- `npm run test:ui` : comparaison à 100 €, gains positifs et négatifs de fixtures, espèces, BTC, ETH, échec, retard, détail, focus, clavier, souris, toucher, historique, texte à 200 % et RTL à trois largeurs. Les fixtures ne sont jamais écrites dans D1.
- `npm run test:theme` : mode sombre et dix paires de contraste. Texte principal 16,42:1, secondaire 7,59:1 sur page et 7,21:1 sur panneau, perte 9,50:1, bouton principal 5,45:1, limite de contrôle 3,12:1. Trois tracés au-dessus de 8,9:1.
- `npm run test:install` : six groupes de cas ; `npm run test:pwa` : installabilité Chromium, chargement, erreur, données vides et reprise réseau. Les données financières ne sont pas mises en cache par le service worker.
- `npm run build` et smoke local : application unique, API publique, nouveaux outils MCP, validation des paramètres et refus des écritures.

Captures et sorties : `output/playwright/`. Les valeurs de gain utilisées dans les captures nommées `fixture` sont des données de test. Les captures de production sont séparées.

Écriture : une passe de réduction et de clarification sur les nouveaux textes, puis relecture française. Aucun score de détecteur anglais n’est présenté comme une validation du français. Les cours, formules, références et réponses enregistrées ne sont pas des textes promotionnels.

Not verified : installation sur appareil physique, VoiceOver/TalkBack et tous les moteurs de navigateur. Les 100 € sont une unité de comparaison, hors variation EUR/USD et minimums d’ordre. Ces contrôles ne prouvent aucune performance future ni possibilité d’exécution réelle.

## Verdict

Approve dans le périmètre Chromium testé. Le journal, les dépenses historiques et le plafond fournisseur sont conservés. Aucun nouvel appel de modèle n’a été déclenché par les tests. Aucun avertissement de design n’a été masqué.
