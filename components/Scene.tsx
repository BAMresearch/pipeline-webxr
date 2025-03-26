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
import { Checkbox } from '@babylonjs/gui';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import SupabaseUtils from '@/lib/supabaseUtils';
import MenuUtils from '@/lib/menuUtils';
import { SimulationResult } from '@/components/SimulationResult';
import MeshUtils from '@/lib/meshUtils';

interface SceneProps {
    modelName: string;
    modelScaling: number;
    modelRotation: { x: number; y: number; z: number };
}

const MenuSnippets = {
    spatial: '#GAF8QH#3',
    fullscreen: '#GYLJ95#19',
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

    const movementEnabledRef = useRef<boolean>(false);

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

    // Initialize engine and scene only once this effect is called when the website is loaded
    // and when the scene parameters change (modelName, modelScaling, modelRotation)
    useEffect(() => {
        // Startup boilerplate code to initialize the scene and engine for babylon.js and store them in refs
        registerBuiltInLoaders();
        if (!canvasRef.current) return;

        const engine = new Engine(canvasRef.current, true);
        engineRef.current = engine;

        const scene = new BabylonScene(engine);
        sceneRef.current = scene;

        // Check if WebXR is available
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

        // Setup camera (for the preview scene on the main page)
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

        // Create floor and make it (almost) transparent
        // If it should be fully transparent, set alpha to 0
        const alpha = 0.1;

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
        floorMaterial.alpha = alpha;
        floor.material = floorMaterial;

        // Initialize both UIs after WebXR capability check
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

            menuHolder.setEnabled(false);
            fullscreenUI.renderScale = 1.0;

            // Load the menu content for both UIs
            const setupMenus = () => {
                // Load spacial UI for VR
                spacialUI
                    .parseFromSnippetAsync(MenuSnippets.spatial)
                    .then(() => {
                        console.log('Spatial UI loaded successfully');
                        setupCycleButton(spacialUI);
                        setupMoveButtons(spacialUI);
                        setupMoveObjectCheckbox(spacialUI);
                    })
                    .catch((error) => {
                        console.error('Failed to load spatial UI:', error);
                    });

                // Load fullscreen UI for tablet/mobile
                fullscreenUI
                    .parseFromSnippetAsync(MenuSnippets.fullscreen)
                    .then(() => {
                        console.log('Fullscreen UI loaded successfully');
                        setupCycleButton(fullscreenUI);
                        setupMoveButtons(fullscreenUI);
                        setupMoveObjectCheckbox(fullscreenUI);
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
                        // createJoystick(scene);
                        performInputDetection(xrExperienceRef.current);
                        setupPointerMove(scene);

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

        /**
         * Function to set up the functionality of the cycle button for switching between simulation types.
         * @param menu - The GUI menu to search for the button (spatial or fullscreen UI)
         */
        const setupCycleButton = (menu: GUI.AdvancedDynamicTexture) => {
            if (!menu) return;
            const cycleButton = MenuUtils.findControlByName(
                menu,
                'cycleColorButton'
            );
            if (cycleButton) {
                cycleButton.onPointerUpObservable.add(() => {
                    cycleSimulationResults();
                });
            }
        };

        /**
         * Function to set up the functionality of move buttons for moving the model up and down.
         * @param menu - The GUI menu to search for the buttons (spatial or fullscreen UI)
         */
        const setupMoveButtons = (menu: GUI.AdvancedDynamicTexture) => {
            if (!menu) return;
            const moveUpButton = MenuUtils.findControlByName(
                menu,
                'moveUpButton'
            );
            if (moveUpButton) {
                moveUpButton.onPointerUpObservable.add(() => {
                    for (const result of simulationResultsRef.current.values()) {
                        MeshUtils.moveSimulationResultMeshes(
                            result,
                            new BABYLON.Vector3(0, 0.1, 0)
                        );
                    }
                });
            }

            const moveDownButton = MenuUtils.findControlByName(
                menu,
                'moveDownButton'
            );
            if (moveDownButton) {
                moveDownButton.onPointerUpObservable.add(() => {
                    for (const result of simulationResultsRef.current.values()) {
                        MeshUtils.moveSimulationResultMeshes(
                            result,
                            new BABYLON.Vector3(0, -0.1, 0)
                        );
                    }
                });
            }
        };

        /**
         * Function to set up the functionality of the move object checkbox for toggling object movement.
         * @param menu - The GUI menu to search for the checkbox (spatial or fullscreen UI)
         */
        const setupMoveObjectCheckbox = (menu: GUI.AdvancedDynamicTexture) => {
            if (!menu) return;
            const moveObjectCheckbox = MenuUtils.findControlByName(
                menu,
                'moveObjectCheckbox'
            ) as Checkbox;
            if (moveObjectCheckbox) {
                moveObjectCheckbox.onIsCheckedChangedObservable.add((value) => {
                    // Need to invert the value
                    console.log(
                        'Move object checkbox checked INVERTING VALUE:',
                        !value
                    );
                    movementEnabledRef.current = !value;
                });
            }
        };

        // Joysticks turned out not to be the best idea since the babylonjs built-in implementation captures the input
        // of any other menu item and checks the entire screen for input. This makes it unable to use the menu while
        // the Joystick is enabled.

        const toggleJoystick = (value: boolean) => {
            if (!BABYLON.VirtualJoystick.Canvas) {
                console.error('VirtualJoystick not initialized');
                return;
            }
            if (
                value &&
                xrExperienceRef.current?.baseExperience.state ===
                    BABYLON.WebXRState.IN_XR
            ) {
                BABYLON.VirtualJoystick.Canvas.style.zIndex = '4';
            } else {
                BABYLON.VirtualJoystick.Canvas.style.zIndex = '-1';
            }
        };

        /**
         * Function to create a virtual joystick for moving the model in the scene.
         * @param scene - The Babylon scene to attach the joystick to
         */
        const createJoystick = (scene: BabylonScene) => {
            const joystick = new BABYLON.VirtualJoystick(true);

            scene.onBeforeRenderObservable.add(() => {
                if (joystick.pressed) {
                    const moveSpeed = 1;
                    const moveX =
                        joystick.deltaPosition.x *
                        (engine.getDeltaTime() / 1000) *
                        moveSpeed;
                    const moveZ =
                        joystick.deltaPosition.y *
                        (engine.getDeltaTime() / 1000) *
                        moveSpeed;
                    const moveVector = new BABYLON.Vector3(moveX, 0, moveZ);

                    for (const result of simulationResultsRef.current.values()) {
                        for (const mesh of result.meshes) {
                            mesh.position.addInPlace(moveVector);
                        }
                    }
                }
            });
        };

        /**
         * We set the object position by sending a ray from the camera position through the pointer.
         * The intersection of that ray with the floor is the point to which the loaded simulation results will be
         * moved.
         * @param scene - The scene object, required to fetch the camera and floor objects.
         */
        const setupPointerMove = (scene: BabylonScene) => {
            scene.onPointerObservable.add((pointerInfo) => {
                // Only process if movement is enabled and it's a pointer down event
                if (
                    !movementEnabledRef.current ||
                    pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN
                ) {
                    return;
                }
                console.log('Processing pointer event', pointerInfo);

                // Get the current active camera
                const camera = scene.activeCamera;
                if (!camera) {
                    console.error('No active camera found');
                    return;
                }

                // Create a ray from the camera through the pointer position
                const ray = scene.createPickingRay(
                    scene.pointerX,
                    scene.pointerY,
                    BABYLON.Matrix.Identity(),
                    camera
                );

                // Find the floor mesh
                const floor = scene.getMeshByName('floor');
                if (!floor) {
                    console.error('Floor mesh not found');
                    return;
                }

                // Check if the ray intersects with the floor
                const pickInfo = scene.pickWithRay(
                    ray,
                    (mesh) => mesh === floor
                );

                if (!pickInfo) {
                    console.error('No intersection found');
                    return;
                }

                if (pickInfo.hit && pickInfo.pickedPoint) {
                    // Get current Y position of the object to maintain height
                    const currentObjectY =
                        simulationResultsRef.current.get(
                            currentSimulationTypeRef.current
                        )?.meshes[0].position.y ?? 0;

                    // Create target position using floor intersection X,Z but keeping original Y
                    const targetPosition = new BABYLON.Vector3(
                        -pickInfo.pickedPoint.x, // needs to be inverted, reason unknown
                        currentObjectY,
                        pickInfo.pickedPoint.z
                    );

                    console.log('Moving object to:', targetPosition);

                    // Move all simulation objects to this position
                    for (const result of simulationResultsRef.current.values()) {
                        MeshUtils.moveSimulationResultMeshes(
                            result,
                            targetPosition,
                            'set'
                        );
                    }
                }
            });
        };

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

        /**
         * Function to check whether VR controllers are detected by the scene.
         * If controllers are detected we can assume that we are in the VR headset mode.
         * Thus, we show the VR UI (spatial). Otherwise, we show the fullscreen UI.
         * @param xrExperience - The WebXR experience object which contains the input controllers
         */
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
            fetchSimulationResults().then(() => {
                console.log('Simulation results loaded, creating UI buttons');
                MenuUtils.createSimulationTypeButtons(
                    fullscreenUIRef.current,
                    spacialUIRef.current,
                    availableSimulationTypesRef.current,
                    availableSimulationTypesRef.current[0],
                    switchSimulationType
                );
            });
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
