import * as BABYLON from '@babylonjs/core';
import { SimulationResult } from '@/components/SimulationResult';

class MeshUtils {
    /**
     * Centers the pivot point of a mesh to its bounding box center
     * @param mesh - The mesh to center the pivot for
     */
    public static centerPivot(mesh: BABYLON.AbstractMesh): void {
        const boundingInfo = mesh.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;
        const center = boundingBox.center;
        console.log('center pivot', center);
        mesh.setPivotPoint(center);
        mesh.position.subtractInPlace(center);
    }

    /**
     * Finds a mesh by name in the scene
     * @param scene - The scene to search in
     * @param name - The name of the mesh to find
     * @returns The found mesh or null if not found
     */
    public static findMeshByName(
        scene: BABYLON.Scene,
        name: string
    ): BABYLON.AbstractMesh | null {
        return scene.getMeshByName(name);
    }

    /**
     * Finds meshes that match a naming pattern
     * @param scene - The scene to search in
     * @param pattern - The regex pattern to match against mesh names
     * @returns Array of meshes that match the pattern
     */
    public static findMeshesByPattern(
        scene: BABYLON.Scene,
        pattern: RegExp
    ): BABYLON.AbstractMesh[] {
        return scene.meshes.filter((mesh) => pattern.test(mesh.name));
    }

    /**
     * Recursively searches for a mesh in a hierarchy
     * @param rootMesh - The root mesh to start searching from
     * @param targetName - The name of the mesh to find
     * @returns The found mesh or null if not found
     */
    public static findNestedMesh(
        rootMesh: BABYLON.AbstractMesh,
        targetName: string
    ): BABYLON.AbstractMesh | null {
        if (rootMesh.name === targetName) return rootMesh;

        for (const child of rootMesh.getChildMeshes()) {
            const result = this.findNestedMesh(child, targetName);
            if (result) return result;
        }

        return null;
    }

    /**
     * Creates and assigns a standard material to a mesh
     * @param mesh - The mesh to set the material to
     * @param scene - The scene the mesh belongs to
     * @param name - Name for the new material
     * @param color - Color for the material (optional)
     * @returns The created material
     */
    public static createAndSetStandardMaterial(
        mesh: BABYLON.AbstractMesh,
        scene: BABYLON.Scene,
        name: string,
        color?: BABYLON.Color3
    ): BABYLON.StandardMaterial {
        const material = new BABYLON.StandardMaterial(name, scene);

        if (color) {
            material.diffuseColor = color;
        }

        mesh.material = material;
        return material;
    }

    public static moveSimulationResultMeshes(
        result: SimulationResult,
        vector: BABYLON.Vector3
    ) {
        for (const mesh of result.meshes) {
            mesh.position.addInPlace(vector);
        }
    }
}

export default MeshUtils;
