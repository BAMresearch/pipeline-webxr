import * as GUI from '@babylonjs/gui';

const SELECTED_COLOR = '#ed5aff';
const DEFAULT_COLOR = '#333333';

class MenuUtils {
    /**
     * Recursively searches through a menu's controls to find a control by name
     * @param menu The menu or container to search through
     * @param controlName The name of the control to find
     * @returns The found control or null if not found
     */
    static findControlByName(
        menu: GUI.AdvancedDynamicTexture | GUI.Container | null,
        controlName: string
    ): GUI.Control | null {
        if (!menu) return null;

        // Check direct children first
        const children =
            menu instanceof GUI.AdvancedDynamicTexture
                ? menu.getChildren()
                : menu.children;

        for (const control of children) {
            // Check if this is the control we're looking for
            if (control.name === controlName) {
                return control;
            }

            // If it's a container, search its children recursively
            if (control instanceof GUI.Container) {
                const found = this.findControlByName(control, controlName);
                if (found) {
                    return found;
                }
            }
        }

        // Not found in this branch
        return null;
    }

    /**
     * Finds all controls of a specific type in a menu
     * @param menu The menu or container to search through
     * @param type The constructor function of the control type to find
     * @returns Array of controls matching the specified type
     */
    static findControlsByType<T extends GUI.Control>(
        menu: GUI.AdvancedDynamicTexture | GUI.Container,
        type: new (...args: any[]) => T
    ): T[] {
        const result: T[] = [];

        // Function to recursively search containers
        const searchContainer = (container: GUI.Container) => {
            for (const control of container.children) {
                if (control instanceof type) {
                    result.push(control as T);
                }

                if (control instanceof GUI.Container) {
                    searchContainer(control);
                }
            }
        };

        // Handle both AdvancedDynamicTexture and Container cases
        if (menu instanceof GUI.AdvancedDynamicTexture) {
            for (const control of menu.getChildren()) {
                if (control instanceof type) {
                    result.push(control as T);
                }

                if (control instanceof GUI.Container) {
                    searchContainer(control);
                }
            }
        } else {
            searchContainer(menu);
        }

        return result;
    }

    /**
     * Creates simulation type buttons for both menu types
     * @param scene - The current Babylon.js scene
     * @param fullscreenUI - The fullscreen UI for non-VR mode
     * @param spacialUI - The spatial UI for VR mode
     * @param simulationTypes - Array of simulation type names
     * @param currentSimulationType - The currently selected simulation type
     * @param switchSimulationType - Function to call when a simulation type is selected
     */
    static createSimulationTypeButtons(
        fullscreenUI: GUI.AdvancedDynamicTexture | null,
        spacialUI: GUI.AdvancedDynamicTexture | null,
        simulationTypes: string[],
        currentSimulationType: string,
        switchSimulationType: (typeName: string) => void
    ): void {
        // Only create if we have types to display
        if (!simulationTypes || simulationTypes.length === 0) {
            console.log('No simulation types available to create buttons for');
            return;
        }

        console.log('Creating buttons for simulation types:', simulationTypes);

        // Get container elements from both UIs
        const fullscreenSimContainer = this.findControlByName(
            fullscreenUI,
            'simulationTypesContainer'
        ) as GUI.StackPanel;

        console.debug('fullscreenSimContainer', fullscreenSimContainer);
        const spacialSimContainer = this.findControlByName(
            spacialUI,
            'simulationTypesContainer'
        ) as GUI.StackPanel;

        // Clear existing buttons first
        if (fullscreenSimContainer) {
            fullscreenSimContainer.clearControls();
        }

        if (spacialSimContainer) {
            spacialSimContainer.clearControls();
        }

        // Create a header for the simulation types section
        if (fullscreenSimContainer) {
            const header = new GUI.TextBlock();
            header.text = 'Simulation Types';
            header.color = 'white';
            header.height = '30px';
            header.fontSize = 16;
            header.fontWeight = 'bold';
            fullscreenSimContainer.addControl(header);
        }

        if (spacialSimContainer) {
            const header = new GUI.TextBlock();
            header.text = 'Simulation Types';
            header.color = 'white';
            header.height = '100px';
            header.fontSize = 104;
            header.fontWeight = 'bold';
            spacialSimContainer.addControl(header);
        }

        // Create a button for each simulation type
        simulationTypes.forEach((typeName) => {
            // Create button for fullscreen UI
            if (fullscreenSimContainer) {
                const button = GUI.Button.CreateSimpleButton(
                    `type_${typeName}_fullscreen`,
                    typeName
                );
                button.width = '100px';
                button.height = '40px';
                button.color = 'white';
                button.cornerRadius = 8;
                button.thickness = 1;
                button.background =
                    typeName === currentSimulationType
                        ? SELECTED_COLOR
                        : DEFAULT_COLOR;
                button.horizontalAlignment =
                    GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

                // Add click event
                button.onPointerUpObservable.add(() => {
                    // Update visuals for all buttons
                    fullscreenSimContainer.children.forEach((control) => {
                        if (control instanceof GUI.Button) {
                            control.background =
                                control.name === `type_${typeName}_fullscreen`
                                    ? SELECTED_COLOR
                                    : DEFAULT_COLOR;
                        }
                    });

                    // Switch to this simulation type
                    switchSimulationType(typeName);
                });
                fullscreenSimContainer.addControl(button);
            }

            // Create button for spatial UI (VR)
            if (spacialSimContainer) {
                const button = GUI.Button.CreateSimpleButton(
                    `type_${typeName}_spacial`,
                    typeName
                );
                button.width = '60%';
                button.height = '100px';
                button.color = 'white';
                button.cornerRadius = 8;
                button.thickness = 1;
                button.background =
                    typeName === currentSimulationType
                        ? SELECTED_COLOR
                        : DEFAULT_COLOR;
                button.horizontalAlignment =
                    GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

                // Add click event
                button.onPointerUpObservable.add(() => {
                    // Update visuals for all buttons
                    spacialSimContainer.children.forEach((control) => {
                        if (control instanceof GUI.Button) {
                            control.background =
                                control.name === `type_${typeName}_spacial`
                                    ? SELECTED_COLOR
                                    : DEFAULT_COLOR;
                        }
                    });

                    // Switch to this simulation type
                    switchSimulationType(typeName);
                });

                spacialSimContainer.addControl(button);
            }
        });
    }

