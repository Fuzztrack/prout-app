# Vérification Cohérence Listes et Noms de Prouts

## 📋 Liste des Prouts (IDs)

### ✅ Frontend React Native (`components/FriendsList.tsx`)
- **PROUT_SOUNDS** : prout1 à prout20 (20 prouts)
- Format : `prout1: require('../assets/sounds/prout1.wav')`

### ✅ Backend (`backend/src/prout/prout.service.ts`)
- **VALID_PROUTS** : prout1 à prout20 + identity-request + identity-response
- Format : `'prout1','prout2',...'prout20'`

### ✅ lib/notifications.ts
- **PROUT_SOUNDS** : prout1 à prout20 (20 prouts)
- Format : `'prout1','prout2',...'prout20'`

### ✅ iOS (`app.json`)
- **sounds** : prout1.wav à prout20.wav (20 fichiers)
- Format : `"./assets/sounds/prout1.wav"` à `"./assets/sounds/prout20.wav"`

### ✅ Android (`ProutMessagingService.kt`)
- **Pas de liste explicite** : utilise `resolveSoundUri()` qui cherche dynamiquement via `getIdentifier(proutKey, "raw", packageName)`
- Fallback : `R.raw.prout1` si ressource non trouvée
- ✅ Compatible avec prout1 à prout20

## 🎨 Noms des Prouts (Traductions)

### Français (FR)

| Prout | Backend | i18n | ✅ |
|-------|---------|------|-----|
| prout1 | La Petite Bourrasque | La Petite Bourrasque | ✅ |
| prout2 | Le Crépitant | Le Crépitant | ✅ |
| prout3 | Le Rebond du Tonnerre | Le Rebond du Tonnerre | ✅ |
| prout4 | Le Faux Départ | Le Faux Départ | ✅ |
| prout5 | Le Frelon Trébuchant | Le Frelon Trébuchant | ✅ |
| prout6 | Le Kraken Douillet | Le Kraken Douillet | ✅ |
| prout7 | La Farandole | La Farandole | ✅ |
| prout8 | Le Question Réponse | Le Question Réponse | ✅ |
| prout9 | Le Oulala… Problème | Le Oulala… Problème | ✅ |
| prout10 | Kebab Party ! | Kebab Party ! | ✅ |
| prout11 | La Mitraille Molle | La Mitraille Molle | ✅ |
| prout12 | La Rafale Infernale | La Rafale Infernale | ✅ |
| prout13 | Le Lâché Prise | Le Lâché Prise | ✅ |
| prout14 | Le Basson Dubitatif | Le Basson Dubitatif | ✅ |
| prout15 | La Fantaisie de Minuit | La Fantaisie de Minuit | ✅ |
| prout16 | Le Marmiton Furieux | Le Marmiton Furieux | ✅ |
| prout17 | L'Éclair Fromager | L'Éclair Fromager | ✅ |
| prout18 | L'Impromptu | L'Impromptu | ✅ |
| prout19 | Le Tuba Chaotique | Le Tuba Chaotique | ✅ |
| prout20 | L'Eternel | L'Eternel | ✅ |

### Anglais (EN)

| Prout | Backend | i18n | ✅ |
|-------|---------|------|-----|
| prout1 | The Little Gust | The Little Gust | ✅ |
| prout2 | The Crackling | The Crackling | ✅ |
| prout3 | The Thunder Bounce | The Thunder Bounce | ✅ |
| prout4 | The False Start | The False Start | ✅ |
| prout5 | The Stumbling Hornet | The Stumbling Hornet | ✅ |
| prout6 | The Cuddly Kraken | The Cuddly Kraken | ✅ |
| prout7 | The Farandole | The Farandole | ✅ |
| prout8 | The Question Answer | The Question Answer | ✅ |
| prout9 | The Oops... Problem | The Oops... Problem | ✅ |
| prout10 | Kebab Party! | Kebab Party! | ✅ |
| prout11 | The Soft Machine Gun | The Soft Machine Gun | ✅ |
| prout12 | The Infernal Burst | The Infernal Burst | ✅ |
| prout13 | The Let Go | The Let Go | ✅ |
| prout14 | The Doubtful Bassoon | The Doubtful Bassoon | ✅ |
| prout15 | The Midnight Fantasy | The Midnight Fantasy | ✅ |
| prout16 | The Furious Cook | The Furious Cook | ✅ |
| prout17 | The Cheesy Lightning | The Cheesy Lightning | ✅ |
| prout18 | The Impromptu | The Impromptu | ✅ |
| prout19 | The Chaotic Tuba | The Chaotic Tuba | ✅ |
| prout20 | The Eternal | The Eternal | ✅ |

### Espagnol (ES)

