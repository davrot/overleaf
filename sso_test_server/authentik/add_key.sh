echo "AUTHENTIK_SECRET_KEY=$(openssl rand 60 | base64 -w 0)" >> .env

