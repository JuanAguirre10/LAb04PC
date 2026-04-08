FROM ghcr.io/puppeteer/puppeteer:21.0.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

USER root
WORKDIR /app

COPY package.json .
RUN npm install

COPY src/ ./src/
RUN mkdir -p uploads && chown -R pptruser /app

USER pptruser

EXPOSE 3000
CMD ["node", "src/app.js"]
