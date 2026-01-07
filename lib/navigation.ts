import { InteractionManager, Platform } from 'react-native';
import type { Router } from 'expo-router';

declare global {
  // Flags stockés sur l'objet global pour synchroniser les redirections initiales
  // eslint-disable-next-line no-var
  var __skipInitialNavigation: boolean | undefined;
  // eslint-disable-next-line no-var
  var __navigationLock: boolean | undefined;
}

const RELEASE_DELAY_MS = 650;

function ensureGlobals() {
  if (typeof global.__skipInitialNavigation === 'undefined') {
    global.__skipInitialNavigation = false;
  }
  if (typeof global.__navigationLock === 'undefined') {
    global.__navigationLock = false;
  }
}

type RouterLike = Pick<Router, 'replace' | 'push'>;

type BaseOptions = {
  /** Active la mise en pause de l'auto-routeur (`index.tsx`) pour cette navigation. */
  skipInitialCheck?: boolean;
};

type SafeReplaceOptions = BaseOptions & {
  /** Options supplémentaires passées au router Expo. */
  navigationOptions?: Parameters<RouterLike['replace']>[1];
};

type SafePushOptions = BaseOptions & {
  navigationOptions?: Parameters<RouterLike['push']>[1];
};

function withNavigationLock(
  action: () => void,
  { skipInitialCheck = true }: BaseOptions = {},
) {
  ensureGlobals();

  if (global.__navigationLock) {
    console.log('⚠️ Navigation déjà en cours, ignorée');
    return false;
  }

  global.__navigationLock = true;
  if (skipInitialCheck) {
    global.__skipInitialNavigation = true;
  }

  let actionExecuted = false;
  
  const executeAction = () => {
    if (actionExecuted) {
      return;
    }
    actionExecuted = true;
    
    try {
      action();
    } catch (error) {
      console.error('❌ Erreur lors de la navigation:', error);
    } finally {
      setTimeout(() => {
        global.__navigationLock = false;
      }, RELEASE_DELAY_MS);
    }
  };

  // Timeout de sécurité pour éviter le blocage si InteractionManager ne se déclenche pas
  const safetyTimeout = setTimeout(() => {
    if (!actionExecuted) {
      console.log('⚠️ Timeout sécurité navigation, exécution forcée');
      // Sur Android, utiliser requestAnimationFrame pour garantir le thread UI
      if (Platform.OS === 'android') {
        requestAnimationFrame(() => {
          executeAction();
        });
      } else {
        executeAction();
      }
    }
  }, 1500);

  // Utiliser InteractionManager pour garantir que les interactions sont terminées
  InteractionManager.runAfterInteractions(() => {
    clearTimeout(safetyTimeout);
    if (!actionExecuted) {
      // Double sécurité avec requestAnimationFrame pour garantir le thread UI
      requestAnimationFrame(() => {
        executeAction();
      });
    }
  });

  return true;
}

export function safeReplace(
  router: RouterLike,
  path: Parameters<RouterLike['replace']>[0],
  { skipInitialCheck = true, navigationOptions }: SafeReplaceOptions = {},
) {
  withNavigationLock(
    () => router.replace(path, navigationOptions),
    { skipInitialCheck },
  );
}

export function safePush(
  router: RouterLike,
  path: Parameters<RouterLike['push']>[0],
  { skipInitialCheck = true, navigationOptions }: SafePushOptions = {},
) {
  withNavigationLock(
    () => router.push(path, navigationOptions),
    { skipInitialCheck },
  );
}

export function shouldSkipInitialNavigation() {
  ensureGlobals();
  return global.__skipInitialNavigation === true;
}

export function clearSkipInitialNavigationFlag() {
  ensureGlobals();
  global.__skipInitialNavigation = false;
}















