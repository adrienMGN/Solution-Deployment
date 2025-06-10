# SAE Déploiement de Solution

## Description
Solution de déploiement sécurisée pour une application d'enregistrement audio avec base de données MongoDB, développée avec Node.js et déployable via Docker Compose.

## Architecture du Projet

### Structure des Services
```
Solution-Deployment/
├── docker-compose.yaml          # Orchestration des services
├── Dockerfile                   # Image de l'application Node.js
├── server.js                    # Serveur principal
├── models.js                    # Modèles de données
├── public/                      # Fichiers statiques web
├── data/                        # Données de l'application
├── uploads/                     # Fichiers uploadés
├── secrets/                     # Secrets Docker Swarm
│   ├── mongo_root_user.txt
│   ├── mongo_root_password.txt
│   ├── mongo_user.txt
│   └── mongo_user_password.txt
└── appArmor/                    # Profils de sécurité AppArmor
    ├── audio-recorder_profile
    └── mongo-express_profile
```

### Services Déployés

#### 1. **MongoDB** (`audiorecorder-mongodb`)
- **Image**: `mongo:7.0`
- **Port**: `27017`
- **Fonction**: Base de données principale pour stocker les métadonnées des enregistrements audio (NoSQL pertinent car pas besoin de relations)
- **Volumes**: Persistance des données via `mongodb_data`

#### 2. **Mongo Express** (`audiorecorder-mongo-express`)
- **Image**: `mongo-express:latest`
- **Port**: `8081`
- **Fonction**: Interface web d'administration MongoDB
- **Accès**: Interface graphique pour la gestion de la base de données

#### 3. **Audio Recorder App** (`audio-recorder-app`)
- **Image**: Construite depuis le Dockerfile local
- **Port**: `3000`
- **Fonction**: Application principale Node.js pour l'enregistrement et la gestion audio
- **Volumes**: Dossier `uploads` pour le stockage des fichiers audio

## Choix de Sécurité

### 1. **Dockerfile - Sécurisation de l'Image**

#### Utilisateur Non-Root
```dockerfile
# Création d'un utilisateur dédié non-privilégié
RUN addgroup -S nodejs && adduser -S audioapp -G nodejs
USER audioapp
```
- **Principe**: Éviter l'exécution en tant que root pour limiter les privilèges
- **Avantage**: Réduction de la surface d'attaque en cas de compromission

#### Image Alpine
```dockerfile
FROM node:18-alpine
```
- **Choix**: Image Linux Alpine pour sa légèreté et sa sécurité
- **Avantages**: 
  - Surface d'attaque réduite
  - Moins de vulnérabilités potentielles
  - Image plus petite (~50MB vs ~200MB)

#### Gestion des Permissions
```dockerfile
RUN chown -R audioapp:nodejs /app
RUN mkdir -p uploads && chown -R audioapp:nodejs uploads
```
- **Principe**: Attribution correcte des permissions aux fichiers et dossiers
- **Sécurité**: Accès restreint aux ressources nécessaires uniquement

### 2. **Docker Compose - Sécurisation des Services**

#### Gestion des Secrets

ajout de ./secrets dans le .gitignore 
les fihciers sont à créer avec mes identifiants suivant: 

admin mdp : admin123
audioapp mdp : audioapp123

```yaml
secrets:
  mongo_root_user:
    file: ./secrets/mongo_root_user.txt
  mongo_root_password:
    file: ./secrets/mongo_root_password.txt
  mongo_user_password:
    file: ./secrets/mongo_user_password.txt
  mongo_user:
    file: ./secrets/mongo_user.txt
```
- **Principe**: Utilisation des secrets Docker Swarm
- **Avantages**: 
  - Credentials non exposés dans les variables d'environnement
  - Chiffrement des secrets au repos et en transit
  - Accès contrôlé via les montages `/run/secrets/`

#### Isolation Réseau
```yaml
networks:
  audio-network:
    driver: bridge
```
- **Principe**: Réseau privé dédié pour l'inter-communication des services
- **Sécurité**: Isolation du trafic applicatif du réseau host

#### Exposition Sélective des Ports
```yaml
ports:
  - "3000:3000"    # Application (exposition nécessaire)
  - "27017:27017"  # MongoDB (dev/debug uniquement)
  - "8081:8081"    # Mongo Express (administration)
```
- **Principe**: Exposition minimale des ports
- **Recommandation Production**: Supprimer l'exposition des ports MongoDB et Mongo Express

#### Profils AppArmor

à mettre en place avec ./scripts/appArmor_setup.sh

```yaml
security_opt:
  - apparmor:audio-recorder_profile
  - apparmor:mongo-express_profile
```
- **Principe**: Contrôle d'accès obligatoire (MAC)
- **Fonctionnalités**:
  - Restriction des appels système
  - Contrôle d'accès aux fichiers et répertoires
  - Limitation des capacités réseau
  - Protection contre l'escalade de privilèges

### 3. **Profils AppArmor Détaillés**

#### Audio Recorder Profile
```bash
# Accès contrôlé aux ressources
/app/** rw,              # Application directory
/run/secrets/** r,       # Docker secrets (lecture seule)
/tmp/** rw,              # Fichiers temporaires
network,                 # Accès réseau contrôlé
```

#### Restrictions Importantes
- Accès en lecture seule aux secrets
- Pas d'accès aux répertoires système sensibles
- Contrôle strict des exécutables autorisés
- Limitation des capacités réseau

### 4. **Health Checks**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
```
- **Monitoring**: Vérification automatique de l'état de l'application
- **Resilience**: Redémarrage automatique en cas de défaillance

## Déploiement

### Prérequis
- Docker Engine 20.10+
- Docker Compose V2
- AppArmor activé (sur les systèmes Linux compatibles)

### Installation
```bash
# Cloner le repository
git clone <repository-url>
cd Solution-Deployment

# Créer les fichiers secrets
mkdir -p secrets
echo "admin" > secrets/mongo_root_user.txt
echo "secure_password" > secrets/mongo_root_password.txt
echo "appuser" > secrets/mongo_user.txt
echo "app_password" > secrets/mongo_user_password.txt

# Démarrer les services
docker-compose up -d
```

### Accès aux Services
- **Application Audio Recorder**: http://localhost:3000
- **Mongo Express** (Admin): http://localhost:8081
- **MongoDB**: localhost:27017 (accès direct)


## Monitoring et Logs

### Health Checks
Tous les services intègrent des vérifications de santé automatiques pour assurer la disponibilité et permettre le redémarrage automatique en cas de défaillance.

### Logs
```bash
# Consulter les logs
docker-compose logs -f audio-recorder
docker-compose logs -f mongodb
docker-compose logs -f mongo-express
```
## Workflow

Une github action est mise en place afin de s'assurer que les conteneurs démarrent correctement.

## Contribution
Les contributions sont les bienvenues. Merci de respecter les standards de sécurité établis lors de vos propositions de modifications.
