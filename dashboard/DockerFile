# In your dashboard/Dockerfile

# --- Build Stage ---
# Use a specific Node.js version on a slim base image
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files and install dependencies first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Define an argument for the API URL, which will be passed in during the build
ARG VITE_API_BASE_URL

# Set it as an environment variable for the build process
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the production-ready static files. They will be in /app/dist
RUN npm run build

# --- Serve Stage ---
# Use a lightweight and efficient Nginx server
FROM nginx:stable-alpine

# Copy the built static files from the 'builder' stage to the Nginx HTML directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration file
# This file is crucial for a Single Page Application (SPA) to work correctly
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080, which is the standard port Cloud Run listens on
EXPOSE 8080

# The default Nginx entrypoint will start the server, so no CMD is needed.