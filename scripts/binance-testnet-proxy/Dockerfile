FROM node:20-alpine
WORKDIR /app
COPY server.mjs package.json ./
ENV PORT=8787
ENV BINANCE_UPSTREAM_URL=https://demo-fapi.binance.com
EXPOSE 8787
CMD ["node", "server.mjs"]
