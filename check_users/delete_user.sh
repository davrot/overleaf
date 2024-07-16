#!/bin/bash

if [ -z "$1" ]; then
    echo "Error: Email address not provided"
    echo "Usage: $0 <email_address>"
    exit 1
fi

docker exec overleafserver /bin/bash -ce "cd /overleaf/services/web && node modules/server-ce-scripts/scripts/delete-user --email=$1"
