# Fin · Warrants

Direction demandée : Linear pour la structure, Apple Bourse pour la lecture des prix. Une application plein écran, sombre uniquement, dans React.

Trois destinations : Sélection, Positions, Résultats. Barre latérale sur ordinateur, navigation basse sur mobile. Méthode et installation accessibles depuis le menu. Aucun fil d’Ariane redondant, aucun bouton d’actualisation.

Le conteneur occupe 100dvh, sans défilement du document. La liste est paginée selon l’espace disponible. Sur ordinateur, liste et analyse côte à côte ; sur mobile, liste puis analyse avec retour explicite. Une URL retrouve chaque position. Les écrans très courts et le texte agrandi peuvent défiler à l’intérieur du panneau pour conserver tous les accès.

Noir #000000, panneau #111113, texte #eeeff1, secondaire #a2a4ac. Bleu #8ac1ff pour les gains, rouge #ff9ca6 pour les pertes, signes et libellés en plus de la couleur. Police système Apple, Public Sans ailleurs. Pas de logo décoratif, de vert, de Geist ni de bordure latérale colorée.

Les lignes portent l’information. Texte de 16 px minimum, nombres tabulaires, commandes de 44 px. Pas de petites notes ni de paragraphes permanents. Les informations de calcul sont accessibles depuis le bouton près de « Gain moyen prévu » ; Position, Prévision et Sources ouvrent des feuilles avec des rubriques courtes. Le graphique principal reste visible hors de ces feuilles.

Graphiques TradingView : valeur et date au pointeur, au toucher et au clavier ; périodes, zoom et cadrage. La courbe occupe la hauteur restante. Historique réel atténué avant la sélection et bleu ensuite. Le sous-jacent, le bid du warrant et le capital sont des séries distinctes, explicitement nommées. Aucune courbe inventée, aucun historique du warrant reconstruit depuis le sous-jacent.

La synchronisation consulte les données toutes les minutes, reprend au retour en ligne ou au premier plan et conserve le graphique si rien n’a changé. Les prix sources restent des relevés quotidiens ; cette distinction apparaît dans les informations de source. Les erreurs annoncent la reconnexion automatique.

Interrupteur FR/EN visible dans chaque barre d’actions, et dans la fiche mobile. Le bouton indique la langue de destination ; son nom accessible est rédigé dans cette langue. Le choix est conservé localement et partagé entre les onglets. Le français reste la valeur initiale. Changer de langue conserve le warrant, les filtres et le focus. Les dates, nombres, pourcentages, légendes et aides suivent la langue ; les horaires de collecte restent en UTC et les relevés en heure de Paris. Le protocole documentaire lié reste explicitement indiqué en français dans l’interface anglaise.
