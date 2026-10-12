"""
Procedural garments built from MakeHuman ones, for customizer options the
free assets don't cover (build_avatar.py):

- hoodie: the sweater plus a hood bunched behind the neck, a kangaroo pocket
  and drawstrings;
- lab-coat: the button-down shirt extended into a coat tail to mid-thigh.

New parts take their bone weights from the body (nearest surface) and their
body-shape morphs from a Surface Deform bound to the body, so they follow
every body variant like the MakeHuman garments do.

Blender axes: +Z up, -Y is the front, +X the avatar's left.
"""

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector


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


# ─── Skinning and morphs for new geometry ───────────────────────────────────


def skin_from_body(obj, body, rig, bones):
    """Gives each new vertex the bone weights of the nearest body vertex that
    is mostly driven by one of `bones` (e.g. torso and thighs for a coat
    tail: never the hands, which hang right beside it in the bind pose),
    then rigs the object to the armature."""
    from mathutils import kdtree

    index_of = {g.index: g.name for g in body.vertex_groups}
    bone_names = set(rig.data.bones.keys())
    co = [v.co for v in body.data.vertices]
    weights = []
    for v in body.data.vertices:
        w = {index_of[g.group]: g.weight for g in v.groups if index_of[g.group] in bone_names and g.weight > 0}
        weights.append(w)
    candidates = [i for i, w in enumerate(weights) if w and max(w, key=w.get) in bones]
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


# ─── Hoodie ─────────────────────────────────────────────────────────────────


def build_hoodie_parts(sweater, waist_z):
    """Hood (bunched behind the neck), kangaroo pocket and drawstrings, as one
    new mesh in the sweater's material, positioned on the neutral body."""
    co = np.array([v.co[:] for v in sweater.data.vertices])
    neck_top = co[:, 2].max()
    neck_ring = co[co[:, 2] > neck_top - 0.02]
    nc = Vector((float(neck_ring[:, 0].mean()), float(neck_ring[:, 1].mean()), float(neck_top)))
    nr = float(np.abs(neck_ring[:, 0] - nc.x).max())

    bm = bmesh.new()
    # Hood: a fat, open torus arc around the back of the neck, tipped back.
    R, r, arc, seg, ring = nr + 0.035, 0.034, math.radians(230), 40, 14
    rows = []
    for i in range(seg + 1):
        a = math.pi / 2 - arc / 2 + arc * i / seg  # centred on +Y (the back)
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            rr = r * (0.75 + 0.25 * math.sin(math.pi * i / seg))  # thicker at the back
            p = Vector(((R + rr * math.cos(b)) * math.cos(a), (R + rr * math.cos(b)) * math.sin(a), rr * math.sin(b) * 1.3))
            row.append(p)
        rows.append(row)
    tilt = Matrix.Rotation(-0.35, 3, "X")
    verts = [[bm.verts.new(tilt @ p + nc + Vector((0, 0.012, -0.03))) for p in row] for row in rows]
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((verts[i][j], verts[i][(j + 1) % ring], verts[i + 1][(j + 1) % ring], verts[i + 1][j]))

    # Kangaroo pocket: the sweater's front faces between the waist and the
    # chest, copied and pushed out 4 mm.
    front = co[:, 1] < float(np.median(co[:, 1])) - 0.02
    z_lo, z_hi = waist_z + 0.03, waist_z + 0.17
    sel = {i for i in range(len(co)) if front[i] and z_lo < co[i, 2] < z_hi and abs(co[i, 0]) < 0.12}
    src = bmesh.new()
    src.from_mesh(sweater.data)
    src.verts.ensure_lookup_table()
    src.normal_update()
    vmap = {}
    for f in src.faces:
        if all(v.index in sel for v in f.verts):
            new = []
            for v in f.verts:
                if v.index not in vmap:
                    vmap[v.index] = bm.verts.new(v.co + v.normal * 0.004)
                new.append(vmap[v.index])
            bm.faces.new(new)
    src.free()

    # Drawstrings: two thin cords from the front of the neckline.
    me_tmp = []
    for side in (1, -1):
        x = nc.x + side * 0.025
        y = float(neck_ring[:, 1].min()) - 0.004
        pts = [(x, y, neck_top - 0.02), (x + side * 0.004, y - 0.006, neck_top - 0.09), (x + side * 0.006, y - 0.004, neck_top - 0.15)]
        cu = bpy.data.curves.new("cord", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.0022
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for pt, q in zip(sp.points, pts):
            pt.co = (*q, 1)
        o = _link(bpy.data.objects.new("cord", cu))
        me_tmp.append(bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())))
        bpy.data.objects.remove(o)
        bpy.data.curves.remove(cu)
    for m in me_tmp:
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)

    me = bpy.data.meshes.new("hoodie_parts")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return _link(bpy.data.objects.new("hoodie_parts", me))


