"""
Builds the Studify v2 avatar assets from MakeHuman (MPFB2) and exports them
as glTF into public/avatar/, plus public/avatar/manifest.json.

Run inside Blender 5.2+ with the MPFB extension and the "makehuman system
assets" + "faceunits01" asset packs installed (all CC0):

    blender -b -P tools/avatar-pipeline/build_avatar.py -- --repo <path to Studify>

or, from a live Blender session (e.g. over the Blender MCP bridge):

    STUDIFY_REPO = r"C:/path/to/Studify"; exec(open(STUDIFY_REPO + "/tools/avatar-pipeline/build_avatar.py").read())

Everything is rebuilt from the MPFB data on each run, so no .blend file is
kept in the repository. The script only touches its own scene
("StudifyAvatarBuild"); other scenes in the open file are left alone.

Asset conventions (see src/components/character/three/v2/manifest.ts):
- glTF, metres, +Y up, facing +Z, feet on y = 0, game_engine skeleton.
- Body-shape morphs gender_male / gender_female / build_slender /
  build_athletic on the body and on every garment; neutral (all zero) is a
  25-year-old of average gender, muscle and weight.
- Gender also moves the joints: per-bone offsets are written to the manifest
  (jointMorphs) so the runtime can move the skeleton with the morph.
- The 52 ARKit face units as morph targets (bare ARKit names) on the body and
  on everything that sits on the face (brows, lashes, beards...).
- Material names start with a colour role (skin_, hair_, top_, ...) and
  tintable textures are normalised to a neutral grey average, so the runtime
  multiplies the user's colour in.
- The body carries a `_hide` vertex attribute: bit N set means "hidden while
  the item with hideBit N is worn" (from MakeHuman's clothes delete groups).
"""

import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector, kdtree
from mathutils.bvhtree import BVHTree

# Headless Blender (-b) doesn't load add-ons before running the script.
import addon_utils  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import accessories  # noqa: E402  (tools/avatar-pipeline/accessories.py)
import garments  # noqa: E402  (tools/avatar-pipeline/garments.py)
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True)

from bl_ext.blender_org.mpfb.entities.objectproperties import HumanObjectProperties
from bl_ext.blender_org.mpfb.services.exportservice import ExportService
from bl_ext.blender_org.mpfb.services.faceservice import FaceService
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService
from bl_ext.blender_org.mpfb.services.objectservice import ObjectService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

# ─── Configuration ──────────────────────────────────────────────────────────


def _repo_root():
    if "STUDIFY_REPO" in globals():
        return globals()["STUDIFY_REPO"]
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        if "--repo" in args:
            return args[args.index("--repo") + 1]
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


REPO = _repo_root()
# Uncompressed export; compress.mjs writes the final files to public/avatar.
OUT_DIR = os.path.join(REPO, "tools", "avatar-pipeline", ".build")
URL_PREFIX = "/avatar"
SCENE_NAME = "StudifyAvatarBuild"

NEUTRAL = dict(gender=0.5, age=0.5, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, cupsize=0.5, firmness=0.5)
BODY_VARIANTS = {
    "gender_male": dict(gender=1.0),
    "gender_female": dict(gender=0.0),
    "build_slender": dict(muscle=0.3, weight=0.3),
    "build_athletic": dict(muscle=0.85, weight=0.6),
}
# Variants that move joints (the build variants only change volume).
JOINT_VARIANTS = ["gender_male", "gender_female"]

SKIN = "skins/young_caucasian_female/young_caucasian_female.mhmat"
EYE_MATERIAL = "eyes/materials/brown.mhmat"

# Parts of the base avatar: (key, mhclo, MPFB asset type, material name).
BASE_PARTS = [
    ("eyes", "eyes/high-poly/high-poly.mhclo", "Eyes", "eye_ball"),
    ("brows", "eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows", "brow_001"),
    ("lashes", "eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes", "lash_01"),
    ("teeth", "teeth/teeth_base/teeth_base.mhclo", "Teeth", "teeth_base"),
]

# Wearable items. A source may be split into several items by height
# (`split`: item -> "upper" / "lower" part of the source's loose pieces).
ITEM_SOURCES = [
    # MakeHuman's hair, mapped to Studify's styles.
    *[
        {"mhclo": f"hair/{src}/{src}.mhclo", "type": "Hair", "items": {("hair", style): f"hair_{src}"}}
        for style, src in [
            ("short-fade", "short04"), ("curly-afro", "afro01"), ("bob-cut", "bob01"), ("long-wavy", "long01"),
            ("ponytail", "ponytail01"), ("spiky", "short02"), ("side-part", "short03"),
        ]
    ],
    # A buzz cut is just shaded scalp: short01's coverage, with no hair mesh.
    {"mhclo": "hair/short01/short01.mhclo", "type": "Hair", "items": {}, "scalpOnly": ("hair", "buzz")},
    {
        "mhclo": "clothes/male_casualsuit01/male_casualsuit01.mhclo", "type": "Clothes",
        "items": {("top", "button-down"): "top_shirt", ("bottom", "jeans"): "bottom_jeans"},
        "split": {("top", "button-down"): "upper", ("bottom", "jeans"): "lower"},
    },
    {"mhclo": "clothes/shoes01/shoes01.mhclo", "type": "Clothes", "items": {("shoes", "sneakers"): "shoes_01"}},
    # Single garments taken from two-piece outfits (the other half is dropped).
    *[
        {"mhclo": f"clothes/{src}/{src}.mhclo", "type": "Clothes", "items": {key: mat}, "split": {key: part}}
        for src, key, part, mat in [
            ("male_casualsuit06", ("top", "casual-tee"), "upper", "top_tee_nologo"),
            ("male_casualsuit02", ("top", "sweater"), "upper", "top_longsleeve_nologo"),
            ("male_casualsuit05", ("top", "varsity-jacket"), "upper", "top_jacket"),
            ("male_elegantsuit01", ("bottom", "chinos"), "lower", "bottom_trousers"),
            ("female_casualsuit02", ("bottom", "shorts"), "lower", "bottom_shorts"),
            ("female_elegantsuit01", ("bottom", "pleated-skirt"), "lower", "bottom_skirt"),
            ("female_sportsuit01", ("bottom", "joggers"), "lower", "bottom_leggings"),
        ]
    ],
    # Shoes that come with socks: the socks get their own, untinted material.
    *[
        {"mhclo": f"clothes/{src}/{src}.mhclo", "type": "Clothes", "items": {("shoes", item): f"shoes_{src}"}, "socks": True}
        for src, item in [("shoes05", "running"), ("shoes04", "loafers")]
    ],
    # shoes03's shaft is part of the boot, not a sock: tint it all.
    {"mhclo": "clothes/shoes03/shoes03.mhclo", "type": "Clothes", "items": {("shoes", "boots"): "shoes_shoes03"}},
]

