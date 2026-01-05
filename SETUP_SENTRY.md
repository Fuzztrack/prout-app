# Installation de Sentry pour le crash reporting en production

Sentry capture automatiquement les crashes en production avec des stack traces complètes, même si vous ne pouvez pas les reproduire en local.

## 1. Créer un compte Sentry

1. Allez sur https://sentry.io/signup/
2. Créez un compte (gratuit jusqu'à 5k événements/mois)
3. Créez un nouveau projet :
   - **Platform**: React Native
   - **Framework**: Expo

## 2. Installation des packages

```bash
npm install @sentry/react-native
npx expo install expo-dev-client
```

## 3. Configuration Sentry

### 3.1. Initialiser Sentry dans `app/_layout.tsx`

Ajoutez au début du fichier (après les imports) :

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'VOTRE_DSN_SENTRY', // À récupérer depuis votre projet Sentry
  enableInExpoDevelopment: false, // Ne pas capturer en dev
  debug: false, // Mettre à true pour debug en dev
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 1.0, // 100% des transactions (ajustez selon vos besoins)
});
```

### 3.2. Wrapper l'app avec ErrorBoundary

Sentry fournit un ErrorBoundary automatique, mais vous pouvez aussi en créer un custom :

```typescript
// Dans app/_layout.tsx
import { Sentry } from '@sentry/react-native';

export default function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      {/* Votre code existant */}
    </Sentry.ErrorBoundary>
  );
}
```

## 4. Ajout du plugin Expo (optionnel mais recommandé)

Dans `app.json`, ajoutez le plugin Sentry :

```json
{
  "expo": {
    "plugins": [
      [
        "sentry-expo",
        {
          "organization": "votre-org",
          "project": "votre-projet",
          "authToken": "votre-auth-token"
        }
      ]
    ]
  }
}
```

## 5. Capturer des erreurs manuellement

Vous pouvez aussi capturer des erreurs spécifiques :

```typescript
import * as Sentry from '@sentry/react-native';

try {
  // Votre code
} catch (error) {
  Sentry.captureException(error);
  // Gérer l'erreur
}

// Ou avec contexte
Sentry.captureException(error, {
  tags: { feature: 'notifications' },
  extra: { userId: user.id },
});
```

## 6. Tester Sentry

Pour tester que Sentry fonctionne, ajoutez un bouton de test (à retirer après) :

```typescript
// Test en production uniquement
if (!__DEV__) {
  const testSentry = () => {
    Sentry.captureMessage('Test Sentry - Tout fonctionne !');
  };
}
```

## 7. Build avec Sentry

Après installation, vous devez rebuilder l'app :

```bash
# Nettoyer et rebuilder
npx expo prebuild --clean
eas build --platform ios
eas build --platform android
```

## 8. Variables d'environnement (recommandé)

Créez un fichier `.env` (et ajoutez-le au `.gitignore`) :

```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

Puis utilisez `expo-constants` pour y accéder :

```typescript
import Constants from 'expo-constants';

const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn;
```

## Avantages de Sentry

✅ **Stack traces symbolisées** : Même en production minifiée, vous voyez les vraies lignes de code  
✅ **Contexte utilisateur** : User ID, device, OS version  
✅ **Breadcrumbs** : Actions avant le crash  
✅ **Alertes** : Notification par email/Slack quand un crash arrive  
✅ **Groupement** : Les mêmes crashes sont groupés  
✅ **Release tracking** : Suivi par version de l'app  

## Alternative légère : ErrorBoundary simple

Si vous voulez juste capturer les erreurs React sans Sentry pour l'instant :

```typescript
// components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // Ici vous pouvez envoyer l'erreur à votre backend
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oups ! Une erreur est survenue</Text>
          <Text style={styles.text}>L'application va redémarrer...</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ebb89b',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#604a3e',
  },
  text: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
  },
});

export default ErrorBoundary;
```

Puis dans `app/_layout.tsx` :

```typescript
import ErrorBoundary from '../components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      {/* Votre code existant */}
    </ErrorBoundary>
  );
}
```

## Recommandation

Je recommande **Sentry** car c'est la solution la plus complète et facile à mettre en place. Le plan gratuit suffit largement pour commencer.



