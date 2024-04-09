import smtplib
from email.message import EmailMessage


def send_mail(
    email_body: str,
    email_subject: str,
    email_from: str,
    email_to: str,
    smtpd_host: str = "overleafsmtpd",
):

    msg = EmailMessage()
    msg.set_content(email_body.decode("utf-8"))
    msg["Subject"] = email_subject
    msg["From"] = email_from
    msg["To"] = email_to

    s = smtplib.SMTP(smtpd_host)
    s.send_message(msg)
    s.quit()
