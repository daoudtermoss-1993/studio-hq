import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "./env";

export interface Range {
  start: number;
  end: number; // inclusive
}

export interface Storage {
  put(key: string, body: Readable | Buffer, mime: string): Promise<number>;
  size(key: string): Promise<number>;
  read(key: string, range?: Range): Promise<Readable>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private root: string) {}
  private file(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("invalid key");
    return p;
  }
  async put(key: string, body: Readable | Buffer) {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await pipeline(Buffer.isBuffer(body) ? Readable.from(body) : body, createWriteStream(file));
    return (await stat(file)).size;
  }
  async size(key: string) {
    return (await stat(this.file(key))).size;
  }
  async read(key: string, range?: Range) {
    return createReadStream(this.file(key), range ? { start: range.start, end: range.end } : undefined);
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class S3Storage implements Storage {
  private s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY || "", secretAccessKey: process.env.S3_SECRET_KEY || "" },
  });
  private bucket = process.env.S3_BUCKET || "studio";
  async put(key: string, body: Readable | Buffer, mime: string) {
    await new Upload({ client: this.s3, params: { Bucket: this.bucket, Key: key, Body: body, ContentType: mime } }).done();
    return this.size(key);
  }
  async size(key: string) {
    const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return Number(head.ContentLength ?? 0);
  }
  async read(key: string, range?: Range) {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
    );
    return res.Body as Readable;
  }
  async remove(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  instance ??= env.storageDriver === "s3" ? new S3Storage() : new LocalStorage(path.resolve(env.storageDir));
  return instance;
}
