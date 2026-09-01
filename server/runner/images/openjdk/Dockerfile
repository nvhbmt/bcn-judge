# bcnjudge-runner-openjdk (design.md §3.1, mức S).
# Build từ thư mục runner/images: docker build -t bcnjudge-runner-openjdk:17 -f openjdk/Dockerfile .
FROM eclipse-temurin:17-jdk-noble

RUN apt-get update && apt-get install -y --no-install-recommends \
      time procps util-linux \
 && rm -rf /var/lib/apt/lists/*

# Sandbox chạy với PATH tối thiểu /usr/local/bin:/usr/bin:/bin (§3.2), còn image
# temurin để JDK ở /opt/java/openjdk/bin — thiếu link này thì javac "not found" và
# MỌI bài Java thành CE(127). Quy ước: runner image tự đưa toolchain lên PATH
# chuẩn, đừng nới PATH của sandbox cho từng ngôn ngữ.
RUN ln -sf /opt/java/openjdk/bin/javac /usr/bin/javac \
 && ln -sf /opt/java/openjdk/bin/java  /usr/bin/java

COPY common/run.sh /opt/judge/run.sh
RUN chown 0:0 /opt/judge/run.sh && chmod 0700 /opt/judge/run.sh

WORKDIR /w
CMD ["sleep", "infinity"]
