FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci
RUN rm -rf apps/api/dist
RUN npm run build --workspace=@lambda/api
RUN test -f apps/api/dist/apps/api/src/main.js || (echo "ERROR: main.js not found!" && find apps/api/dist/ -name "*.js" | head -5 && exit 1)

EXPOSE 3001
CMD ["node", "/app/apps/api/dist/apps/api/src/main.js"]
