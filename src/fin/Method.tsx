import React from "react";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";

const chapters = [
  [
    "01",
    "Définir le pari",
    "Fixer une date, un budget, un multiple cible et une règle de sortie avant de regarder les résultats. Un ×5 du warrant signifie un remboursement de cinq fois son prix d’achat, pas un bénéfice de cinq fois la mise.",
  ],
  [
    "02",
    "Vérifier le contrat",
    "Lire le DIC : call ou put, strike, ratio, devise, référence de règlement, échéance et dernier jour de négociation. Le moteur accepte les warrants européens standard. Il exclut turbos, barrières, produits cappés et exercice américain.",
  ],
  [
    "03",
    "Enregistrer le prix",
    "Utiliser l’ask pour acheter et le bid pour une sortie anticipée. Conserver l’heure, la source, la quantité disponible, le marché et les frais du courtier. Un cours de clôture ou un midprice ne prouve pas qu’un ordre serait exécuté.",
  ],
  [
    "04",
    "Construire les scénarios",
    "Calculer les variations glissantes du sous-jacent sur l’horizon restant. Comparer un an et cinq ans. Par défaut, diviser les facteurs de variation par leur moyenne : la hausse passée de l’action n’est pas une prévision.",
  ],
  [
    "05",
    "Chiffrer les résultats",
    "Appliquer la formule contractuelle à chaque scénario, convertir la devise, soustraire prix d’achat et courtage. Compter les scénarios rentables, ceux à ×5, ceux à zéro. Une forte espérance peut coexister avec une probabilité de perte très élevée.",
  ],
  [
    "06",
    "Contester le résultat",
    "Rééchantillonner des blocs pour tenir compte des fenêtres qui se chevauchent. Comparer plusieurs régimes de volatilité, stresser le change et augmenter les frais. Une borne basse positive sur le seul modèle choisi après coup n’est pas une preuve.",
  ],
  [
    "07",
    "Valider dans le futur",
    "Enregistrer chaque candidat et chaque rejet avant le mouvement, avec les données disponibles à cet instant. Conserver aussi les expirations sans valeur. Mesurer ensuite calibration, espérance réalisée et drawdown, sans modifier les règles de sélection.",
  ],
];
export function Method() {
  return (
    <article className="method-page">
      <div className="eyebrow">Méthode</div>
      <h1>Analyser un warrant</h1>
      <p className="intro">
        Calculer les gains à l’échéance, puis vérifier ce qui change selon les
        hypothèses.
      </p>
      <div className="method-actions">
        <a className="button" href="/research/protocole.md" download>
          <ArrowDownToLine size={15} /> Protocole complet
        </a>
        <a className="button secondary" href="/research/recherche.zip" download>
          <ArrowDownToLine size={15} /> Code et données
        </a>
      </div>
      <nav className="chapter-nav" aria-label="Chapitres de la méthode">
        <a href="#protocol">Protocole</a>
        <a href="#maths">Calculs</a>
        <a href="#scale">Passer à l’échelle</a>
        <a href="#limits">Limites</a>
        <a href="#sources">Sources</a>
      </nav>
      <section id="protocol">
        <h2>Du contrat au résultat</h2>
        <div className="steps">
          {chapters.map(([n, title, text]) => (
            <div className="step" key={n}>
              <span className="step-number">{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section id="maths">
        <h2>Calculer le remboursement</h2>
        <p>Pour un call en dollars, payé en euros :</p>
        <pre tabIndex={0}>
          Remboursement = max(S_final − strike, 0) × ratio / EURUSD{`\n`}Gain
          net = quantité × remboursement − coût d’achat{`\n`}Espérance = moyenne
          des gains nets des scénarios
        </pre>
        <p>
          Pour un put, remplacer S_final − strike par strike − S_final. Le seuil
          de rentabilité intègre le courtage. Le gain d’un call n’est pas
          plafonné ; celui d’un put standard est borné par un sous-jacent à
          zéro, pour un change donné.
        </p>
        <h3>Trois lectures du même produit</h3>
        <ul>
          <li>
            <strong>Historique centré.</strong> Variations réellement observées
            ; hausse moyenne retirée. Les queues de distribution restent
            empiriques.
          </li>
          <li>
            <strong>Lognormal.</strong> Rendement moyen nul, volatilité calculée
            sur 20, 60 ou 252 séances. Sert à mesurer la sensibilité, sans
            supposer qu’une volatilité passée se reproduira.
          </li>
          <li>
            <strong>Bootstrap par blocs.</strong> Intervalle conditionnel sur
            l’espérance, avec des blocs de la taille de l’horizon. Les scénarios
            glissants ne sont pas des essais indépendants.
          </li>
        </ul>
        <p>
          Le calendrier compte les jours de semaine et exclut Thanksgiving, Noël
          et le jour de l’An. Il reste approximatif : brancher le calendrier
          officiel de la place pour un calcul destiné à l’exécution. La
          volatilité implicite de l’émetteur n’est pas une probabilité physique.
        </p>
      </section>
      <section id="scale">
        <h2>Passer à l’échelle</h2>
        <div className="pipeline">
          <span>Catalogue</span>
          <i>→</i>
          <span>Contrôles</span>
          <i>→</i>
          <span>Scénarios</span>
          <i>→</i>
          <span>Validation</span>
          <i>→</i>
          <span>Journal</span>
        </div>
        <h3>Ce qui fonctionne dans cette version</h3>
        <p>
          Importer un catalogue CSV jusqu’à 10 000 lignes ou un jeu JSON avec
          ses historiques. Le classement calcule les mêmes métriques pour chaque
          contrat. Les calculs s’exécutent dans un Web Worker ; import et suivi
          restent dans ce navigateur. L’export contient les hypothèses et la
          version du moteur.
        </p>
        <pre tabIndex={0}>
          npm run research:collect # actualiser les historiques publics{`\n`}npm
          run research:screen # analyser tout le catalogue hors navigateur{`\n`}
          npm run test:research # vérifier le moteur financier
        </pre>
        <h3>La cotation est le premier verrou</h3>
        <p>
          La collecte quotidienne relève les fourchettes publiques Bourso à 22 h
          30 UTC les jours ouvrés. Elle recharge les clôtures et le change, et
          cherche de nouveaux contrats sur Nasdaq-100, Nvidia, Tesla, AMD et
          Palantir. Chaque produit garde la date de son relevé. Les erreurs sont
          visibles dans Données.
        </p>
        <h3>Une architecture pour un catalogue plus large</h3>
        <p>
          Collecter une fois les prix et DIC, dédupliquer par ISIN, conserver
          les réponses brutes et leur empreinte. Calculer les variations une
          fois par sous-jacent et horizon ; appliquer ensuite les remboursements
          à tout le groupe. Lancer le bootstrap sur une présélection, avec une
          concurrence bornée, puis archiver les résultats.
        </p>
        <h3>Éviter la chasse aux faux positifs</h3>
        <p>
          En testant des milliers de produits et de paramètres, on trouve des
          espérances positives par hasard. Séparer les périodes de sélection et
          de validation, fixer les seuils à l’avance et corriger les
          comparaisons multiples. L’intervalle affiché ici n’est pas corrigé
          pour cette sélection. « À valider » reste un signal de recherche.
        </p>
        <h3>Utiliser un LLM pour vérifier les documents</h3>
        <p>
          Extraire les termes d’un DIC, retrouver une date de résultats,
          proposer des risques à tester. Chaque champ doit garder sa source et
          être validé. Le LLM ne fournit ni prix, ni probabilité, ni classement
          financier sans calcul vérifiable. Aucun appel de modèle payant n’est
          lancé par Warrants.
        </p>
      </section>
      <section id="limits">
        <h2>Ce que le modèle laisse ouvert</h2>
        <ul>
          <li>
            Les probabilités portent sur le remboursement à l’échéance, pas sur
            la possibilité de revendre à ×5 avant cette date.
          </li>
          <li>
            Les données quotidiennes ne permettent pas de reproduire un ordre
            intrajournalier, un spread changeant ou un arrêt de cotation.
          </li>
          <li>
            Les régimes changent. Les annonces de résultats créent des sauts et
            une baisse de volatilité après publication.
          </li>
          <li>
            Le change reste fixé dans le modèle. Modifier EUR/USD est un
            scénario, pas une distribution jointe action/change.
          </li>
          <li>
            Fiscalité, défaut de l’émetteur, résiliation extraordinaire et coût
            d’opportunité ne sont pas modélisés.
          </li>
          <li>
            Le suivi est local au navigateur et peut être effacé ou modifié. Il
            ne constitue pas un registre d’audit inviolable.
          </li>
        </ul>
      </section>
      <section id="sources">
        <h2>Sources et reproduction</h2>
        <div className="source-list">
          <a href="https://www.sgbourse.fr/" target="_blank" rel="noreferrer">
            Société Générale · contrats et DIC <ArrowUpRight size={15} />
          </a>
          <a
            href="https://www.boursorama.com/content/brochure_tarifaire/boursorama_bt.pdf"
            target="_blank"
            rel="noreferrer"
          >
            BoursoBank · tarifs <ArrowUpRight size={15} />
          </a>
          <a
            href="https://finance.yahoo.com/quote/PLTR/history/"
            target="_blank"
            rel="noreferrer"
          >
            Yahoo Finance · historiques quotidiens <ArrowUpRight size={15} />
          </a>
          <a href="/research/etude-palantir.md">
            Étude Palantir d’origine <ArrowUpRight size={15} />
          </a>
          <a href="/research/snapshot.json">
            Jeu de données versionné <ArrowUpRight size={15} />
          </a>
          <a href="/research/schema.json">
            Schéma d’import JSON <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
    </article>
  );
}
