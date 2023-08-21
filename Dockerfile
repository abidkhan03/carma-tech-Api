# FROM 395929101814.dkr.ecr.us-east-2.amazonaws.com/nestjs-application:latest

# # Run app in container
# EXPOSE 3000

# COPY . .

# # install node modules
# RUN yarn && yarn build

# CMD ["yarn", "start:prod"]

FROM node:lts-alpine

WORKDIR /app

ENV NODE_ENV production
COPY package.json yarn.lock ./

# install dev dependencies too
RUN set -x && yarn install --prod=false --verbose

COPY . .
RUN set -x && yarn run prestart:prod

EXPOSE 3000

CMD [ "node", "-r", "./tsconfig-paths-bootstrap.js" ,"dist/main.js" ]