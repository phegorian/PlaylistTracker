# frontend/Dockerfile

# Stage 1: Build the React application
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Declare an argument to capture the build-time variable
ARG REACT_APP_BACKEND_URL

# Set it as an environment variable for the subsequent build commands
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80 (default for Nginx HTTP)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]