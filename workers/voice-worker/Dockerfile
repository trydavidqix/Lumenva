FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY *.mjs ./
ENV NODE_ENV=production
EXPOSE 8080 8081
CMD ["node", "main.mjs"]
