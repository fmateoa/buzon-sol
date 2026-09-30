import { Readable } from "node:stream";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export class S3Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("S3 configuration is incomplete");
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, bytes: Buffer, mime: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: mime }));
  }

  async get(key: string): Promise<Readable> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!(response.Body instanceof Readable)) throw new Error("Object body is not a readable stream");
    return response.Body;
  }
}
