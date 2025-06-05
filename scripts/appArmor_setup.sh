#!/bin/bash
set -e

PROFILES_DIR="../appArmor"

# Liste des profils à déployer
profiles=(
  "audio-recorder_profile"
  "mongo-db_profile"
  "mongo-express_profile"
)

echo "Déploiement des profils AppArmor..."

for profile in "${profiles[@]}"; do
  src="$PROFILES_DIR/$profile"
  dst="/etc/apparmor.d/$profile"

  if [[ ! -f "$src" ]]; then
    echo "Profil $profile non trouvé dans $PROFILES_DIR. Abort."
    exit 1
  fi

  echo "Copie du profil $profile vers /etc/apparmor.d/"
  sudo cp "$src" "$dst"

  echo "Chargement du profil $profile"
  sudo apparmor_parser -r "$dst"
done

echo "Tous les profils ont été déployés et chargés avec succès."

# Optionnel: afficher l'état des profils
echo
echo "État actuel des profils AppArmor :"
sudo aa-status
