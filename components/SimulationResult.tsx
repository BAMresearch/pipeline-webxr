import { AbstractMesh } from '@babylonjs/core';

/**
 * Interface for the result of a simulation
 * Contains the type of simulation and the meshes that were created,
 * also contains the current index of the simulation for advancing the time step
 * of the simulation
 */
export interface SimulationResult {
    type: string;
    meshes: AbstractMesh[];
    currentIndex: number;
}
