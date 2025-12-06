#!/bin/bash
# Script pour désinstaller complètement l'app Android et réinstaller

echo "🔧 Désinstallation de l'app Android..."
adb uninstall com.fuzztrack.proutapp

echo "✅ App désinstallée"
echo ""
echo "📱 Pour réinstaller l'app :"
echo "   - Relancer: npx expo run:android"
echo "   - Ou installer un nouveau build"
echo ""
echo "⚠️  Les canaux Android seront recréés avec la bonne configuration au prochain démarrage"



