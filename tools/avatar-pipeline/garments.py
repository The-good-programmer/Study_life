"""
Procedural garments built from MakeHuman ones, for customizer options the
free assets don't cover (build_avatar.py):

- hoodie: the sweater plus a hood lying down on the upper back, a kangaroo
  pocket and drawstrings;
- lab-coat: the button-down shirt with lapels over an open V (the shirt
  underneath shows there), extended into an open, knee-length coat.

New parts follow the garment they are built on: they are draped over its
surface (projected onto it, then lifted off it by their own thickness) and
take their UVs from plain fabric of the same texture. They take their bone
weights from the body (nearest surface) or, for the coat skirt, from the
hips and thighs by height, and their body-shape morphs from a Surface
Deform bound to the body, so they follow every body variant like the
MakeHuman garments do.

Blender axes: +Z up, -Y is the front, +X the avatar's left.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

Z = Vector((0, 0, 1))


def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def duplicate(obj, name):
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name
    return _link(copy)


def _boundary_loops(me):
    """Open boundary loops of a mesh, as lists of vertex indices."""
    bm = bmesh.new()
    bm.from_mesh(me)
    edges = [e for e in bm.edges if e.is_boundary]
    nxt = {}
    for e in edges:
        a, b = e.verts[0].index, e.verts[1].index
        nxt.setdefault(a, []).append(b)
        nxt.setdefault(b, []).append(a)
    bm.free()
    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            options = [v for v in nxt[cur] if v != prev and v not in seen]
            if not options:
                break
            prev, cur = cur, options[0]
            loop.append(cur)
            seen.add(cur)
        loops.append(loop)
    return loops


def _smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def _tri(x):
    """Triangle wave (0 -> 1 -> 0, period 2): UVs that mirror back and forth
    over a small patch of plain fabric, so a large new panel is textured at
    the fabric's own scale without seams."""
    x = x % 2.0
    return x if x <= 1.0 else 2.0 - x


class _Surface:
    """A garment's rest surface (its basis shape), for draping new parts over
    it: nearest points and rays with outward normals, and the UV under a
    point."""

    def __init__(self, obj, axis):
        me = obj.data
        self.co = [v.co.copy() for v in me.vertices]
        self.polys = [p.vertices[:] for p in me.polygons]
        self.loops = [list(p.loop_indices) for p in me.polygons]
        self.uv = me.uv_layers.active.data
        self.tree = BVHTree.FromPolygons(self.co, self.polys)
        # Normals point away from the garment's vertical axis, measured from
        # a little lower (so shoulder tops count as outward-facing too).
        self.axis = Vector(axis)

    def _outward(self, p, n):
        a = Vector((self.axis.x, self.axis.y, p.z - 0.15))
        return n if n.dot(p - a) >= 0 else -n

    def nearest(self, p):
        loc, n, face, _ = self.tree.find_nearest(Vector(p))
        return loc, self._outward(loc, n), face

    def ray(self, origin, direction, dist=1.0):
        loc, n, face, _ = self.tree.ray_cast(Vector(origin), Vector(direction), dist)
        if loc is None:
            return None
        return loc, self._outward(loc, n), face

    def uv_at(self, face, p):
        w = poly_3d_calc([self.co[i] for i in self.polys[face]], Vector(p))
        uv = Vector((0.0, 0.0))
        for li, wi in zip(self.loops[face], w):
            uv += self.uv[li].uv * wi
        return (uv.x, uv.y)


def _grid_faces(bm, rows, uvs, uv_layer, mat=0):
    """Quads between consecutive rows of vertices (rows of equal length)."""
    for r in range(len(rows) - 1):
        for i in range(len(rows[r]) - 1):
            quad = (rows[r][i], rows[r][i + 1], rows[r + 1][i + 1], rows[r + 1][i])
            f = bm.faces.new(quad)
            f.material_index = mat
            for loop, (rr, ii) in zip(f.loops, ((r, i), (r, i + 1), (r + 1, i + 1), (r + 1, i))):
                loop[uv_layer].uv = uvs[rr][ii]


