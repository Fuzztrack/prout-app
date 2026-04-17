-- ============================================
-- VÉRIFICATION ET CRÉATION DE LA CONTRAINTE UNIQUE POUR LE PSEUDO
-- ============================================

-- Vérifier si la contrainte unique existe déjà
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
AND contype = 'u'
AND conname LIKE '%pseudo%';

-- Si la contrainte n'existe pas, la créer
-- Option 1 : Contrainte UNIQUE simple
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_pseudo UNIQUE (pseudo);

-- Si vous voulez une contrainte avec un nom spécifique, utilisez :
-- ALTER TABLE user_profiles 
-- ADD CONSTRAINT unique_pseudo UNIQUE (pseudo);

-- Pour supprimer la contrainte si nécessaire (décommenter si besoin) :
-- ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS unique_pseudo;

