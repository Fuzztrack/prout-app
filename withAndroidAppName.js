const { withAndroidStrings } = require('@expo/config-plugins');

const withAndroidAppName = (config) => {
  return withAndroidStrings(config, async (config) => {
    config.modResults = setStringItem(
      [
        { $: { name: 'app_name', translatable: 'false' }, _: 'Prrt!' },
      ],
      config.modResults
    );
    return config;
  });
};

function setStringItem(itemToAdd, modResults) {
  if (!modResults.resources || !modResults.resources.string) {
      if (!modResults.resources) modResults.resources = {};
      modResults.resources.string = [];
  }
  
  for (const item of itemToAdd) {
    const existingItem = modResults.resources.string.find(
      (s) => s.$.name === item.$.name
    );
    if (existingItem) {
      existingItem._ = item._;
      if (item.$.translatable) {
        existingItem.$.translatable = item.$.translatable;
      }
    } else {
      modResults.resources.string.push(item);
    }
  }
  return modResults;
}

module.exports = withAndroidAppName;