Module de filtres pour les différents types de daltonismes avec une page html de test. 

Il faut faire bien attention à :
- conserver l'ARIA présent (vérifier qu'on peut activer/désactiver le fltres avec le bouton toggle au clavier, et qu'on peut bien déroule les paramètres des filtres).
- conserver la possibilité d'activer plusieurs filtres en même selon les contraintes imposés (impossible d'activer Deutéranopie et Deutéranomalie en même temps, même chose pour Protanopie et Protanomalie, Tritanopie et Tritanomalie, et Achromatopsie n'est pas cominable à autre chose)
- conserver les explications et les raccourcis claviers.
- conserver les textes de la sidebar en noir (#00000).
- conserver les icônes, suivies par les en-têtes de filtres, puis le bouton toggle d'activation/désactivation du filtre.
- intégrer un ordre de priorité pour éviter les conflits : la modification de la taille du texte du filtre achromatopsie surpasse les autres fonctionnalité de modification de taille du texte.
- faire attention à ce qu'après avoir fermé la page web avec le filtre achromatopsie actif, celui-ci soit bien actif mais qu'il puisse bien se désactiver après avoir relancer la page.
- conserver le fait que le contraste entre le texte et le fond soit toujours bien différenciable lorsque le filtre achromatopsia (Achromatopsie) est actif (avec la garde automatique de contraste qui agit uniquement sur la couleur du texte, élément par élément, en lui appliquant automatiquement la couleur offrant le meilleur contraste (noir ou blanc) dès que le contraste tombe sous le seuil requis).
