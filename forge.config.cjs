const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const repoIconBasePath = path.resolve(__dirname, 'electron', 'assets', 'icon');
const stagingRoot = process.env.SHELEG_FORGE_STAGING_DIR || path.join(os.tmpdir(), 'sheleg-forge');
const stagingAssetsDir = path.join(stagingRoot, 'assets');
const outDir = process.env.SHELEG_FORGE_OUT_DIR || path.join(stagingRoot, 'out');
const iconBasePath = path.join(stagingAssetsDir, 'icon');
const artifactExportDir = path.resolve(__dirname, 'desktop-release');
const packagedTopLevelEntries = new Set(['dist', 'dist-electron', 'node_modules', 'package.json']);
const macSigningEnabled = Boolean(
  process.env.APPLE_ID &&
  process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  process.env.APPLE_TEAM_ID
);
const windowsCertificateEnabled = Boolean(
  process.env.WINDOWS_CERT_FILE && process.env.WINDOWS_CERT_PASSWORD
);

fs.mkdirSync(stagingAssetsDir, { recursive: true });
fs.copyFileSync(`${repoIconBasePath}.ico`, `${iconBasePath}.ico`);
fs.copyFileSync(`${repoIconBasePath}.png`, `${iconBasePath}.png`);
if (fs.existsSync(`${repoIconBasePath}.icns`)) {
  fs.copyFileSync(`${repoIconBasePath}.icns`, `${iconBasePath}.icns`);
}

function toRelativePackagedPath(filePath) {
  const packagerPath = filePath.replace(/\\/g, '/');

  if (packagerPath === '/' || packagerPath === '.') {
    return '';
  }

  if (packagerPath.startsWith('/')) {
    return packagerPath.slice(1);
  }

  const normalizedRoot = __dirname.replace(/\\/g, '/');
  const normalizedPath = path.resolve(filePath).replace(/\\/g, '/');

  if (normalizedPath === normalizedRoot) {
    return '';
  }

  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  return path.relative(__dirname, normalizedPath).replace(/\\/g, '/');
}

function shouldIgnorePackagedPath(filePath) {
  const relativePath = toRelativePackagedPath(filePath);

  if (!relativePath) {
    return false;
  }

  if (relativePath === 'package.json') {
    return false;
  }

  if (
    relativePath === 'node_modules/.bin' ||
    relativePath.startsWith('node_modules/.bin/') ||
    relativePath === 'node_modules/.cache' ||
    relativePath.startsWith('node_modules/.cache/') ||
    relativePath === 'node_modules/.vite' ||
    relativePath.startsWith('node_modules/.vite/')
  ) {
    return true;
  }

  const [topLevelEntry] = relativePath.split('/');
  return !packagedTopLevelEntries.has(topLevelEntry);
}

module.exports = {
  outDir,
  hooks: {
    postMake: async (_forgeConfig, makeResults) => {
      fs.rmSync(artifactExportDir, { recursive: true, force: true });

      for (const result of makeResults) {
        const targetDir = path.join(artifactExportDir, `${result.platform}-${result.arch}`);
        fs.mkdirSync(targetDir, { recursive: true });

        for (const artifact of result.artifacts) {
          fs.copyFileSync(artifact, path.join(targetDir, path.basename(artifact)));
        }
      }

      return makeResults;
    },
  },
  packagerConfig: {
    asar: true,
    appBundleId: 'com.sheleg.legal',
    appCategoryType: 'public.app-category.productivity',
    executableName: 'ShelegLegal',
    prune: true,
    icon: iconBasePath,
    name: 'Sheleg - Legal Document Compiler',
    protocols: [
      {
        name: 'Sheleg Secure App Protocol',
        schemes: ['app'],
      },
    ],
    ignore: shouldIgnorePackagedPath,
    osxSign: macSigningEnabled ? {} : undefined,
    osxNotarize: macSigningEnabled
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
    win32metadata: {
      CompanyName: 'Sheleg Team',
      FileDescription: 'Sheleg - Legal Document Compiler Desktop',
      InternalName: 'ShelegLegal',
      OriginalFilename: 'ShelegLegal.exe',
      ProductName: 'Sheleg - Legal Document Compiler',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        authors: 'Sheleg Team',
        exe: 'ShelegLegal.exe',
        name: 'sheleg_legal',
        setupExe: 'Sheleg.exe',
        setupIcon: `${iconBasePath}.ico`,
        ...(windowsCertificateEnabled
          ? {
              certificateFile: process.env.WINDOWS_CERT_FILE,
              certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
            }
          : {}),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'ULFO',
        title: 'Sheleg',
      },
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