    /**
     * Updates the highlight on the current simulation type button
     * @param fullscreenUI - The fullscreen UI for non-VR mode
     * @param spacialUI - The spatial UI for VR mode
     * @param currentSimulationType - The currently selected simulation type
     */
    static updateSimulationTypeButtonHighlight(
        fullscreenUI: GUI.AdvancedDynamicTexture | null,
        spacialUI: GUI.AdvancedDynamicTexture | null,
        currentSimulationType: string
    ): void {
        const fullscreenSimContainer = this.findControlByName(
            fullscreenUI,
            'simulationTypesContainer'
        ) as GUI.StackPanel;
        const spacialSimContainer = this.findControlByName(
            spacialUI,
            'simulationTypesContainer'
        ) as GUI.StackPanel;

        // Update fullscreen UI buttons
        if (fullscreenSimContainer) {
            fullscreenSimContainer.children.forEach((control) => {
                if (control instanceof GUI.Button) {
                    const buttonNameParts = control.name?.split('_');
                    if (!buttonNameParts) {
                        console.warn(
                            `Button name is not in the expected format: ${control.name}`
                        );
                        return;
                    }
                    if (buttonNameParts.length >= 2) {
                        const buttonTypeName = buttonNameParts[1]; // Extract type name from button name
                        control.background =
                            buttonTypeName === currentSimulationType
                                ? SELECTED_COLOR
                                : DEFAULT_COLOR;
                    }
                }
            });
        }

        // Update spatial UI buttons
        if (spacialSimContainer) {
            spacialSimContainer.children.forEach((control) => {
                if (control instanceof GUI.Button) {
                    const buttonNameParts = control.name?.split('_');
                    if (!buttonNameParts) {
                        console.warn(
                            `Button name is not in the expected format: ${control.name}`
                        );
                        return;
                    }
                    if (buttonNameParts.length >= 2) {
                        const buttonTypeName = buttonNameParts[1]; // Extract type name from button name
                        control.background =
                            buttonTypeName === currentSimulationType
                                ? SELECTED_COLOR
                                : DEFAULT_COLOR;
                    }
                }
            });
        }
    }

    /**
     * Creates or ensures a container exists for simulation type buttons
     * @param ui - The UI to create the container in
     * @param containerName - Name for the container
     * @param parentName - Name of the parent control to add the container to
     * @returns The created or existing container
     */
    static ensureSimulationTypeContainer(
        ui: GUI.AdvancedDynamicTexture | null,
        containerName: string = 'simulationTypesContainer',
        parentName: string = 'mainPanel'
    ): GUI.StackPanel | null {
        if (!ui) return null;

        // Check if container already exists
        let container = this.findControlByName(
            ui,
            containerName
        ) as GUI.StackPanel;

        if (!container) {
            // Find parent to add container to
            const parent = this.findControlByName(
                ui,
                parentName
            ) as GUI.Container;

            if (!parent) {
                console.warn(`Parent control '${parentName}' not found in UI`);
                return null;
            }

            // Create new container
            container = new GUI.StackPanel();
            container.name = containerName;
            container.width = '100%';
            container.height = '300px';
            container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

            // Add to parent
            parent.addControl(container);
            console.log(`Created simulation type container in ${parentName}`);
        }

        return container;
    }
}

export default MenuUtils;
