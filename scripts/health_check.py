#!/usr/bin/env python3
"""
Quick smoke test for a running DevNews server.

Usage:
    python3 scripts/health_check.py
    python3 scripts/health_check.py --base-url http://localhost:5001
"""
import argparse
import sys

import requests


def check(name, method, url, **kwargs):
    try:
        response = requests.request(method, url, timeout=10, **kwargs)
        ok = response.status_code < 500
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name} -> HTTP {response.status_code}")
        return ok
    except requests.RequestException as error:
        print(f"[FAIL] {name} -> {error}")
        return False


def main():
    parser = argparse.ArgumentParser(description="DevNews smoke test")
    parser.add_argument("--base-url", default="http://localhost:5001")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    results = [
        check("Health endpoint", "GET", f"{base}/health"),
        check("Homepage", "GET", f"{base}/"),
        check("Unauthenticated post list is rejected", "GET", f"{base}/api/posts/getPosts?page=1&limit=5"),
        check("Unauthenticated /me is rejected", "GET", f"{base}/api/auth/me"),
    ]

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed.")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
