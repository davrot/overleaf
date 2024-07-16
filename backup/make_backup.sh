#!/bin/bash
rsync -avz --delete -e "ssh -i /root/backup/backup" /root overleaf@backup.zfn.uni-bremen.de:/home/overleaf/backup_root/root

# Set variables
REMOTE_USER="overleaf"
REMOTE_HOST="backup.zfn.uni-bremen.de"
REMOTE_DIR="/home/overleaf/backup_docker"
SSH_KEY="/root/backup/backup"
EXCLUDED_VOLUME="overleafserver_overleaf_tex2024"

# Get list of all Docker volumes, excluding the specified volume
volumes=$(docker volume ls --format "{{.Name}}" | grep -v "^$EXCLUDED_VOLUME$")

# Backup each volume
for volume in $volumes
do
    echo "Backing up volume: $volume"
    
    # Create a new container from busybox image, mount the volume and tar it up,
    # then pipe it directly to the remote server via SSH
    docker run --rm -v $volume:/volume busybox tar cf - /volume | \
    ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "cat > $REMOTE_DIR/$volume.tar"

    echo "Finished backing up $volume"
done

echo "Backup completed"
