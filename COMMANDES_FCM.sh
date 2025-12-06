#!/bin/bash
# Script pour configurer FCM dans l'app

echo "🚀 Configuration FCM pour ProutApp"
echo ""

cd /Users/fuzz/ProutAppavecNest

echo "📦 Étape 1/4 : Installation des dépendances..."
npm install

echo ""
echo "📱 Étape 2/4 : Installation expo-dev-client..."
npx expo install expo-dev-client

echo ""
echo "🔧 Étape 3/4 : Génération des fichiers natifs Android..."
npx expo prebuild --platform android --clean

echo ""
echo "✅ Étape 4/4 : Build de l'app Android..."
echo "Lancez maintenant : npm run android"
echo ""
echo "📝 Vérifications après le build :"
echo "  - Les logs doivent montrer : ✅ Token FCM mis à jour"
echo "  - Vérifiez dans Supabase que expo_push_token contient un token FCM"
echo "  - Testez l'envoi d'un prout entre deux devices"


