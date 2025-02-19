# Plugin InfoFlow pour Obsidian

Ce plugin intègre [InfoFlow](https://www.infoflow.app) avec Obsidian, vous permettant de synchroniser vos articles, pages web, notes et surlignages enregistrés directement dans votre coffre-fort Obsidian.

InfoFlow est un système de gestion des connaissances personnelles (PKMS) qui vous permet d'enregistrer des articles, des pages web, des publications X, des vidéos YouTube, des notes et des surlignages à partir de votre navigateur et de les synchroniser avec votre coffre-fort Obsidian.

[Version chinoise](./README_zh.md)

Ce plugin est encore en développement.
Veuillez signaler tout problème en utilisant les issues GitHub ou en contactant [le support InfoFlow](https://www.infoflow.app/support). Merci pour votre soutien !

## Fonctionnalités

- Synchroniser les éléments InfoFlow avec votre coffre-fort Obsidian
- Convertir automatiquement le contenu HTML en Markdown
- Modèles de nommage de fichiers personnalisables
- Modèles de notes personnalisables avec frontmatter
- Prise en charge des surlignages et des annotations
- Filtrer la synchronisation par date, tags et dossiers
- Options de synchronisation manuelle et automatique

## Installation

1. Ouvrez les paramètres d'Obsidian
2. Allez dans Plugins communautaires et désactivez le mode sans échec
3. Cliquez sur Parcourir et recherchez "InfoFlow"
4. Installez le plugin et activez-le

## Configuration

1. Obtenez votre jeton API InfoFlow (peut être créé sur <https://www.infoflow.app/user_portal/external_token>)
   - À l'avenir, un abonnement InfoFlow sera nécessaire pour utiliser ce jeton API
2. Ouvrez les paramètres du plugin dans Obsidian
3. Entrez votre jeton API
4. Configurez les paramètres de synchronisation :
   - Dossier cible pour les notes synchronisées
   - Modèle de nom de fichier
   - Modèle de note
   - Fréquence de synchronisation

### Variables de modèle disponibles

#### Modèle de nom de fichier
- `{{title}}` - Titre de l'élément
- `{{id}}` - ID de l'élément
- `{{itemType}}` - Type d'élément (page_web, pdf, etc.)

#### Modèle de note
- `{{title}}` - Titre de l'élément
- `{{url}}` - URL source
- `{{itemType}}` - Type d'élément
- `{{author}}` - Métadonnées de l'auteur
- `{{tags}}` - Tags de l'élément
- `{{createdAt}}` - Date de création
- `{{updatedAt}}` - Date de dernière mise à jour
- `{{content}}` - Contenu principal
- `{{notes}}` - Section des surlignages/annotations

## Utilisation

### Synchronisation manuelle
1. Cliquez sur l'icône de synchronisation InfoFlow dans le ruban de gauche
2. Ou utilisez la palette de commandes et recherchez "Synchroniser les éléments InfoFlow"

### Synchronisation automatique
Le plugin se synchronisera automatiquement en fonction de la fréquence de synchronisation que vous avez configurée.

### Filtrage
Vous pouvez filtrer les éléments à synchroniser par :
- Plage de dates
- Tags
- Dossiers
- Heure de la dernière mise à jour

## Exigences

- Un compte InfoFlow Cloud actif. Les versions locales avec Google Drive ou OneDrive ne sont PAS prises en charge en raison de la nature du plugin Obsidian (un serveur centralisé est nécessaire pour synchroniser les fichiers).
- Jeton API InfoFlow
- Obsidian v0.15.0 ou supérieur

## Support

- Visitez [le support InfoFlow](https://www.infoflow.app/support)
- Signalez les problèmes sur GitHub

## Licence

Licence MIT. Voir LICENSE pour plus de détails.