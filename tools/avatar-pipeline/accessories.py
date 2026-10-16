"""
Procedural glasses and hats for the avatar pipeline (build_avatar.py).

MakeHuman's free assets have no glasses and almost no hats, so these are
generated in Blender and fitted to the base human: glasses to the face
(lenses in front of the eyes, pads on the nose, temples along the head to
over the ears), hats to the skull. Every piece is weighted fully to the
head bone and gets the same body-shape morph targets as the garments:
glasses are rebuilt on each body variant's head (same topology, so the
rebuild is the morph target), hats follow an affine fit of the skull.

Blender axes: +Z up, -Y is the front of the face, +X the avatar's left.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# ─── Measuring the head ─────────────────────────────────────────────────────


class HeadFit:
    """Where the eyes, skull, face and ears are, measured from rest-pose
    vertices (eyeballs, body without helper geometry, the body's ears)."""

    def __init__(self, eye_co, body_co, ear_co=None):
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
        # Width of the head at eye level (anywhere behind the eyes, ears included).
        band = body_co[np.abs(body_co[:, 2] - self.eye_z) < 0.01]
        band = band[band[:, 1] > self.eye_front + 0.03]
        self.temple_x = float(np.abs(band[:, 0]).max()) if len(band) else self.half_w
        # Width of the face at the temples, just behind the eyes (where a frame's hinges sit).
        face = body_co[(np.abs(body_co[:, 2] - self.eye_z) < 0.008)
                       & (body_co[:, 1] > self.eye_front) & (body_co[:, 1] < self.eye_front + 0.03)]
        self.face_x = float(np.abs(face[:, 0]).max()) if len(face) else self.half_w * 0.9
        self.ear_y = self.eye_front + 0.095
        # The head's skin, for fitting things that touch it.
        self.skin = body_co[body_co[:, 2] > self.eye_z - 0.08]
        self.ears = {}
        if ear_co is not None and len(ear_co):
            for side in (1, -1):
                e = ear_co[side * ear_co[:, 0] > 0]
                self.ears[side] = dict(top=float(e[:, 2].max()), front=float(e[:, 1].min()), back=float(e[:, 1].max()))

    def skin_front(self, x, z, r=0.003):
        """Front-most skin (smallest y) near (x, z) on the face, or None."""
        s = self.skin
        m = (np.abs(s[:, 0] - x) < r) & (np.abs(s[:, 2] - z) < r) & (s[:, 1] < self.eye_front + 0.04)
        return float(s[m, 1].min()) if m.any() else None

    def skin_side(self, side, y, z, r=0.004):
        """Outermost |x| of the skin on one side near (y, z), or None."""
        s = self.skin
        m = (np.abs(s[:, 1] - y) < r) & (np.abs(s[:, 2] - z) < r) & (side * s[:, 0] > 0)
        return float(np.abs(s[m, 0]).max()) if m.any() else None


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


def _primitive(name, kind, matrix, **kw):
    bm = bmesh.new()
    if kind == "cylinder":
        bmesh.ops.create_cone(bm, cap_ends=kw.get("caps", True), segments=kw.get("segments", 32), radius1=kw["r"],
                              radius2=kw.get("r2", kw["r"]), depth=kw["depth"])
    elif kind == "box":
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=kw["size"], verts=bm.verts)
    elif kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=kw.get("segments", 12), v_segments=kw.get("rings", 8), radius=1.0)
    elif kind == "torus":
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


def _band(name, centre, rx, ry, profile, matrix=None, segments=96):
    """A closed band around an ellipse (centre, rx, ry): `profile` is a closed
    loop of (radial offset, height) points swept all the way round, so the
    band has a real thickness and smooth, round edges."""
    bm = bmesh.new()
    rows = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((centre[0] + (rx + dr) * ca, centre[1] + (ry + dr) * sa, centre[2] + dz)) for dr, dz in profile])
    n = len(profile)
    for i in range(segments):
        a, b = rows[i], rows[(i + 1) % segments]
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def _rounded_profile(half_w, half_h, r, n=3):
    """A closed rounded-rectangle profile (radial offset, height), for bands."""
    pts = []
    for cx, cz, a0 in ((half_w - r, -half_h + r, -math.pi / 2), (half_w - r, half_h - r, 0.0),
                       (-half_w + r, half_h - r, math.pi / 2), (-half_w + r, -half_h + r, math.pi)):
        for i in range(n + 1):
            a = a0 + (math.pi / 2) * i / n
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


