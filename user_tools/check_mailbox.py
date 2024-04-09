import imaplib
import json


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
