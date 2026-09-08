#!/usr/bin/env python3
"""
Promote a user to admin.

Usage:
    python3 scripts/promote_admin.py user@example.com

Replaces scripts/promoteAdmin.js. Reads the same .env file as the Node
server (MONGO_URI / MONGO_URL), so no extra configuration is needed.
"""
import os
import sys

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

# Load the .env that sits next to this script's parent folder (backend/.env)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/promote_admin.py user@example.com")
        return 1

    email = sys.argv[1].strip().lower()
    mongo_url = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")

    if not email or not mongo_url:
        print("Usage: python3 scripts/promote_admin.py user@example.com")
        print("(MONGO_URI or MONGO_URL must also be set in .env)")
        return 1

    client = MongoClient(mongo_url, tlsCAFile=certifi.where())
    try:
        db = client.get_default_database()
        users = db["users"]  # Mongoose pluralizes/lowercases the "User" model to "users"

        result = users.find_one_and_update(
            {"email": email},
            {"$set": {"role": "admin"}},
            return_document=True,
        )

        if not result:
            print(f"Failed to promote admin: No user found for {email}")
            return 1

        print(f"Promoted {result['email']} to admin.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
