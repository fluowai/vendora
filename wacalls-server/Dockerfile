FROM golang:1.26-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o wacalls-server .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/wacalls-server .

EXPOSE 8080 8081
ENTRYPOINT ["/app/wacalls-server"]
CMD ["-addr", ":8080", "-db", "/data/wacalls.db"]
