import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

if (!process.env.R2_ENDPOINT) {
  console.warn("R2_ENDPOINT not configured - R2 storage will not work");
}
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.warn("R2 credentials not configured - R2 storage will not work");
}
if (!process.env.R2_PUBLIC_URL) {
  console.warn("R2_PUBLIC_URL not configured - image URLs may be broken");
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "topsel-images";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

function generateImageName(originalFilename: string): string {
  const now = new Date();
  const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  
  const yearLast2Digits = seoulTime.getFullYear().toString().slice(-2);
  const month = (seoulTime.getMonth() + 1).toString().padStart(2, '0');
  const day = seoulTime.getDate().toString().padStart(2, '0');
  const randomSeq = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const uniqueSuffix = Date.now().toString().slice(-3);
  
  const ext = originalFilename.includes('.') 
    ? originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase()
    : '.jpg';
  
  return `${yearLast2Digits}${month}${day}${randomSeq}${uniqueSuffix}${ext}`;
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  category: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const newFilename = generateImageName(filename);
  const storagePath = `${category}/${newFilename}`;

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