def _finish(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return _link(bpy.data.objects.new(name, me))


# ─── Skinning and morphs for new geometry ───────────────────────────────────


def skin_from_body(obj, body, rig, bones, real=None):
    """Gives each new vertex the bone weights of the nearest body vertex that
    is mostly driven by one of `bones` (e.g. the torso for a hood: never the
    hands, which hang right beside the hips in the bind pose), then rigs the
    object to the armature. `real` masks out MakeHuman's helper geometry."""
    from mathutils import kdtree

    index_of = {g.index: g.name for g in body.vertex_groups}
    bone_names = set(rig.data.bones.keys())
    co = [v.co for v in body.data.vertices]
    weights = []
    for v in body.data.vertices:
        w = {index_of[g.group]: g.weight for g in v.groups if index_of[g.group] in bone_names and g.weight > 0}
        weights.append(w)
    candidates = [i for i, w in enumerate(weights)
                  if w and max(w, key=w.get) in bones and (real is None or real[i])]
    tree = kdtree.KDTree(len(candidates))
    for k, i in enumerate(candidates):
        tree.insert(co[i], k)
    tree.balance()
    groups = {}
    for v in obj.data.vertices:
        _, k, _ = tree.find(v.co)
        for name, w in weights[candidates[k]].items():
            if name not in groups:
                groups[name] = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            groups[name].add([v.index], w, "REPLACE")
    if not any(m.type == "ARMATURE" for m in obj.modifiers):
        arm = obj.modifiers.new("Armature", "ARMATURE")
        arm.object = rig
    obj.parent = rig


def skirt_weights(obj, top_z, hem_z, below_z):
    """Re-weights the vertices below `below_z` (a coat skirt) from the hips
    down the thighs: all pelvis at the waist, blending to mostly the thigh on
    that side at the hem (both thighs across the back), so the skirt follows
    the legs without tearing between them."""
    groups = {n: obj.vertex_groups.get(n) or obj.vertex_groups.new(name=n) for n in ("pelvis", "thigh_l", "thigh_r")}
    for v in obj.data.vertices:
        if v.co.z >= below_z:
            continue
        for g in list(v.groups):
            obj.vertex_groups[g.group].remove([v.index])
        t = min(1.0, max(0.0, (top_z - v.co.z) / (top_z - hem_z)))
        thigh = 0.8 * _smoothstep(0.05, 1.0, t)
        left = _smoothstep(-0.06, 0.06, v.co.x)  # +X is the avatar's left
        for name, w in (("pelvis", 1 - thigh), ("thigh_l", thigh * left), ("thigh_r", thigh * (1 - left))):
            if w > 1e-3:
                groups[name].add([v.index], w, "REPLACE")


def _apply(obj, mod):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def morphs_via_surface_deform(obj, body_obj, variants):
    """`variants`: name -> (N, 3) body vertex positions (same vertex order as
    body_obj). Shape keys on obj follow the body into each variant."""
    proxy = duplicate(body_obj, "body_proxy")
    proxy.modifiers.clear()
    if proxy.data.shape_keys:
        proxy.shape_key_clear()
    base_co = np.empty(len(proxy.data.vertices) * 3, dtype=np.float32)
    proxy.data.vertices.foreach_get("co", base_co)
    keep = [m for m in obj.modifiers]
    saved = [(m, m.show_viewport) for m in keep]
    for m in keep:
        m.show_viewport = False
    sd = obj.modifiers.new("follow", "SURFACE_DEFORM")
    sd.target = proxy
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.surfacedeform_bind(modifier=sd.name)
    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis", from_mix=False)
    for name, co in variants.items():
        proxy.data.vertices.foreach_set("co", np.asarray(co, dtype=np.float32).ravel())
        proxy.data.update()
        bpy.context.view_layer.update()
        ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        out = np.empty(len(ev.data.vertices) * 3, dtype=np.float32)
        ev.data.vertices.foreach_get("co", out)
        key = obj.shape_key_add(name=name, from_mix=False)
        key.data.foreach_set("co", out)
    proxy.data.vertices.foreach_set("co", base_co)
    obj.modifiers.remove(sd)
    for m, v in saved:
        m.show_viewport = v
    me = proxy.data
    bpy.data.objects.remove(proxy)
    bpy.data.meshes.remove(me)


def weights_from_garment(obj, garment, where=lambda co: True):
    """Gives the vertices of `obj` that lie on `garment` (and pass `where`)
    the garment's bone weights at the nearest point of its surface, so they
    bend exactly like it in every pose."""
    co = [v.co.copy() for v in garment.data.vertices]
    polys = [p.vertices[:] for p in garment.data.polygons]
    tree = BVHTree.FromPolygons(co, polys)
    names = {g.index: g.name for g in garment.vertex_groups}
    vw = [{names[g.group]: g.weight for g in v.groups} for v in garment.data.vertices]
    for v in obj.data.vertices:
        if not where(v.co):
            continue
        _, _, face, _ = tree.find_nearest(v.co)
        corners = polys[face]
        mixed = {}
        for k, wk in zip(corners, poly_3d_calc([co[k] for k in corners], v.co)):
            for name, w in vw[k].items():
                mixed[name] = mixed.get(name, 0.0) + w * wk
        for g in list(v.groups):
            obj.vertex_groups[g.group].remove([v.index])
        for name, w in mixed.items():
            if w > 1e-3:
                (obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)).add([v.index], w, "REPLACE")


