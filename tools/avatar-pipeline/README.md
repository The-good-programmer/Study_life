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
```

The script rebuilds everything from MPFB on each run, so no `.blend` file is kept in the repository. What it produces and the conventions the runtime relies on are documented at the top of `build_avatar.py` and in `src/components/character/three/v2/manifest.ts`.

## Asset sources and licences

| Asset | Source | Licence |
|---|---|---|
| Base human, body targets, game-engine rig | MPFB2 / MakeHuman | CC0 |
| Skin, eyes, brows, lashes, teeth, `short01` hair, `male_casualsuit01` (shirt + jeans), `shoes01` | MakeHuman system assets | CC0 |
| ARKit face units | MakeHuman `faceunits01` | CC0 |

The MPFB plugin's code is GPL-3, but the models it generates are CC0, so the exported files are not covered by the GPL. Any new asset source must allow redistribution inside a web and mobile app; add it to this table.
