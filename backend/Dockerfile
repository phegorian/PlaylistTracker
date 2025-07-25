# Stage 1: Build the Node.js application
FROM node:24-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Stage 2: Run the Node.js application
FROM node:24-alpine

WORKDIR /app

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js .
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/models ./models
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/services ./services

# Expose the port your backend runs on (e.g., 5000)
EXPOSE 5000

# Command to run the application
CMD ["node", "server.js"]