def morphs_from_garment(obj, garment, where=lambda co: True):
    """Gives the vertices of `obj` that lie on `garment` (and pass `where`)
    the garment's own body-shape morphs, taken at the nearest point of its
    surface: parts sewn onto a MakeHuman garment move exactly with it in
    every body variant, instead of following the body underneath."""
    if not (obj.data.shape_keys and garment.data.shape_keys):
        return
    g_keys = garment.data.shape_keys.key_blocks
    g_basis = g_keys[0]
    g_co = [d.co.copy() for d in g_basis.data]
    polys = [p.vertices[:] for p in garment.data.polygons]
    tree = BVHTree.FromPolygons(g_co, polys)
    keys = obj.data.shape_keys.key_blocks
    basis = keys[0]
    for i, d in enumerate(basis.data):
        if not where(d.co):
            continue
        _, _, face, _ = tree.find_nearest(d.co)
        corners = polys[face]
        w = poly_3d_calc([g_co[k] for k in corners], d.co)
        for key in keys[1:]:
            if key.name not in g_keys:
                continue
            gk = g_keys[key.name].data
            delta = Vector()
            for k, wk in zip(corners, w):
                delta += (gk[k].co - g_basis.data[k].co) * wk
            key.data[i].co = d.co + delta


# ─── Hoodie ─────────────────────────────────────────────────────────────────

# Plain fabric on the sweater's texture (male_casualsuit02): the middle of
# the back panel, and its ribbed hem band (used for the hood's rolled edge).
SWEATER_PLAIN = dict(u=0.17, u_per_m=0.5, v_top=0.89, v_per_m=0.6)
SWEATER_RIB = dict(v0=0.608, v1=0.642)


def _neck_ring(co, loop):
    """The neckline as a function of the angle around it (0 = back centre,
    +pi/2 = the avatar's left, +-pi = front centre)."""
    pts = co[loop]
    c = pts.mean(0)
    ang = np.arctan2(pts[:, 0] - c[0], pts[:, 1] - c[1])
    order = np.argsort(ang)
    ang, pts = ang[order], pts[order]

    def at(phi):
        return Vector([float(np.interp(phi, ang, pts[:, k], period=2 * math.pi)) for k in range(3)])
    return at, Vector(c)


