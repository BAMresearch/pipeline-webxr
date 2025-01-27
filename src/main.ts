import "./style.css";

import XRApp from "./mainScene.ts";

// Required for EnvironmentHelper
import "@babylonjs/core/Materials/Textures/Loaders";

// Enable GLTF/GLB loader for loading controller models from WebXR Input registry
import "@babylonjs/loaders/glTF";

// Without this next import, an error message like this occurs loading controller models:
//  Build of NodeMaterial failed" error when loading controller model
//  Uncaught (in promise) Build of NodeMaterial failed: input rgba from block
//  FragmentOutput[FragmentOutputBlock] is not connected and is not optional.
import "@babylonjs/core/Materials/Node/Blocks";
import MeshTransformers from "./meshTransformers.ts";
import * as BABYLON from "@babylonjs/core";

// Create a canvas element for rendering
const app = document.querySelector<HTMLDivElement>("#app");
console.log("app", app)
const canvas = document.createElement("canvas");
console.log("canvas created", canvas)

app?.appendChild(canvas);

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

resizeCanvas();

// const babylonEngine = new Engine(canvas, true);

const xrApp = new XRApp(canvas)
// const noXRApp = new NoXRApp(canvas, babylonEngine)

xrApp.create().then((scene) => {
  console.log("XR Scene is ready:", scene);
});

const meshTransformers = new MeshTransformers();

// Handle window resize
window.addEventListener("resize", () => xrApp.resize());
const loadedMeshes = await xrApp.loadGLTFModel("trussarc.gltf")
const trussarc = await xrApp.findMeshByName(loadedMeshes, "mesh0")

if (!trussarc) {
  throw new Error("Trussarc mesh not found");
}

meshTransformers.centerPivot(trussarc)
trussarc.position.y = 1;
trussarc.position.z = 2;

const testMaterial = new BABYLON.StandardMaterial("testMaterial", xrApp.scene!);

trussarc.material = testMaterial;

