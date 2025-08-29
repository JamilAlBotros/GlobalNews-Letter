import re
import quopri
import email
from urllib.parse import unquote
import csv
import os
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time


def extract_original_links(eml_file):
    """Extracts original URLs from a .eml file by removing tracking redirects."""
    with open(eml_file, "r", encoding="utf-8", errors="ignore") as f:
        msg = email.message_from_file(f)

    links = set()

    for part in msg.walk():
        if part.get_content_type() in ["text/plain", "text/html"]:
            payload = part.get_payload(decode=True)
            if payload:
                try:
                    content = payload.decode("utf-8", errors="ignore")
                except UnicodeDecodeError:
                    content = quopri.decodestring(payload).decode("utf-8", errors="ignore")

                for match in re.findall(r'href=["\'](.*?)["\']', content):
                    url = match

                    # Remove tracking redirects
                    if "tracking.tldrnewsletter.com" in url or "CL0/https" in url:
                        start = url.find("https%3A")
                        if start == -1:
                            start = url.find("https:")
                        if start != -1:
                            url = unquote(url[start:])

                    links.add(url)

    return sorted(links)


def append_links_to_csv(eml_file, output_csv="all_extracted_links.csv"):
    """Extract links from one .eml file and append them into a CSV."""
    links = extract_original_links(eml_file)

    with open(output_csv, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for link in links:
            writer.writerow([os.path.basename(eml_file), link])

    print(f"📧 {os.path.basename(eml_file)} → {len(links)} links saved.")


class EmailHandler(FileSystemEventHandler):
    """Watches for new .eml files and processes them."""

    def __init__(self, output_csv):
        self.output_csv = output_csv
        # Ensure CSV has headers
        if not os.path.exists(self.output_csv):
            with open(self.output_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Email File", "Original Link"])

    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(".eml"):
            time.sleep(1)  # small delay to ensure file is fully written
            append_links_to_csv(event.src_path, self.output_csv)


def watch_eml_folder(folder_path="./emails", output_csv="all_extracted_links.csv"):
    """Watch a folder for new .eml files and auto-update CSV."""
    event_handler = EmailHandler(output_csv)
    observer = Observer()
    observer.schedule(event_handler, folder_path, recursive=False)
    observer.start()
    print(f"👀 Watching folder: {folder_path}")
    print(f"📂 Links will be added to {output_csv}\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    folder = "./emails"  # put your .eml files here
    watch_eml_folder(folder, "all_extracted_links.csv")