# ─── Lab coat ───────────────────────────────────────────────────────────────


def build_coat_tail(shirt, body_co, body_faces, hem_z_to=0.56, rings=10, flare=0.06, clearance=0.03):
    """A coat tail hanging from a shirt's bottom hem to mid-thigh, flaring a
    little towards its own hem, as a separate object (it is joined to the
    shirt after it has been skinned and given body morphs). Every ring is
    kept at least `clearance` outside the body (hips and thighs are wider
    than the waist the hem goes round), so trousers never poke through."""
    from mathutils.bvhtree import BVHTree

    tree = BVHTree.FromPolygons(body_co.tolist(), body_faces)
    me = shirt.data
    co = np.array([v.co[:] for v in me.vertices])
    # The hem is the lowest open edge that goes round the body (centred on
    # x = 0); sleeve cuffs hang lower in the bind pose but sit off to the side.
    loops = [lp for lp in _boundary_loops(me) if len(lp) > 8 and abs(co[lp, 0].mean()) < 0.05]
    hem = min(loops, key=lambda lp: co[lp, 2].mean())
    hem_co = co[hem]
    centre = Vector((float(hem_co[:, 0].mean()), float(hem_co[:, 1].mean()), 0))
    z0 = float(hem_co[:, 2].mean())
    bm = bmesh.new()
    prev = None
    for k in range(rings + 1):
        t = k / rings
        z = z0 + (hem_z_to - z0) * t
        s = 1.0 + flare * t
        row = []
        for p0 in hem_co:
            p = Vector(p0)
            p.x = centre.x + (p.x - centre.x) * s
            p.y = centre.y + (p.y - centre.y) * s
            p.z = z + (p0[2] - z0) * (1 - t)  # flatten the hem's waviness
            if k > 0:
                # Push out past the body's outer surface in this direction.
                d = Vector((p.x - centre.x, p.y - centre.y, 0))
                if d.length > 1e-6:
                    d.normalize()
                    axis = Vector((centre.x, centre.y, p.z))
                    hit = tree.ray_cast(axis + d * 0.6, -d, 0.6)[0]
                    if hit is not None:
                        need = (Vector((hit.x, hit.y, 0)) - Vector((centre.x, centre.y, 0))).length + clearance
                        have = (Vector((p.x, p.y, 0)) - Vector((centre.x, centre.y, 0))).length
                        if have < need:
                            p.x, p.y = centre.x + d.x * need, centre.y + d.y * need
            row.append(bm.verts.new(p))
        if prev:
            for i in range(len(row)):
                j = (i + 1) % len(row)
                bm.faces.new((prev[i], prev[j], row[j], row[i]))
        prev = row
    out = bpy.data.meshes.new("coat_tail")
    bm.to_mesh(out)
    bm.free()
    for p in out.polygons:
        p.use_smooth = True
    return _link(bpy.data.objects.new("coat_tail", out))


# ─── UVs and joining ────────────────────────────────────────────────────────


def uv_near(obj, point):
    """The UV at the vertex of `obj` nearest to `point` (a plain-fabric sample)."""
    me = obj.data
    co = np.array([v.co[:] for v in me.vertices])
    vi = int(np.argmin(np.linalg.norm(co - np.array(point), axis=1)))
    uv = me.uv_layers.active.data
    for loop in me.loops:
        if loop.vertex_index == vi:
            return tuple(uv[loop.index].uv)
    return (0.5, 0.5)


def set_constant_uv(me, uv, name="UVMap"):
    layer = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    for d in layer.data:
        d.uv = uv


def join_into(target, part):
    """Joins `part` into `target` (shape keys and vertex groups merge by name)."""
    with bpy.context.temp_override(active_object=target, selected_editable_objects=[target, part], selected_objects=[target, part]):
        bpy.ops.object.join()
    return target
