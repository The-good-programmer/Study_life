"""
Procedural glasses and hats for the avatar pipeline (build_avatar.py).

MakeHuman's free assets have no glasses and almost no hats, so these are
generated in Blender and fitted to the base human: glasses from the eyes,
hats from the skull. Every piece is weighted fully to the head bone and gets
the same body-shape morph targets as the garments, derived from how the
eyes / skull move and scale between body variants.

Blender axes: +Z up, -Y is the front of the face, +X the avatar's left.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ─── Measuring the head ─────────────────────────────────────────────────────


class HeadFit:
    """Where the eyes, skull and ears are, measured from rest-pose vertices."""

    def __init__(self, eye_co, body_co):
        left = eye_co[eye_co[:, 0] > 0]
        right = eye_co[eye_co[:, 0] < 0]
        self.eye_l = Vector(left.mean(0))
        self.eye_r = Vector(right.mean(0))
        self.eye_front = float(eye_co[:, 1].min())
        self.eye_top = float(eye_co[:, 2].max())
        self.eye_z = float(eye_co[:, 2].mean())
        top = float(body_co[:, 2].max())
        self.top = top
        skull = body_co[body_co[:, 2] > self.eye_top + 0.01]
        self.centre = Vector(((skull[:, 0].max() + skull[:, 0].min()) / 2, (skull[:, 1].max() + skull[:, 1].min()) / 2, 0))
        self.half_w = float((skull[:, 0].max() - skull[:, 0].min()) / 2)
        self.half_d = float((skull[:, 1].max() - skull[:, 1].min()) / 2)
        # Width of the head at eye level (where glasses temples run).
        band = body_co[np.abs(body_co[:, 2] - self.eye_z) < 0.01]
        band = band[band[:, 1] > self.eye_front + 0.03]  # behind the eyes
        self.temple_x = float(np.abs(band[:, 0]).max()) if len(band) else self.half_w
        self.ear_y = self.eye_front + 0.095


def head_transform(neutral, variant):
    """An affine map taking neutral-head accessory points onto a variant head
    (scale about the skull centre, then follow the skull)."""
    s = Vector((variant.half_w / neutral.half_w, variant.half_d / neutral.half_d, 1.0))
    c0 = Vector((neutral.centre.x, neutral.centre.y, neutral.eye_z))
    c1 = Vector((variant.centre.x, variant.centre.y, variant.eye_z))
    dz = (variant.top - variant.eye_z) / (neutral.top - neutral.eye_z)
    return lambda p: Vector(((p.x - c0.x) * s.x + c1.x, (p.y - c0.y) * s.y + c1.y, (p.z - c0.z) * dz + c1.z))


# ─── Mesh helpers ───────────────────────────────────────────────────────────


def _material(name, color, roughness=0.5, metallic=0.0, alpha=1.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    return mat


def _curve_tube(name, points, radius, cyclic=False, square=False, width=0.0):
    """A tube (or flat band) mesh along a polyline."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 0 if square else 3
    cu.extrude = width
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (*q, 1)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    mesh = obj.to_mesh().copy()
    obj.to_mesh_clear()
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(cu)
    return mesh


