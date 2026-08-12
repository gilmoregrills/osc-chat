FROM node:22-alpine

RUN mkdir /app
ADD . /app
WORKDIR /app
RUN yarn

CMD ["yarn", "start"]
