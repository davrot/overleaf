# pip install email_validator

import email.utils
from email_validator import validate_email  # type: ignore
import email_validator
import json


def process_emails(
    mail_to_process: list[dict],
    config_file: str = "allowed_domains.json",
    blocked_user_file: str = "blocked_users.json",
) -> list[dict]:

    result: list[dict] = []

    with open(config_file, "r") as file:
        allowed_domains: dict = json.load(file)

    with open(blocked_user_file, "r") as file:
        blocked_users: dict = json.load(file)

    for mail in mail_to_process:
        temp = email.utils.parseaddr(mail["from"])[1]
        if (temp != "") and (temp is not None):

            email_status: bool = False

            try:
                emailinfo = validate_email(temp, check_deliverability=False)
                email_status = True
                temp = emailinfo.normalized
            except email_validator.exceptions_types.EmailSyntaxError:
                email_status = False
            except email_validator.exceptions_types.EmailNotValidError:
                email_status = False

            domain_found = False
            if email_status:
                for domain in allowed_domains["allowed_domains"]:
                    if temp.endswith(domain):
                        domain_found = True

                if domain_found:
                    for blocked_user in blocked_users["blocked_users"]:
                        if temp == blocked_user:
                            domain_found = False

            if domain_found:
                from_validated_ab = email.utils.parseaddr(mail["from"])
                try:
                    from_validated = validate_email(
                        from_validated_ab[1], check_deliverability=False
                    )
                    result.append(
                        {
                            "from_a": from_validated_ab[0],
                            "from_b": from_validated.normalized,
                            "to": mail["to"],
                            "subject": mail["subject"],
                        }
                    )
                except email_validator.exceptions_types.EmailSyntaxError:
                    pass
                except email_validator.exceptions_types.EmailNotValidError:
                    pass

    return result
