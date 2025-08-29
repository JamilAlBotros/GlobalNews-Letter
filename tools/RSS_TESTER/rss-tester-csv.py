# rss_validator.py
#
# Description:
# This script reads a CSV file containing URLs, checks if each URL
# points to a valid RSS feed, and writes the results back to the CSV
# in new columns.
#
# Required Libraries:
# - requests: To handle HTTP requests and check if URLs are accessible.
# - feedparser: To parse and validate the RSS feed content.
#
# Installation:
# You can install the required libraries using pip:
# pip install requests feedparser

import os
import re
import csv
import requests
from email import policy
from email.parser import BytesParser
from bs4 import BeautifulSoup
import feedparser

def check_rss_feed(url):
    """
    Checks if a given URL is a valid and accessible RSS feed.

    Args:
        url (str): The URL of the feed to check.

    Returns:
        tuple: A tuple containing a boolean (True if valid, False otherwise)
               and a status message (string).
    """
    # First, check if the URL is reachable.
    try:
        # Use a common user-agent to avoid being blocked by some sites.
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        response = requests.get(url, timeout=10, headers=headers)
        # Raise an exception for bad status codes (like 404 or 500)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        return False, f"URL Error: {e}"

    # If the URL is reachable, try to parse the content as a feed.
    feed = feedparser.parse(response.content)

    # feedparser sets a 'bozo' flag to 1 if the feed is malformed.
    # We also check if the feed has a version attribute and at least one entry,
    # which are strong indicators of a valid feed.
    if feed.bozo == 0 and hasattr(feed, 'version') and feed.version and len(feed.entries) > 0:
        return True, "Valid RSS Feed"
    elif hasattr(feed, 'version') and feed.version:
        # Sometimes a feed is valid but has no entries, or has a non-critical error (bozo=1)
        return True, "Potentially Valid RSS Feed (parsed, but might have issues or be empty)"
    else:
        # Provide the specific parsing error if available.
        error_message = feed.bozo_exception if hasattr(feed, 'bozo_exception') else "Unknown parsing error"
        return False, f"Not a valid RSS feed. Reason: {error_message}"

def process_csv_feeds(filename):
    """
    Reads a CSV file, validates each URL, and writes the results back
    to the same file with new columns for validation status and message.

    Args:
        filename (str): The path to the CSV file.
    """
    try:
        # --- Step 1: Read all data from the CSV into memory ---
        with open(filename, mode='r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            # Verify that the necessary 'URL' column exists.
            if 'URL' not in reader.fieldnames:
                print(f"Error: CSV file '{filename}' must contain a 'URL' column.")
                return
            
            # Store original fieldnames and all rows
            original_fieldnames = reader.fieldnames
            rows = list(reader)

        print(f"--- Starting RSS Feed Validation for {filename} ---\n")

        # --- Step 2: Process each row and add validation results ---
        for i, row in enumerate(rows):
            url = row.get('URL', '').strip()
            source = row.get('Source', 'N/A')

            print(f"({i+1}/{len(rows)}) Testing URL: {url} (Source: {source})")

            if not url:
                is_valid = False
                message = "SKIPPED (No URL provided)"
                print(f"  -> ❌ SKIPPED: No URL provided\n")
            else:
                is_valid, message = check_rss_feed(url)
                if is_valid:
                    print(f"  -> ✅ SUCCESS: {message}\n")
                else:
                    print(f"  -> ❌ FAILED: {message}\n")

            # Add new data to the row dictionary
            row['Validation Status'] = 'Valid' if is_valid else 'Invalid'
            row['Validation Message'] = message
            print("-" * 20)
            
        # --- Step 3: Write the updated data back to the CSV file ---
        # Define the new headers for the CSV file
        new_fieldnames = original_fieldnames + ['Validation Status', 'Validation Message']
        
        # Remove duplicates in case the script is run multiple times
        # by converting to a dict and back to a list
        new_fieldnames = list(dict.fromkeys(new_fieldnames))

        with open(filename, mode='w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=new_fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"--- ✅ All Done! The results have been saved to {filename} ---")

    except FileNotFoundError:
        print(f"Error: The file '{filename}' was not found.")
        print("Please ensure the CSV file is in the same directory as the script or provide the full path.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # --- CONFIGURATION ---
    # Set the name of your CSV file here.
    csv_to_process = 'feeds.csv'

    # --- SCRIPT EXECUTION ---
    process_csv_feeds(csv_to_process)
