#!/bin/bash

# List of expected container names
expected_containers=("overleafregister" "overleafnginx" "overleafserver" "overleafredis" "overleafmongo")

# Email settings
recipient="overleaf@uni-bremen.de"
subject="Docker Container Alert"

# Check containers
for container in "${expected_containers[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^$container$"; then
        echo "Container $container is not running" | mail -s "$subject" "$recipient"
    fi
done

