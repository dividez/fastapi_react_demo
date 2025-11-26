FROM node:18-alpine

WORKDIR /app

COPY frontend/package*.json ./
COPY frontend/pnpm-lock.yaml ./pnpm-lock.yaml
RUN npm install

COPY frontend ./

ENV VITE_API_BASE_URL=http://localhost:8001
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
