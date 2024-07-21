Inside of the container (use sh for exec)

docker exec -it overleafredis sh

redis-cli config set appendonly yes
