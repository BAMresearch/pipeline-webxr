import { supabase } from "@/lib/supabase";

/**
 * Utility class for Supabase storage operations
 */
class SupabaseUtils {
  /**
   * List files in a storage bucket
   * @param bucketName - Name of the bucket to list files from
   * @param folderPath - Path of the folder within the bucket (optional)
   * @param options - Additional options for listing files
   * @returns A promise with the list results
   */
  static async listFiles(
    bucketName: string,
    folderPath: string = "",
    options: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: "asc" | "desc" };
    } = {},
  ) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath, options);

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export default SupabaseUtils;
