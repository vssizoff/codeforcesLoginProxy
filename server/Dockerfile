FROM oven/bun:latest

WORKDIR /app

COPY ./package.json ./
COPY ./tsconfig.json ./
COPY ./index.ts ./
COPY ./db.ts ./

RUN bun i

CMD bun ./index.ts