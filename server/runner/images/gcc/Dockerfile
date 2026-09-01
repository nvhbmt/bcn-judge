# bcnjudge-runner-gcc — phục vụ c11 + cpp17 (design.md §3.1)
# Build từ thư mục runner/images:  docker build -t bcnjudge-runner-gcc:14 -f gcc/Dockerfile .
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ libc6-dev \
      time procps util-linux coreutils \
 && rm -rf /var/lib/apt/lists/*

COPY common/run.sh /opt/judge/run.sh
RUN chown 0:0 /opt/judge/run.sh && chmod 0700 /opt/judge/run.sh

WORKDIR /w
CMD ["sleep", "infinity"]
