# The JAR is built on the host (see README) rather than inside this image.
# This avoids flaky in-container Maven Central downloads and matches a
# common production pattern: build once, containerize the artifact.
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]