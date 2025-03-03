"use client"
import {useEffect, useRef} from "react"
import * as BABYLON from "@babylonjs/core"
import {
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    Scene as BabylonScene,
    Vector3,
    WebXRDefaultExperience
} from "@babylonjs/core"
import {supabase} from "@/lib/supabase";
import {registerBuiltInLoaders} from "@babylonjs/loaders/dynamic";
import SupabaseUtils from "@/lib/supabaseUtils";

interface SceneProps {
    modelName: string
    modelScaling: number
}

export default function Scene({modelName, modelScaling}: SceneProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const sceneRef = useRef<BabylonScene | null>(null);
    const xrExperienceRef = useRef<WebXRDefaultExperience | null>(null);
    const loadedModelRef = useRef<BABYLON.AbstractMesh[]>([]);

    /*
      Materials
     */
    const loadedMaterialsRef = useRef<BABYLON.Material[]>([]);
    const currentMaterialIndexRef = useRef<number>(0);
    const targetMeshRef = useRef<BABYLON.AbstractMesh | null>(null);

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
        const floor = BABYLON.MeshBuilder.CreateGround("floor", {width: 6, height: 6}, scene);
        const floorMaterial = new BABYLON.StandardMaterial("floorMaterial", scene);
        floorMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        floorMaterial.alpha = 0.2;
        floor.material = floorMaterial;

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

    // Handle controller interactions for material swapping
    const addControllerObservable = (xr: WebXRDefaultExperience) => {
        xr.input.onControllerAddedObservable.add((inputSource) => {
            inputSource.onMotionControllerInitObservable.add((motionController) => {
                const triggerComponent = motionController.getComponent("xr-standard-trigger");
                if (triggerComponent) {
                    triggerComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.value > 0.9 && targetMeshRef.current && loadedMaterialsRef.current.length > 0) {
                            currentMaterialIndexRef.current = (currentMaterialIndexRef.current + 1) % loadedMaterialsRef.current.length;
                            targetMeshRef.current.material = loadedMaterialsRef.current[currentMaterialIndexRef.current];
                            console.log("Switched material to index:", currentMaterialIndexRef.current);
                        }
                    });
                }
            });
        });
    };

    // Load and update models when props change
    useEffect(() => {
        const loadModels = async () => {
            if (!sceneRef.current) return;

            try {
                // Clean up previously loaded model
                loadedModelRef.current.forEach(mesh => {
                    if (mesh && mesh.name !== "floor") {
                        mesh.dispose();
                    }
                });
                loadedModelRef.current = [];

                // Clear materials collection
                loadedMaterialsRef.current = [];
                currentMaterialIndexRef.current = 0;
                targetMeshRef.current = null;
                let loadedFirstMesh = false;

                const folderPath = `public/${modelName}`;
                const files = await SupabaseUtils.listFiles("models", folderPath, {
                    offset: 0,
                    sortBy: {column: 'name', order: 'asc'},
                });

                if (!files.data || files.data.length === 0) {
                    console.error("No files found in folder:", folderPath);
                    return;
                }

                // Load all models in the folder
                for (const file of files.data) {
                    const modelPath = `${folderPath}/${file.name}`;
                    const {data} = supabase.storage.from("models").getPublicUrl(modelPath);

                    // Load model to a container
                    const container = await BABYLON.LoadAssetContainerAsync(data.publicUrl, sceneRef.current);

                    // Scale all meshes
                    container.meshes.forEach(mesh => {
                        mesh.scaling = new Vector3(modelScaling, modelScaling, modelScaling);
                    });

                    // Find mesh0 if it exists
                    const mesh0 = container.meshes.find(mesh => mesh.name === "mesh0");

                    if (mesh0) {
                        container.materials.forEach(material => {
                            loadedMaterialsRef.current.push(material);
                        });

                        if (!loadedFirstMesh) {
                            container.addToScene();
                            targetMeshRef.current = mesh0;
                            loadedFirstMesh = true;
                        }

                        // Store the loaded meshes for cleanup later
                        loadedModelRef.current = [...loadedModelRef.current, ...container.meshes];

                        console.log(`Loaded model: ${file.name}`);
                        console.log(`Found mesh0, stored ${loadedMaterialsRef.current.length} materials total`);
                    } else {
                        // Still collect materials even if no mesh0
                        console.log(`No mesh0 found in model: ${file.name}`);
                        container.materials.forEach(material => {
                            loadedMaterialsRef.current.push(material);
                        });
                    }
                }

                console.log("Total materials loaded:", loadedMaterialsRef.current.length);
                console.log("Target mesh found:", targetMeshRef.current ? "Yes" : "No");
                console.log(loadedMaterialsRef.current)
            } catch (error) {
                console.error("Error loading models:", error);
            }
        };

        if (sceneRef.current) {
            loadModels();
        }
    }, [modelName, modelScaling]);

    return <canvas ref={canvasRef} className="w-full h-full"/>;
}