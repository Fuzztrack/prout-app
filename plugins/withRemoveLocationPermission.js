const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Plugin pour supprimer les permissions non nécessaires du Info.plist
 * - Permissions de localisation
 * - Permission de réseau local (recherche d'appareils)
 */
const withRemoveLocationPermission = (config) => {
  return withInfoPlist(config, (config) => {
    // Supprimer les clés de permission de localisation si elles existent
    delete config.modResults.NSLocationWhenInUseUsageDescription;
    delete config.modResults.NSLocationAlwaysUsageDescription;
    delete config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;
    
    // Supprimer la permission de réseau local (recherche d'appareils)
    delete config.modResults.NSLocalNetworkUsageDescription;
    delete config.modResults.NSBonjourServicesUsageDescription;
    
    // Supprimer aussi les clés dans NSBonjourServices (array)
    if (config.modResults.NSBonjourServices && Array.isArray(config.modResults.NSBonjourServices)) {
      config.modResults.NSBonjourServices = [];
    }
    
    // Supprimer NSAllowsLocalNetworking dans NSAppTransportSecurity
    if (config.modResults.NSAppTransportSecurity && config.modResults.NSAppTransportSecurity.NSAllowsLocalNetworking !== undefined) {
      delete config.modResults.NSAppTransportSecurity.NSAllowsLocalNetworking;
      
      // Si NSAppTransportSecurity est vide après suppression, on peut le supprimer complètement
      // Mais on garde NSAllowsArbitraryLoads si présent, donc on ne supprime pas tout le dict
    }
    
    console.log('🔧 [PLUGIN] Permissions de localisation et réseau local supprimées du Info.plist');
    
    return config;
  });
};

module.exports = withRemoveLocationPermission;