# ─── Glasses ────────────────────────────────────────────────────────────────

GLASSES = {
    # lens height, corner radius, rim tube radius, flat rim width, half the
    # bridge, lens width as a share of the room up to the temples
    "wireframe": dict(h=0.032, corner=0.009, tube=0.0010, band=0.0, bridge=0.0095, fill=0.95, lens="clear", metal=True),
    "thick-frame": dict(h=0.036, corner=0.007, tube=0.0024, band=0.0022, bridge=0.009, fill=1.0, lens="clear", metal=False),
    "round": dict(round=True, tube=0.0011, band=0.0, bridge=0.0095, fill=1.0, lens="clear", metal=True),
    "sunglasses": dict(h=0.041, corner=0.013, tube=0.0024, band=0.002, bridge=0.009, fill=1.03, lens="dark", metal=False),
}


def _rounded_rect(cx, cz, w, h, r, n=12):
    pts = []
    corners = [(cx + w / 2 - r, cz + h / 2 - r, 0), (cx - w / 2 + r, cz + h / 2 - r, math.pi / 2),
               (cx - w / 2 + r, cz - h / 2 + r, math.pi), (cx + w / 2 - r, cz - h / 2 + r, 1.5 * math.pi)]
    for ccx, ccz, a0 in corners:
        for i in range(n + 1):
            a = a0 + (math.pi / 2) * i / n
            pts.append((ccx + r * math.cos(a), ccz + r * math.sin(a)))
    return pts


def _glasses_layout(style, fit):
    """Lens size and position for this head: the frame is as wide as the
    face at the temples, the bridge sits on the nose and the lenses about a
    centimetre in front of the eyes, tilted and wrapped a little to follow
    the face, and pushed forward if the brows or cheeks would touch them."""
    spec = GLASSES[style]
    bridge = spec["bridge"]
    hinge_x = fit.face_x + 0.002
    room = hinge_x - 0.004 - bridge  # rim's outer edge, minus the end piece
    if spec.get("round"):
        w = h = min(0.046, room)
        corner = w / 2
    else:
        w, h, corner = room * spec["fill"], spec["h"], spec["corner"]
    cx = bridge + w / 2
    cz = fit.eye_z + (0.001 if spec.get("round") else 0.002)
    wrap, tilt = 0.07, 0.12

    def depth(x, z, y0):
        return y0 + wrap * max(0.0, abs(x) - bridge) + tilt * (cz - z)

    outline = _rounded_rect(cx, cz, w, h, corner)
    y0 = fit.eye_front - 0.010
    deficit = 0.0
    for x, z in outline:
        # Cheeks rise when smiling: more room below the eyes than above.
        skin = fit.skin_front(x, z)
        if skin is not None:
            margin = 0.006 if z < cz else 0.003
            deficit = max(deficit, depth(x, z, y0) - (skin - margin))
    y0 -= deficit
    return dict(spec=spec, w=w, h=h, corner=corner, cx=cx, cz=cz, bridge=bridge, outline=outline,
                depth=lambda x, z: depth(x, z, y0))


