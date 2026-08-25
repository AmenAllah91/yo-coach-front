FROM node:20.11.0 as build-step

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm install --force

COPY . .
RUN node --max_old_space_size=2048 ./node_modules/@angular/cli/bin/ng build --configuration=production

FROM nginx:alpine
COPY --from=build-step /app/dist/yo-coach /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
