# bcnjudge-runner-python (design.md §3.1)
# Build từ thư mục runner/images:  docker build -t bcnjudge-runner-python:3.12 -f python/Dockerfile .
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      time procps util-linux \
 && rm -rf /var/lib/apt/lists/*

COPY common/run.sh /opt/judge/run.sh
RUN chown 0:0 /opt/judge/run.sh && chmod 0700 /opt/judge/run.sh

WORKDIR /w
CMD ["sleep", "infinity"]
