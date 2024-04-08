# pip install email_validator
import imaplib
import json
import email.utils
from email_validator import validate_email, EmailNotValidError  # type: ignore


def check_mails(
    config_file: str = "config.json", delete_mails: bool = False
) -> list[dict]:
    result: list[dict] = []

    with open(config_file, "r") as file:
        setting: dict = json.load(file)

    with imaplib.IMAP4_SSL(
        host=setting["host"], port=setting["port"]
    ) as imap_connection:
        imap_connection.login(user=setting["user"], password=setting["password"])

        # open inbox
        response_open = imap_connection.select(mailbox="INBOX", readonly=False)
        assert response_open[0] == "OK"
        assert response_open[1] is not None
        assert response_open[1][0] is not None
        number_of_emails: int = int(response_open[1][0])

        if number_of_emails > 0:
            # We want to find all mails in the INBOX
            inbox_typ, inbox_data = imap_connection.search(None, "ALL")
            assert inbox_typ == "OK"
            # Browse through all emails
            for mail_id in inbox_data[0].split(b" "):
                assert mail_id is not None

                # Get the next email for processing
                email_typ, email_data = imap_connection.fetch(mail_id, "(RFC822)")
                assert email_typ == "OK"
                assert email_data is not None
                assert email_data[0] is not None
                assert email_data[0][1] is not None

                field_from: str | None = None
                field_to: str | None = None
                field_subject: str | None = None

                for segments in email_data[0][1].split(b"\r\n"):  # type: ignore
                    if segments.startswith(b"From:"):
                        field_from = segments.decode("utf-8")[6:]
                    if segments.startswith(b"To:"):
                        field_to = segments.decode("utf-8")[4:]
                    if segments.startswith(b"Subject:"):
                        field_subject = segments.decode("utf-8")[9:]
                item = {"from": field_from, "to": field_to, "subject": field_subject}
                result.append(item)

                if delete_mails:
                    imap_connection.store(mail_id, "+FLAGS", "\\Deleted")

        # The trash is emptied
        imap_connection.expunge()

        # close inbox
        imap_connection.close()

    return result


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
            except EmailNotValidError:
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

    return result
