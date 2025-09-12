# Fetching the minified node image on apline linux
FROM node:20-alpine

# Setting up the work directory
WORKDIR /service

# Install CURL for Health check
RUN apk --no-cache add curl

# Copying all the files in our project
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Installing dependencies
RUN npm ci --omit=dev

# Run as non-root
USER node

# Starting our application
CMD ["npm", "run", "start"]

# Wait 30 seconds before starting health check, then check every 30 seconds, with a timeout of 15 seconds and 3 retries
# Healthcheck: default to 8080 if PORT is unset
HEALTHCHECK --start-period=30s --interval=30s --timeout=15s --retries=3 \
  CMD curl -fail http://localhost:${PORT:-8080}/health || exit 1
