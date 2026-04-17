# 📋 FONCTIONS CLIENT POUR LE FLUX D'INVITATION

## 📁 Fichier: `app/Invitation.tsx`

### 1. `loadPendingInvitations()`
**Ligne:** 45-144  
**Description:** Charge toutes les invitations en attente pour l'utilisateur actuel.

**Fonctionnalités:**
- Récupère l'utilisateur actuel et son profil
- Charge toutes les invitations `pending` de la table `invitations`
- Filtre les invitations qui correspondent à l'utilisateur par :
  - `to_user_id` (invitation directe)
  - `to_email` (comparaison insensible à la casse)
  - `to_pseudo` (comparaison exacte)
  - `to_phone` (normalisation et comparaison)
- Récupère les pseudos des expéditeurs
- Met à jour l'état `pendingInvitations`

**Utilisation:**
```typescript
await loadPendingInvitations();
```

---

### 2. `handleAcceptInvitation(invitation: PendingInvitation)`
**Ligne:** 147-239  
**Description:** Accepte une invitation en attente.

**Fonctionnalités:**
- Vérifie si la relation A→B existe dans `friends`
- Si elle n'existe pas, la crée avec `method: 'invitation'` et `status: 'pending'`
- Met à jour la relation A→B de `pending` à `accepted`
- Le trigger `handle_invitation_accept()` crée automatiquement la réciproque B→A
- Met à jour le statut de l'invitation dans la table `invitations` à `accepted`
- Recharge les invitations en attente

**Flux:**
1. Vérifier si relation A→B existe
2. Si non, créer A→B avec `method: 'invitation'`
3. UPDATE A→B: `status = 'accepted'`
4. Trigger crée automatiquement B→A
5. UPDATE `invitations`: `status = 'accepted'`

**Utilisation:**
```typescript
handleAcceptInvitation(invitation);
```

---

### 3. `handleRejectInvitation(invitation: PendingInvitation)`
**Ligne:** 242-285  
**Description:** Rejette une invitation en attente.

**Fonctionnalités:**
- Affiche une confirmation avant de rejeter
- Met à jour le statut de l'invitation à `rejected` dans la table `invitations`
- Recharge les invitations en attente

**Utilisation:**
```typescript
handleRejectInvitation(invitation);
```

---

### 4. `loadContacts()`
**Ligne:** 300-359  
**Description:** Charge tous les contacts du téléphone de l'utilisateur.

**Fonctionnalités:**
- Vérifie et demande la permission d'accès aux contacts
- Récupère tous les contacts avec leurs numéros de téléphone
- Normalise les numéros de téléphone
- Filtre les numéros trop courts (< 8 caractères)
- Trie les contacts par nom
- Met à jour l'état `contacts` et affiche la liste

**Utilisation:**
```typescript
await loadContacts();
```

---

### 5. `handleInviteByValue()`
**Ligne:** 365-618  
**Description:** Envoie une invitation par email ou pseudo.

**Fonctionnalités:**
- **Mode Email:**
  - Valide le format de l'email
  - Normalise l'email (minuscules, trim)
  - Crée une entrée dans la table `invitations` avec `to_email`
  
- **Mode Pseudo:**
  - Vérifie si le pseudo correspond à un utilisateur existant
  - Si l'utilisateur existe:
    - Vérifie les relations existantes (A→B et B→A)
    - Vérifie s'il y a déjà une invitation en pending
    - Si relation A→B existe, la met à jour en `invitation` + `pending`
    - Sinon, crée une nouvelle relation A→B avec `method: 'invitation'` et `status: 'pending'`
    - Crée aussi une entrée dans `invitations` avec `to_user_id` pour que B puisse voir l'invitation
  - Si l'utilisateur n'existe pas:
    - Crée une entrée dans `invitations` avec `to_pseudo`

**Gestion des erreurs:**
- Vérifie les relations existantes avant de créer
- Affiche des messages d'erreur appropriés
- Logs détaillés pour le débogage

**Utilisation:**
```typescript
// Définir le mode d'invitation
setInviteMode('email'); // ou 'pseudo'
setInviteValue('user@example.com'); // ou 'pseudo123'
handleInviteByValue();
```

---

### 6. `handleContactSelect(contact: Contact)`
**Ligne:** 620-699  
**Description:** Gère la sélection d'un contact depuis la liste.

**Fonctionnalités:**
- Vérifie si le numéro de téléphone correspond à un utilisateur existant
- **Si utilisateur existe:**
  - Crée directement une relation dans `friends` avec `method: 'contact'`
  - Le trigger `handle_friend_creation()` définit automatiquement `status: 'accepted'`
  - Note: La réciproque B→A doit être créée via `create_mutual_friendship()` RPC
- **Si utilisateur n'existe pas:**
  - Crée une invitation dans la table `invitations` avec `to_phone`

**Utilisation:**
```typescript
handleContactSelect(contact);
```

---

### 7. `handleInviteFriend()`
**Ligne:** 361-363  
**Description:** Lance le chargement des contacts pour inviter depuis la liste.

