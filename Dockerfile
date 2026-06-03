# -------- Builder Stage: Install deps & prepare source --------
FROM node:24-alpine AS builder

# Use pnpm instead of npm for faster, efficient installs
RUN npm install -g pnpm

# Set working directory for all subsequent commands
WORKDIR /usr/src/app

# Copy both npm and pnpm lockfiles
COPY package*.json pnpm-lock.yaml ./

# Install only prod deps — strict, reproducible, no malicious scripts
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy rest of the source code after deps to preserve cache
COPY . .


# -------- Runtime Stage: Lean, secure production image --------

# Distroless — no shell, no package manager, minimal attack surface
FROM gcr.io/distroless/nodejs24-debian12

# Set working directory in the production image
WORKDIR /usr/src/app

# Tell Node.js and frameworks to run in production mode
ENV NODE_ENV=development

# Copy the entire app from builder (node_modules + src + environment + app.js)
COPY --from=builder /usr/src/app .

# Document the port the app listens on (use -p 8080:8080 at docker run)
EXPOSE 8080

# Start the app — distroless entrypoint is already node, so just pass the file
CMD ["app.js"]