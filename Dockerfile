FROM node:24-alpine3.21

RUN apk add --no-cache curl bash

# Set working directory for the app
WORKDIR /usr/src/app

# Copy all files to the container
COPY . .

# install dependencies
RUN npm install
RUN npm run build

# Expose the port that the application will use
EXPOSE 3000

# Add this near the top
COPY ./wait-and-start.sh ./wait-and-start.sh
RUN chmod +x ./wait-and-start.sh

# Change CMD to use the script
CMD ["./wait-and-start.sh"]