| Prout | Backend | i18n | ✅ |
|-------|---------|------|-----|
| prout1 | La Pequeña Ráfaga | La Pequeña Ráfaga | ✅ |
| prout2 | El Crepitante | El Crepitante | ✅ |
| prout3 | El Rebote del Trueno | El Rebote del Trueno | ✅ |
| prout4 | La Falsa Salida | La Falsa Salida | ✅ |
| prout5 | El Avispón Tropezón | El Avispón Tropezón | ✅ |
| prout6 | El Kraken Tierno | El Kraken Tierno | ✅ |
| prout7 | La Farándula | La Farándula | ✅ |
| prout8 | La Pregunta Respuesta | La Pregunta Respuesta | ✅ |
| prout9 | El Oops... Problema | El Oops... Problema | ✅ |
| prout10 | Fiesta Kebab | Fiesta Kebab | ✅ |
| prout11 | La Ametralladora Blanda | La Ametralladora Blanda | ✅ |
| prout12 | La Ráfaga Infernal | La Ráfaga Infernal | ✅ |
| prout13 | El Dejar Ir | El Dejar Ir | ✅ |
| prout14 | El Fagot Dudoso | El Fagot Dudoso | ✅ |
| prout15 | La Fantasía de Medianoche | La Fantasía de Medianoche | ✅ |
| prout16 | El Cocinero Furioso | El Cocinero Furioso | ✅ |
| prout17 | El Relámpago Quesoso | El Relámpago Quesoso | ✅ |
| prout18 | El Improvisado | El Improvisado | ✅ |
| prout19 | La Tuba Caótica | La Tuba Caótica | ✅ |
| prout20 | El Eterno | El Eterno | ✅ |

### Portugais (PT-BR)

| Prout | Backend | i18n | ✅ |
|-------|---------|------|-----|
| prout1 | A Brisa Leve | A Brisa Leve | ✅ |
| prout2 | O Pipoco | O Pipoco | ✅ |
| prout3 | O Trovão Quicante | O Trovão Quicante | ✅ |
| prout4 | O Alarme Falso | O Alarme Falso | ✅ |
| prout5 | O Marimbondo Bêbado | O Marimbondo Bêbado | ✅ |
| prout6 | O Polvo Fofinho | O Polvo Fofinho | ✅ |
| prout7 | A Festa Junina | A Festa Junina | ✅ |
| prout8 | A Entrevista | A Entrevista | ✅ |
| prout9 | O Vixi Mainha | O Vixi Mainha | ✅ |
| prout10 | Churrasco na Laje! | Churrasco na Laje! | ✅ |
| prout11 | A Metralhadora de Feijão | A Metralhadora de Feijão | ✅ |
| prout12 | O Furacão Baiano | O Furacão Baiano | ✅ |
| prout13 | O Desapego | O Desapego | ✅ |
| prout14 | A Corneta Duvidosa | A Corneta Duvidosa | ✅ |
| prout15 | O Fantasma da Madrugada | O Fantasma da Madrugada | ✅ |
| prout16 | O Cozinheiro Pistola | O Cozinheiro Pistola | ✅ |
| prout17 | O Raio de Queijo | O Raio de Queijo | ✅ |
| prout18 | O De Repente | O De Repente | ✅ |
| prout19 | A Tuba Desafinada | A Tuba Desafinada | ✅ |
| prout20 | O Infinito e Além | O Infinito e Além | ✅ |

### Allemand (DE)

**⚠️ MANQUANT dans i18n.ts** : Le backend a PROUT_NAMES_DE mais i18n.ts n'a pas de section 'de' avec prout_names.

### Italien (IT)

**⚠️ MANQUANT dans i18n.ts** : Le backend a PROUT_NAMES_IT mais i18n.ts n'a pas de section 'it' avec prout_names.

## 📊 Résumé

### ✅ Cohérence Liste des Prouts
- **Frontend** : prout1 à prout20 ✅
- **Backend** : prout1 à prout20 + identity-request/response ✅
- **iOS** : prout1.wav à prout20.wav ✅
- **Android** : Recherche dynamique (compatible) ✅

### ✅ Cohérence Noms (FR, EN, ES, PT-BR)
- **Tous identiques** entre backend et i18n ✅

### ⚠️ Langues Manquantes dans i18n.ts
- **Allemand (DE)** : Backend a PROUT_NAMES_DE mais pas dans i18n.ts
- **Italien (IT)** : Backend a PROUT_NAMES_IT mais pas dans i18n.ts

## 🔧 Recommandations

1. **Ajouter les traductions DE et IT dans i18n.ts** pour être cohérent avec le backend
2. **Vérifier que les fichiers audio** prout1.wav à prout20.wav existent bien dans `assets/sounds/`
3. **Android** : Vérifier que les ressources R.raw.prout1 à R.raw.prout20 existent dans `android/app/src/main/res/raw/`
