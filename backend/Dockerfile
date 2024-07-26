# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
# ARG BUN_VERSION=1.1.9
# FROM oven/bun:${BUN_VERSION}-slim as base

FROM node:18-slim as base

LABEL fly_launch_runtime="Bun/Prisma"

# Bun/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential openssl pkg-config python-is-python3 curl

RUN npm install -g bun 

# Install node modules
COPY --link bun.lockb package.json ./
RUN bun install --ci

# Generate Prisma Client
COPY --link prisma .
RUN bunx prisma generate

# Copy application code
COPY --link . .


# Final stage for app image
FROM base

RUN npm install -g bun 

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl curl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "bun", "run", "start" ]
