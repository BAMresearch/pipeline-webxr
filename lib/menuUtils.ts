import * as GUI from "@babylonjs/gui"

class MenuUtils {
  /**
   * Recursively searches through a menu's controls to find a control by name
   * @param menu The menu or container to search through
   * @param controlName The name of the control to find
   * @returns The found control or null if not found
   */
  static findControlByName(menu: GUI.AdvancedDynamicTexture | GUI.Container, controlName: string): GUI.Control | null {
    // Check direct children first
    const children = menu instanceof GUI.AdvancedDynamicTexture ? menu.getChildren() : menu.children;

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
  static findControlsByType<T extends GUI.Control>(menu: GUI.AdvancedDynamicTexture | GUI.Container, type: new (...args: any[]) => T): T[] {
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
}

export default MenuUtils;
