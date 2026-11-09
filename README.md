# Ezuryseth releases

Public release assets and HTTPS update feed for Ezuryseth.

- **Update feed:** <https://ezurinho.github.io/ezuryseth-releases/>
- **Releases:** <https://github.com/ezurinho/ezuryseth-releases/releases>
- **Source code:** not stored here. This repository contains release automation and public feed metadata only.

## How it works

1. A CA-signed NSIS build is produced from the main Ezuryseth project. The build's own `latest.yml` is verified locally by `npm run dist:release`.
2. The installer, its `.blockmap` and the locally verified `latest.yml` are uploaded as assets of a stable GitHub Release.
3. The `Publish signed update feed` workflow downloads those assets, validates the version, SHA-512 and size, then rewrites the installer URL to the GitHub Release asset. It deploys `latest.yml` and a small download page to GitHub Pages.
4. The installed app reads `https://ezurinho.github.io/ezuryseth-releases/latest.yml`. The installer and blockmap stay on GitHub Releases, so Pages only hosts metadata.

The Pages copy of `latest.yml` is the authoritative feed. It points to absolute GitHub Release asset URLs; the copy uploaded as a release asset is only an input for validation.

The feed accepts stable releases only. A pre-release is ignored by the workflow, and an unsigned or self-signed build must never be uploaded.

## Publishing a signed release

On the Windows build machine, with the trusted CA PFX available outside the project:

```powershell
$env:WIN_CSC_LINK = "C:\secure\ezuryseth-release.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<asked by the release helper>"
$env:FPSBOOSTER_UPDATE_URL = "https://ezurinho.github.io/ezuryseth-releases/"
npm run release:check
npm run dist:release
```

Do not paste the PFX password into a command line, chat or repository. `C:\secure\ezuryseth-release.ps1` prompts for it without echoing it; use that helper or set the variables only in the current shell.

After the local build passes its strict signature and feed checks, create the release. Keep the assets immutable:

```powershell
gh release create v1.38.0 `
  dist\Ezuryseth-Setup-1.38.0.exe `
  dist\Ezuryseth-Setup-1.38.0.exe.blockmap `
  dist\latest.yml `
  --repo ezurinho/ezuryseth-releases `
  --title "Ezuryseth 1.38.0" `
  --notes-file release-notes.md
```

Publishing the release triggers the Pages workflow. The optional portable executable may be attached to the release as a manual download, but it is not part of the automatic update feed.

To redeploy an existing stable release without creating it again:

```powershell
gh workflow run pages.yml --repo ezurinho/ezuryseth-releases -f tag=v1.38.0
```

To deploy the placeholder page while no signed release exists:

```powershell
gh workflow run pages.yml --repo ezurinho/ezuryseth-releases
```

## Verification

```powershell
gh run list --workflow pages.yml --repo ezurinho/ezuryseth-releases
curl.exe -fsSL https://ezurinho.github.io/ezuryseth-releases/latest.yml
```

The feed must be fetched over HTTPS, must not require authentication, and must not be cached aggressively. GitHub Pages controls response headers; keep the feed URL stable and use a new version for every release rather than overwriting an existing asset.

## Security rules

- Never upload the internal self-signed test build to this public repository.
- Never put a PFX, its password, a GitHub token or a signing secret in this repository.
- The local `npm run dist:release` strict check is the signing gate. The workflow additionally rejects metadata whose SHA-512 or size does not match the uploaded installer.
- Release assets are immutable per version. Do not replace a published installer or blockmap; publish a new version instead.
- The app's embedded feed URL must be `https://ezurinho.github.io/ezuryseth-releases/` so the published `latest.yml` is found.
