import {
	S3Client,
	CreateMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	AbortMultipartUploadCommand,
	UploadPartCommand,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { config, r2Endpoint } from './config';

let _client: S3Client | null = null;

export function r2(): S3Client {
	if (_client) return _client;
	_client = new S3Client({
		region: 'auto',
		endpoint: r2Endpoint(),
		credentials: {
			accessKeyId: config.r2.accessKeyId,
			secretAccessKey: config.r2.secretAccessKey
		},
		// R2 requires path-style-compatible signing; the SDK handles this fine.
		forcePathStyle: false
	});
	return _client;
}

const BUCKET = () => config.r2.bucket;

/** Start a multipart upload and return its uploadId. */
export async function createMultipart(key: string, contentType: string): Promise<string> {
	const out = await r2().send(
		new CreateMultipartUploadCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType })
	);
	if (!out.UploadId) throw new Error('R2 did not return an UploadId');
	return out.UploadId;
}

/** Presigned URL for uploading a single part (PUT). Short-lived. */
export async function presignPart(
	key: string,
	uploadId: string,
	partNumber: number,
	expiresSec = 3600
): Promise<string> {
	const cmd = new UploadPartCommand({
		Bucket: BUCKET(),
		Key: key,
		UploadId: uploadId,
		PartNumber: partNumber
	});
	return getSignedUrl(r2(), cmd, { expiresIn: expiresSec });
}

/** Presigned single-shot PUT (for small files uploaded in one request). */
export async function presignPut(
	key: string,
	contentType: string,
	expiresSec = 3600
): Promise<string> {
	const cmd = new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType });
	return getSignedUrl(r2(), cmd, { expiresIn: expiresSec });
}

export async function completeMultipart(
	key: string,
	uploadId: string,
	parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
	await r2().send(
		new CompleteMultipartUploadCommand({
			Bucket: BUCKET(),
			Key: key,
			UploadId: uploadId,
			MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) }
		})
	);
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
	try {
		await r2().send(new AbortMultipartUploadCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId }));
	} catch {
		// best-effort cleanup
	}
}

export interface HeadInfo {
	size: number;
	contentType: string | undefined;
}

/** HEAD an object to confirm it exists and read its real size/type. */
export async function headObject(key: string): Promise<HeadInfo | null> {
	try {
		const out = await r2().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
		return { size: out.ContentLength ?? 0, contentType: out.ContentType };
	} catch {
		return null;
	}
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
	await r2().send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
	await r2().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}

/** Read an object as a Node stream (used by the thumbnail worker and ZIP export). */
export async function getObjectStream(key: string): Promise<Readable> {
	const out = await r2().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
	return out.Body as Readable;
}

/** Presigned GET for serving originals/thumbs to the browser without proxying bytes through VPS. */
export async function presignGet(key: string, expiresSec = 3600, downloadName?: string): Promise<string> {
	const cmd = new GetObjectCommand({
		Bucket: BUCKET(),
		Key: key,
		...(downloadName
			? { ResponseContentDisposition: `attachment; filename="${sanitizeFilename(downloadName)}"` }
			: {})
	});
	return getSignedUrl(r2(), cmd, { expiresIn: expiresSec });
}

function sanitizeFilename(name: string): string {
	return name.replace(/[^\w.\-() ]+/g, '_').slice(0, 180);
}
