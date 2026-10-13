FROM node:24-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /app/dist /usr/share/nginx/html
EXPOSE 8080

FROM python:3.13-alpine AS api
WORKDIR /app
COPY server/app.py server/accounts.py server/manage_accounts.py server/
RUN mkdir -p /data && chown 65534:65534 /data
COPY src/data/missions.json src/data/missions.json
USER 65534:65534
ENV DATA_DIR=/data HOST=0.0.0.0 PORT=8787 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8787
CMD ["python", "server/app.py"]

FROM python:3.13-alpine AS runner
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY server/runner.py server/jobs.py server/
COPY src/data/missions.json src/data/missions.json
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8788
CMD ["python", "server/runner.py"]

# Optional execution image; build on the same dedicated daemon used by the runner.
FROM python:3.13-alpine AS bash-lab
RUN apk add --no-cache bash coreutils
USER 65534:65534
