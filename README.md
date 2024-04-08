I bassed the installation on Fedora 39 Server Edition.

* Ansible will not work as long as SE Linux is active. Use the cockpit localhost:9090 to disable it for duration you need it to be tured off.
* Don't forget to configure the firewalls correctly. Again, use cockpit.
* Portainer is exported to port 9443. You should use it for coordinating the docker chaos. 

# How make a computer ready for ansible

```
dnf -y install ansible mc net-tools openssh-server openssh-clients passwdqc cracklib-dicts shadow-utils

systemctl enable sshd
systemctl start sshd

useradd -b /specialusers ansibleuser
passwd_value="PUT_A_PASSWORD_HERE"
echo ansibleuser:$passwd_value | chpasswd
echo "ansibleuser ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/ansible
```

# How to make the server ready

Once:
```
dnf -y install ansible mc net-tools openssh-server openssh-clients passwdqc cracklib-dicts shadow-utils sshpass

ssh-keygen
```

And then for every computer:

```
passwd_value="PUT_A_PASSWORD_HERE"
sshpass -p "$passwd_value" ssh-copy-id -o "StrictHostKeyChecking accept-new" ansibleuser@COMPUTERNAME
```

