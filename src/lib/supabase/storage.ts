import { supabase } from "./client";

export interface TaskSubmissionFileResult {
    signed_file_url: string;
    file_name: string;
}

export async function uploadTaskSubmissionFile(
    taskId: string,
    file: File,
): Promise<TaskSubmissionFileResult> {
    // Upload to task-submissions/{taskId}/{filename}
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `task-submissions/${taskId}/${fileName}`;

    const { data, error } = await supabase.storage
        .from("task-submissions")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
        });

    if (error) {
        console.error("Upload error:", error);
        throw new Error(`File upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from("task-submissions")
        .getPublicUrl(filePath);

    return {
        signed_file_url: publicUrl,
        file_name: fileName,
    };
}

export async function deleteTaskSubmissionFile(
    taskId: string,
    fileName: string,
): Promise<void> {
    const filePath = `task-submissions/${taskId}/${fileName}`;

    const { error } = await supabase.storage
        .from("task-submissions")
        .remove([filePath]);

    if (error) {
        console.error("Delete error:", error);
        throw new Error(`File delete failed: ${error.message}`);
    }
}

export interface AssetImageUploadResult {
    public_url: string;
    file_path: string;
}

export async function uploadAssetImage(
    organizationId: string,
    assetId: string,
    file: File,
    type: 'asset' | 'site',
): Promise<AssetImageUploadResult> {
    // Upload to asset-images/{organizationId}/{assetId}/{type}/{filename}
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${organizationId}/${assetId}/${type}/${fileName}`;

    const { data, error } = await supabase.storage
        .from("asset-images")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
        });

    if (error) {
        console.error("Upload error:", error);
        throw new Error(`Image upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from("asset-images")
        .getPublicUrl(filePath);

    return {
        public_url: publicUrl,
        file_path: filePath,
    };
}

export async function deleteAssetImage(filePath: string): Promise<void> {
    const { error } = await supabase.storage
        .from("asset-images")
        .remove([filePath]);

    if (error) {
        console.error("Delete error:", error);
        throw new Error(`Image delete failed: ${error.message}`);
    }
}