def build_glasses(style, fit):
    """Glasses fitted to `fit`'s head. The vertex count depends only on the
    style, so a build on a body variant's head is that variant's morph."""
    L = _glasses_layout(style, fit)
    spec, w, h, cx, cz, depth = L["spec"], L["w"], L["h"], L["cx"], L["cz"], L["depth"]
    frame = _material("eyewear_frame", (0.8, 0.8, 0.8), roughness=0.25 if spec["metal"] else 0.4, metallic=0.9 if spec["metal"] else 0.0)
    lens = _material("lens_dark" if spec["lens"] == "dark" else "lens_clear",
                     (0.05, 0.06, 0.07) if spec["lens"] == "dark" else (0.9, 0.95, 1.0),
                     roughness=0.05, alpha=0.82 if spec["lens"] == "dark" else 0.12)
    tube = max(spec["tube"], 0.0011)
    parts = []
    for side in (1, -1):
        rim = [(side * x, depth(x, z), z) for x, z in L["outline"]]
        if side < 0:
            rim.reverse()
        parts.append((_curve_tube("rim", rim, spec["tube"], cyclic=True, square=spec["band"] > 0, width=spec["band"]), frame))
        # Lens: a fan of triangles just behind the rim.
        bm = bmesh.new()
        centre = bm.verts.new((side * cx, depth(cx, cz) + 0.0006, cz))
        ring = [bm.verts.new((p[0], p[1] + 0.0006, p[2])) for p in rim]
        for i in range(len(ring)):
            bm.faces.new((centre, ring[i], ring[(i + 1) % len(ring)]))
        me = bpy.data.meshes.new("lens")
        bm.to_mesh(me)
        bm.free()
        parts.append((me, lens))

        # End piece and temple: from the rim's outer edge back to a hinge at
        # the temple, then along the side of the head (just off the skin),
        # over the top of the ear and down behind it.
        zt = cz + h * 0.25
        x_out = cx + w / 2
        hinge = Vector((side * (x_out + 0.004), depth(x_out, zt) + 0.004, zt))
        ear = fit.ears.get(side, dict(top=fit.eye_z + 0.01, front=fit.ear_y - 0.015, back=fit.ear_y + 0.02))
        over = max(ear["top"] + 0.004, zt - 0.006)
        path = [Vector((side * x_out, depth(x_out, zt), zt)), hinge]
        x_prev = abs(hinge.x)
        steps = 9
        for i in range(1, steps + 1):
            y = hinge.y + (ear["back"] + 0.004 - hinge.y) * i / steps
            t = min(1.0, (y - hinge.y) / max(ear["front"] - hinge.y, 1e-3))
            z = zt + (over - zt) * t
            skin = fit.skin_side(side, y, z)
            x_prev = max(x_prev, (skin or x_prev) + 0.0015 + tube)
            path.append(Vector((side * x_prev, y, z)))
        for dy, dz in ((0.008, -0.012), (0.007, -0.028)):
            y, z = ear["back"] + dy, over + dz
            skin = fit.skin_side(side, y, z)
            path.append(Vector((side * ((skin or x_prev) + 0.001 + tube), y, z)))
        parts.append((_curve_tube("temple", [p[:] for p in path], tube, square=spec["band"] > 0, width=spec["band"] * 0.5), frame))

        # Nose pad on a short arm, resting on the side of the nose.
        zp = cz - h * 0.12
        xp = L["bridge"] - 0.001
        nose = fit.skin_front(xp, zp, r=0.0025)
        x_in = cx - w / 2
        pad_y = (nose if nose is not None else depth(x_in, zp)) - 0.0012
        pad = Vector((side * xp, pad_y, zp))
        parts.append((_primitive("pad", "sphere", Matrix.Translation(pad) @ Matrix.Diagonal((0.0016, 0.0026, 0.0042, 1))), frame))
        arm = [(side * (x_in + 0.001), depth(x_in, zp + 0.006), zp + 0.006), pad[:]]
        parts.append((_curve_tube("pad_arm", arm, 0.0006 if spec["metal"] else 0.0012), frame))

    # Bridge: an arch between the rims, over the nose.
    zb = cz + h * 0.22
    yb = depth(L["bridge"], zb)
    nose = fit.skin_front(0.0, zb + 0.004)
    mid = min(yb - 0.001, (nose - 0.0025) if nose is not None else yb)
    bridge = [(L["bridge"], yb, zb), (0.0, mid, zb + 0.004), (-L["bridge"], yb, zb)]
    parts.append((_curve_tube("bridge", bridge, max(spec["tube"], 0.0012), square=spec["band"] > 0, width=spec["band"] * 0.6), frame))
    return _join(f"Item_{style}", parts)


# ─── Hats ───────────────────────────────────────────────────────────────────


HATS = ["cap", "beanie", "mortarboard", "headphones", "halo", "crown"]
# Headwear that sits clear of the hair (it hides none of it).
NO_HAIR_HIDING = {"halo"}