def _join(name, parts):
    """Joins (mesh, material) pairs into one object with one slot per material."""
    bm = bmesh.new()
    mats = []
    for mesh, mat in parts:
        if mat not in mats:
            mats.append(mat)
        idx = mats.index(mat)
        tmp = bmesh.new()
        tmp.from_mesh(mesh)
        for f in tmp.faces:
            f.material_index = idx
        tmp.to_mesh(mesh)
        tmp.free()
        bm.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def _uv_sphere_cap(name, centre, radii, z_min, segments=40, rings=16, tilt=0.0):
    """The part of an ellipsoid above z_min (a hat dome)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=radii, verts=bm.verts)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(tilt, 3, "X"), verts=bm.verts)
    bmesh.ops.translate(bm, vec=centre, verts=bm.verts)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < z_min], context="VERTS")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def _primitive(name, kind, matrix, **kw):
    bm = bmesh.new()
    if kind == "cylinder":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get("segments", 32), radius1=kw["r"], radius2=kw.get("r2", kw["r"]), depth=kw["depth"])
    elif kind == "box":
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=kw["size"], verts=bm.verts)
    elif kind == "torus":
        me = bpy.data.meshes.new(name)
        _torus(bm, kw["R"], kw["r"], kw.get("arc", 2 * math.pi))
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def _torus(bm, R, r, arc, seg=48, ring=12):
    rows = []
    for i in range(seg + 1):
        a = -arc / 2 + arc * i / seg
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            row.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % ring], rows[i + 1][(j + 1) % ring], rows[i + 1][j]))


# ─── Glasses ────────────────────────────────────────────────────────────────

GLASSES = {
    # rim outline, rim tube radius, flat rim width, lens look
    "wireframe": dict(w=0.050, h=0.034, corner=0.010, tube=0.0011, band=0.0, lens="clear", metal=True),
    "thick-frame": dict(w=0.054, h=0.040, corner=0.008, tube=0.0028, band=0.0025, lens="clear", metal=False),
    "round": dict(w=0.046, h=0.046, corner=0.023, tube=0.0012, band=0.0, lens="clear", metal=True),
    "sunglasses": dict(w=0.058, h=0.044, corner=0.014, tube=0.0026, band=0.002, lens="dark", metal=False),
}


def _rounded_rect(cx, cz, w, h, r, y, n=12):
    pts = []
    corners = [(cx + w / 2 - r, cz + h / 2 - r, 0), (cx - w / 2 + r, cz + h / 2 - r, math.pi / 2),
               (cx - w / 2 + r, cz - h / 2 + r, math.pi), (cx + w / 2 - r, cz - h / 2 + r, 1.5 * math.pi)]
    for ccx, ccz, a0 in corners:
        for i in range(n + 1):
            a = a0 + (math.pi / 2) * i / n
            pts.append((ccx + r * math.cos(a), y, ccz + r * math.sin(a)))
    return pts


def build_glasses(style, fit):
    spec = GLASSES[style]
    frame = _material("eyewear_frame", (0.8, 0.8, 0.8), roughness=0.25 if spec["metal"] else 0.4, metallic=0.9 if spec["metal"] else 0.0)
    lens = _material("lens_dark" if spec["lens"] == "dark" else "lens_clear",
                     (0.05, 0.06, 0.07) if spec["lens"] == "dark" else (0.9, 0.95, 1.0),
                     roughness=0.05, alpha=0.82 if spec["lens"] == "dark" else 0.12)
    y = fit.eye_front - 0.013
    cz = fit.eye_z + 0.002
    parts = []
    inner = []
    for eye in (fit.eye_l, fit.eye_r):
        side = 1 if eye.x > 0 else -1
        cx = eye.x + side * 0.002
        rim = _rounded_rect(cx, cz, spec["w"], spec["h"], spec["corner"], y)
        parts.append((_curve_tube("rim", rim, spec["tube"], cyclic=True, square=spec["band"] > 0, width=spec["band"]), frame))
        # Lens: a fan of triangles just behind the rim.
        bm = bmesh.new()
        centre = bm.verts.new((cx, y + 0.001, cz))
        ring = [bm.verts.new((p[0], y + 0.001, p[2])) for p in rim]
        for i in range(len(ring)):
            bm.faces.new((centre, ring[i], ring[(i + 1) % len(ring)]))
        me = bpy.data.meshes.new("lens")
        bm.to_mesh(me)
        bm.free()
        parts.append((me, lens))
        inner.append((cx - side * spec["w"] / 2, cz + spec["h"] * 0.15))
        # Temple: from the outer top of the rim back along the side of the head to behind the ear.
        x0 = cx + side * spec["w"] / 2
        xs = side * (fit.temple_x + 0.004)
        temple = [(x0, y, cz + spec["h"] * 0.3), (xs, y + 0.015, cz + spec["h"] * 0.3),
                  (xs, fit.ear_y, cz + 0.004), (xs * 0.97, fit.ear_y + 0.02, cz - 0.02)]
        parts.append((_curve_tube("temple", temple, max(spec["tube"], 0.0012), square=spec["band"] > 0, width=spec["band"] * 0.5), frame))
    (xl, zl), (xr, zr) = inner
    bridge = [(xl, y, zl), ((xl + xr) / 2, y - 0.002, zl + 0.004), (xr, y, zr)]
    parts.append((_curve_tube("bridge", bridge, max(spec["tube"], 0.0012)), frame))
    return _join(f"Item_{style}", parts)


# ─── Hats ───────────────────────────────────────────────────────────────────


HATS = ["cap", "beanie", "mortarboard", "headphones", "halo", "crown"]


class HeadShell:
    """The scalp pushed out by `thickness` (room for short hair): hats are
    shrink-wrapped onto it, so they sit on this head instead of on a guessed
    ellipsoid. Built from the body's rest pose (helper geometry excluded)."""

    def __init__(self, body, real, fit, thickness=0.014):
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        z_min = fit.eye_top - 0.05
        drop = [v for v in bm.verts if not real[v.index] or v.co.z < z_min]
        bmesh.ops.delete(bm, geom=drop, context="VERTS")
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * thickness
        me = bpy.data.meshes.new("HeadShell")
        bm.to_mesh(me)
        bm.free()
        self.obj = bpy.data.objects.new("HeadShell", me)
        bpy.context.scene.collection.objects.link(self.obj)
        self.co = np.array([v.co[:] for v in me.vertices])

    def section(self, z, band=0.006):
        """Half-extents (x, y) and centre of the shell's slice at height z."""
        ring = self.co[np.abs(self.co[:, 2] - z) < band]
        lo, hi = ring.min(0), ring.max(0)
        return (hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, Vector(((hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, z))

    def wrap(self, mesh, offset=0.002):
        """Projects a (larger) mesh onto the shell, keeping it outside."""
        tmp = bpy.data.objects.new("wrap_tmp", mesh)
        bpy.context.scene.collection.objects.link(tmp)
        mod = tmp.modifiers.new("wrap", "SHRINKWRAP")
        mod.target = self.obj
        mod.wrap_method = "NEAREST_SURFACEPOINT"
        mod.wrap_mode = "OUTSIDE_SURFACE"
        mod.offset = offset
        dg = bpy.context.evaluated_depsgraph_get()
        out = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        bpy.data.objects.remove(tmp)
        bpy.data.meshes.remove(mesh)
        return out

    def dispose(self):
        me = self.obj.data
        bpy.data.objects.remove(self.obj)
        bpy.data.meshes.remove(me)


def _dome(shell, fit, front_z, back_z, offset):
    """A skull-hugging dome whose rim runs from front_z (forehead) down to
    back_z (nape): a big hemisphere, cut along that tilted rim, wrapped onto
    the head shell."""
    rx, ry, c = shell.section(fit.eye_top + 0.04)
    front_y, back_y = c.y - ry, c.y + ry
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=1.0)
    bmesh.ops.scale(bm, vec=(rx + 0.06, ry + 0.06, fit.top - back_z + 0.06), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(c.x, c.y, back_z), verts=bm.verts)

    def rim(y):
        t = min(1.0, max(0.0, (y - front_y) / (back_y - front_y)))
        return front_z + (back_z - front_z) * t

    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < rim(v.co.y)], context="VERTS")
    me = bpy.data.meshes.new("dome")
    bm.to_mesh(me)
    bm.free()
    return shell.wrap(me, offset), front_y, c


