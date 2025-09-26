#!/bin/bash
cd "$(dirname "$0")"
exec node ../dist/runtime/stdio-entry.js
