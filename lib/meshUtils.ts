import * as BABYLON from "@babylonjs/core"

class MeshUtils {

    public centerPivot(mesh: BABYLON.AbstractMesh): void {
        const boundingInfo = mesh.getBoundingInfo();

        const boundingBox = boundingInfo.boundingBox;
        const center = boundingBox.center;
        console.log("center pivot", center)

        mesh.setPivotPoint(center)
        mesh.position.subtractInPlace(center);
    }
}

export default MeshUtils