def build_hoodie_parts(sweater):
    """Hood (lying down on the upper back), kangaroo pocket and drawstrings,
    as one new mesh positioned on the neutral body. Material slots: 0 the
    sweater's fabric, 1 the drawstrings."""
    co = np.array([v.co[:] for v in sweater.data.vertices])
    loops = [lp for lp in _boundary_loops(sweater.data) if len(lp) > 8 and abs(co[lp, 0].mean()) < 0.05]
    neck = max(loops, key=lambda lp: co[lp, 2].mean())
    hem = min(loops, key=lambda lp: co[lp, 2].mean())
    neck_at, nc = _neck_ring(co, neck)
    surf = _Surface(sweater, (float(co[:, 0].mean()), float(np.median(co[:, 1]))))

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Hood. Each column runs out from the neckline at angle phi: first a
    # rolled rim standing up around the neck (the hood's face opening, folded
    # over), then the hood itself draped over the shoulders and down the
    # back: longest at the back centre (a rounded shield), short over the
    # shoulders, just the rim at the throat where the two ends nearly meet.
    cols, phi_max, flap_rows = 56, math.radians(164), 14
    rim_profile = [(0.002, -0.003), (0.001, 0.010), (0.006, 0.020), (0.016, 0.025), (0.027, 0.018)]
    rim_rows = [[] for _ in rim_profile]
    rim_uvs = [[] for _ in rim_profile]
    flap = [[] for _ in range(flap_rows + 1)]
    flap_uvs = [[] for _ in range(flap_rows + 1)]
    plain = SWEATER_PLAIN
    for i in range(cols + 1):
        phi = -phi_max + 2 * phi_max * i / cols
        a = abs(phi) / phi_max
        n0 = neck_at(phi)
        out = Vector((math.sin(phi), math.cos(phi), 0))
        # The rim is lower at the front, where the hood's edges run down to the throat.
        lift = 1.0 - 0.5 * _smoothstep(0.55, 1.0, a)
        u = plain["u"] + plain["u_per_m"] * 0.075 * phi * 0.9
        for j, (dr, dz) in enumerate(rim_profile):
            rim_rows[j].append(bm.verts.new(n0 + out * dr + Z * dz * lift))
            rim_uvs[j].append((u, SWEATER_RIB["v0"] + (SWEATER_RIB["v1"] - SWEATER_RIB["v0"]) * j / (len(rim_profile) - 1)))
        # Drape: march over the sweater from just outside the rim, away from
        # the neck, keeping to the surface (over the shoulder, down the back).
        length = 0.03 + 0.2 * math.cos(min(a / 0.72, 1.0) * math.pi / 2) ** 1.3
        p, n, _ = surf.nearest(n0 + out * 0.034 - Z * 0.008)
        d = out - Z * 0.8
        d = (d - n * d.dot(n)).normalized()
        step = length / (flap_rows - 1)
        travelled = 0.034
        for k in range(flap_rows):
            if k:
                q, n, _ = surf.nearest(p + d * step)
                if (q - p).length > 1e-6:
                    d = q - p
                    d = (d - n * d.dot(n)).normalized()
                p = q
                travelled += step
            v = k / (flap_rows - 1)
            # Thick (the hood's layers bunched up) near the neck, thinning to
            # its edge, with a few soft folds across it.
            t = 0.003 + (0.012 + 0.014 * (1 - a)) * (1 - v ** 2.5)
            t *= 1 + 0.1 * v * math.sin(phi * 5.0)
            flap[k].append(bm.verts.new(p + n * t))
            flap_uvs[k].append((plain["u"] + plain["u_per_m"] * 0.075 * phi * 0.9, plain["v_top"] - plain["v_per_m"] * travelled))
        # The edge rolls under, back towards the neck, so it reads as fabric with a thickness.
        flap[flap_rows].append(bm.verts.new(p - d * 0.005 + n * 0.0012))
        flap_uvs[flap_rows].append(flap_uvs[flap_rows - 1][-1])
    _grid_faces(bm, rim_rows, rim_uvs, uv_layer)
    # The drape starts where the rim ends (its own vertices: the UVs jump from rib to plain fabric).
    first = [bm.verts.new(v.co) for v in rim_rows[-1]]
    _grid_faces(bm, [first] + flap, [flap_uvs[0]] + flap_uvs, uv_layer)

    # Kangaroo pocket: a panel sewn on above the hem rib, standing a few mm
    # off the front, puffed a little in the middle, with open slanted sides
    # (the hand openings) that fold back under. UVs are the sweater's own, so
    # its fabric continues across the pocket.
    hem_z = float(co[hem, 2].mean())
    z0, z1 = hem_z + 0.045, hem_z + 0.21
    half_bottom, half_top = 0.135, 0.085
    front_y = float(co[:, 1].min()) - 0.2
    na, nb = 20, 10
    rows, uvs = [], []
    for b in range(nb + 1):
        tb = b / nb
        z = z0 + (z1 - z0) * tb
        hw = half_bottom + (half_top - half_bottom) * tb
        row, row_uv = [], []
        for ia in range(-1, na + 2):
            edge = ia in (-1, na + 1)
            ta = -1.0 + 2.0 * min(max(ia, 0), na) / na
            x = nc.x + ta * hw - (0.004 * math.copysign(1, ta) if edge else 0.0)
            hit = surf.ray((x, front_y, z), (0, 1, 0))
            if hit is None:
                hit = surf.nearest((x, front_y + 0.2, z))
            p, n, face = hit
            if edge:
                t = 0.0008
            else:
                t = 0.0022 + 0.004 * (1 - ta ** 4) * math.sin(math.pi * tb) ** 0.5
            row.append(bm.verts.new(p + n * t))
            row_uv.append(surf.uv_at(face, p))
        rows.append(row)
        uvs.append(row_uv)
    _grid_faces(bm, rows, uvs, uv_layer)

    # Drawstrings: from eyelets either side of the throat, hanging down the
    # chest (kept just off it), with slightly thicker tips.
    temp = []
    for side, length in ((1, 0.165), (-1, 0.185)):
        phi = side * math.radians(156)
        out = Vector((math.sin(phi), math.cos(phi), 0))
        start = neck_at(phi) + out * 0.012 + Z * 0.004
        pts = [start]
        steps = 10
        for k in range(1, steps + 1):
            q = start + Vector((side * 0.003 * k, 0, -length * k / steps))
            s, n, _ = surf.nearest(q)
            if (q - s).dot(n) < 0.0045:
                q = s + n * 0.0045
            pts.append(q)
        for _ in range(2):  # relax the pushed-out points into a smooth hang
            pts = [pts[0]] + [(pts[k - 1] + pts[k] * 2 + pts[k + 1]) / 4 for k in range(1, len(pts) - 1)] + [pts[-1]]
        tip_dir = (pts[-1] - pts[-2]).normalized()
        radii = [1.0] * len(pts) + [1.35, 1.35]
        pts += [pts[-1] + tip_dir * 0.004, pts[-1] + tip_dir * 0.016]
        cu = bpy.data.curves.new("cord", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.0024
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for pt, q, r in zip(sp.points, pts, radii):
            pt.co = (*q, 1)
            pt.radius = r
        o = _link(bpy.data.objects.new("cord", cu))
        temp.append(bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())))
        bpy.data.objects.remove(o)
        bpy.data.curves.remove(cu)
    for m in temp:
        before = len(bm.faces)
        bm.from_mesh(m)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[before:]:
            f.material_index = 1
            for loop in f.loops:
                loop[uv_layer].uv = (0.5, 0.5)
        bpy.data.meshes.remove(m)
    return _finish(bm, "hoodie_parts")


