import { InteractionManager } from 'react-native';
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
    return false;
  }

  global.__navigationLock = true;
  if (skipInitialCheck) {
    global.__skipInitialNavigation = true;
  }

  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => {
      action();

      setTimeout(() => {
        global.__navigationLock = false;
      }, RELEASE_DELAY_MS);
    });
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

