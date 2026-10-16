# Avatar asset pipeline

Builds the v2 avatar's glTF assets in `public/avatar/` (and `manifest.json`) from MakeHuman data, using Blender and the MPFB2 extension.

## Requirements

- Blender 5.2+ with the **MPFB** extension (extensions.blender.org).
- MakeHuman asset packs, installed through MPFB (or unzipped into MPFB's user data folder):
  - `makehuman_system_assets_cc0.zip`: skins, eyes, brows, lashes, teeth, hair, clothes
  - `faceunits01.zip`: the 52 ARKit face shapes

## Run

```bash
blender -b -P tools/avatar-pipeline/build_avatar.py -- --repo <path to Studify>
npm run avatar:compress
```

The first step exports uncompressed glTF into `tools/avatar-pipeline/.build/` (git-ignored); it takes a few minutes. The second quantizes and meshopt-compresses those files into `public/avatar/` and writes the manifest with their final sizes (about 15 MB down to 7 MB for the medium tier: the base is about 1.2 MB, and the default outfit adds about 1 MB). Then run `npm test`: `src/components/character/three/v2/shippedAssets.test.ts` checks the shipped files.

The script rebuilds everything from MPFB on each run, so no `.blend` file is kept in the repository. What it produces and the conventions the runtime relies on are documented at the top of `build_avatar.py` and in `src/components/character/three/v2/manifest.ts`.

### Textures

The runtime multiplies the user's colours into textures whose material name starts with a colour role (`skin_`, `hair_`, `brow_`, `top_`, `bottom_`, `shoes_`; the iris is `iris_`). So that a swatch looks the same on every item, the build makes those textures neutral grey with a set average brightness per role, measured only over the texels each mesh's UVs use (MakeHuman outfits share one atlas between garments). Detail is kept: very contrasty sources (black hair, dark leather) are contrast-limited and highlights roll off instead of clipping. It also:

- paints out MakeHuman's printed logos and lettering on the `_nologo` tops,
- evens out the skin texture's large-scale differences (a paler face, the scalp's painted stubble around the ears and neck),
- greyscales the iris (with a darker limbal ring) for the eye colour to tint,
- gives shoes untinted, light grey socks.

`compress.mjs` never merges materials, since their names carry the colour role.

## Asset sources and licences

| Asset | Source | Licence |
|---|---|---|
| Base human, body targets, game-engine rig | MPFB2 / MakeHuman | CC0 |
| Skin, eyes, brows, lashes, teeth; hair `short01`-`short04`, `afro01`, `bob01`, `long01`, `ponytail01`; clothes `male_casualsuit01`/`02`/`05`/`06`, `male_elegantsuit01`, `female_casualsuit02`, `female_elegantsuit01`, `female_sportsuit01`; shoes `shoes01`, `shoes03`-`shoes05` | MakeHuman system assets | CC0 |
| ARKit face units | MakeHuman `faceunits01` | CC0 |

The MPFB plugin's code is GPL-3, but the models it generates are CC0, so the exported files are not covered by the GPL. Any new asset source must allow redistribution inside a web and mobile app; add it to this table.
