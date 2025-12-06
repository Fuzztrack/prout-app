#!/bin/bash

# Script pour clean build iOS avant EAS build

echo "🧹 Nettoyage du build iOS..."

# 1. Nettoyer le dossier build iOS
echo "📦 Suppression du dossier build iOS..."
rm -rf ios/build
rm -rf ios/DerivedData

# 2. Nettoyer les pods
echo "📦 Nettoyage des pods..."
cd ios
pod deintegrate 2>/dev/null || true
pod cache clean --all 2>/dev/null || true
rm -rf Pods
rm -rf Podfile.lock
cd ..

# 3. Nettoyer le cache Xcode
echo "📦 Nettoyage du cache Xcode..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 4. Nettoyer le cache Metro
echo "📦 Nettoyage du cache Metro..."
rm -rf .expo
rm -rf node_modules/.cache

# 5. Régénérer les assets (optionnel, décommentez si nécessaire)
# echo "📦 Régénération des assets..."
# npx expo prebuild --platform ios --clean

echo "✅ Clean terminé !"
echo ""
echo "Vous pouvez maintenant lancer :"
echo "  eas build --platform ios --profile production --local"




