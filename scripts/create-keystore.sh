#!/bin/bash

# Script pour créer un keystore Android automatiquement
# Usage: ./scripts/create-keystore.sh

KEYSTORE_NAME="prout-release-key.jks"
KEYSTORE_ALIAS="prout-key"
KEYSTORE_PASSWORD="ProutApp2024!"  # Changez ce mot de passe !

echo "🔑 Création du keystore Android..."
echo ""

# Vérifier si keytool est disponible
if ! command -v keytool &> /dev/null; then
    echo "❌ Erreur: keytool n'est pas trouvé. Assurez-vous que Java JDK est installé."
    exit 1
fi

# Créer le keystore avec des valeurs par défaut
keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_NAME" \
    -alias "$KEYSTORE_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEYSTORE_PASSWORD" \
    -dname "CN=ProutApp, OU=Development, O=ProutApp, L=Paris, ST=Ile-de-France, C=FR"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore créé avec succès: $KEYSTORE_NAME"
    echo ""
    echo "⚠️  IMPORTANT: Notez ces informations:"
    echo "   - Fichier: $KEYSTORE_NAME"
    echo "   - Alias: $KEYSTORE_ALIAS"
    echo "   - Mot de passe: $KEYSTORE_PASSWORD"
    echo ""
    echo "📝 Vous pouvez maintenant uploader ce fichier dans EAS CLI"
else
    echo ""
    echo "❌ Erreur lors de la création du keystore"
    exit 1
fi




