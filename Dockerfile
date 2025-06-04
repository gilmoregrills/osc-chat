# Stage 1: Build
FROM node:18 AS builder

WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package.json ./
COPY package-lock.json* ./

# The .yarnrc lines are specific to yarn, will be no-op for npm.
# If there was an .npmrc for the client, it would go here.
# COPY src/client/.yarnrc ./src/client/

# Install all dependencies (including devDependencies)
# Using --legacy-peer-deps as a precaution for complex dependency trees.
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run compile

# Build client-side assets using Webpack
RUN npm run build

# Stage 2: Production
FROM node:18-slim

WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) for production dependencies
COPY package.json ./
COPY package-lock.json* ./

# COPY src/client/.yarnrc ./src/client/ # No-op for npm

# Install only production dependencies using npm ci for consistency if package-lock.json is present
# --omit=dev is the standard way to exclude devDependencies with npm install.
# --ignore-scripts can be a security measure if no runtime scripts are needed from dependencies.
RUN npm install --omit=dev --ignore-scripts

# Copy compiled server code (from tsc) and client assets (from webpack) from builder stage
# The 'dist' directory should now contain 'ts/' (server code) and 'bundle.js' etc. (client assets)
COPY --from=builder /usr/src/app/dist ./dist

# Expose necessary ports
EXPOSE 8080 8081 57121/udp

# Define the command to run the application
# package.json's main field is 'dist/ts/server/index.js'
CMD ["node", "dist/ts/server/index.js"]
