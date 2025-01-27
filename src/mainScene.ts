import * as BABYLON from "@babylonjs/core";
import {Scene} from "@babylonjs/core";
import "@babylonjs/loaders";

class XRApp {
    private engine: BABYLON.Engine;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = new BABYLON.Engine(canvas, true);
    }

    private _scene: BABYLON.Scene | null = null;

    get scene(): Scene | null {
        return this._scene;
    }

    async create(): Promise<BABYLON.Scene> {
        this._scene = new BABYLON.Scene(this.engine);

        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, 1), this._scene);

        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(this.canvas, true);

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 5, 0), this._scene);
        light.intensity = 0.7;

        const floor = BABYLON.MeshBuilder.CreateGround("floor", {width: 6, height: 6}, this._scene);

        console.log("before createDefaultXRExperienceAsync");

        const xr = await this._scene.createDefaultXRExperienceAsync({
            floorMeshes: [floor], uiOptions: {
                sessionMode: "immersive-ar",
            }, optionalFeatures: true,
        });

        xr.input.onControllerAddedObservable.add((inputSource) => {
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.value > 0.9) {
                            console.log("Trigger pressed");
                        }
                    });
                }
            });
        });

        this.engine.runRenderLoop(() => {
            if (this._scene) {
                this._scene.render();
            }
        });

        console.log("Scene created", this._scene);
        return this._scene;
    }

    resize(): void {
        this.engine.resize();
    }

    async loadGLTFModel(sceneFileName: string): Promise<BABYLON.AbstractMesh[]> {
        if (!this._scene) {
            throw new Error("Scene is not initialized. Ensure that the `create` method has been called before loading models.");
        }

        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", // Leave empty to load all meshes
                "./assets/", // Folder path
                sceneFileName, // File name
                this._scene // The scene to load into
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

    async findMeshByName(loadedGLTFScene: BABYLON.AbstractMesh[], meshName: string): Promise<BABYLON.AbstractMesh | null> {
        const foundMesh = loadedGLTFScene.find((mesh) => mesh.name === meshName);
        if (!foundMesh) {
            console.error("Mesh not found:", meshName);
            return null;
        }
        return foundMesh;
    }
}

export default XRApp;
