# Use the latest LTS version of Node.js
FROM node:18
 
# Set the working directory inside the container
WORKDIR /backend
 
# Copy package.json and package-lock.json
COPY package*.json ./
 
# Install dependencies
RUN npm install
 
# Copy the rest of your application files
COPY . .
 
# Expose the port your app runs on
EXPOSE 8787
 
# Define the command to run your app
CMD ["npm", "run", "dev"]