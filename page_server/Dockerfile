# The site is static, so the final image is just nginx and the built folder.
#
# The build step needs the client sites that live beside this project, so
# build from the repository root:
#
#   docker build -f page_server/Dockerfile -t portfolio .
#   docker run --rm -p 8080:80 portfolio
#
# then open http://localhost:8080

FROM node:24-alpine AS build
WORKDIR /app
COPY page_server/ ./page_server/
COPY promptops-ai/ ./promptops-ai/
COPY omniprompt-marketing/ ./omniprompt-marketing/
COPY ai_business_plan.md ai_marketing_automation_business_plan.md ./
RUN node page_server/scripts/build.mjs

FROM nginx:stable-alpine
LABEL org.opencontainers.image.title="jfdiazbus portfolio" \
      org.opencontainers.image.description="ASCII portfolio, built to static files and served by nginx"
COPY page_server/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/page_server/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --quiet --spider http://127.0.0.1/ || exit 1
