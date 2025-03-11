'use client';
import { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
    AbstractMesh,
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    KeyboardEventTypes,
    Scene as BabylonScene,
    Vector3,
    WebXRDefaultExperience,
} from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import SupabaseUtils from '@/lib/supabaseUtils';
import MenuUtils from '@/lib/menuUtils';

interface SceneProps {
    modelName: string;
    modelScaling: number;
    modelRotation: { x: number; y: number; z: number };
}

interface SimulationResult {
    type: string;
    meshes: AbstractMesh[];
    currentIndex: number;
}

const MenuSnippets = {
    spatial: '#GYLJ95#5',
    fullscreen: '#GYLJ95#11',
};

export default function Scene({
    modelName,
    modelScaling,
    modelRotation,
}: SceneProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const sceneRef = useRef<BabylonScene | null>(null);

    const fullscreenUIRef = useRef<GUI.AdvancedDynamicTexture | null>(null);
    const spacialUIRef = useRef<GUI.AdvancedDynamicTexture | null>(null);
    const spatialUIRef = useRef<BABYLON.Mesh | null>(null);

    const xrExperienceRef = useRef<WebXRDefaultExperience | null>(null);

    const simulationResultsRef = useRef<Map<string, SimulationResult>>(
        new Map()
    );
    const currentSimulationTypeRef = useRef<string>('');

    // Replace useState with useRef for availableSimulationTypes
    const availableSimulationTypesRef = useRef<string[]>([]);

    // Keep these as useState because they're used for UI rendering
    const [deviceType, setDeviceType] = useState<string>('unknown');
    const [inXRSession, setInXRSession] = useState<boolean>(false);

    const fetchSimulationResults = async () => {
        if (!sceneRef.current) return;

        try {
            console.log('Fetching simulation results for model:', modelName);

            // First, dispose of all previous model meshes to prevent memory leaks
            clearPreviousModels();

            // Clear existing simulation results map
            simulationResultsRef.current.clear();

            // Get available simulation types for this model
            const simulationTypesResult =
                await SupabaseUtils.listSimulationTypes('models', modelName);

            if (
                !simulationTypesResult.data ||
                simulationTypesResult.data.length === 0
            ) {
                console.log('No simulation types found for model:', modelName);
                return;
            }

            // Store available simulation types in ref instead of state
            const types = simulationTypesResult.data.map((item) => item.name);
            console.log('Available simulation types:', types);
            availableSimulationTypesRef.current = types;
            console.log(
                'Available simulation types stored:',
                availableSimulationTypesRef.current
            );

            // Set default simulation type if none is set
            if (!currentSimulationTypeRef.current && types.length > 0) {
                currentSimulationTypeRef.current = types[0];
            }

            // Load simulation results for each type
            for (const simType of simulationTypesResult.data) {
                const simTypeName = simType.name;
                console.log(
                    `Loading simulation results for type: ${simTypeName}`
                );

                const folderPath = `${modelName}/${simTypeName}`;
                const files = await SupabaseUtils.listFiles(
                    'models',
                    folderPath,
                    {
                        offset: 0,
                        sortBy: { column: 'name', order: 'asc' },
                    }
                );

                if (!files.data || files.data.length === 0) {
                    console.log(
                        `No files found for simulation type: ${simTypeName}`
                    );
                    continue;
                }

                console.log(
                    `Found ${files.data.length} files for simulation type: ${simTypeName}`
                );

                const simulationMeshes: AbstractMesh[] = [];

                for (const file of files.data) {
                    const filePath = `${folderPath}/${file.name}`;
                    console.log(`Loading simulation result: ${filePath}`);

                    const publicUrl = await SupabaseUtils.getPublicUrl(
                        'models',
                        filePath
                    );

                    const container = await BABYLON.LoadAssetContainerAsync(
                        publicUrl,
                        sceneRef.current
                    );

                    // Look for mesh0 (ParaView models) or other suitable mesh
                    const mesh0 = container.meshes.find(
                        (mesh) => mesh.name === 'mesh0'
                    );

                    if (mesh0) {
                        container.addAllToScene();

                        mesh0.scaling = new Vector3(
                            modelScaling,
                            modelScaling,
                            modelScaling
                        );
                        mesh0.rotation = new Vector3(
                            BABYLON.Tools.ToRadians(modelRotation.x),
                            BABYLON.Tools.ToRadians(modelRotation.y),
                            BABYLON.Tools.ToRadians(modelRotation.z)
                        );

                        simulationMeshes.push(mesh0);
                        mesh0.setEnabled(false); // Initially hide all meshes

                        console.log(
                            `Successfully loaded simulation result: ${file.name}`
                        );
                    } else {
                        // Not a ParaView model, look for other meshes
                        const firstMesh = container.meshes.find(
                            (mesh) =>
                                mesh.name !== 'root' && mesh.name !== '__root__'
                        );

                        if (firstMesh) {
                            container.addAllToScene();
                            firstMesh.scaling = new Vector3(
                                modelScaling,
                                modelScaling,
                                modelScaling
                            );
                            firstMesh.rotation = new Vector3(
                                BABYLON.Tools.ToRadians(modelRotation.x),
                                BABYLON.Tools.ToRadians(modelRotation.y),
                                BABYLON.Tools.ToRadians(modelRotation.z)
                            );

                            simulationMeshes.push(firstMesh);
                            firstMesh.setEnabled(false); // Initially hide all meshes

                            console.log(
                                `Using ${firstMesh.name} as simulation result mesh for ${file.name}`
                            );
                        } else {
                            console.log(
                                `No suitable mesh found in this simulation result: ${file.name}`
                            );
                        }
                    }
                }

                if (simulationMeshes.length > 0) {
                    // Store this simulation type's meshes in our map
                    simulationResultsRef.current.set(simTypeName, {
                        type: simTypeName,
                        meshes: simulationMeshes,
                        currentIndex: 0,
                    });

                    console.log(
                        `Stored ${simulationMeshes.length} meshes for simulation type: ${simTypeName}`
                    );
                }
            }

            // Show the current simulation type's first mesh
            if (currentSimulationTypeRef.current) {
                showCurrentSimulationResult();
            }
        } catch (error) {
            console.error('Error loading simulation results:', error);
        }
    };

    const cycleSimulationResults = () => {
        const currentSimType = currentSimulationTypeRef.current;
        if (
            !currentSimType ||
            !simulationResultsRef.current.has(currentSimType)
        ) {
            console.log(
                'No current simulation type selected or no results available'
            );
            return;
        }

        const simResult = simulationResultsRef.current.get(currentSimType)!;

        // Hide current mesh
        if (simResult.meshes[simResult.currentIndex]) {
            simResult.meshes[simResult.currentIndex].setEnabled(false);
        }

        // Move to next mesh
        simResult.currentIndex =
            (simResult.currentIndex + 1) % simResult.meshes.length;

        // Show new current mesh
        if (simResult.meshes[simResult.currentIndex]) {
            simResult.meshes[simResult.currentIndex].setEnabled(true);
            console.log(
                `Switched to simulation result ${simResult.currentIndex} for type ${currentSimType}: ${simResult.meshes[simResult.currentIndex].name}`
            );
        }
    };

    // Function to switch to a different simulation type
    const switchSimulationType = (simulationType: string) => {
        if (!simulationResultsRef.current.has(simulationType)) {
            console.log(`Simulation type not found: ${simulationType}`);
            return;
        }

        // Hide current simulation result
        hideAllSimulationResults();

        // Update current simulation type
        currentSimulationTypeRef.current = simulationType;

        // Show the first mesh of the new simulation type
        showCurrentSimulationResult();

        console.log(`Switched to simulation type: ${simulationType}`);
    };

    // Helper function to hide all simulation results
    const hideAllSimulationResults = () => {
        simulationResultsRef.current.forEach((simResult) => {
            simResult.meshes.forEach((mesh) => {
                mesh.setEnabled(false);
            });
        });
    };

    // Helper function to dispose of all previous model meshes
    const clearPreviousModels = () => {
        if (!sceneRef.current) return;

        console.log('Clearing previous model meshes from scene');

        // Dispose of all meshes from previous simulation results
        simulationResultsRef.current.forEach((simResult) => {
            simResult.meshes.forEach((mesh) => {
                // Check if the mesh still exists in the scene
                if (mesh && !mesh.isDisposed()) {
                    console.log(`Disposing mesh: ${mesh.name}`);
                    // First dispose of materials if they exist
                    if (mesh.material) {
                        mesh.material.dispose();
                    }
                    // Remove from scene and dispose
                    mesh.dispose(true, true);
                }
            });
        });

        // Additional cleanup for any remaining meshes from the model
        // This helps catch meshes that might not be tracked in our simulation results map
        const meshesToDispose = sceneRef.current.meshes.filter((mesh) => {
            // Keep essential scene objects like the floor and menu holder
            return (
                mesh.name !== 'floor' &&
                mesh.name !== 'menuHolder' &&
                !mesh.name.includes('ground')
            );
        });

        meshesToDispose.forEach((mesh) => {
            if (!mesh.isDisposed()) {
                console.log(`Disposing additional mesh: ${mesh.name}`);
                if (mesh.material) {
                    mesh.material.dispose();
                }
                mesh.dispose(true, true);
            }
        });

        // Force garbage collection hint
        if (sceneRef.current) {
            sceneRef.current.cleanCachedTextureBuffer();
            // Optional: trigger a garbage collection hint in Babylon
            if (engineRef.current) {
                engineRef.current.wipeCaches(true);
            }
        }
    };

    // Helper function to show current simulation result
    const showCurrentSimulationResult = () => {
        const currentSimType = currentSimulationTypeRef.current;
        if (
            !currentSimType ||
            !simulationResultsRef.current.has(currentSimType)
        ) {
            return;
        }

        const simResult = simulationResultsRef.current.get(currentSimType)!;

        // Hide all meshes first
        hideAllSimulationResults();

        // Show the current mesh for this simulation type
        if (simResult.meshes[simResult.currentIndex]) {
            simResult.meshes[simResult.currentIndex].setEnabled(true);
            console.log(
                `Showing simulation result ${simResult.currentIndex} for type ${currentSimType}: ${simResult.meshes[simResult.currentIndex].name}`
            );
        }
    };

    // Initialize engine and scene only once
    useEffect(() => {
        registerBuiltInLoaders();

        if (!canvasRef.current) return;

        // Create engine and scene
        const engine = new Engine(canvasRef.current, true);
        engineRef.current = engine;

        const scene = new BabylonScene(engine);
        sceneRef.current = scene;

        // Check if VR is available
        const xrPromise = BABYLON.WebXRSessionManager.IsSessionSupportedAsync(
            'immersive-ar'
        )
            .then((supported) => {
                console.log('VR support:', supported);
                return supported;
            })
            .catch((error) => {
                console.error('Error checking XR support:', error);
                return false;
            });

        // Setup camera
        const camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2,
            Math.PI / 2.5,
            3,
            Vector3.Zero(),
            scene
        );
        camera.attachControl(canvasRef.current, true);

        // Create light
        const light = new HemisphericLight(
            'light',
            new Vector3(0, 1, 0),
            scene
        );

        // Create floor
        const floor = BABYLON.MeshBuilder.CreateGround(
            'floor',
            { width: 6, height: 6 },
            scene
        );
        const floorMaterial = new BABYLON.StandardMaterial(
            'floorMaterial',
            scene
        );
        floorMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        floorMaterial.alpha = 0.2;
        floor.material = floorMaterial;

        // Initialize both UIs after XR capability check
        xrPromise.then((vrCapable) => {
            // Create 3D spatial menu for VR
            const menuHolder = BABYLON.MeshBuilder.CreatePlane(
                'menuHolder',
                { width: 1, height: 1 },
                scene
            );
            menuHolder.position = new BABYLON.Vector3(0, 1, 2);
            spatialUIRef.current = menuHolder;

            const spacialUI = GUI.AdvancedDynamicTexture.CreateForMesh(
                menuHolder,
                2048,
                2048
            );
            spacialUIRef.current = spacialUI;

            // Create fullscreen UI for non-VR devices
            const fullscreenUI = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
                'UI',
                true,
                scene
            );
            fullscreenUIRef.current = fullscreenUI;

            // Initially hide both UIs until we determine which to show
            menuHolder.setEnabled(false);
            fullscreenUI.renderScale = 1.0;

            // Load the menu content for both UIs
            const setupMenus = () => {
                // Load spacial UI for VR
                spacialUI
                    .parseFromSnippetAsync(MenuSnippets.spatial)
                    .then(() => {
                        console.log('Spatial UI loaded successfully');
                        const cycleColorButton = MenuUtils.findControlByName(
                            spacialUI,
                            'cycleColorButton'
                        );
                        if (cycleColorButton) {
                            cycleColorButton.onPointerUpObservable.add(() => {
                                cycleSimulationResults();
                            });
                        }

                        const cycleSimulationButton =
                            MenuUtils.findControlByName(
                                spacialUI,
                                'cycleSimulationButton'
                            );
                        if (cycleSimulationButton) {
                            cycleSimulationButton.onPointerUpObservable.add(
                                () => {
                                    cycleSimulationTypes();
                                }
                            );
                        }
                    })
                    .catch((error) => {
                        console.error('Failed to load spatial UI:', error);
                    });

                // Load fullscreen UI for tablet/mobile
                fullscreenUI
                    .parseFromSnippetAsync(MenuSnippets.fullscreen)
                    .then(() => {
                        console.log('Fullscreen UI loaded successfully');
                        const cycleColorButton = MenuUtils.findControlByName(
                            fullscreenUI,
                            'cycleColorButton'
                        );
                        if (cycleColorButton) {
                            cycleColorButton.onPointerUpObservable.add(() => {
                                cycleSimulationResults();
                            });
                        }

                        const cycleSimulationButton =
                            MenuUtils.findControlByName(
                                fullscreenUI,
                                'cycleSimulationButton'
                            );
                        if (cycleSimulationButton) {
                            cycleSimulationButton.onPointerUpObservable.add(
                                () => {
                                    cycleSimulationTypes();
                                }
                            );
                        }
                    })
                    .catch((error) => {
                        console.error('Failed to load fullscreen UI:', error);
                    });
            };

            setupMenus();

            // Setup WebXR if capable
            if (vrCapable) {
                scene
                    .createDefaultXRExperienceAsync({
                        floorMeshes: [floor],
                        uiOptions: {
                            sessionMode: 'immersive-ar',
                        },
                        disableTeleportation: true,
                    })
                    .then((xr) => {
                        console.log('XR experience created successfully');
                        xrExperienceRef.current = xr;
                        setupManualTriggerHandling(scene);
                        performInputDetection(xr);
                        xr.baseExperience.onStateChangedObservable.add(
                            (state) => {
                                if (state === BABYLON.WebXRState.IN_XR) {
                                    console.log('Entered XR');
                                    setInXRSession(true);
                                } else if (
                                    state === BABYLON.WebXRState.NOT_IN_XR
                                ) {
                                    console.log('Exited XR');
                                    setInXRSession(false);
                                }
                            }
                        );
                    })
                    .catch((error) => {
                        console.error('Error creating XR experience:', error);
                        updateUIVisibility(false);
                    });
            } else {
                // Not VR capable, show fullscreen UI by default
                updateUIVisibility(false);
            }
        });

        const updateUIVisibility = (inXRSession: boolean) => {
            if (spatialUIRef.current && fullscreenUIRef.current) {
                const isVRHeadset = deviceType === 'vr-headset';
                console.log(
                    `Updating UI visibility - In XR: ${inXRSession}, Device: ${deviceType}`
                );

                // Spatial UI (3D menu for VR headsets)
                if (spacialUIRef.current) {
                    // Only show spatial UI in XR session and if we're using a VR headset
                    spatialUIRef.current.setEnabled(inXRSession && isVRHeadset);
                    console.log(
                        `Spatial UI ${inXRSession && isVRHeadset ? 'enabled' : 'disabled'}`
                    );
                }

                // Fullscreen UI (2D overlay for tablets/mobile or non-VR devices)
                const fullscreenControls =
                    fullscreenUIRef.current.getChildren();
                fullscreenControls.forEach((control) => {
                    // Show fullscreen UI when:
                    // 1. Not in XR session at all, OR
                    // 2. In XR session but on a tablet/mobile device
                    control.isVisible =
                        !inXRSession || (inXRSession && !isVRHeadset);
                });
                console.log(
                    `Fullscreen UI ${!inXRSession || (inXRSession && !isVRHeadset) ? 'visible' : 'hidden'}`
                );
            } else {
                console.warn(
                    'Cannot update UI visibility: UI references not initialized'
                );
            }
        };

        const performInputDetection = (
            xrExperience: WebXRDefaultExperience
        ) => {
            if (!xrExperience || !xrExperience.input) return;

            // Initial check for controllers
            checkForControllers();

            // Set up continuous monitoring for controller connections
            xrExperience.input.onControllerAddedObservable.add((controller) => {
                console.log('New controller connected:', controller);
                checkForControllers();
            });

            // Helper function to check for controllers and update device type
            function checkForControllers() {
                let hasControllers = false;

                // Check for motion controllers
                if (
                    xrExperience.input.controllers &&
                    xrExperience.input.controllers.length > 0
                ) {
                    hasControllers = xrExperience.input.controllers.some(
                        (controller) => controller.motionController !== null
                    );
                }

                if (hasControllers) {
                    console.log(
                        'VR controllers detected - setting device type to vr-headset'
                    );
                    setDeviceType('vr-headset');
                    // Update UI immediately when we detect controllers
                    if (sceneRef.current && sceneRef.current.activeCamera) {
                        updateUIVisibility(true);
                    }
                }
            }
        };

        // Start render loop
        engine.runRenderLoop(() => {
            scene.render();
        });

        // Handle window resize
        const resizeHandler = () => {
            engine.resize();
        };
        window.addEventListener('resize', resizeHandler);

        // Cleanup
        return () => {
            window.removeEventListener('resize', resizeHandler);
            scene.dispose();
            engine.dispose();
        };
    }, []);

    // This effect runs whenever deviceType or inXRSession changes
    useEffect(() => {
        // Skip if UI refs aren't initialized yet
        if (!spatialUIRef.current || !fullscreenUIRef.current) return;

        const isVRHeadset = deviceType === 'vr-headset';
        console.log(
            `[useEffect] Updating UI - Device Type: ${deviceType}, In XR: ${inXRSession}`
        );

        // Spatial UI (3D menu for VR headsets)
        if (spacialUIRef.current) {
            // Only show spatial UI in XR session and if we're using a VR headset
            spatialUIRef.current.setEnabled(inXRSession && isVRHeadset);
            console.log(
                `[useEffect] Spatial UI ${inXRSession && isVRHeadset ? 'enabled' : 'disabled'}`
            );
        }

        // Fullscreen UI (2D overlay for tablets/mobile)
        const fullscreenControls = fullscreenUIRef.current.getChildren();
        fullscreenControls.forEach((control) => {
            // Show fullscreen UI when:
            // 1. Not in XR session at all, OR
            // 2. In XR session but on a tablet/mobile device
            control.isVisible = !inXRSession || (inXRSession && !isVRHeadset);
        });
        console.log(
            `[useEffect] Fullscreen UI ${!inXRSession || (inXRSession && !isVRHeadset) ? 'visible' : 'hidden'}`
        );
    }, [deviceType, inXRSession]); // This effect runs when either state changes

    const cycleSimulationTypes = () => {
        if (availableSimulationTypesRef.current.length > 1) {
            const currentIndex = availableSimulationTypesRef.current.indexOf(
                currentSimulationTypeRef.current
            );
            const nextIndex =
                (currentIndex + 1) % availableSimulationTypesRef.current.length;
            const nextType = availableSimulationTypesRef.current[nextIndex];
            switchSimulationType(nextType);
        }
    };

    const observersRef = {
        keyboard: null as BABYLON.Observer<BABYLON.KeyboardInfo> | null,
        pointer: null as BABYLON.Observer<BABYLON.PointerInfo> | null,
    };

    // Setup manual trigger handling for testing without XR controllers
    const setupManualTriggerHandling = (scene: BabylonScene) => {
        observersRef.keyboard = scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                if (kbInfo.event.key === 't' || kbInfo.event.key === 'T') {
                    console.log(
                        'Manual simulation cycle trigger activated via keyboard'
                    );
                    console.log(
                        'Available simulation types:',
                        availableSimulationTypesRef.current
                    );
                    if (currentSimulationTypeRef.current == 'default') {
                        // Now using the ref directly instead of state
                        switchSimulationType(
                            availableSimulationTypesRef.current[1]
                        );
                    } else {
                        switchSimulationType('default');
                    }
                }
            }
        });
    };

    // Function to re-enable debug triggers when exiting XR
    const enableDebugTriggers = (scene: BabylonScene) => {
        console.log('Re-enabling debug keyboard and screen triggers');
        setupManualTriggerHandling(scene);
    };

    // Add a useEffect to call fetchSimulationResults when the model changes
    useEffect(() => {
        if (sceneRef.current) {
            // Reset the current simulation type when model parameters change
            currentSimulationTypeRef.current = '';
            // Clear the available simulation types
            availableSimulationTypesRef.current = [];
            // Fetch new simulation results
            fetchSimulationResults();
        }

        // Cleanup function to ensure models are disposed when component unmounts
        return () => {
            if (sceneRef.current) {
                clearPreviousModels();
            }
        };
    }, [modelName, modelScaling, modelRotation]);

    return <canvas ref={canvasRef} className="w-full h-full" />;
}
