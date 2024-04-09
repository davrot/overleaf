import pymongo
import datetime
import os
import pickle
import email.utils
from email_validator import validate_email  # type: ignore
import email_validator


def process_invitations(remove_old_entries: bool = False):

    results: list[dict] = []

    filename = "last_run_invitations.pkl"

    now = datetime.datetime.now()

    client = pymongo.MongoClient("overleafmongo", 27017)
    db = client.sharelatex
    project_invites = db.projectInvites

    continue_at_time = None
    if remove_old_entries:
        if os.path.exists(filename):
            with open(filename, "rb") as file:
                continue_at_time = pickle.load(file)

    query = {"expires": {"$gt": now}}
    if continue_at_time is not None:
        query["createdAt"] = {"$gt": continue_at_time}

    newest = None
    for project_invite in project_invites.find(query):
        if newest is None:
            newest = project_invite["createdAt"]
        elif project_invite["createdAt"] > newest:
            newest = project_invite["createdAt"]

    # Freeze time. We don't want to misshandle item that are newer than the last check
    if newest is not None:
        if "createdAt" in query:
            query["createdAt"] = {"$gt": continue_at_time, "$lte": newest}
        else:
            query["createdAt"] = {"$lte": newest}

        # Find unique user ids
        user_id_set = set()

        for project_invite in project_invites.find(query):
            user_id_set.add(project_invite["email"])

        user_ids = list(user_id_set)

        # Store the time stamp for newest
        with open(filename, "wb") as file:
            pickle.dump(newest, file)

        for uid in user_ids:

            from_validated_ab = email.utils.parseaddr(uid)
            try:
                from_validated = validate_email(
                    from_validated_ab[1], check_deliverability=False
                )
                results.append(
                    {
                        "from_a": None,
                        "from_b": from_validated.normalized,
                        "to": None,
                        "subject": None,
                    }
                )
            except email_validator.exceptions_types.EmailSyntaxError:
                pass
            except email_validator.exceptions_types.EmailNotValidError:
                pass

    return results


print(process_invitations())
