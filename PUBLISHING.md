# Publishing & Listing

How `dsh-custom-fonts` **v1.2.0** gets released, pushed and listed.

Repository: <https://github.com/liujia1128/dsh-custom-fonts> · `https://github.com/liujia1128/dsh-custom-fonts.git`

## 0. Source repository (git)

```sh
git init -b main
git remote add origin https://github.com/liujia1128/dsh-custom-fonts.git
git add .
git commit -m "feat: v1.2.0 custom fonts plugin with installed-font discovery"
git push -u origin main
```

Tag the release together with the version in `package.json`:

```sh
git tag v1.2.0
git push origin v1.2.0
```

## 1. Release checklist

1. Keep `version` in `package.json` and the `[1.2.0]` entry in `CHANGELOG.md` in sync.
2. Zero-build package — `client/client.js` and `lib/index.js` are hand-maintained. Run the smoke test:

   ```sh
   node scripts/verify.mjs
   ```

3. Stage the prebuilt tarball (this is what plugin markets install from):

   ```sh
   npm pack          # -> dsh-custom-fonts-1.2.0.tgz
   ```

4. Create a GitHub Release for tag `v1.2.0` and attach the generated
   `dsh-custom-fonts-1.2.0.tgz`. Keep asset name and version aligned.
5. Update the `tarball:` line in `data/plugins/liujia1128__dsh-custom-fonts.yml`
   (awesome-dsh-plugin) if it names a versioned asset URL.
6. Keep `README.md`, `README.zh-CN.md`, `INSTALL.md`, `INSTALL.zh-CN.md` and the
   `repository` / `homepage` / `bugs` fields in `package.json` pointing at
   `https://github.com/liujia1128/dsh-custom-fonts`.

## 2. Marketplace listing

The community catalog lives at
[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin);
submissions are one YAML file per plugin:

- File: `data/plugins/liujia1128__dsh-custom-fonts.yml`
- Category: `ui`
- The repo must exist for **at least 1 day** and carry **at least 10 commits**
  (automated CI checks).
- The `dsh-plugin` topic must be set on the repository.
- After adding/updating the YAML, regenerate the two READMEs with
  `node scripts/generate-readme.mjs` in that repo and commit together with the YAML.
- Optional but recommended: screenshots under `data/screenshots.json` keyed by
  `https://github.com/liujia1128/dsh-custom-fonts`, pointing at images hosted on
  GitHub (e.g. `raw.githubusercontent.com`).

## 3. npm (optional)

Publishing to the public npm registry is optional — listing works without it:

```sh
npm publish          # publishConfig.access = public
```

If published, the package `repository` field already points back at this repo,
which is what links the two. Install from GitHub or from a Release tarball
works either way.
