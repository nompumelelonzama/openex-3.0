# Multi-stage build: compiles the JAR inside the image (needed for cloud
# builds like Render, which clone the repo fresh and don't have a
# pre-built build/libs/ directory on the host).
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN sed -i "s/\r$//" gradlew
RUN chmod +x gradlew
COPY src src
RUN ./gradlew build -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
