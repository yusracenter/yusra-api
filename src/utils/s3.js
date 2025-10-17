import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const BUCKET = process.env.STORAGE_S3_BUCKET;

export const s3 = new S3Client({
	region: process.env.STORAGE_AWS_REGION,
	credentials: {
		accessKeyId: process.env.STORAGE_AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.STORAGE_AWS_SECRET_ACCESS_KEY,
	},
});

export async function getPresignedGetUrl(key, expiresIn = 300) {
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });

	return await getSignedUrl(s3, command, { expiresIn });
}
