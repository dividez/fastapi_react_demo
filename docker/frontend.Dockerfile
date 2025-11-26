FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm@8

COPY frontend/package*.json ./
COPY frontend/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY frontend ./

ENV VITE_API_BASE_URL=http://localhost:8001
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