# Garment layers, inside to outside: an outer garment hides what of an inner one
# it covers (shoe collars under jeans, waistbands under shirts).
# Layering groups don't interact: body clothes, and hair under headwear.
LAYERS = {"shoes": ("body", 0), "bottom": ("body", 1), "top": ("body", 2), "hair": ("head", 0), "headwear": ("head", 1)}

# Material roles whose textures are tinted at runtime (normalised to grey here).
TINTED_ROLES = ("skin", "hair", "brow", "top", "bottom", "shoes")

TIERS = {"medium": 1024}  # texture size per quality tier

BONE_MAP = {
    "hips": "pelvis", "spine": "spine_01", "chest": "spine_03", "neck": "neck_01", "head": "head",
    "upperArmL": "upperarm_l", "forearmL": "lowerarm_l", "handL": "hand_l",
    "upperArmR": "upperarm_r", "forearmR": "lowerarm_r", "handR": "hand_r",
    "thighL": "thigh_l", "shinL": "calf_l", "footL": "foot_l",
    "thighR": "thigh_r", "shinR": "calf_r", "footR": "foot_r",
}

DATA = LocationService.get_user_data()


def data_path(rel):
    return os.path.join(DATA, *rel.split("/"))


def log(*a):
    print("[avatar-pipeline]", *a)


# ─── Scene and human ────────────────────────────────────────────────────────


def fresh_scene():
    if bpy.app.background:
        # Headless: operators and MPFB work on the context scene, which is the
        # factory startup scene here; empty it (its cube, camera and light).
        scene = bpy.context.scene
        for o in list(scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        return scene
    old = bpy.data.scenes.get(SCENE_NAME)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        if len(bpy.data.scenes) > 1:
            bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window:
        bpy.context.window.scene = scene
    return scene


def set_macro(basemesh, values):
    for k, v in {**NEUTRAL, **values}.items():
        HumanObjectProperties.set_value(k, v, entity_reference=basemesh)
    TargetService.reapply_macro_details(basemesh)
    HumanService.refit(basemesh)
    bpy.context.view_layer.update()


def build_human():
    basemesh = HumanService.create_human(macro_detail_dict={**TargetService.get_default_macro_info_dict(), **NEUTRAL})
    HumanService.add_builtin_rig(basemesh, "game_engine")
    HumanService.set_character_skin(data_path(SKIN), basemesh, skin_type="GAMEENGINE")
    parts = {}
    for key, mhclo, kind, _ in BASE_PARTS:
        parts[key] = HumanService.add_mhclo_asset(data_path(mhclo), basemesh, asset_type=kind, subdiv_levels=0, material_type="MAKESKIN")
    sources = []
    for src in ITEM_SOURCES:
        sources.append(HumanService.add_mhclo_asset(data_path(src["mhclo"]), basemesh, asset_type=src["type"], subdiv_levels=0, material_type="MAKESKIN"))
    return basemesh, parts, sources


# ─── Capturing body variants ────────────────────────────────────────────────


def rest_coords(obj):
    """Vertex positions with shape keys mixed but no modifiers (no skinning, no masks)."""
    saved = [(m, m.show_viewport) for m in obj.modifiers]
    for m, _ in saved:
        m.show_viewport = False
    bpy.context.view_layer.update()
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    co = np.empty(len(ev.data.vertices) * 3, dtype=np.float32)
    ev.data.vertices.foreach_get("co", co)
    for m, v in saved:
        m.show_viewport = v
    return co.reshape(-1, 3)


def bone_heads(rig):
    return {b.name: np.array(b.head_local) for b in rig.data.bones}


def capture_variants(basemesh, meshes):
    rig = basemesh.parent
    captured = {}
    for name, values in BODY_VARIANTS.items():
        set_macro(basemesh, values)
        captured[name] = {"coords": {o.name: rest_coords(o) for o in meshes}, "bones": bone_heads(rig)}
        log("captured", name)
    set_macro(basemesh, {})
    neutral = {"coords": {o.name: rest_coords(o) for o in meshes}, "bones": bone_heads(rig)}
    return neutral, captured


# ─── Export copy: bake, ARKit, morphs, helpers ─────────────────────────────


def to_gltf(v):
    """Blender (Z up, -Y forward) to glTF (Y up, +Z forward)."""
    return [float(v[0]), float(v[2]), float(-v[1])]


def make_export_copy(basemesh):
    collection = bpy.data.collections.new("studify export")
    bpy.context.scene.collection.children.link(collection)
    root = ExportService.create_character_copy(basemesh, name_suffix="_x", place_in_collection=collection)
    new_basemesh = ObjectService.find_object_of_type_amongst_nearest_relatives(root, "Basemesh")
    TargetService.bake_targets(new_basemesh)
    FaceService.load_targets(new_basemesh, load_microsoft_visemes=False, load_meta_visemes=False, load_arkit_faceunits=True)
    FaceService.interpolate_targets(new_basemesh)
    return new_basemesh.parent, new_basemesh


def original_name(copy_name):
    return copy_name[:-2] if copy_name.endswith("_x") else copy_name


def add_body_morphs(objects, captured):
    for obj in objects:
        src = original_name(obj.name)
        for variant, data in captured.items():
            co = data["coords"].get(src)
            if co is None:
                continue
            if len(co) != len(obj.data.vertices):
                raise RuntimeError(f"{obj.name}: {len(obj.data.vertices)} verts, variant {variant} has {len(co)}")
            if not obj.data.shape_keys:
                obj.shape_key_add(name="Basis", from_mix=False)
            key = obj.shape_key_add(name=variant, from_mix=False)
            key.data.foreach_set("co", co.ravel())


def rename_arkit_keys(objects):
    for obj in objects:
        if not obj.data.shape_keys:
            continue
        for key in obj.data.shape_keys.key_blocks:
            bare = TargetService.shapekey_name_to_expression_name(key.name)
            if bare:
                key.name = bare


def drop_unused_keys(obj, keep):
    """Removes shape keys that aren't body morphs or face units (visemes, leftovers)."""
    if not obj.data.shape_keys:
        return
    for key in list(obj.data.shape_keys.key_blocks):
        if key.name != "Basis" and key.name not in keep:
            obj.shape_key_remove(key)


def prune_flat_keys(obj, tolerance=1e-5):
    """Face units are interpolated onto every asset; drop keys that don't move this one."""
    if not obj.data.shape_keys:
        return
    blocks = obj.data.shape_keys.key_blocks
    n = len(obj.data.vertices) * 3
    basis = np.empty(n, dtype=np.float32)
    blocks[0].data.foreach_get("co", basis)
    co = np.empty(n, dtype=np.float32)
    for key in list(blocks)[1:]:
        key.data.foreach_get("co", co)
        if np.abs(co - basis).max() < tolerance:
            obj.shape_key_remove(key)
    if len(obj.data.shape_keys.key_blocks) == 1:
        obj.shape_key_remove(obj.data.shape_keys.key_blocks[0])


def remove_helpers(basemesh):
    """Deletes MakeHuman's helper geometry (bmesh keeps the shape-key layers)."""
    for m in list(basemesh.modifiers):
        if m.type != "ARMATURE":
            basemesh.modifiers.remove(m)
    groups = [basemesh.vertex_groups[g].index for g in ("HelperGeometry", "JointCubes") if g in basemesh.vertex_groups]
    me = basemesh.data
    doomed = set()
    for v in me.vertices:
        if any(g.group in groups and g.weight > 0.5 for g in v.groups):
            doomed.add(v.index)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in doomed], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    for g in list(basemesh.vertex_groups):
        if g.name.startswith(("helper-", "joint-")) or g.name in ("HelperGeometry", "JointCubes", "Mid", "Left", "Right"):
            basemesh.vertex_groups.remove(g)
    log("removed", len(doomed), "helper vertices;", len(me.vertices), "remain")


