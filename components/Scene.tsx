"use client"
import { useEffect, useRef } from "react"
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import {
  AbstractMesh,
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  KeyboardEventTypes,
  PointerEventTypes,
  Scene as BabylonScene,
  Vector3,
  WebXRDefaultExperience
} from "@babylonjs/core"
import { supabase } from "@/lib/supabase";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import SupabaseUtils from "@/lib/supabaseUtils";
import MenuUtils from "@/lib/menuUtils";

interface SceneProps {
  modelName: string;
  modelScaling: number;
  modelRotation: { x: number; y: number; z: number };
}

export default function Scene({ modelName, modelScaling, modelRotation }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<BabylonScene | null>(null);
  const xrExperienceRef = useRef<WebXRDefaultExperience | null>(null);

  // Track all loaded target meshes (all mesh0 instances from different models)
  const targetMeshesRef = useRef<AbstractMesh[]>([]);
  // Current visible mesh index
  const currentMeshIndexRef = useRef<number>(0);

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
    const floorMaterial = new BABYLON.StandardMaterial("floorMaterial", scene);
    floorMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    floorMaterial.alpha = 0.2;
    floor.material = floorMaterial;

    const menuHolder = BABYLON.MeshBuilder.CreatePlane("menuHolder", { width: 1, height: 1 }, scene);
    menuHolder.position = new BABYLON.Vector3(0, 1, 2)
    menuHolder.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

    const menuUI = GUI.AdvancedDynamicTexture.CreateForMesh(menuHolder, 2048, 2048);

    menuUI.parseFromSnippetAsync("#GYLJ95#5").then(() => {
      console.log("GUI snippet loaded successfully");
      const componentName = "cycleButton"
      const cycleButton = MenuUtils.findControlByName(menuUI, componentName);

      if (cycleButton) {
        cycleButton.onPointerUpObservable.add(() => {
          cycleMeshVisibility();
        })
      } else {
        console.error("No component with name" + componentName);
      }
    }).catch(error => {
      console.error("Failed to load GUI snippet:", error);
    });

    // Setup WebXR
    scene.createDefaultXRExperienceAsync({
      floorMeshes: [floor],
      uiOptions: {
        sessionMode: "immersive-ar",
      },
      optionalFeatures: true,
    }).then((xr) => {
      xrExperienceRef.current = xr;
      console.log("XR experience created successfully");

      // setupControllerObservables(xr);

      setupManualTriggerHandling(scene);

      xr.baseExperience.onStateChangedObservable.add((state) => {
        if (state === BABYLON.WebXRState.IN_XR) {
          console.log("Entered XR, disabling debug triggers");
          disableDebugTriggers(scene);
        } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
          console.log("Exited XR, re-enabling debug triggers");
          enableDebugTriggers(scene);
        }
      });
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

  // Function to cycle through visible meshes
  const cycleMeshVisibility = () => {
    if (targetMeshesRef.current.length === 0) {
      console.log("No meshes available to cycle through");
      return;
    }
    // Hid  current mesh
    if (targetMeshesRef.current[currentMeshIndexRef.current]) {
      targetMeshesRef.current[currentMeshIndexRef.current].setEnabled(false);
    }
    // Move to next mesh
    currentMeshIndexRef.current = (currentMeshIndexRef.current + 1) % targetMeshesRef.current.length;
    // Show new current mesh
    if (targetMeshesRef.current[currentMeshIndexRef.current]) {
      targetMeshesRef.current[currentMeshIndexRef.current].setEnabled(true);
      console.log(`Switched to mesh index ${currentMeshIndexRef.current}: ${targetMeshesRef.current[currentMeshIndexRef.current].name}`);
    }
  };

  const observersRef = {
    keyboard: null as BABYLON.Observer<BABYLON.KeyboardInfo> | null,
    pointer: null as BABYLON.Observer<BABYLON.PointerInfo> | null
  };

  // Setup manual trigger handling for testing without XR controllers
  const setupManualTriggerHandling = (scene: BabylonScene) => {
    // Add keyboard event for testing (press 'T' to simulate trigger)
    observersRef.keyboard = scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
        if (kbInfo.event.key === 't' || kbInfo.event.key === 'T') {
          console.log("Manual trigger activated via keyboard");
          cycleMeshVisibility();
        }
      }
    });

    // Also respond to pointer down events (clicks)
    observersRef.pointer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        console.log("Screen tap/click detected");
        cycleMeshVisibility();
      }
    });
  };

  // Function to disable debug triggers when in XR
  const disableDebugTriggers = (scene: BabylonScene) => {
    console.log("Disabling debug keyboard and screen triggers for XR");
    if (observersRef.keyboard !== null) {
      scene.onKeyboardObservable.remove(observersRef.keyboard);
    }
    if (observersRef.pointer !== null) {
      scene.onPointerObservable.remove(observersRef.pointer);
    }
  };

  // Function to re-enable debug triggers when exiting XR
  const enableDebugTriggers = (scene: BabylonScene) => {
    console.log("Re-enabling debug keyboard and screen triggers");
    setupManualTriggerHandling(scene);
  };

  // const setupControllerObservables = (xr: WebXRDefaultExperience) => {
  //   xr.input.onControllerAddedObservable.add((inputSource) => {
  //     inputSource.onMotionControllerInitObservable.add((motionController) => {
  //       const triggerComponent = motionController.getComponent("xr-standard-trigger");
  //       if (triggerComponent) {
  //         let wasPressed = false;
  //         triggerComponent.onButtonStateChangedObservable.add((component) => {
  //           if (component.pressed && !wasPressed) {
  //             console.log("Controller trigger press detected");
  //             cycleMeshVisibility();
  //           }
  //           wasPressed = component.pressed;
  //         });
  //       }
  //     });
  //   });
  //   xr.input.onControllerRemovedObservable.add((controller) => {
  //     console.log("Controller disconnected:", controller.uniqueId);
  //   });
  // };

  useEffect(() => {
    const loadModels = async () => {
      if (!sceneRef.current) return;

      try {
        // Clear existing target meshes
        targetMeshesRef.current.forEach(mesh => {
          if (mesh) {
            mesh.dispose();
          }
        });
        targetMeshesRef.current = [];
        currentMeshIndexRef.current = 0;

        console.log("Loading models for folder:", modelName);

        const folderPath = `public/${modelName}`;
        const files = await SupabaseUtils.listFiles("models", folderPath, {
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (!files.data || files.data.length === 0) {
          console.error("No files found in folder:", folderPath);
          return;
        }

        console.log(`Found ${files.data.length} files to load`);

        for (const file of files.data) {
          const modelPath = `${folderPath}/${file.name}`;
          const { data } = supabase.storage.from("models").getPublicUrl(modelPath);
          const container = await BABYLON.LoadAssetContainerAsync(data.publicUrl, sceneRef.current);
          const mesh0 = container.meshes.find(mesh => mesh.name === "mesh0");

          if (mesh0) {
            console.log("Found mesh0 in the model!");
            container.addAllToScene();

            mesh0.scaling = new Vector3(modelScaling, modelScaling, modelScaling);
            mesh0.rotation = new Vector3(
              BABYLON.Tools.ToRadians(modelRotation.x),
              BABYLON.Tools.ToRadians(modelRotation.y),
              BABYLON.Tools.ToRadians(modelRotation.z)
            );

            targetMeshesRef.current.push(mesh0);
            mesh0.setEnabled(currentMeshIndexRef.current === targetMeshesRef.current.length - 1);

            console.log(`Successfully loaded model: ${file.name}`);
          } else {
            // IS ONLY THE CASE IF NOT LOADING PARAVIEW MODELS
            console.log(`No mesh0 found in model: ${file.name}, looking for other meshes`);
            const firstMesh = container.meshes.find(mesh =>
              mesh.name !== "root" && mesh.name !== "__root__");

            if (firstMesh) {
              console.log(`Using ${firstMesh.name} as target mesh instead`);
              container.addAllToScene();
              firstMesh.scaling = new Vector3(modelScaling, modelScaling, modelScaling);
              firstMesh.rotation = new Vector3(
                BABYLON.Tools.ToRadians(modelRotation.x),
                BABYLON.Tools.ToRadians(modelRotation.y),
                BABYLON.Tools.ToRadians(modelRotation.z)
              );
              targetMeshesRef.current.push(firstMesh);
              firstMesh.setEnabled(currentMeshIndexRef.current === targetMeshesRef.current.length - 1);
            } else {
              console.log("No suitable mesh found in this model");
            }
          }
        }

        if (targetMeshesRef.current.length > 0) {
          targetMeshesRef.current.forEach(mesh => mesh.setEnabled(false));
          targetMeshesRef.current[currentMeshIndexRef.current].setEnabled(true);
          console.log(`Showing mesh ${currentMeshIndexRef.current}: ${targetMeshesRef.current[currentMeshIndexRef.current].name}`);
        }

        console.log("Total meshes loaded:", targetMeshesRef.current.length);
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };

    if (sceneRef.current) {
      loadModels();
    }
  }, [modelName, modelScaling, modelRotation]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
