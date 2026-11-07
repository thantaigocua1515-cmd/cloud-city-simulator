import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type {
  Building,
  BuildingKind,
  Cell,
  City,
  Rotation,
} from "../simulation/city";
import { CATALOG, footprint } from "../simulation/city";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Collisions/pickingInfo";

export class IslandScene {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private models = new Map<number, Mesh>();
  private preview: Mesh;
  private materials = new Map<string, StandardMaterial>();
  private pointers = new Map<number, { x: number; y: number }>();
  private start = { x: 0, y: 0 };
  private dragged = false;
  private zoomSize = 11.6;
  private resizeObserver: ResizeObserver;
  constructor(
    private canvas: HTMLCanvasElement,
    private onCell: (cell: Cell | null, commit: boolean) => void,
  ) {
    this.engine = new Engine(canvas, true, {
      stencil: true,
      preserveDrawingBuffer: false,
    });
    this.engine.setHardwareScalingLevel(
      Math.max(1, window.devicePixelRatio / 1.6),
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);
    this.camera = new ArcRotateCamera(
      "isometric",
      -Math.PI / 4,
      Math.atan(Math.sqrt(2)),
      28,
      new Vector3(0, 0, 0),
      this.scene,
    );
    this.camera.mode = 1; // orthographic projection
    new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene).intensity =
      0.7;
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, 1), this.scene);
    sun.intensity = 0.55;
    const slab = MeshBuilder.CreateBox(
      "earth",
      { width: 12.4, depth: 12.4, height: 1.25 },
      this.scene,
    );
    slab.position.y = -0.72;
    slab.material = this.material("#b5b79a");
    slab.isPickable = false;
    const rock = MeshBuilder.CreateCylinder(
      "floating-rock",
      { diameterTop: 15.5, diameterBottom: 3, height: 3.3, tessellation: 5 },
      this.scene,
    );
    rock.position.y = -2.7;
    rock.rotation.y = Math.PI / 4;
    rock.material = this.material("#a5ad9a");
    rock.isPickable = false;
    for (let x = 0; x < 12; x++)
      for (let z = 0; z < 12; z++) {
        const tile = MeshBuilder.CreateBox(
          `tile-${x}-${z}`,
          { width: 0.975, depth: 0.975, height: 0.12 },
          this.scene,
        );
        tile.position.set(x - 5.5, 0, z - 5.5);
        tile.material = this.material((x + z) % 2 ? "#acbf91" : "#b2c598");
        tile.metadata = { x, z };
      }
    // Decorative drifting clouds and edge trees are non-interactive placeholder geometry.
    for (let i = 0; i < 8; i++) {
      const cloud = MeshBuilder.CreateSphere(
        `cloud-${i}`,
        { diameter: 1, segments: 8 },
        this.scene,
      );
      cloud.position.set(
        Math.sin(i * 2.4) * 11,
        -2 - (i % 3),
        Math.cos(i * 2.4) * 10,
      );
      cloud.scaling.set(2.8, 0.7, 1.5);
      cloud.material = this.material("#f8faf4");
      cloud.isPickable = false;
    }
    for (const [x, z] of [
      [-5.5, -5.5],
      [-4.5, -5.5],
      [5.5, 5.5],
      [5.5, 4.5],
      [-5.5, 4.5],
    ])
      this.tree(x, z);
    this.preview = MeshBuilder.CreateBox(
      "preview",
      { width: 0.96, depth: 0.96, height: 0.15 },
      this.scene,
    );
    this.preview.isPickable = false;
    this.preview.setEnabled(false);
    this.canvas.addEventListener("pointerdown", this.down);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("pointercancel", this.cancel);
    this.canvas.addEventListener("pointerleave", this.leave);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize();
      this.projection();
    });
    this.resizeObserver.observe(canvas);
    this.projection();
    this.engine.runRenderLoop(() => this.scene.render());
  }
  private material(hex: string, alpha = 1) {
    const key = hex + alpha;
    if (!this.materials.has(key)) {
      const m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = Color3.Black();
      m.alpha = alpha;
      this.materials.set(key, m);
    }
    return this.materials.get(key)!;
  }
  private box(
    parent: Mesh,
    name: string,
    w: number,
    h: number,
    d: number,
    y: number,
    color: string,
    x = 0,
    z = 0,
  ) {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.material = this.material(color);
    mesh.isPickable = false;
    return mesh;
  }
  private tree(x: number, z: number, parent?: Mesh) {
    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { diameter: 0.09, height: 0.5, tessellation: 6 },
      this.scene,
    );
    trunk.parent = parent ?? null;
    trunk.position.set(x, 0.3, z);
    trunk.material = this.material("#9c8267");
    trunk.isPickable = false;
    const crown = MeshBuilder.CreateSphere(
      "leaves",
      { diameter: 0.65, segments: 4 },
      this.scene,
    );
    crown.parent = parent ?? null;
    crown.position.set(x, 0.82, z);
    crown.scaling.y = 1.4;
    crown.material = this.material("#6e986e");
    crown.isPickable = false;
  }
  private model(b: Building) {
    const root = new Mesh(`building-${b.id}`, this.scene);
    const [w, d] = footprint(b.kind, b.rotation);
    root.position.set(b.x - 5.5 + (w - 1) / 2, 0.1, b.z - 5.5 + (d - 1) / 2);
    root.rotation.y = (b.rotation * Math.PI) / 2;
    const [bw, bd] = CATALOG[b.kind].size;
    if (b.kind === "path")
      this.box(root, "paving", 0.98, 0.03, 0.98, 0, "#d5cfb9");
    else if (b.kind === "garden") {
      this.box(root, "garden", 0.88, 0.1, 0.88, 0, "#7fa575");
      this.tree(0, 0, root);
      this.box(root, "bench", 0.38, 0.12, 0.16, 0.12, "#d7b58b", 0.22, -0.28);
    } else if (b.kind === "turbine") {
      const pole = MeshBuilder.CreateCylinder(
        "mast",
        {
          diameterTop: 0.07,
          diameterBottom: 0.15,
          height: 1.9,
          tessellation: 8,
        },
        this.scene,
      );
      pole.parent = root;
      pole.position.y = 0.95;
      pole.material = this.material("#eee9d9");
      pole.isPickable = false;
      for (let i = 0; i < 3; i++) {
        const blade = this.box(
          root,
          "blade",
          0.09,
          0.78,
          0.05,
          2,
          "#fff9e6",
          0,
          -0.12,
        );
        blade.rotation.z = (i * Math.PI * 2) / 3;
        blade.position.x = Math.sin(-blade.rotation.z) * 0.3;
        blade.position.y += Math.cos(blade.rotation.z) * 0.3;
      }
    } else {
      const h = b.kind === "tower" ? 1.85 : b.kind === "market" ? 0.66 : 0.82;
      this.box(
        root,
        "walls",
        bw * 0.8,
        h,
        bd * 0.8,
        h / 2,
        CATALOG[b.kind].color,
      );
      this.box(
        root,
        "roof",
        bw * 0.91,
        0.15,
        bd * 0.91,
        h + 0.07,
        b.kind === "market" ? "#a7725d" : "#6c8e83",
      );
      if (b.kind === "cottage") {
        const roof = MeshBuilder.CreateCylinder(
          "gable",
          { diameter: 1.17, height: 0.92, tessellation: 3 },
          this.scene,
        );
        roof.parent = root;
        roof.rotation.x = Math.PI / 2;
        roof.rotation.y = Math.PI / 2;
        roof.position.y = h + 0.16;
        roof.material = this.material("#b9775f");
        roof.isPickable = false;
      }
      for (let floor = 0; floor < (b.kind === "tower" ? 4 : 1); floor++)
        for (const side of [-1, 1]) {
          this.box(
            root,
            "window",
            0.19,
            0.22,
            0.025,
            0.38 + floor * 0.39,
            "#eaf0d9",
            side * bw * 0.22,
            -bd * 0.401,
          );
          this.box(
            root,
            "window-side",
            0.025,
            0.22,
            0.19,
            0.38 + floor * 0.39,
            "#eaf0d9",
            bw * 0.401,
            side * bd * 0.22,
          );
        }
      this.box(
        root,
        "door",
        0.17,
        0.31,
        0.03,
        0.155,
        "#627e76",
        0,
        -bd * 0.405,
      );
    }
    return root;
  }
  update(city: City) {
    for (const [id, mesh] of this.models)
      if (!city.buildings.some((b) => b.id === id)) {
        mesh.dispose();
        this.models.delete(id);
      }
    for (const b of city.buildings)
      if (!this.models.has(b.id)) this.models.set(b.id, this.model(b));
  }
  showPreview(
    cell: Cell | null,
    kind: BuildingKind,
    rotation: Rotation,
    valid: boolean,
  ) {
    this.preview.setEnabled(!!cell);
    if (!cell) return;
    const [w, d] = footprint(kind, rotation);
    this.preview.scaling.set(w, 1, d);
    this.preview.position.set(
      cell.x - 5.5 + (w - 1) / 2,
      0.16,
      cell.z - 5.5 + (d - 1) / 2,
    );
    this.preview.material = this.material(valid ? "#e9f8ae" : "#e47965", 0.7);
  }
  private pick(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.scene.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      (m) => m.name.startsWith("tile-"),
    );
    return (hit?.pickedMesh?.metadata as Cell | null) ?? null;
  }
  private down = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.start = { x: e.clientX, y: e.clientY };
      this.dragged = false;
    } else {
      this.dragged = true;
      this.onCell(null, false);
    }
  };
  private move = (e: PointerEvent) => {
    const old = this.pointers.get(e.pointerId);
    if (!old) {
      this.onCell(this.pick(e), false);
      return;
    }
    const dx = e.clientX - old.x,
      dy = e.clientY - old.y;
    if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 6)
      this.dragged = true;
    if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(
        ([id]) => id !== e.pointerId,
      )![1];
      const before = Math.hypot(old.x - other.x, old.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (after > 0) this.zoom(before / after);
    } else if (this.dragged) {
      const factor = (this.zoomSize * 2) / this.canvas.clientHeight;
      const a = this.camera.alpha;
      this.camera.target.x += (-dx * Math.sin(a) - dy * Math.cos(a)) * factor;
      this.camera.target.z += (dx * Math.cos(a) - dy * Math.sin(a)) * factor;
      this.camera.target.x = Math.max(-8, Math.min(8, this.camera.target.x));
      this.camera.target.z = Math.max(-8, Math.min(8, this.camera.target.z));
      this.onCell(null, false);
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  private up = (e: PointerEvent) => {
    if (!this.dragged && this.pointers.size === 1)
      this.onCell(this.pick(e), true);
    this.pointers.delete(e.pointerId);
  };
  private cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.dragged = true;
    this.onCell(null, false);
  };
  private leave = () => {
    if (!this.pointers.size) this.onCell(null, false);
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom(Math.exp(e.deltaY * 0.001));
  };
  zoom(factor: number) {
    this.zoomSize = Math.min(20, Math.max(5, this.zoomSize * factor));
    this.projection();
  }
  orbit(direction: number) {
    this.camera.alpha += (direction * Math.PI) / 2;
  }
  home() {
    this.camera.target.set(0, 0, 0);
    this.camera.alpha = -Math.PI / 4;
    this.zoomSize = 11.6;
    this.projection();
  }
  private projection() {
    const aspect =
      this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const size = this.zoomSize / Math.min(1, aspect);
    this.camera.orthoTop = size;
    this.camera.orthoBottom = -size;
    this.camera.orthoLeft = -size * aspect;
    this.camera.orthoRight = size * aspect;
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.scene.dispose();
    this.engine.dispose();
  }
}
