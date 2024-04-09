import docker


def identify_container(client, label: str = "overleaf") -> int | None:

    containers = client.containers.list(all=True)
    for container in containers:
        if str(container.name) == label:
            return container.id

    return None


def docker_exec(exec_command: str = "ls") -> tuple[bool, str]:
    client = docker.from_env()
    docker_id = identify_container(client)
    assert docker_id is not None
    container = client.containers.get(docker_id)
    command = f'/bin/bash -c "{exec_command}"'

    try:
        result = container.exec_run(command, stream=False)
        result_string: str = result.output
        return True, result_string
    except docker.errors.APIError as e:
        return False, str("")
