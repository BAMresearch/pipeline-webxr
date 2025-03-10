'use client';
import { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
    AbstractMesh,
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    KeyboardEventTypes,
    PointerEventTypes,
    Scene as BabylonScene,
    Vector3,
    WebXRDefaultExperience,
} from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { supabase } from '@/lib/supabase';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import SupabaseUtils from '@/lib/supabaseUtils';
import MenuUtils from '@/lib/menuUtils';

interface SceneProps {
    modelName: string;
    modelScaling: number;
    modelRotation: { x: number; y: number; z: number };
}

const MenuSnippets = {
    spatial: '#GYLJ95#5',
    fullscreen: '#GYLJ95#7',
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
    const targetMeshesRef = useRef<AbstractMesh[]>([]);
    const currentMeshIndexRef = useRef<number>(0);

    const [deviceType, setDeviceType] = useState<string>('unknown');
    const [inXRSession, setInXRSession] = useState<boolean>(false);

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
        floorMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
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
                        const cycleButton = MenuUtils.findControlByName(
                            spacialUI,
                            'cycleButton'
                        );
                        if (cycleButton) {
                            cycleButton.onPointerUpObservable.add(() => {
                                cycleMeshVisibility();
                            });
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
                        const cycleButton = MenuUtils.findControlByName(
                            fullscreenUI,
                            'cycleButton'
                        );
                        if (cycleButton) {
                            cycleButton.onPointerUpObservable.add(() => {
                                cycleMeshVisibility();
                            });
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
                            referenceSpaceType: 'unbounded',
                        },
                        optionalFeatures: true,
                    })
                    .then((xr) => {
                        console.log('XR experience created successfully');
                        xrExperienceRef.current = xr;
                        // setupManualTriggerHandling(scene);
                        performInputDetection(xr);
                        xr.baseExperience.onStateChangedObservable.add(
                            (state) => {
                                if (state === BABYLON.WebXRState.IN_XR) {
                                    console.log('Entered XR');
                                    setInXRSession(true);
                                    // Check for controllers again when entering XR, in case they connect slightly later
                                    // setTimeout(() => {
                                    //     performInputDetection(xr);
                                    // }, 1000); // Give controllers a second to connect
                                    // disableDebugTriggers(scene);
                                } else if (
                                    state === BABYLON.WebXRState.NOT_IN_XR
                                ) {
                                    console.log('Exited XR');
                                    setInXRSession(false);
                                    // enableDebugTriggers(scene);
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

    // Function to cycle through visible meshes
    const cycleMeshVisibility = () => {
        if (targetMeshesRef.current.length === 0) {
            console.log('No meshes available to cycle through');
            return;
        }
        // Hide current mesh
        if (targetMeshesRef.current[currentMeshIndexRef.current]) {
            targetMeshesRef.current[currentMeshIndexRef.current].setEnabled(
                false
            );
        }
        // Move to next mesh
        currentMeshIndexRef.current =
            (currentMeshIndexRef.current + 1) % targetMeshesRef.current.length;
        // Show new current mesh
        if (targetMeshesRef.current[currentMeshIndexRef.current]) {
            targetMeshesRef.current[currentMeshIndexRef.current].setEnabled(
                true
            );
            console.log(
                `Switched to mesh index ${currentMeshIndexRef.current}: ${targetMeshesRef.current[currentMeshIndexRef.current].name}`
            );
        }
    };

    const observersRef = {
        keyboard: null as BABYLON.Observer<BABYLON.KeyboardInfo> | null,
        pointer: null as BABYLON.Observer<BABYLON.PointerInfo> | null,
    };

    // Setup manual trigger handling for testing without XR controllers
    const setupManualTriggerHandling = (scene: BabylonScene) => {
        // Add keyboard event for testing (press 'T' to simulate trigger)
        observersRef.keyboard = scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                if (kbInfo.event.key === 't' || kbInfo.event.key === 'T') {
                    console.log('Manual trigger activated via keyboard');
                    cycleMeshVisibility();
                }
            }
        });

        // Also respond to pointer down events (clicks)
        observersRef.pointer = scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                console.log('Screen tap/click detected');
                cycleMeshVisibility();
            }
        });
    };

    // Function to disable debug triggers when in XR
    const disableDebugTriggers = (scene: BabylonScene) => {
        console.log('Disabling debug keyboard and screen triggers for XR');
        if (observersRef.keyboard !== null) {
            scene.onKeyboardObservable.remove(observersRef.keyboard);
        }
        if (observersRef.pointer !== null) {
            scene.onPointerObservable.remove(observersRef.pointer);
        }
    };

    // Function to re-enable debug triggers when exiting XR
    const enableDebugTriggers = (scene: BabylonScene) => {
        console.log('Re-enabling debug keyboard and screen triggers');
        setupManualTriggerHandling(scene);
    };

    useEffect(() => {
        const loadModels = async () => {
            if (!sceneRef.current) return;

            try {
                // Clear existing target meshes
                targetMeshesRef.current.forEach((mesh) => {
                    if (mesh) {
                        mesh.dispose();
                    }
                });
                targetMeshesRef.current = [];
                currentMeshIndexRef.current = 0;

                console.log('Loading models for folder:', modelName);

                const folderPath = `public/${modelName}`;
                const files = await SupabaseUtils.listFiles(
                    'models',
                    folderPath,
                    {
                        offset: 0,
                        sortBy: { column: 'name', order: 'asc' },
                    }
                );

                if (!files.data || files.data.length === 0) {
                    console.error('No files found in folder:', folderPath);
                    return;
                }

                console.log(`Found ${files.data.length} files to load`);

                for (const file of files.data) {
                    const modelPath = `${folderPath}/${file.name}`;
                    const { data } = supabase.storage
                        .from('models')
                        .getPublicUrl(modelPath);
                    const container = await BABYLON.LoadAssetContainerAsync(
                        data.publicUrl,
                        sceneRef.current
                    );
                    const mesh0 = container.meshes.find(
                        (mesh) => mesh.name === 'mesh0'
                    );

                    if (mesh0) {
                        console.log('Found mesh0 in the model!');
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

                        targetMeshesRef.current.push(mesh0);
                        mesh0.setEnabled(
                            currentMeshIndexRef.current ===
                                targetMeshesRef.current.length - 1
                        );

                        console.log(`Successfully loaded model: ${file.name}`);
                    } else {
                        // IS ONLY THE CASE IF NOT LOADING PARAVIEW MODELS
                        console.log(
                            `No mesh0 found in model: ${file.name}, looking for other meshes`
                        );
                        const firstMesh = container.meshes.find(
                            (mesh) =>
                                mesh.name !== 'root' && mesh.name !== '__root__'
                        );

                        if (firstMesh) {
                            console.log(
                                `Using ${firstMesh.name} as target mesh instead`
                            );
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
                            targetMeshesRef.current.push(firstMesh);
                            firstMesh.setEnabled(
                                currentMeshIndexRef.current ===
                                    targetMeshesRef.current.length - 1
                            );
                        } else {
                            console.log('No suitable mesh found in this model');
                        }
                    }
                }

                if (targetMeshesRef.current.length > 0) {
                    targetMeshesRef.current.forEach((mesh) =>
                        mesh.setEnabled(false)
                    );
                    targetMeshesRef.current[
                        currentMeshIndexRef.current
                    ].setEnabled(true);
                    console.log(
                        `Showing mesh ${currentMeshIndexRef.current}: ${targetMeshesRef.current[currentMeshIndexRef.current].name}`
                    );
                }

                console.log(
                    'Total meshes loaded:',
                    targetMeshesRef.current.length
                );
            } catch (error) {
                console.error('Error loading models:', error);
            }
        };

        if (sceneRef.current) {
            loadModels();
        }
    }, [modelName, modelScaling, modelRotation]);

    return <canvas ref={canvasRef} className="w-full h-full" />;
}
