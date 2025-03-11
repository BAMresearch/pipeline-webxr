import { supabase } from '@/lib/supabase';

const TOP_LEVEL_FOLDER = 'public-combined';

/**
 * Utility class for Supabase storage operations
 */
class SupabaseUtils {
    /**
     * List files in a storage bucket
     * @param bucketName - Name of the bucket to list files from
     * @param folderPath - Path of the folder within the bucket DOES NOT INCLUDE THE TOP LEVEL FOLDER
     * @param options - Additional options for listing files
     * @returns A promise with the list results
     */
    static async listFiles(
        bucketName: string,
        folderPath: string = '',
        options: {
            limit?: number;
            offset?: number;
            sortBy?: { column: string; order: 'asc' | 'desc' };
        } = {}
    ) {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .list(`${TOP_LEVEL_FOLDER}/${folderPath}`, options);

            if (error) {
                throw error;
            }

            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    /**
     * List available models from the top level folder
     * @param bucketName - Name of the bucket
     * @returns A promise with the list of model folders
     */
    static async listModels(bucketName: string) {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .list(`${TOP_LEVEL_FOLDER}`);

            if (error) {
                throw error;
            }

            // Filter to only include folders (not files)
            const models = data.filter(
                (item) => item.id !== '.' && !item.name.includes('.')
            );
            return { data: models, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    /**
     * List available simulation types for a specific model
     * @param bucketName - Name of the bucket
     * @param modelName - Name of the model
     * @returns A promise with the list of simulation type folders
     */
    static async listSimulationTypes(bucketName: string, modelName: string) {
        try {
            const folderPath = `${TOP_LEVEL_FOLDER}/${modelName}`;
            const { data, error } = await supabase.storage
                .from(bucketName)
                .list(folderPath);

            if (error) {
                throw error;
            }

            // Filter to only include folders (not files)
            const simulationTypes = data.filter(
                (item) => item.id !== '.' && !item.name.includes('.')
            );
            return { data: simulationTypes, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    static async getPublicUrl(bucketName: string, filePath: string) {
        const response = supabase.storage
            .from(bucketName)
            .getPublicUrl(`${TOP_LEVEL_FOLDER}/${filePath}`);
        return response.data.publicUrl;
    }
}

export default SupabaseUtils;
