#!/bin/sh
set -eu

cd /app
node database.cjs migrate
exec node server.js
