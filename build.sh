#! /usr/bin/env bash

./node_modules/.bin/browserify -s timeline -e ./src/index.js > ./dist/timeline.js
