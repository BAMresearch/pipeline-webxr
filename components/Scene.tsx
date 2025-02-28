"use client"
import { useEffect, useRef, useState } from "react"
import * as BABYLON from "@babylonjs/core"
import {
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  Scene as BabylonScene,
  Vector3,
  WebXRDefaultExperience
} from "@babylonjs/core"
import { supabase } from "@/lib/supabase";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import SupabaseUtils from "@/lib/supabaseUtils";
import MeshUtils from "@/lib/meshUtils";

interface SceneProps {
  modelName: string
  modelScaling: number
}

export default function Scene({ modelName, modelScaling }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<BabylonScene | null>(null);
  const xrExperienceRef = useRef<WebXRDefaultExperience | null>(null);
  const loadedModelRef = useRef<BABYLON.AbstractMesh[]>([]);

  // Initialize engine and scene only once
  useEffect(() => {
    registerBuiltInLoaders();

    if (!canvasRef.current) return;

    // Create engine and scene
    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;

    const scene = new BabylonScene(engine);
    sceneRef.current = scene;

    // Setup camera
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      3,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvasRef.current, true);

    // Create light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Create floor
    const floor = BABYLON.MeshBuilder.CreateGround("floor", { width: 6, height: 6 }, scene);

    // Setup WebXR
    scene.createDefaultXRExperienceAsync({
      floorMeshes: [floor],
      uiOptions: {
        sessionMode: "immersive-ar",
      },
      optionalFeatures: true,
    }).then((xr) => {
      xrExperienceRef.current = xr;
      addControllerObservable(xr);
    }).catch((error) => {
      console.error("Error creating XR experience:", error);
    });

    // Start render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const resizeHandler = () => {
      engine.resize();
    };
    window.addEventListener("resize", resizeHandler);

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeHandler);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // Handle controller interactions
  const addControllerObservable = (xr: WebXRDefaultExperience) => {
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
  };

  // Load and update model separately when props change
  useEffect(() => {
    const loadModel = async () => {
      if (!sceneRef.current) return;

      try {
        // Clean up previously loaded model
        loadedModelRef.current.forEach(mesh => {
          if (mesh && mesh.name !== "floor") {
            mesh.dispose();
          }
        });
        loadedModelRef.current = [];

        const folderPath = `public/${modelName}`;
        const files = await SupabaseUtils.listFiles("models", folderPath, {
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (!files.data || files.data.length !== 1) {
          console.error("Expected exactly one model file, found:", files.data?.length);
          return;
        }

        const firstFileName = files.data[0].name;
        const modelPath = `${folderPath}/${firstFileName}`;
        const { data } = supabase.storage.from("models").getPublicUrl(modelPath);

        const result = await BABYLON.SceneLoader.ImportMeshAsync("", data.publicUrl, "", sceneRef.current);

        // Store loaded meshes for future cleanup
        loadedModelRef.current = result.meshes;

        // Apply scaling to the model (not the floor)
        result.meshes.forEach(mesh => {
          if (mesh.name !== "floor") {
            mesh.scaling = new Vector3(modelScaling, modelScaling, modelScaling);
          }
        });

        const myMaterial = new BABYLON.StandardMaterial("myMaterial", sceneRef.current);

        myMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.2, 1);

        const mesh0 = MeshUtils.findMeshByName(sceneRef.current, "mesh0")

        if (mesh0)
          mesh0.material = myMaterial

      } catch (error) {
        console.error("Error loading model:", error);
      }
    };

    if (sceneRef.current) {
      loadModel();
    }
  }, [modelName, modelScaling]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