class HeadShell:
    """The scalp pushed out by `thickness` (room for short hair): hats are
    shrink-wrapped onto it, so they sit on this head instead of on a guessed
    ellipsoid. Built from the body's rest pose (helper geometry excluded)."""

    def __init__(self, body, real, fit, thickness=0.014):
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        z_min = fit.eye_top - 0.05
        # The ears stick out of the skull: hats wrap the skull, not them.
        ears = body.vertex_groups.get("ears")
        on_ear = set()
        if ears is not None:
            on_ear = {v.index for v in body.data.vertices if any(g.group == ears.index and g.weight > 0.5 for g in v.groups)}
        drop = [v for v in bm.verts if not real[v.index] or v.co.z < z_min or v.index in on_ear]
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
        self.tree = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices[:] for p in me.polygons])
        self.centre = Vector((fit.centre.x, fit.centre.y, fit.eye_z + 0.02))

    def section(self, z, band=0.006):
        """Half-extents (x, y) and centre of the shell's slice at height z."""
        ring = self.co[np.abs(self.co[:, 2] - z) < band]
        lo, hi = ring.min(0), ring.max(0)
        return (hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, Vector(((hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, z))

    def wrap(self, mesh, offset=0.002):
        """Projects a (larger) mesh onto the shell, `offset` outside it, along
        rays from the middle of the head: neighbouring vertices stay
        neighbours, so a clean edge stays clean."""
        for v in mesh.vertices:
            d = (v.co - self.centre).normalized()
            hit = self.tree.ray_cast(self.centre, d, 1.0)[0]
            if hit is None:  # a gap in the shell (where an ear was): its nearest point
                hit = self.tree.find_nearest(v.co)[0]
            v.co = hit + d * offset
        mesh.update()
        return mesh

    def dispose(self):
        me = self.obj.data
        bpy.data.objects.remove(self.obj)
        bpy.data.meshes.remove(me)


def _dome(shell, fit, front_z, back_z, offset, hem=0.004):
    """A skull-hugging dome whose rim runs from front_z (forehead) down to
    back_z (nape): a big hemisphere cut cleanly along that tilted rim (a
    plane), wrapped onto the head shell, with its edge turned in by `hem`
    so it has a thickness."""
    rx, ry, c = shell.section(fit.eye_top + 0.04)
    front_y, back_y = c.y - ry, c.y + ry
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=72, v_segments=36, radius=1.0)
    bmesh.ops.scale(bm, vec=(rx + 0.06, ry + 0.06, fit.top - back_z + 0.06), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(c.x, c.y, back_z), verts=bm.verts)
    slope = (back_z - front_z) / (back_y - front_y)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                           plane_co=(c.x, front_y, front_z), plane_no=Vector((0, -slope, 1)).normalized(), clear_inner=True)
    me = bpy.data.meshes.new("dome")
    bm.to_mesh(me)
    bm.free()
    me = shell.wrap(me, offset)
    if hem:
        bm = bmesh.new()
        bm.from_mesh(me)
        edges = [e for e in bm.edges if e.is_boundary]
        new = bmesh.ops.extrude_edge_only(bm, edges=edges)["geom"]
        for v in (g for g in new if isinstance(g, bmesh.types.BMVert)):
            v.co -= (v.co - shell.centre).normalized() * hem
            v.co.z += 0.002
        bm.to_mesh(me)
        bm.free()
    return me, front_y, c


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
            # A turned-up cuff: a thick, rounded band around the rim, proud of the dome.
            rx, ry, cc = shell.section(front_z + 0.012)
            m = Matrix.Translation((cc.x, cc.y + 0.004, front_z + 0.006)) @ Matrix.Rotation(-0.12, 4, "X")
            parts.append((_band("cuff", (0, 0, 0), rx + 0.013, ry + 0.013,
                                _rounded_profile(0.0055, 0.017, 0.004), matrix=m), main))
        elif style == "cap":
            # Brim: a curved peak from the forehead outwards, its sides bent
            # down and its edge rounded.
            rx, _, cc = shell.section(front_z)
            bm = bmesh.new()
            n = 64
            rows = []
            for depth in (0.0, -0.004):
                inner, outer = [], []
                for i in range(n + 1):
                    a = math.pi * i / n
                    bend = -0.012 * math.cos(a) ** 2
                    inner.append(bm.verts.new((rx * 0.92 * math.cos(a), -0.012 * math.sin(a), depth + bend * 0.3)))
                    outer.append(bm.verts.new((rx * 0.98 * math.cos(a), -0.09 * math.sin(a), depth + bend)))
                rows.append((inner, outer))
            (ti, to), (bi, bo) = rows
            for i in range(n):
                bm.faces.new((ti[i], to[i], to[i + 1], ti[i + 1]))
                bm.faces.new((bi[i + 1], bo[i + 1], bo[i], bi[i]))
                bm.faces.new((to[i], bo[i], bo[i + 1], to[i + 1]))
                bm.faces.new((ti[i + 1], bi[i + 1], bi[i], ti[i]))
            # Sewn on at the front of the crown's edge (no gap above the forehead).
            front = min((v.co for v in dome.vertices if abs(v.co.x - c.x) < 0.02), key=lambda p: p.y)
            m = Matrix.Translation((cc.x, front.y + 0.012, front.z - 0.001)) @ Matrix.Rotation(-0.18, 4, "X")
            bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
            brim = bpy.data.meshes.new("brim")
            bm.to_mesh(brim)
            bm.free()
            parts.append((brim, main))
            parts.append((_primitive("button", "sphere", Matrix.Translation((c.x, c.y, top - 0.001)) @ Matrix.Diagonal((0.007, 0.007, 0.004, 1)),
                                     segments=16, rings=8), main))
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
        # An open band (no lid, so the hair shows inside it) with points on top.
        base_z = fit.top - 0.045
        rx, ry, c = shell.section(base_z)
        rx, ry = rx + 0.006, ry + 0.006
        parts.append((_band("band", (c.x, c.y, base_z), rx, ry, _rounded_profile(0.0022, 0.016, 0.0015)), main))
        for i in range(8):
            a = 2 * math.pi * i / 8
            m = Matrix.Translation((c.x + math.cos(a) * rx, c.y + math.sin(a) * ry, base_z + 0.0155 + 0.0175))
            parts.append((_primitive("spike", "cylinder", m @ Matrix.Rotation(a + math.pi / 4, 4, "Z"),
                                     r=0.011, r2=0.0, depth=0.035, segments=4), main))
            jewel = Matrix.Translation((c.x + math.cos(a + math.pi / 8) * (rx + 0.002), c.y + math.sin(a + math.pi / 8) * (ry + 0.002), base_z))
            parts.append((_primitive("jewel", "sphere", jewel @ Matrix.Diagonal((0.004, 0.004, 0.004, 1)), segments=12, rings=6), main))
    else:
        raise ValueError(style)
    return _join(f"Item_{style}", parts)


# ─── Rigging and body morphs ────────────────────────────────────────────────


def rig_to_head(obj, rig, neutral_fit, variant_fits, rebuild=None):
    """Weights the accessory fully to the head bone, parents it to the rig,
    and adds the body-shape morphs: `rebuild(fit)` builds the same item on a
    variant's head (its vertices become the morph target); without it, the
    item follows an affine fit of each variant's skull."""
    obj.parent = rig
    group = obj.vertex_groups.new(name="head")
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    obj.shape_key_add(name="Basis", from_mix=False)
    base = [v.co.copy() for v in obj.data.vertices]
    for name, fit in variant_fits.items():
        key = obj.shape_key_add(name=name, from_mix=False)
        if rebuild:
            other = rebuild(fit)
            co = [v.co.copy() for v in other.data.vertices]
            me = other.data
            bpy.data.objects.remove(other)
            bpy.data.meshes.remove(me)
            if len(co) != len(base):
                raise RuntimeError(f"{obj.name}: variant {name} has {len(co)} vertices, not {len(base)}")
            for kv, p in zip(key.data, co):
                kv.co = p
        else:
            f = head_transform(neutral_fit, fit)
            for kv, p in zip(key.data, base):
                kv.co = f(p)
