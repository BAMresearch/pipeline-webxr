import "./style.css";

import { Engine } from "@babylonjs/core/Engines/engine.js";
import {createScene} from "./mainScene.ts";

// Required for EnvironmentHelper
import "@babylonjs/core/Materials/Textures/Loaders";

// Enable GLTF/GLB loader for loading controller models from WebXR Input registry
import "@babylonjs/loaders/glTF";

// Without this next import, an error message like this occurs loading controller models:
//  Build of NodeMaterial failed" error when loading controller model
//  Uncaught (in promise) Build of NodeMaterial failed: input rgba from block
//  FragmentOutput[FragmentOutputBlock] is not connected and is not optional.
import "@babylonjs/core/Materials/Node/Blocks";

// Create a canvas element for rendering
const app = document.querySelector<HTMLDivElement>("#app");
const canvas = document.createElement("canvas");

app?.appendChild(canvas);

const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

window.addEventListener("resize", resizeCanvas);

resizeCanvas();

// Create engine and a scene
const babylonEngine = new Engine(canvas, true);

const scene = await createScene(canvas, babylonEngine);