def build_hat(style, fit, shell):
    main = _material("headwear_main", (0.8, 0.8, 0.8), roughness=0.85)
    hairline = fit.eye_top + 0.035
    parts = []
    if style in ("cap", "beanie", "mortarboard"):
        if style == "mortarboard":
            front_z, back_z = hairline + 0.005, hairline - 0.01
        else:
            front_z, back_z = hairline, fit.eye_top - 0.01
        dome, front_y, c = _dome(shell, fit, front_z, back_z, 0.008 if style == "beanie" else 0.003)
        parts.append((dome, main))
        top = max(v.co.z for v in dome.vertices)
        if style == "beanie":
            # A turned-up cuff: a band around the rim, a little proud of the dome.
            rx, ry, cc = shell.section(front_z + 0.012)
            m = (Matrix.Translation((cc.x, cc.y + 0.004, front_z + 0.008)) @ Matrix.Rotation(-0.12, 4, "X")
                 @ Matrix.Diagonal((rx + 0.016, ry + 0.016, 1, 1)))
            parts.append((_primitive("cuff", "cylinder", m, r=1.0, depth=0.032, segments=64), main))
        elif style == "cap":
            # Brim: a half-ring strip from the forehead outwards, tipped down a little.
            rx, _, cc = shell.section(front_z)
            bm = bmesh.new()
            n = 32
            rows = []
            for depth in (0.0, -0.004):
                inner, outer = [], []
                for i in range(n + 1):
                    a = math.pi * i / n
                    inner.append(bm.verts.new((rx * 0.92 * math.cos(a), -0.012 * math.sin(a), depth)))
                    outer.append(bm.verts.new((rx * 0.98 * math.cos(a), -0.09 * math.sin(a), depth)))
                rows.append((inner, outer))
            (ti, to), (bi, bo) = rows
            for i in range(n):
                bm.faces.new((ti[i], to[i], to[i + 1], ti[i + 1]))
                bm.faces.new((bi[i + 1], bo[i + 1], bo[i], bi[i]))
                bm.faces.new((to[i], bo[i], bo[i + 1], to[i + 1]))
            m = Matrix.Translation((cc.x, front_y + 0.014, front_z + 0.006)) @ Matrix.Rotation(-0.18, 4, "X")
            bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
            brim = bpy.data.meshes.new("brim")
            bm.to_mesh(brim)
            bm.free()
            parts.append((brim, main))
            parts.append((_primitive("button", "cylinder", Matrix.Translation((c.x, c.y, top + 0.001)), r=0.007, depth=0.005, segments=16), main))
        else:
            board_z = top + 0.004
            parts.append((_primitive("board", "box", Matrix.Translation((c.x, c.y, board_z)), size=(0.2, 0.2, 0.007)), main))
            gold = _material("tassel", (0.86, 0.66, 0.2), roughness=0.5)
            tassel = [(c.x, c.y, board_z + 0.004), (c.x + 0.07, c.y - 0.04, board_z + 0.004), (c.x + 0.095, c.y - 0.05, board_z - 0.05)]
            parts.append((_curve_tube("tassel", tassel, 0.0018), gold))
    elif style == "headphones":
        rx, _, c = shell.section(fit.eye_top + 0.04)
        band = []
        for i in range(25):
            a = math.pi * i / 24
            band.append((c.x + math.cos(a) * (rx + 0.008), c.y + 0.01, fit.eye_z - 0.005 + math.sin(a) * (fit.top - fit.eye_z + 0.02)))
        parts.append((_curve_tube("band", band, 0.004, square=True, width=0.008), main))
        pad = _material("headphone_pads", (0.08, 0.08, 0.09), roughness=0.7)
        for side in (1, -1):
            m = Matrix.Translation((c.x + side * (fit.temple_x + 0.014), c.y + 0.01, fit.eye_z - 0.015)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
            parts.append((_primitive("cup", "cylinder", m, r=0.034, depth=0.026, segments=32), main))
            m2 = Matrix.Translation((c.x + side * (fit.temple_x + 0.0005), c.y + 0.01, fit.eye_z - 0.015)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
            parts.append((_primitive("pad", "cylinder", m2, r=0.03, depth=0.01, segments=32), pad))
    elif style == "halo":
        glow = _material("halo_glow", (1.0, 0.85, 0.35), roughness=0.4, emission=(1.0, 0.75, 0.2))
        parts.append((_primitive("ring", "torus", Matrix.Translation((fit.centre.x, fit.centre.y + 0.01, fit.top + 0.07)), R=0.105, r=0.006), glow))
    elif style == "crown":
        base_z = fit.top - 0.045
        rx, ry, c = shell.section(base_z)
        rx, ry = rx + 0.004, ry + 0.004
        parts.append((_primitive("band", "cylinder", Matrix.Translation((c.x, c.y, base_z)) @ Matrix.Diagonal((rx, ry, 1, 1)), r=1.0, depth=0.032, segments=48), main))
        for i in range(8):
            a = 2 * math.pi * i / 8
            m = Matrix.Translation((c.x + math.cos(a) * rx * 0.98, c.y + math.sin(a) * ry * 0.98, base_z + 0.032))
            parts.append((_primitive("spike", "cylinder", m, r=0.011, r2=0.0, depth=0.035, segments=4), main))
    else:
        raise ValueError(style)
    return _join(f"Item_{style}", parts)


# ─── Rigging and body morphs ────────────────────────────────────────────────


def rig_to_head(obj, rig, neutral_fit, variant_fits):
    """Weights the accessory fully to the head bone, parents it to the rig,
    and adds the body-shape morphs (follow the head of each variant)."""
    obj.parent = rig
    group = obj.vertex_groups.new(name="head")
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    obj.shape_key_add(name="Basis", from_mix=False)
    base = [v.co.copy() for v in obj.data.vertices]
    for name, fit in variant_fits.items():
        f = head_transform(neutral_fit, fit)
        key = obj.shape_key_add(name=name, from_mix=False)
        for kv, p in zip(key.data, base):
            kv.co = f(p)