# ─── Lab coat ───────────────────────────────────────────────────────────────

# Plain fabric on the shirt's texture (male_casualsuit01): the lower body,
# between the button placket and the hem.
SHIRT_PLAIN = dict(u0=0.11, du=0.07, v0=0.09, dv=0.12, per_m=0.47)


class CoatV:
    """The open V at the front of the coat: centred on the shirt's placket,
    from the chest (`bottom_z`) up to the collar."""

    def __init__(self, shirt, bottom_z=1.15, top_z=1.35, top_half=0.068):
        co = np.array([v.co[:] for v in shirt.data.vertices])
        self.x = float(np.median(co[co[:, 1] < np.median(co[:, 1]), 0]))
        self.bottom, self.top = bottom_z, top_z
        self.slope = (top_half - 0.006) / (top_z - bottom_z)

    def half(self, z):
        return 0.006 + (z - self.bottom) * self.slope

    def faces(self, shirt):
        """Front faces of the shirt inside the V (the shirt under the coat)."""
        mid_y = float(np.median([v.co.y for v in shirt.data.vertices]))
        return [p.index for p in shirt.data.polygons
                if p.center.y < mid_y and p.normal.y < -0.2 and self.bottom < p.center.z < self.top
                and abs(p.center.x - self.x) < self.half(p.center.z)]


