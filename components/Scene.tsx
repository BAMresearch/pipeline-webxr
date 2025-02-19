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

interface SceneProps {
    modelName: string
    modelScaling: number
}

export default function Scene({modelName, modelScaling}: SceneProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    registerBuiltInLoaders();

    useEffect(() => {
        if (!canvasRef.current) return

        const engine = new Engine(canvasRef.current, true)
        const scene = new BabylonScene(engine)

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene)
        camera.attachControl(canvasRef.current, true)

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)

        const floor = BABYLON.MeshBuilder.CreateGround("floor", {width: 6, height: 6}, scene);

        const xr = scene.createDefaultXRExperienceAsync({
            floorMeshes: [floor],
            uiOptions: {
                sessionMode: "immersive-ar",
            },
            optionalFeatures: true,
        }).then((xr) => {
            addControllerObservable(xr)
        }, (error) => {
            console.error("Error creating XR experience:", error)
        });

        /* Add controller observable */
        const addControllerObservable = (xr: WebXRDefaultExperience) => xr.input.onControllerAddedObservable.add((inputSource) => {
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


        const loadModel = async () => {
            try {
                const {data} = supabase.storage.from("models/public").getPublicUrl(modelName)

                console.log("public url", data.publicUrl)
                await BABYLON.AppendSceneAsync(data.publicUrl, scene);

                for (const mesh of scene.meshes) {
                    mesh.scaling = new Vector3(modelScaling, modelScaling, modelScaling)
                }
                floor.scaling = new Vector3(1, 1, 1)

            } catch (error) {
                console.error("Error loading model:", error)
            }
        }

        loadModel()

        engine.runRenderLoop(() => {
            scene.render()
        })

        const resizeHandler = () => {
            engine.resize()
        }

        window.addEventListener("resize", resizeHandler)

        return () => {
            window.removeEventListener("resize", resizeHandler)
            engine.dispose()
        }
    }, [modelName, modelScaling, supabase])

    return <canvas ref={canvasRef} className="w-full h-full"/>
}