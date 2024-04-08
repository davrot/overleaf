import pymongo
import datetime
import os
import pickle
import json


def get_activation_requests(remove_old_entries: bool = False) -> list[dict]:
    results: list[dict] = []

    filename = "last_run.pkl"

    with open("config_mail.json", "r") as file:
        config = json.load(file)

    now = datetime.datetime.now()

    client = pymongo.MongoClient("overleafmongo", 27017)
    db = client.sharelatex
    tokens = db.tokens

    continue_at_time = None
    if remove_old_entries:
        if os.path.exists(filename):
            with open(filename, "rb") as file:
                continue_at_time = pickle.load(file)

    query = {"expiresAt": {"$gt": now}}
    if continue_at_time is not None:
        query["createdAt"] = {"$gt": continue_at_time}

    newest = None
    for token in tokens.find(query):
        if newest is None:
            newest = token["createdAt"]
        elif token["createdAt"] > newest:
            newest = token["createdAt"]

    # Freeze time. We don't want to misshandle item that are newer than the last check
    if newest is not None:
        if "createdAt" in query:
            query["createdAt"] = {"$gt": continue_at_time, "$lte": newest}
        else:
            query["createdAt"] = {"$lte": newest}

        # Find unique user ids
        user_id_set = set()

        for token in tokens.find(query):
            user_id_set.add(token["data"]["user_id"])

        user_ids = list(user_id_set)

        # Store the time stamp for newest
        with open(filename, "wb") as file:
            pickle.dump(newest, file)

        for user_id in user_ids:
            new_query = query.copy()
            new_query["data.user_id"] = user_id

            newest_entry = None
            object_id = None

            for token in tokens.find(new_query):

                if newest_entry is None:
                    newest_entry = token["createdAt"]
                    object_id = token["_id"]
                elif token["createdAt"] > newest_entry:
                    newest_entry = token["createdAt"]
                    object_id = token["_id"]

            dataset_found = None

            profile = dict()
            if object_id is not None:
                dataset_found = tokens.find_one({"_id": object_id})
                extracted_user_id = dataset_found["data"]["user_id"]
                profile["email"] = dataset_found["data"]["email"]
                extracted_token = dataset_found["token"]
                profile["url_string"] = (
                    f"{config['overleafdomain']}/user/activate?token={extracted_token}&user_id={extracted_user_id}"
                )
                results.append(profile)

    return results
