import pymongo

container_name:str = "overleafmongo"
port: int = 27017

client = pymongo.MongoClient(container_name, port)
db = client.sharelatex
users = db.projectInvites

cursor = users.find()

for user in cursor:
    print(user['email'])

client.close()



