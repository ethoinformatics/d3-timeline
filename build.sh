#! /usr/bin/env bash

./node_modules/.bin/browserify -t node-lessify -s timeline -e ./src/index.js > ./dist/timeline.js
