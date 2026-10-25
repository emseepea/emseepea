FROM docker.io/library/node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS build
WORKDIR /app
COPY . .
RUN test "$(node --version)" = "v24.22.1" \
  && test -f package-lock.json \
  && npm ci --ignore-scripts \
  && npm run build \
  && npm prune --omit=dev --ignore-scripts

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:78f07ef1b5ea71ad7c055df15d0dd8997f2d288f9158623c4d4ae3d765b7d50d
WORKDIR /app
ENV EMSEEPEA_DEPLOYMENT_MODE=production-behind-proxy
COPY --from=build --chown=65532:65532 /app/package.json ./package.json
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/dist ./dist
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["/nodejs/bin/node", "-e", "const port=process.env.PORT||'3000';fetch(`http://127.0.0.1:${port}/healthz`).then((r)=>process.exit(r.ok?0:1),()=>process.exit(1));"]
CMD ["dist/server.js"]
