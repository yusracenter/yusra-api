import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export const BUCKET = process.env.STORAGE_S3_BUCKET;
const KEY = 'data/data.json';

export const s3 = new S3Client({
	region: process.env.STORAGE_AWS_REGION,
	credentials: {
		accessKeyId: process.env.STORAGE_AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.STORAGE_AWS_SECRET_ACCESS_KEY,
	},
});

export async function getPresignedGetUrl(key) {
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
	const ex = 60 * 60 * 24; // 1 day
	return await getSignedUrl(s3, command, { expiresIn: ex });
}

export async function uploadObject(file) {
	const fileExt = file.originalname.split('.').pop();
	const fileName = `${crypto.randomUUID()}.${fileExt}`;

	const uploadParams = {
		Bucket: BUCKET,
		Key: `uploads/${fileName}`,
		Body: file.buffer,
		ContentType: file.mimetype,
	};

	await s3.send(new PutObjectCommand(uploadParams));

	const fileUrl = `https://cdn.yusracenter.org/uploads/${fileName}`;

	return { fileName, fileUrl };
}

export const deleteObject = async key => {
	await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

	return { message: 'File deleted successfully', key };
};

async function streamToString(stream) {
	return await new Promise((resolve, reject) => {
		const chunks = [];
		stream.on('data', chunk => chunks.push(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	});
}

export async function readData() {
	try {
		const command = new GetObjectCommand({ Bucket: BUCKET, Key: KEY });
		const response = await s3.send(command);
		const text = await streamToString(
			response.Body instanceof Readable ? response.Body : Readable.from(response.Body)
		);
		return JSON.parse(text);
	} catch (err) {
		console.error('❌ readData error:', err);
		return { communities: [], slides: [] };
	}
}

export async function writeData(data) {
	try {
		const body = JSON.stringify(data, null, 2);
		const command = new PutObjectCommand({
			Bucket: BUCKET,
			Key: KEY,
			Body: body,
			ContentType: 'application/json',
		});
		await s3.send(command);
		console.log('✅ data.json updated in S3');
	} catch (err) {
		console.error('❌ writeData error:', err);
		throw err;
	}
}