**Fonctionnalités:**
- Appelle `loadContacts()` pour charger les contacts
- Affiche la liste des contacts

**Utilisation:**
```typescript
handleInviteFriend();
```

---

### 8. `filteredContacts` (useMemo)
**Ligne:** 288-297  
**Description:** Filtre les contacts en fonction de la recherche.

**Fonctionnalités:**
- Filtre les contacts par nom (insensible à la casse)
- Utilise `useMemo` pour optimiser les performances

**Utilisation:**
```typescript
const filtered = filteredContacts; // Utilisé dans FlatList
```

---

## 📁 Fichier: `app/home.tsx`

### 9. `matchContactsAutomatically(currentUserId: string, contactPhones: Set<string>)`
**Ligne:** 221-393  
**Description:** Match automatiquement les contacts du téléphone avec les utilisateurs de l'app.

**Fonctionnalités:**
- Récupère tous les profils utilisateurs avec numéros de téléphone
- Compare les numéros normalisés pour trouver les correspondances
- Vérifie les relations existantes dans les deux sens (A→B et B→A)
- Vérifie s'il y a des invitations en pending (dans `friends` et `invitations`)
- Exclut les utilisateurs qui ont déjà une relation ou une invitation en pending
- Crée les relations mutuelles via `create_mutual_friendship()` RPC avec `method: 'contact'`

**Protection contre les conflits:**
- Ne crée pas de relation si une invitation est en pending dans l'un ou l'autre sens
- Vérifie les deux tables (`friends` et `invitations`)
- Logs détaillés pour le débogage

**Utilisation:**
```typescript
const contactPhones = new Set<string>(['+33123456789', '+33987654321']);
await matchContactsAutomatically(userId, contactPhones);
```

---

## 🔄 FLUX COMPLET D'INVITATION

### Scénario 1: A invite B par pseudo (B existe déjà)

1. **A appelle `handleInviteByValue()` avec mode 'pseudo'**
   - Vérifie si B existe dans `user_profiles`
   - Vérifie les relations existantes (A→B et B→A)
   - Crée A→B dans `friends` avec `method: 'invitation'`, `status: 'pending'`
   - Crée entrée dans `invitations` avec `to_user_id: B.id`

2. **B voit l'invitation**
   - `loadPendingInvitations()` charge l'invitation (filtre par `to_user_id`)

3. **B accepte l'invitation**
   - `handleAcceptInvitation()` met à jour A→B: `status = 'accepted'`
   - Trigger `handle_invitation_accept()` crée automatiquement B→A avec `status: 'accepted'`
   - Les deux utilisateurs sont maintenant amis

---

### Scénario 2: A invite B par email (B n'existe pas encore)

1. **A appelle `handleInviteByValue()` avec mode 'email'**
   - Crée entrée dans `invitations` avec `to_email`

2. **B s'inscrit plus tard**
   - `loadPendingInvitations()` charge l'invitation (filtre par `to_email`)

3. **B accepte l'invitation**
   - `handleAcceptInvitation()` crée d'abord A→B si elle n'existe pas
   - Met à jour A→B: `status = 'accepted'`
   - Trigger crée B→A automatiquement

---

### Scénario 3: Matching automatique des contacts

1. **Au démarrage de l'app**
   - `matchContactsAutomatically()` est appelée avec les contacts du téléphone
   - Trouve les correspondances avec les utilisateurs existants
   - Vérifie qu'il n'y a pas d'invitation en pending
   - Crée les relations mutuelles via `create_mutual_friendship()` RPC avec `method: 'contact'`

2. **Protection**
   - Ne crée pas de relation si une invitation est en pending
   - Vérifie les deux sens (A→B et B→A)

---

## 🔑 POINTS IMPORTANTS

1. **Table `friends`:**
   - `method: 'invitation'` → Créée manuellement, nécessite acceptation
   - `method: 'contact'` → Créée automatiquement, acceptée immédiatement
   - `status: 'pending'` → En attente d'acceptation
   - `status: 'accepted'` → Acceptée

2. **Table `invitations`:**
   - Utilisée pour les invitations par email/pseudo/téléphone
   - `to_user_id` peut être NULL si l'utilisateur n'existe pas encore
   - Permet de filtrer les invitations reçues

3. **Triggers SQL:**
   - `handle_friend_creation()` → Définit le `status` selon le `method`
   - `handle_invitation_accept()` → Crée la réciproque B→A quand A→B passe à `accepted`

4. **Fonction RPC:**
   - `create_mutual_friendship()` → Crée les deux relations mutuelles pour les contacts
   - Contourne la RLS pour créer B→A
   - Vérifie qu'il n'y a pas d'invitation en pending

---

## 📝 NOTES DE DÉVELOPPEMENT

- Toutes les fonctions gèrent les erreurs avec `try/catch`
- Les logs détaillés sont ajoutés pour le débogage
- Les valeurs sont normalisées (email en minuscules, téléphones normalisés)
- Les vérifications de relations existantes sont faites avant chaque création
- Les états de chargement sont gérés avec `loading` et `loadingInvitations`

