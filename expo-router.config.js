/** @type {import('expo-router').ExpoRouterConfig} */
export default {
  screens: {
    '(tabs)': {
      path: '',
      screens: {
        index: 'index',
        explore: 'explore',
        settings: 'settings',
      },
    },
    modal: 'modal',
  },

  initialRouteName: 'index',
};
