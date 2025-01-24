import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders"

class XRApp {
  private engine: BABYLON.Engine;
  private canvas: HTMLCanvasElement;
  private scene: BABYLON.Scene | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true);
  }

  async create(): Promise<BABYLON.Scene> {
    this.scene = new BABYLON.Scene(this.engine);

    const camera = new BABYLON.FreeCamera(
      "camera1",
      new BABYLON.Vector3(0, 1, 1),
      this.scene
    );

    camera.setTarget(BABYLON.Vector3.Zero());

    camera.attachControl(this.canvas, true);

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 5, 0),
      this.scene
    );

    light.intensity = 0.7;

    // const sphere = BABYLON.MeshBuilder.CreateSphere(
    //   "sphere",
    //   { diameter: 2, segments: 32 },
    //   this.scene
    // );
    // sphere.position.y = 1;
    // sphere.position.z = 5;

    console.log("before createDefaultXRExperienceAsync")

    await this.scene.createDefaultXRExperienceAsync({
      uiOptions: {
        sessionMode: "immersive-ar",
      },
      optionalFeatures: true,
    });

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });

    console.log("Scene created", this.scene);
    return this.scene;
  }

  resize(): void {
    this.engine.resize();
  }

  async loadGLTFModel(sceneFileName: string): Promise<BABYLON.AbstractMesh[]> {
    if (!this.scene) {
      throw new Error("Scene is not initialized. Ensure that the `create` method has been called before loading models.");
    }

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        "", // Leave empty to load all meshes
        "./assets/", // Folder path
        sceneFileName, // File name
        this.scene // The scene to load into
      );

      // Access the loaded meshes
      const loadedMeshes = result.meshes;

      console.log("Loaded Meshes:", loadedMeshes);

      return loadedMeshes;
    } catch (error) {
      console.error("Error loading GLTF model:", error);
      throw error;
    }
  }
}

export default XRApp;

