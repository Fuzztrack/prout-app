import { Href, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform, GestureResponderEvent } from 'react-native';
import { type ComponentProps, type MouseEvent } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  const handlePress = async (event: GestureResponderEvent | MouseEvent<HTMLAnchorElement>) => {
    if (Platform.OS !== 'web') {
      // Empêche le comportement par défaut sur mobile
      if ('preventDefault' in event) {
        event.preventDefault();
      }
      try {
        await WebBrowser.openBrowserAsync(href, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        });
      } catch (err) {
        console.error("Impossible d'ouvrir le lien:", err);
      }
    }
    // Sur le web, laisse le comportement par défaut (nouvel onglet)
  };

  return <Link {...rest} href={href} target="_blank" onPress={handlePress} />;
}
