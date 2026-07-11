FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build
RUN git clone https://github.com/JotaDev66/WaCalls.git .

RUN go mod download
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o wacalls-server ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/wacalls-server .

EXPOSE 8080 8081
ENTRYPOINT ["/app/wacalls-server"]
CMD ["-addr", ":8080", "-db", "/data/wacalls.db"]
