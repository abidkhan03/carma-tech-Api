#!/bin/bash

cd ..

zip -r nest-docker-app.zip . -x "scripts/*" -x "node_modules/*" -x "dist/*"