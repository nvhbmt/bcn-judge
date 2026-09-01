FROM caddy:2-alpine
# SPA build tĩnh được deploy script copy vào /srv/spa (§9).
RUN mkdir -p /srv/spa
