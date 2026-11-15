# The co-op server. Build from the endless-digging folder:  docker build -f server/Dockerfile -t endless-digging-server .
FROM node:22-slim
WORKDIR /app
COPY src/world.js src/rules.js src/deposits.js src/
COPY src/dem src/dem
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm install --omit=dev
COPY server server
ENV PORT=8790 DATA_DIR=/data
VOLUME /data
EXPOSE 8790
USER node
CMD ["node", "server/server.js"]