def build_coat_parts(shirt, coat_v, body_co, body_faces, hem_z, front_gap=0.09, rings=16):
    """Lapels over the V and the coat's skirt, as one new mesh (material slot
    0) positioned on the neutral body, and a loosen(obj) that lets the
    coat's copy of the shirt out at the waist to meet the skirt.

    The skirt hangs from the shirt's hem to `hem_z`, open at the front (its
    panels part a little towards the hem), with a turned-up hem and front
    facings so its edges have a thickness. Its rings hang like cloth over
    the hips and thighs: each one is the convex outline of the body at that
    height plus a clearance, never narrower than the ring above, so the
    trousers never poke through and nothing dips between the legs."""
    tree = BVHTree.FromPolygons(body_co.tolist(), body_faces)
    co = np.array([v.co[:] for v in shirt.data.vertices])
    surf = _Surface(shirt, (float(co[:, 0].mean()), float(np.median(co[:, 1]))))
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    plain = SHIRT_PLAIN

    def fabric_uv(s_u, s_v):
        return (plain["u0"] + plain["du"] * _tri(s_u * plain["per_m"] / plain["du"]),
                plain["v0"] + plain["dv"] * _tri(s_v * plain["per_m"] / plain["dv"]))

    # Lapels: flaps folded back along each side of the V, widest just below
    # the collar, with a notch where they meet it.
    front_y = float(co[:, 1].min()) - 0.2
    along = 14
    across = [-0.004, 0.0, 0.25, 0.5, 0.75, 0.97, 1.0]  # fold, then fractions of the width
    lift = [0.002, 0.010, 0.0085, 0.0075, 0.0065, 0.006, 0.0012]  # a crisp outer edge
    for side in (1, -1):
        rows, uvs = [], []
        for k in range(along + 1):
            t = k / along
            z = coat_v.bottom + (coat_v.top - coat_v.bottom) * t
            width = 0.062 * _smoothstep(0.0, 0.6, t)
            if t > 0.82:
                width *= 1 - 0.45 * (t - 0.82) / 0.18
            row, row_uv = [], []
            for c, h in zip(across, lift):
                d = c if c <= 0 else c * width
                x = coat_v.x + side * (coat_v.half(z) + d)
                hit = surf.ray((x, front_y, z), (0, 1, 0)) or surf.nearest((x, front_y + 0.2, z))
                p, n, face = hit
                row.append(bm.verts.new(p + n * h))
                row_uv.append(surf.uv_at(face, p))
            if side < 0:
                row.reverse()
                row_uv.reverse()
            rows.append(row)
            uvs.append(row_uv)
        _grid_faces(bm, rows, uvs, uv_layer)

    # Skirt.
    loops = [lp for lp in _boundary_loops(shirt.data) if len(lp) > 8 and abs(co[lp, 0].mean()) < 0.05]
    hem_idx = np.array(min(loops, key=lambda lp: co[lp, 2].mean()))
    hem = co[hem_idx]
    centre = hem.mean(0)
    ang = np.arctan2(hem[:, 0] - centre[0], hem[:, 1] - centre[1])  # 0 back, +-pi front
    order = np.argsort(ang)
    ang, hem, hem_idx = ang[order], hem[order], hem_idx[order]
    # Open at the front centre: both ends of the strip start there.
    front = [float(np.interp(math.pi, ang, hem[:, k], period=2 * math.pi)) for k in range(3)]
    top = np.vstack([front, hem, front])
    angles = np.concatenate([[-math.pi], ang, [math.pi]])
    dirs = np.stack([np.sin(angles), np.cos(angles)], 1)
    r0 = np.linalg.norm(top[:, :2] - centre[:2], axis=1)
    rays = [np.array([math.sin(a), math.cos(a)]) for a in np.linspace(-math.pi, math.pi, 96, endpoint=False)]
    needs, heights = [], []
    for k in range(rings + 1):
        t = k / rings
        z = top[:, 2] + (hem_z - top[:, 2]) * t
        # The body's outline at this height (rays from outside to the axis).
        outline = []
        for d in rays:
            origin = Vector((centre[0] + d[0] * 0.6, centre[1] + d[1] * 0.6, float(z.mean())))
            hit = tree.ray_cast(origin, Vector((-d[0], -d[1], 0)), 0.6)[0]
            if hit is not None:
                outline.append((hit.x - centre[0], hit.y - centre[1]))
        outline = np.array(outline) if outline else np.zeros((1, 2))
        support = (dirs @ outline.T).max(1)  # convex outline, measured along each column
        needs.append(support + 0.024 + 0.012 * t)
        heights.append(z)
    # A coat isn't fitted at the waist like the shirt it is built on: it
    # already stands off the waist as far as it must clear the hips below,
    # and loosen() lets the shirt's lower body out to meet it.
    ease = np.maximum(0.0, np.max(needs[:5], axis=0) - r0)
    prev_r = r0 + ease
    grid = []
    for k, (z, need) in enumerate(zip(heights, needs)):
        t = k / rings
        r = np.maximum(np.maximum((r0 + ease) * (1 + 0.04 * t), need), prev_r)
        prev_r = r
        pts = np.column_stack([centre[0] + dirs[:, 0] * r, centre[1] + dirs[:, 1] * r, z])
        # The two front panels part towards the hem.
        near_front = np.clip(1 - (math.pi - np.abs(angles)) / 0.7, 0, 1)
        pts[:, 0] += np.sign(angles) * near_front * front_gap / 2 * t ** 1.3
        grid.append(pts)
    grid = np.array(grid)  # (rings + 1, columns, 3)

    def inward(pts, amount):
        d = pts[:, :2] - centre[:2]
        d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
        out = pts.copy()
        out[:, :2] -= d * amount
        return out

    # Turned-up hem: one row folded inside, a few cm up.
    facing = inward(grid[-1], 0.006)
    facing[:, 2] += 0.03
    grid = np.concatenate([grid, facing[None]], 0)
    # Front facings: a column folded inside each front edge.
    left_face = inward(grid[:, -1] + (grid[:, -2] - grid[:, -1]) * 0.02 / np.maximum(
        np.linalg.norm(grid[:, -2] - grid[:, -1], axis=1, keepdims=True), 1e-9), 0.006)
    right_face = inward(grid[:, 0] + (grid[:, 1] - grid[:, 0]) * 0.02 / np.maximum(
        np.linalg.norm(grid[:, 1] - grid[:, 0], axis=1, keepdims=True), 1e-9), 0.006)
    grid = np.concatenate([right_face[:, None], grid, left_face[:, None]], 1)

    # UVs: arc length around the ring and distance down from the waist.
    seg = np.linalg.norm(np.diff(grid[:, :, :2], axis=1), axis=2)
    s_u = np.concatenate([np.zeros((grid.shape[0], 1)), np.cumsum(seg, axis=1)], 1)
    s_v = np.abs(grid[:, :, 2] - grid[0:1, :, 2])
    s_v[-1] = s_v[-2] - 0.03  # the turned-up hem continues the fabric
    rows = [[bm.verts.new(Vector(p)) for p in row] for row in grid]
    uvs = [[fabric_uv(s_u[r, c], s_v[r, c]) for c in range(grid.shape[1])] for r in range(grid.shape[0])]
    _grid_faces(bm, rows, uvs, uv_layer)

    # Patch pockets on the front panels, at hand height: a piece of the panel
    # lifted off it (open at the top), sewn down along its sides and bottom.
    zs = grid[:rings + 1, 1:-1, 2].mean(1)
    cols_angle = np.concatenate([[angles[0]], angles, [angles[-1]]])
    pocket_rows = [k for k in range(rings + 1) if hem_z + 0.12 < zs[k] < hem_z + 0.30]
    for side in (1, -1):
        cols = [c for c in range(1, grid.shape[1] - 1)
                if side * cols_angle[c] > 0 and 0.5 < math.pi - abs(cols_angle[c]) < 1.15]
        if len(cols) < 3 or len(pocket_rows) < 3:
            continue
        patch, patch_uv = [], []
        for i, k in enumerate(pocket_rows):
            row = []
            for j, c in enumerate(cols):
                sewn = j in (0, len(cols) - 1) or i == len(pocket_rows) - 1
                row.append(bm.verts.new(Vector(inward(grid[k, c][None], -(0.0015 if sewn else 0.0045))[0])))
            patch.append(row)
            patch_uv.append([fabric_uv(s_u[k, c], s_v[k, c]) for c in cols])
        _grid_faces(bm, patch, patch_uv, uv_layer)
    hem_top = float(top[:, 2].max())
    bm.verts.index_update()
    # Shirt vertex each skirt column hangs from (facing and front columns: the nearest end).
    sources = [hem_idx[0], hem_idx[0], *hem_idx, hem_idx[-1], hem_idx[-1]]
    seam_rows = [[v.index for v in rows[r]] for r in range(min(5, rings))]

    def match_variants(parts, obj):
        """The skirt's body-shape morphs come from the body, the shirt's from
        MakeHuman's fitting: near the waist seam, blend the skirt's into the
        shirt hem's (fully at the seam), so the two never part."""
        if not (parts.data.shape_keys and obj.data.shape_keys):
            return
        shirt_keys = obj.data.shape_keys.key_blocks
        basis, shirt_basis = parts.data.shape_keys.key_blocks[0], shirt_keys[0]
        for key in parts.data.shape_keys.key_blocks[1:]:
            if key.name not in shirt_keys:
                continue
            sk = shirt_keys[key.name]
            for r, row in enumerate(seam_rows):
                w = 1.0 - r / len(seam_rows)
                for vi, src in zip(row, sources):
                    own = key.data[vi].co - basis.data[vi].co
                    follow = sk.data[int(src)].co - shirt_basis.data[int(src)].co
                    key.data[vi].co = basis.data[vi].co + follow * w + own * (1 - w)

    def loosen(obj, from_z=1.12):
        """Lets the coat's copy of the shirt out below `from_z`, reaching the
        skirt's ease at the hem (every shape key moves alike)."""
        keys = obj.data.shape_keys.key_blocks if obj.data.shape_keys else []
        for v in obj.data.vertices:
            p = v.co
            if p.z >= from_z or abs(p.x - centre[0]) > 0.24:
                continue
            phi = math.atan2(p.x - centre[0], p.y - centre[1])
            e = float(np.interp(phi, angles, ease)) * _smoothstep(from_z, hem_top, p.z)
            off = Vector((math.sin(phi) * e, math.cos(phi) * e, 0))
            for kb in keys:
                kb.data[v.index].co += off
            v.co += off
        obj.data.update()

    return _finish(bm, "coat_parts"), loosen, match_variants


# ─── Joining ────────────────────────────────────────────────────────────────


def join_into(target, part):
    """Joins `part` into `target` (shape keys and vertex groups merge by name)."""
    with bpy.context.temp_override(active_object=target, selected_editable_objects=[target, part], selected_objects=[target, part]):
        bpy.ops.object.join()
    return target
