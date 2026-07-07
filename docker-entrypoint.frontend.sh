#!/bin/sh
set -e

API_BACKEND_URL="${API_BACKEND_URL:-http://app:3333}"

export API_BACKEND_URL

envsubst '${API_BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
