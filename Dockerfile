FROM node:24-alpine3.21

# Set working directory for the app
WORKDIR /usr/src/app

# Copy all files to the container
COPY . .

# install dependencies
RUN npm install
RUN npm run build

# Expose the port that the application will use
EXPOSE 3000

CMD ["npm", "start"]
