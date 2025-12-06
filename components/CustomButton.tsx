import { ActivityIndicator, Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string; // Pour les boutons spéciaux (ex: rouge pour supprimer)
  textColor?: string; // Pour personnaliser la couleur du texte
  small?: boolean; // Pour les petits boutons
  iconSource?: ImageSourcePropType; // Pour ajouter une icône personnalisée
  iconOnly?: boolean; // Si true, affiche seulement l'icône sans texte
}

export function CustomButton({ title, onPress, disabled, loading, color, textColor: customTextColor, small, iconSource, iconOnly }: CustomButtonProps) {
  const buttonColor = color || '#adb9b3';
  const textColor = customTextColor || '#ebb89b';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        small && styles.buttonSmall,
        iconOnly && styles.buttonIconOnly,
        { backgroundColor: buttonColor },
        (disabled || loading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size={small ? 'small' : 'large'} />
      ) : (
        <>
          {iconSource && (
            <Image 
              source={iconSource} 
              style={[styles.buttonIcon, small && styles.buttonIconSmall, iconOnly && styles.buttonIconOnlySize]} 
              resizeMode="contain"
            />
          )}
          {!iconOnly && (
            <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: textColor }]}>{title}</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#adb9b3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ebb89b',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    marginBottom: 5,
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  buttonIconOnly: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20, // Rond (la moitié de la largeur/hauteur)
    aspectRatio: 1, // Garde la forme carrée/rond
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  buttonIconSmall: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  buttonIconOnlySize: {
    width: 24,
    height: 24,
    marginRight: 0,
  },
});