# ─── Items: splitting, hide masks ───────────────────────────────────────────


def uv_islands(bm, uv):
    """Groups faces into UV islands (faces sharing an edge with matching UVs)."""
    def key(loop):
        return (round(loop[uv].uv.x, 5), round(loop[uv].uv.y, 5))
    island = {}
    islands = []
    for f in bm.faces:
        if f.index in island:
            continue
        idx = len(islands)
        stack, members = [f], []
        island[f.index] = idx
        while stack:
            g = stack.pop()
            members.append(g)
            for loop in g.loops:
                edge = loop.edge
                a, b = key(loop), key(loop.link_loop_next)
                for other in edge.link_loops:
                    h = other.face
                    if h.index in island:
                        continue
                    # The other face walks the edge the other way round.
                    if {key(other), key(other.link_loop_next)} == {a, b}:
                        island[h.index] = idx
                        stack.append(h)
        islands.append(members)
    return islands


def split_by_height(obj, lower_name, upper_name, cut):
    """Splits a two-piece outfit (e.g. shirt + trousers) into lower and upper
    garments. MakeHuman suits are often one connected mesh, but each garment
    has its own UV islands: an island belongs to the lower garment when its
    centre is below `cut` (just above the waist, so waistbands and belts go
    with the trousers and shirt panels, which start higher, don't)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    islands = uv_islands(bm, bm.loops.layers.uv.active)
    centre = [float(np.mean([v.co.z for f in isl for v in f.verts])) for isl in islands]
    lower = [z < cut for z in centre]
    # Small pieces near the waist (a jacket's hip pockets, a button) would
    # follow the cut and leave holes in the garment they are sewn to. Islands
    # that share vertices are one garment unless both sides of the cut hold a
    # real share of its area (a shirt sewn to its trousers); otherwise every
    # island goes with the garment's majority.
    parent = list(range(len(islands)))

    def root(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k
    first_island = {}
    for k, isl in enumerate(islands):
        for f in isl:
            for v in f.verts:
                parent[root(k)] = root(first_island.setdefault(v.index, k))
    area = [sum(f.calc_area() for f in isl) for isl in islands]
    garments_of = {}
    for k in range(len(islands)):
        garments_of.setdefault(root(k), []).append(k)
    for members in garments_of.values():
        low = sum(area[k] for k in members if lower[k]) / max(sum(area[k] for k in members), 1e-12)
        if low < 0.25 or low > 0.75:
            for k in members:
                lower[k] = low > 0.5
    lower_faces = {f.index for isl, low in zip(islands, lower) if low for f in isl}
    bm.free()
    log(f"{obj.name}: {len(islands)} UV islands, split at z={cut:.3f}, {len(lower_faces)} lower faces")

    for p in obj.data.polygons:
        p.select = p.index in lower_faces
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    for p in obj.data.polygons:
        p.select = p.index in lower_faces
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    lower = next(o for o in bpy.context.selected_objects if o is not obj)
    lower.name = lower_name
    obj.name = upper_name
    return lower, obj


def delete_group_vertices(basemesh, source_name):
    """Body vertices MakeHuman hides under a clothes source (its delete group)."""
    group = basemesh.vertex_groups.get("Delete." + source_name)
    if group is None:
        return set()
    return {v.index for v in basemesh.data.vertices if any(g.group == group.index and g.weight > 0.5 for g in v.groups)}


def assign_hidden(body, body_co, hidden, pieces):
    """Shares a two-piece outfit's hidden skin between its pieces: a vertex is
    hidden by every piece that covers it (a ray along the skin's normal meets
    the piece within 4 cm, or the piece is within 1 cm). Vertices covered by
    neither go to the nearest piece. Hiding is a bit mask, so a vertex can
    belong to both, and a piece worn alone still hides all the skin it covers.
    """
    normals = np.empty(len(body_co) * 3, dtype=np.float32)
    body.data.vertices.foreach_get("normal", normals)
    normals = normals.reshape(-1, 3)
    trees = [BVHTree.FromPolygons(rest_coords(p).tolist(), [f.vertices[:] for f in p.data.polygons]) for p in pieces]
    out = [set() for _ in pieces]
    for vi in hidden:
        c, n = Vector(body_co[vi]), Vector(normals[vi])
        hits = [k for k, t in enumerate(trees)
                if t.ray_cast(c + n * 1e-4, n, 0.04)[0] is not None or t.find_nearest(c, 0.01)[0] is not None]
        if not hits:
            dist = [(t.find_nearest(c)[3] if t.find_nearest(c)[0] is not None else 1e9) for t in trees]
            hits = [int(np.argmin(dist))]
        for k in hits:
            out[k].add(vi)
    return out


def scalp_coverage(body, body_co, hair, eye_top, eye_y):
    """Scalp vertices a hairstyle covers, grown by one ring of neighbours so
    the hairline fades out instead of stopping at the hair's edge.

    Covered: the hair lies over the skin (a ray along the skin's normal meets
    it within 5 cm) or right beside it (within 3 cm). In front of a plane
    just ahead of the ears, only skin above a natural hairline (about 4.5 cm
    over the eyes) counts, so neither hair hanging beside the face nor a
    fringe tints the cheeks, temples or forehead.
    """
    def face(c):
        return c[2] < eye_top + 0.045 and c[1] < eye_y + 0.075  # Blender's front is -Y
    normals = np.empty(len(body_co) * 3, dtype=np.float32)
    body.data.vertices.foreach_get("normal", normals)
    normals = normals.reshape(-1, 3)
    tree = BVHTree.FromPolygons(rest_coords(hair).tolist(), [p.vertices[:] for p in hair.data.polygons])
    covered = set()
    for i in np.nonzero(body_co[:, 2] > eye_top - 0.08)[0]:
        if face(body_co[i]):
            continue
        c, n = Vector(body_co[i]), Vector(normals[i])
        near = tree.find_nearest(c, 0.03)[0] is not None
        if near or tree.ray_cast(c + n * 1e-4, n, 0.05)[0] is not None:
            covered.add(int(i))
    # One ring of dilation for a soft edge (still only on the scalp side).
    ring = set()
    for e in body.data.edges:
        a, b = e.vertices
        if (a in covered) != (b in covered):
            ring.add(b if a in covered else a)
    covered.update(i for i in ring if not face(body_co[i]))
    return sorted(covered)


# Facial hair drawn as shading on the skin (MakeHuman has no beard meshes):
# style -> (region, strength). Bits 8+ of the body's `_scalp` mask hold the
# regions, after the hairstyles' bits.
FACIAL_HAIR = {"stubble": ("beard", 0.55), "goatee": ("goatee", 1.0), "beard": ("beard", 1.0)}
FACIAL_BITS = {"beard": 8, "goatee": 9}


def facial_hair_regions(body, body_co, real, eye_co):
    """Beard and goatee regions on the face, from the lips, eyes and ears.

    Beard: the lower face up to a cheek line that rises from just above the
    upper lip (centre) to below the eyes (sides), to the sideburns, and a
    little under the jaw. Goatee: a mustache over the upper lip plus a patch
    on the chin. Lips and ears are never included.
    """
    def group(name):
        gi = body.vertex_groups[name].index
        return {v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)}

    lips, ears = group("lips"), group("ears")
    lip_co = body_co[sorted(lips)]
    mx, lip_top, lip_bot = float(lip_co[:, 0].mean()), float(lip_co[:, 2].max()), float(lip_co[:, 2].min())
    eye_z, eye_y = float(eye_co[:, 2].mean()), float(eye_co[:, 1].mean())
    ear_y = eye_y + 0.075  # just in front of the ears (Blender's front is -Y)
    beard, goatee = [], []
    for i, (x, y, z) in enumerate(body_co):
        if not real[i] or i in lips or i in ears or y > ear_y + 0.01:
            continue
        if z > eye_z - 0.03 or z < lip_bot - 0.06:
            continue
        dx = abs(x - mx)
        cheek_line = lip_top + 0.015 + (eye_z - 0.045 - lip_top - 0.015) * min(1.0, dx / 0.055)
        if z > cheek_line:
            continue
        beard.append(i)
        if (lip_top - 0.002 < z < lip_top + 0.02 and dx < 0.03) or (lip_bot - 0.05 < z < lip_bot and dx < 0.022):
            goatee.append(i)
    return {"beard": beard, "goatee": goatee}


def mark_layering(item_objects, manifest_items, head_centre):
    """Gives inner items a `_hide` mask for the vertices an outer item covers."""
    layered = [(*LAYERS[slot], slot, item_id, obj) for slot, item_id, obj in item_objects
               if slot in LAYERS and item_id not in accessories.NO_HAIR_HIDING]
    head_centre = Vector(head_centre)
    for group, inner_layer, _, inner_id, inner in layered:
        co = rest_coords(inner)
        normals = np.empty(len(co) * 3, dtype=np.float32)
        inner.data.vertices.foreach_get("normal", normals)
        normals = normals.reshape(-1, 3)
        mask = np.zeros(len(co), dtype=np.float32)
        for outer_group, outer_layer, outer_slot, outer_id, outer in layered:
            bit = manifest_items[outer_slot][outer_id].get("hideBit")
            if outer_group != group or outer_layer <= inner_layer or bit is None:
                continue
            outer_co = rest_coords(outer)
            tree = BVHTree.FromPolygons(outer_co.tolist(), [p.vertices[:] for p in outer.data.polygons])
            for i, (c, n) in enumerate(zip(co, normals)):
                c, n = Vector(c), Vector(n)
                if group == "head":
                    # Hair cards are double-sided (normals say little), so look
                    # out from the middle of the head instead: hair is under the
                    # hat when the hat is just outside it, or squashed by it when
                    # the hat is between it and the head. Hair below the hat's
                    # rim stays (at the temples, under a cap's back, a fringe).
                    d = c - head_centre
                    dist = d.length
                    d.normalize()
                    covered = (tree.ray_cast(c, d, 0.05)[0] is not None
                               or tree.ray_cast(c, -d, max(dist - 0.03, 0.0))[0] is not None)
                else:
                    # The outer garment lies just outside this vertex, or the
                    # vertex already pokes through it (the garment is just behind).
                    covered = tree.ray_cast(c + n * 1e-4, n, 0.03)[0] is not None or                         tree.ray_cast(c - n * 1e-4, -n, 0.015)[0] is not None
                if covered:
                    mask[i] += float(1 << bit)
        if mask.any():
            name = "_hide"
            attr = inner.data.attributes.get(name) or inner.data.attributes.new(name, "FLOAT", "POINT")
            attr.data.foreach_set("value", mask)
            log(f"{inner_id}: {int((mask > 0).sum())} vertices hidden under outer items")


# ─── Materials and textures ─────────────────────────────────────────────────


def read_mhmat(path):
    props = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith(("#", "//")):
                continue
            k, _, v = line.partition(" ")
            props.setdefault(k, v.strip())
    return props


# Average brightness tinted textures are normalised to. Hair textures carry
# painted-in shine, so they sit darker to keep dark colours dark under the
# runtime's specular highlight.
NEUTRAL_GREY = {"hair": 0.5}
DEFAULT_GREY = 0.82


def remove_logo(px, w, h):
    """Paints out MakeHuman's orange logo: orange pixels (and a 3 px margin)
    are refilled from the surrounding fabric (a normalised box blur of the
    unmasked pixels, widened until every hole is filled)."""
    img = px.reshape(h, w, 4)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mask = (r > 0.35) & (r - b > 0.2) & (r > g) & (g > b - 0.05)
    for _ in range(3):  # dilate
        m = mask.copy()
        m[1:] |= mask[:-1]; m[:-1] |= mask[1:]; m[:, 1:] |= mask[:, :-1]; m[:, :-1] |= mask[:, 1:]
        mask = m
    if not mask.any():
        return 0
    keep = (~mask).astype(np.float32)
    k = 9
    while True:
        def blur(a):
            c = np.cumsum(np.cumsum(np.pad(a, ((k + 1, k), (k + 1, k))), 0), 1)
            return c[2 * k + 1:, 2 * k + 1:] - c[:-2 * k - 1, 2 * k + 1:] - c[2 * k + 1:, :-2 * k - 1] + c[:-2 * k - 1, :-2 * k - 1]
        weight = blur(keep)
        if (weight[mask] > 0).all() or k > 200:
            break
        k *= 2
    for ch in range(3):
        fill = blur(img[..., ch] * keep) / np.maximum(weight, 1e-6)
        img[..., ch][mask] = fill[mask]
    return int(mask.sum())


def load_texture(path, size, neutralise, grey=DEFAULT_GREY, clean_logo=False):
    img = bpy.data.images.load(path, check_existing=False)
    img.name = os.path.basename(path)
    if img.size[0] > size:
        img.scale(size, size)
    if clean_logo:
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        n = remove_logo(px, img.size[0], img.size[1])
        img.pixels.foreach_set(px)
        log(f"{img.name}: painted out {n} logo pixels")
    if neutralise:
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        opaque = px[:, 3] > 0.5
        mean = px[opaque, :3].mean(axis=0) if opaque.any() else px[:, :3].mean(axis=0)
        # Keep the texture's detail but make its average a light neutral grey.
        px[:, :3] = np.clip(px[:, :3] / np.maximum(mean, 1e-3) * grey, 0, 1)
        img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def simple_material(name, mhmat_path, size, cutout=False):
    """A plain Principled BSDF the glTF exporter maps 1:1 (base colour, alpha, normal map)."""
    props = read_mhmat(mhmat_path)
    folder = os.path.dirname(mhmat_path)
    role = name.split("_")[0]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55 if role == "skin" else 0.85
    diffuse = props.get("diffuseTexture")
    if diffuse:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = load_texture(os.path.join(folder, diffuse), size, role in TINTED_ROLES, NEUTRAL_GREY.get(role, DEFAULT_GREY),
                                 clean_logo=name.endswith("_nologo"))
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if cutout or props.get("transparent") == "True":
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            if hasattr(mat, "blend_method"):
                mat.blend_method = "HASHED"
    normal = props.get("normalmapTexture")
    if normal and os.path.exists(os.path.join(folder, normal)):
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = load_texture(os.path.join(folder, normal), size, False)
        ntex.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def find_irises(img):
    """Centre and radius (UV units) of the iris discs on an eye texture."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb = px[..., :3]
    sat = rgb.max(-1) - rgb.min(-1)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    ys, xs = np.nonzero((sat > 0.2) & (lum < 0.45))
    pts = np.stack([xs / w, ys / h], axis=1)
    # Two irises: k-means seeded at the extremes of x - y.
    d = pts[:, 0] - pts[:, 1]
    centres = np.stack([pts[d.argmin()], pts[d.argmax()]])
    for _ in range(12):
        label = np.linalg.norm(pts[:, None] - centres[None], axis=2).argmin(1)
        centres = np.stack([pts[label == k].mean(0) for k in range(2)])
    radii = [float(np.percentile(np.linalg.norm(pts[label == k] - centres[k], axis=1), 98)) for k in range(2)]
    return [(Vector(c), r) for c, r in zip(centres, radii)]


