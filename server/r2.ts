import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "topsel-images";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  category: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const timestamp = Date.now();
  const storagePath = `${category}/${timestamp}-${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storagePath,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const publicUrl = `${PUBLIC_URL}/${storagePath}`;
  return { storagePath, publicUrl };
}

export async function deleteImage(storagePath: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storagePath,
    })
  );
}

export async function listImages(prefix?: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    })
  );

  return response.Contents?.map((item) => item.Key || "") || [];
}

export function getPublicUrl(storagePath: string): string {
  return `${PUBLIC_URL}/${storagePath}`;
}
