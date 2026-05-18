const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const INDEX_TSX_PATH = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');

function bumpVersion() {
  const isAndroidOnly = process.argv.includes('--android-only');

  // 1. Lire et mettre à jour app.json
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  const currentVersion = appJson.expo.version;
  
  let newVersion = currentVersion;
  
  if (!isAndroidOnly) {
    const versionParts = currentVersion.split('.');
    versionParts[versionParts.length - 1] = parseInt(versionParts[versionParts.length - 1], 10) + 1;
    newVersion = versionParts.join('.');
    appJson.expo.version = newVersion;
    appJson.expo.ios.buildNumber = (parseInt(appJson.expo.ios.buildNumber, 10) + 1).toString();
  }

  appJson.expo.android.versionCode = parseInt(appJson.expo.android.versionCode, 10) + 1;

  fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`✅ app.json mis à jour : ${newVersion} (Build ${appJson.expo.ios.buildNumber} / VC ${appJson.expo.android.versionCode})`);

  if (isAndroidOnly) {
    console.log(`✅ Mode --android-only : version principale et iOS ignorés.`);
    return newVersion;
  }

  // 2. Mettre à jour package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ package.json mis à jour : ${newVersion}`);

  // 3. Mettre à jour app/(tabs)/index.tsx (fallback version et texte UI)
  let indexTsx = fs.readFileSync(INDEX_TSX_PATH, 'utf8');
  const indexVersionRegex = /(const appVersion = Constants\.expoConfig\?\.version \?\? ')[0-9.]+(';)/;
  const uiVersionRegex = /(`Proot ! version \${appVersion}`)|(Proot ! version )[0-9.]+/g;
  
  let modified = false;
  if (indexVersionRegex.test(indexTsx)) {
    indexTsx = indexTsx.replace(indexVersionRegex, `$1${newVersion}$2`);
    modified = true;
  }

  // On s'assure que si le texte est en dur quelque part (pour le rendu), il soit mis à jour
  // Même si ici c'est une template string, on prépare le terrain pour toute variante
  const hardcodedTextRegex = /Proot ! version [0-9.]+/g;
  if (hardcodedTextRegex.test(indexTsx)) {
    indexTsx = indexTsx.replace(hardcodedTextRegex, `Proot ! version ${newVersion}`);
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(INDEX_TSX_PATH, indexTsx);
    console.log(`✅ app/(tabs)/index.tsx mis à jour : ${newVersion}`);
  } else {
    console.warn('⚠️ Impossible de trouver la version dans app/(tabs)/index.tsx');
  }

  return newVersion;
}

const version = bumpVersion();
console.log(`🚀 Version incrémentée avec succès vers ${version}`);