def eye_materials(eye_obj, mhmat_path, size):
    """Splits the eyeballs into sclera and iris materials, with the iris
    greyscaled so the runtime can tint it with the user's eye colour."""
    props = read_mhmat(mhmat_path)
    tex_path = os.path.join(os.path.dirname(mhmat_path), props["diffuseTexture"])
    img = bpy.data.images.load(tex_path, check_existing=False)
    irises = find_irises(img)
    if img.size[0] > size:
        img.scale(size, size)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    yy, xx = np.mgrid[0:h, 0:w]
    uv = np.stack([(xx + 0.5) / w, (yy + 0.5) / h], axis=-1)
    inside = np.zeros((h, w), dtype=bool)
    for c, r in irises:
        inside |= np.linalg.norm(uv - np.array(c[:]), axis=-1) < r * 1.04
    lum = px[..., :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    grey = np.clip(lum / max(float(lum[inside].mean()), 1e-3) * 0.55, 0, 1)
    px[inside, 0] = px[inside, 1] = px[inside, 2] = grey[inside]
    img.pixels.foreach_set(px.ravel())
    img.name = "eye_greyiris.png"
    img.pack()

    # Sclera and iris are opaque; the cornea shell over them is see-through
    # (the texture's alpha is low where the cornea is mapped).
    mats = []
    for name in ("eye_sclera", "iris_main", "eye_cornea"):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Roughness"].default_value = 0.05 if name == "eye_cornea" else 0.3
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if name == "eye_cornea":
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        mats.append(mat)
    me = eye_obj.data
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    uv_layer = me.uv_layers.active.data
    alpha = px[..., 3]
    counts = [0, 0, 0]
    for poly in me.polygons:
        c = sum((uv_layer[li].uv for li in poly.loop_indices), Vector((0, 0))) / poly.loop_total
        a = alpha[min(h - 1, max(0, int(c.y * h))), min(w - 1, max(0, int(c.x * w)))]
        if a < 0.5:
            idx = 2
        elif any((c - centre).length < r for centre, r in irises):
            idx = 1
        else:
            idx = 0
        poly.material_index = idx
        counts[idx] += 1
    log(f"eyes: irises at {[tuple(round(x, 3) for x in c) for c, _ in irises]}; sclera/iris/cornea faces {counts}")


def add_socks(obj, mhmat_path, size):
    """Moves a shoe's sock faces (its upper UV islands) onto an untinted
    material, so socks stay white whatever colour the shoes are."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    islands = uv_islands(bm, bm.loops.layers.uv.active)
    centre = [float(np.mean([v.co.z for f in isl for v in f.verts])) for isl in islands]
    faces = [[f.index for f in isl] for isl in islands]
    bm.free()
    if len(islands) < 2:
        return
    order = sorted(centre)
    cut = max((order[i + 1] - order[i], (order[i + 1] + order[i]) / 2) for i in range(len(order) - 1))[1]
    sock_faces = {i for isl, z in zip(faces, centre) if z > cut for i in isl}
    props = read_mhmat(mhmat_path)
    socks = bpy.data.materials.new("socks")
    socks.use_nodes = True
    tex = socks.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = load_texture(os.path.join(os.path.dirname(mhmat_path), props["diffuseTexture"]), size, False)
    bsdf = socks.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    socks.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.append(socks)
    for poly in obj.data.polygons:
        if poly.index in sock_faces:
            poly.material_index = len(obj.data.materials) - 1
    log(f"{obj.name}: {len(sock_faces)} sock faces")


def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ─── Export ─────────────────────────────────────────────────────────────────


def export_glb(path, rig, meshes):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_skins=True, export_morph=True, export_morph_normal=False, export_morph_tangent=False,
        export_animations=False, export_apply=False, export_yup=True, export_extras=True,
        export_attributes=True, export_image_format="WEBP", export_tangents=False,
    )
    return os.path.getsize(path)


def main():
    fresh_scene()
    basemesh, parts, sources = build_human()
    rig = basemesh.parent
    all_meshes = [basemesh, *parts.values(), *sources]
    neutral, captured = capture_variants(basemesh, all_meshes)

    # Head measurements for fitting glasses and hats (helper geometry excluded).
    helper_groups = {basemesh.vertex_groups[g].index for g in ("HelperGeometry", "JointCubes") if g in basemesh.vertex_groups}
    real = np.array([not any(g.group in helper_groups and g.weight > 0.5 for g in v.groups) for v in basemesh.data.vertices])

    ears_group = basemesh.vertex_groups["ears"].index
    ears = np.array([any(g.group == ears_group and g.weight > 0.5 for g in v.groups) for v in basemesh.data.vertices])

    def head_fit(data):
        body = data["coords"][basemesh.name]
        return accessories.HeadFit(data["coords"][parts["eyes"].name], body[real], body[ears & real])

    neutral_fit = head_fit(neutral)
    variant_fits = {v: head_fit(captured[v]) for v in BODY_VARIANTS}

    # Joint offsets per gender variant (glTF axes, avatar space).
    joint_morphs = {}
    for variant in JOINT_VARIANTS:
        offsets = {}
        for bone, head in captured[variant]["bones"].items():
            d = head - neutral["bones"][bone]
            if np.linalg.norm(d) > 1e-4:
                offsets[bone] = [round(x, 5) for x in to_gltf(d)]
        joint_morphs[variant] = offsets

    # Which body vertices each clothes source hides (indices before helper removal).
    source_hidden = {src.name: delete_group_vertices(basemesh, src.name.split(".", 1)[-1]) for src in sources}

    xrig, xbody = make_export_copy(basemesh)
    xmeshes = [o for o in xrig.children if o.type == "MESH"]
    add_body_morphs(xmeshes, captured)
    rename_arkit_keys(xmeshes)
    from bl_ext.blender_org.mpfb.services.faceservice import ARKIT_FACEUNITS
    keep = set(BODY_VARIANTS) | set(ARKIT_FACEUNITS)
    for o in xmeshes:
        drop_unused_keys(o, keep)
        prune_flat_keys(o)

    # Hide bits on the body, computed on the full body (helpers still present).
    body_co = rest_coords(xbody)
    hide = np.zeros(len(xbody.data.vertices), dtype=np.float32)
    manifest_items = {}
    next_bit = 0
    item_objects = []
    size = TIERS["medium"]
    scalp = np.zeros(len(xbody.data.vertices), dtype=np.float32)
    next_scalp_bit = 0
    eye_co = rest_coords(bpy.data.objects[parts["eyes"].name + "_x"])
    eye_top, eye_y = float(eye_co[:, 2].max()), float(eye_co[:, 1].mean())

    def add_scalp(entry, hair_obj):
        nonlocal next_scalp_bit
        covered = scalp_coverage(xbody, body_co, hair_obj, eye_top, eye_y)
        entry["scalpBit"] = next_scalp_bit
        scalp[covered] += float(1 << next_scalp_bit)
        next_scalp_bit += 1
        log(f"scalp bit {entry['scalpBit']}: {len(covered)} head vertices")

    waist_cut = rig.data.bones["pelvis"].head_local.z + 0.12
    for src_def, src in zip(ITEM_SOURCES, sources):
        xsrc = bpy.data.objects[src.name + "_x"]
        hidden = source_hidden.get(src.name, set())
        if "scalpOnly" in src_def:
            slot, item_id = src_def["scalpOnly"]
            entry = {"files": {}, "scalpOnly": True}
            add_scalp(entry, xsrc)
            manifest_items.setdefault(slot, {})[item_id] = entry
            bpy.data.objects.remove(xsrc, do_unlink=True)
            continue
        if "split" in src_def:
            lower, upper = split_by_height(xsrc, f"{xsrc.name}_lower", f"{xsrc.name}_upper", waist_cut)
            halves = {"lower": lower, "upper": upper}
            pieces = {}
            for key, part in src_def["split"].items():
                halves[part].name = f"Item_{key[1]}"
                pieces[key] = halves[part]
        else:
            key = next(iter(src_def["items"]))
            xsrc.name = f"Item_{key[1]}"
            halves = {"whole": xsrc}
            pieces = {key: xsrc}
        # Hidden skin is shared out over every half (even one we drop), so a
        # kept half only hides the skin it actually covers.
        all_shares = assign_hidden(xbody, body_co, hidden, list(halves.values())) if hidden else [set() for _ in halves]
        share_of = {obj.name: share for obj, share in zip(halves.values(), all_shares)}
        shares = [share_of[obj.name] for obj in pieces.values()]
        for obj in halves.values():
            if obj not in pieces.values():
                bpy.data.objects.remove(obj, do_unlink=True)
        mhmat = os.path.splitext(data_path(src_def["mhclo"]))[0] + ".mhmat"
        for (key, obj), share in zip(pieces.items(), shares):
            slot, item_id = key
            mat = simple_material(src_def["items"][key], mhmat, size, cutout=slot == "hair")
            set_material(obj, mat)
            if src_def.get("socks"):
                add_socks(obj, mhmat, size)
            entry = {"files": {}}
            if slot == "hair":
                add_scalp(entry, obj)
            if share or slot in LAYERS:
                entry["hideBit"] = next_bit
                for vi in share:
                    hide[vi] += float(1 << next_bit)
                next_bit += 1
            manifest_items.setdefault(slot, {})[item_id] = entry
            item_objects.append((slot, item_id, obj))

    # Garments built from MakeHuman ones (hoodie, lab coat): new parts are
    # skinned from the body and follow its variants through a Surface Deform.
    tops = {item_id: obj for slot, item_id, obj in item_objects if slot == "top"}
    body_variants = {v: captured[v]["coords"][basemesh.name] for v in BODY_VARIANTS}

    def derived_top(item_id, source_id, parts, bones, extra_materials=(), dress=None, reweight=None, after_morphs=None):
        """`parts` (material slot 0 = the source's fabric, then
        `extra_materials`) are joined into a copy of the source top;
        `dress(obj)` may re-material that copy first, `reweight(parts)`
        replace the nearest-body weights and `after_morphs(parts, obj)` adjust
        the parts' body-shape morphs."""
        nonlocal next_bit
        source = tops[source_id]
        obj = garments.duplicate(source, f"Item_{item_id}")
        if dress:
            dress(obj)
        for mat in (obj.data.materials[0], *extra_materials):
            parts.data.materials.append(mat)
        garments.skin_from_body(parts, xbody, xrig, bones, real)
        if reweight:
            reweight(parts)
        garments.morphs_via_surface_deform(parts, xbody, body_variants)
        if after_morphs:
            after_morphs(parts, obj)
        garments.join_into(obj, parts)
        # Hides the same skin as its source, under a bit of its own.
        src_bit = manifest_items["top"][source_id]["hideBit"]
        bit = next_bit
        next_bit += 1
        covered = (hide.astype(np.int64) >> src_bit) & 1
        hide[covered == 1] += float(1 << bit)
        manifest_items["top"][item_id] = {"files": {}, "hideBit": bit}
        item_objects.append(("top", item_id, obj))
        log(f"{item_id}: built from {source_id}, hide bit {bit}")

    def plain_material(name, roughness):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.85, 0.85, 0.85, 1)
        bsdf.inputs["Roughness"].default_value = roughness
        return mat

    # Hoodie: drawstrings in the secondary colour (like the procedural avatar's).
    hood = garments.build_hoodie_parts(tops["sweater"])
    derived_top("hoodie", "sweater", hood, {"spine_01", "spine_02", "spine_03", "neck_01", "clavicle_l", "clavicle_r"},
                extra_materials=[plain_material("topSecondary_cord", 0.7)],
                reweight=lambda o: garments.weights_from_garment(o, tops["sweater"]),
                after_morphs=garments.morphs_from_garment)

    # Lab coat: always white (untinted, as on the procedural avatar), with the
    # shirt underneath showing in the V in the secondary colour.
    shirt = tops["button-down"]
    shirt_mat = shirt.data.materials[0]
    coat_mat = shirt_mat.copy()
    coat_mat.name = "labcoat_fabric"
    tex = next(n for n in coat_mat.node_tree.nodes if n.type == "TEX_IMAGE")
    white = tex.image.copy()
    px = np.empty(white.size[0] * white.size[1] * 4, dtype=np.float32)
    white.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    px[:, :3] = np.clip(px[:, :3] * (0.93 / max(float(px[:, :3].mean()), 1e-3)), 0, 1)
    white.pixels.foreach_set(px.ravel())
    white.name = "labcoat_white"
    white.pack()
    tex.image = white
    under_mat = shirt_mat.copy()
    under_mat.name = "topSecondary_shirt"
    coat_v = garments.CoatV(shirt)
    # Torso and legs only: in the bind pose the hands hang right beside the hips.
    body_faces = [p.vertices[:] for p in xbody.data.polygons
                  if all(real[v] and abs(body_co[v][0]) < 0.21 for v in p.vertices)]
    knee_z = xrig.data.bones["calf_l"].head_local.z
    coat_hem = knee_z + 0.03
    shirt_hem = float(min(v.co.z for v in shirt.data.vertices))
    coat, loosen_coat, match_coat = garments.build_coat_parts(shirt, coat_v, body_co, body_faces, coat_hem)

    def dress_coat(obj):
        loosen_coat(obj)
        obj.data.materials[0] = coat_mat
        obj.data.materials.append(under_mat)
        under = set(coat_v.faces(obj))
        for p in obj.data.polygons:
            p.material_index = 1 if p.index in under else 0

    derived_top("lab-coat", "button-down", coat, {"pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r"},
                dress=dress_coat,
                reweight=lambda o: (garments.skirt_weights(o, shirt_hem + 0.03, coat_hem, shirt_hem + 0.045),
                                    garments.weights_from_garment(o, shirt, where=lambda co: co.z > coat_v.bottom - 0.03)),
                after_morphs=lambda parts, obj: (match_coat(parts, obj), garments.morphs_from_garment(
                    parts, obj, where=lambda co: co.z > coat_v.bottom - 0.03)))

    # Procedural glasses and hats, rigged to the head with body-shape morphs.
    shell = accessories.HeadShell(xbody, real, neutral_fit)
    for slot, styles in (("eyewear", accessories.GLASSES), ("headwear", accessories.HATS)):
        for style in styles:
            if slot == "eyewear":
                # Glasses are rebuilt on every variant's face (an exact fit).
                obj = accessories.build_glasses(style, neutral_fit)
                accessories.rig_to_head(obj, xrig, neutral_fit, variant_fits,
                                        rebuild=lambda fit, style=style: accessories.build_glasses(style, fit))
            else:
                obj = accessories.build_hat(style, neutral_fit, shell)
                accessories.rig_to_head(obj, xrig, neutral_fit, variant_fits)
            entry = {"files": {}}
            if slot == "headwear":
                entry["hideBit"] = next_bit
                next_bit += 1
            manifest_items.setdefault(slot, {})[style] = entry
            item_objects.append((slot, style, obj))
    shell.dispose()
    log(f"accessories: {len(accessories.GLASSES)} glasses, {len(accessories.HATS)} hats")

    head_centre = (neutral_fit.centre.x, neutral_fit.centre.y, neutral_fit.eye_z + 0.02)
    mark_layering(item_objects, manifest_items, head_centre)

    # A leading underscore makes the glTF exporter keep it (three.js reads it as `_hide`).
    attr = xbody.data.attributes.new("_hide", "FLOAT", "POINT")
    attr.data.foreach_set("value", hide)
    # Facial hair regions share the mask (bits after the hairstyles').
    regions = facial_hair_regions(xbody, body_co, real, eye_co)
    for region, bit in FACIAL_BITS.items():
        assert bit >= next_scalp_bit, "facial hair bits overlap the hairstyles'"
        scalp[regions[region]] += float(1 << bit)
        log(f"facial hair region {region}: {len(regions[region])} vertices (bit {bit})")
    for style, (region, strength) in FACIAL_HAIR.items():
        manifest_items.setdefault("facialHair", {})[style] = {
            "files": {}, "scalpOnly": True, "beardBit": FACIAL_BITS[region], "shadeStrength": strength,
        }
    xbody.data.attributes.new("_scalp", "FLOAT", "POINT").data.foreach_set("value", scalp)

    remove_helpers(xbody)

    # Base materials.
    set_material(xbody, simple_material("skin_body", data_path(SKIN), size))
    for key, mhclo, _, mat_name in BASE_PARTS:
        obj = bpy.data.objects[parts[key].name + "_x"]
        if key == "eyes":
            eye_materials(obj, data_path(EYE_MATERIAL), size)
            continue
        mhmat = next(
            os.path.join(os.path.dirname(data_path(mhclo)), f) for f in os.listdir(os.path.dirname(data_path(mhclo))) if f.endswith(".mhmat"))
        set_material(obj, simple_material(mat_name, mhmat, size, cutout=key in ("brows", "lashes")))
    xbody.name = "Body"

    # Export.
    base_meshes = [xbody] + [bpy.data.objects[parts[k].name + "_x"] for k, *_ in BASE_PARTS]
    tier = "medium"
    sizes = {}
    sizes["base"] = export_glb(os.path.join(OUT_DIR, tier, "base.glb"), xrig, base_meshes)
    for slot, item_id, obj in item_objects:
        rel = f"{tier}/{slot}/{item_id}.glb"
        sizes[rel] = export_glb(os.path.join(OUT_DIR, *rel.split("/")), xrig, [obj])
        entry = manifest_items[slot][item_id]
        entry["files"][tier] = f"{URL_PREFIX}/{rel}"
        entry.setdefault("bytes", {})[tier] = sizes[rel]

    manifest = {
        "version": 1,
        "base": {"files": {tier: f"{URL_PREFIX}/{tier}/base.glb"}, "bytes": {tier: sizes["base"]}},
        "boneMap": BONE_MAP,
        "jointMorphs": joint_morphs,
        "items": manifest_items,
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    log("done", {k: round(v / 1e6, 2) for k, v in sizes.items()}, "MB")
    return {"sizes": sizes, "bodyVerts": len(xbody.data.vertices), "hideBits": next_bit,
            "jointMorphBones": {k: len(v) for k, v in joint_morphs.items()}}


if __name__ == "__main__" or "STUDIFY_REPO" in globals():
    PIPELINE_RESULT = main()
