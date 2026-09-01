# bcnjudge-runner-node (design.md §3.1, mức S).
# Build từ thư mục runner/images: docker build -t bcnjudge-runner-node:20 -f node/Dockerfile .
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      time procps util-linux \
 && rm -rf /var/lib/apt/lists/*

COPY common/run.sh /opt/judge/run.sh
RUN chown 0:0 /opt/judge/run.sh && chmod 0700 /opt/judge/run.sh

WORKDIR /w
CMD ["sleep", "infinity"]
