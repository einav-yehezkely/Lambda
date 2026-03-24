FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci
RUN npm run build --workspace=@lambda/api
RUN ls -la apps/api/dist/

EXPOSE 3001
CMD ["node", "/app/apps/api/dist/main.js"]
