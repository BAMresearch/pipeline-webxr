import { AbstractMesh } from '@babylonjs/core';

export interface SimulationResult {
    type: string;
    meshes: AbstractMesh[];
    currentIndex: number;
}
