# Yusra API

## 🚀 Getting Started

### 1. Clone the repository

```bash
https://github.com/yusracenter/yusra-api.git
cd yusra-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create a `.env` file in the root directory and add the following values:

```env
MONGO_URI=your_mongodb_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
SIGNING_SECRET=your_signing_secret
CLIENT_URL=your_client_url
PORT=port
STRIPE_SECRET_KEY=your_stripe_secret_key

```

### 4. Run the development server

```bash
npm run dev
```

## Access the API
The API should be accessible at: `https://api.yusracenter.org/` or `http://localhost:8080/`.

## Deployment
The application is containerized using Docker and deployed with GitHub Actions to AWS ECS. 
The AWS details to push the images are stored within Gihub Secrets. The environment variables for the application are managed in AWS ECS.
To deploy the application, push your changes to the `main` branch. The GitHub Actions workflow will automatically build and deploy the Docker image to AWS ECS.

## Locally running with Docker
1. `docker buildx create --use` Sets up Docker Buildx for building multi-platform images (needed for ARM based CPUs - AWS ECS Graviton)
2. `docker buildx build --platform linux/arm64 -t yusra-api --load .` = Builds the Docker image (tagged as yusra-api) for ARM64 architectures.
3. `docker run -p 80:8080 --env-file .env yusra-api` = Runs the Docker container (tagged latest), passes the env variables from .env file and mapping port 8080 of the container to port 80 on the host machine.

## Pushing to AWS ECR (if needed, not needed in most cases because of github actions)
1. `aws configure` - will log you in
2. `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 535574334800.dkr.ecr.us-east-1.amazonaws.com` - Logs into AWS ECR
3. `docker buildx build --platform linux/arm64 -t 535574334800.dkr.ecr.us-east-1.amazonaws.com/dev:latest --push .` - builds image with tag dev:latest and pushes it to AWS ECR
