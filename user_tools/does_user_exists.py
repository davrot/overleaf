import pymongo


def does_user_exists(email_to_find: str) -> bool:
    client = pymongo.MongoClient("overleafmongo", 27017)
    db = client.sharelatex
    users = db.users

    search_result = users.find_one({"email": email_to_find})
    if search_result is None:
        return False
    else:
        return True
