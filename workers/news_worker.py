#!/usr/bin/env python3
"""
DevNews live ingestion worker.

Fetches tech articles from NewsAPI + DEV Community and inserts new ones
into the `posts` collection (same collection the Node app reads from).

Run once:
    python3 workers/news_worker.py --once

Run continuously (fetches immediately, then every hour on the hour,
matching the old node-cron '0 * * * *' schedule):
    python3 workers/news_worker.py

Replaces workers/news_worker.js. This is a separate OS process from the
Express server -- it is NOT imported by server.js, so the Node app starts
and runs completely independently of whether this script is running.
"""
import argparse
import os
import re
import time
from datetime import datetime, timezone

import requests
import certifi
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DEV_TO_TAGS = ["javascript", "react", "node", "webdev"]


def clean_title(title):
    return re.sub(r"\s+", " ", (title or "")).strip()


def fetch_newsapi():
    api_key = os.environ.get("NEWS_API_KEY")
    if not api_key:
        return []
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": "software engineering OR web development OR programming",
            "language": "en",
            "pageSize": 50,
            "sortBy": "publishedAt",
            "apiKey": api_key,
        }
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "error" or not isinstance(data.get("articles"), list):
            return []
        return [
            {
                "title": clean_title(article.get("title")),
                "link": article.get("url"),
                "source": (article.get("source") or {}).get("name") or "NewsAPI",
                "tag": ["technology"],
            }
            for article in data["articles"]
        ]
    except requests.RequestException as error:
        print(f"NewsAPI error: {error}")
        return []


def fetch_dev_to():
    seen_links = set()
    results = []
    for tag in DEV_TO_TAGS:
        try:
            response = requests.get(
                "https://dev.to/api/articles",
                params={"tag": tag, "per_page": 50},
                timeout=15,
            )
            response.raise_for_status()
            articles = response.json()
            if not isinstance(articles, list):
                continue
            for article in articles:
                link = article.get("url")
                if not link or link in seen_links:
                    continue
                seen_links.add(link)
                tag_list = article.get("tag_list")
                results.append({
                    "title": clean_title(article.get("title")),
                    "link": link,
                    "source": "DEV Community",
                    "tag": [str(t).lower() for t in tag_list[:10]] if isinstance(tag_list, list) else ["webdev"],
                })
        except requests.RequestException as error:
            print(f"Dev.to error (tag={tag}): {error}")
    return results


def fetch_all_live_news():
    print("News worker: fetching from live sources...")
    all_articles = [
        a for a in (fetch_newsapi() + fetch_dev_to())
        if a.get("title") and a["title"] != "[Removed]" and a.get("link")
    ]

    admin_id = os.environ.get("ADMIN_ID")
    if not admin_id or not ObjectId.is_valid(admin_id):
        print("ADMIN_ID is missing or invalid; live articles cannot be saved.")
        return {"addedCount": 0, "total": len(all_articles)}

    mongo_url = os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL")
    client = MongoClient(mongo_url, tlsCAFile=certifi.where())
    added_count = 0
    try:
        posts = client.get_default_database()["posts"]
        for article in all_articles:
            if posts.find_one({"link": article["link"]}, {"_id": 1}):
                continue
            try:
                now = datetime.now(timezone.utc)
                posts.insert_one({
                    **article,
                    "author": ObjectId(admin_id),
                    "clicks": 0,
                    "createdAt": now,
                    "updatedAt": now,
                })
                added_count += 1
            except DuplicateKeyError:
                pass
            except Exception as error:  # keep the loop going on a single bad article
                print(f"Article insert error: {error}")
    finally:
        client.close()

    print(f"News worker: added {added_count} new articles from {len(all_articles)} candidates.")
    return {"addedCount": added_count, "total": len(all_articles)}


def seconds_until_next_hour():
    now = datetime.now()
    return 3600 - (now.minute * 60 + now.second)


def main():
    parser = argparse.ArgumentParser(description="DevNews live ingestion worker")
    parser.add_argument("--once", action="store_true", help="Run a single sync and exit")
    args = parser.parse_args()

    fetch_all_live_news()
    if args.once:
        return

    while True:
        wait = seconds_until_next_hour()
        print(f"News worker: sleeping {wait}s until the next hourly run...")
        time.sleep(wait)
        fetch_all_live_news()


if __name__ == "__main__":
    main()
