const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const INDEX_TSX_PATH = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');

function bumpVersion() {
  // 1. Lire et mettre à jour app.json
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  const currentVersion = appJson.expo.version;
  const versionParts = currentVersion.split('.');
  versionParts[versionParts.length - 1] = parseInt(versionParts[versionParts.length - 1], 10) + 1;
  const newVersion = versionParts.join('.');

  appJson.expo.version = newVersion;
  appJson.expo.ios.buildNumber = (parseInt(appJson.expo.ios.buildNumber, 10) + 1).toString();
  appJson.expo.android.versionCode = parseInt(appJson.expo.android.versionCode, 10) + 1;

  fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`✅ app.json mis à jour : ${newVersion} (Build ${appJson.expo.ios.buildNumber} / VC ${appJson.expo.android.versionCode})`);

  // 2. Mettre à jour package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ package.json mis à jour : ${newVersion}`);

  // 3. Mettre à jour app/(tabs)/index.tsx (fallback version)
  let indexTsx = fs.readFileSync(INDEX_TSX_PATH, 'utf8');
  const indexVersionRegex = /(const appVersion = Constants\.expoConfig\?\.version \?\? ')[0-9.]+(';)/;
  
  if (indexVersionRegex.test(indexTsx)) {
    indexTsx = indexTsx.replace(indexVersionRegex, `$1${newVersion}$2`);
    fs.writeFileSync(INDEX_TSX_PATH, indexTsx);
    console.log(`✅ app/(tabs)/index.tsx mis à jour : ${newVersion}`);
  } else {
    console.warn('⚠️ Impossible de trouver la version fallback dans app/(tabs)/index.tsx');
  }

  return newVersion;
}

const version = bumpVersion();
console.log(`🚀 Version incrémentée avec succès vers ${version}`);
