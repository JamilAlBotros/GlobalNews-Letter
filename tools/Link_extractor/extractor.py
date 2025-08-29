import re
import quopri
import email
from email.utils import parseaddr
from urllib.parse import urlparse, unquote
import csv
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# ---------- Extract Links & From Name ----------
def extract_original_links(eml_file):
    """
    Extracts original root domain URLs from a .eml file by removing TLDR redirects.
    Returns From name + list of root domains.
    """
    with open(eml_file, "r", encoding="utf-8", errors="ignore") as f:
        msg = email.message_from_file(f)

    # Get the "From" display name
    from_name = parseaddr(msg.get("From", ""))[0] or parseaddr(msg.get("From", ""))[1]

    links = set()

    for part in msg.walk():
        if part.get_content_type() in ["text/plain", "text/html"]:
            payload = part.get_payload(decode=True)
            if payload:
                try:
                    content = payload.decode("utf-8", errors="ignore")
                except UnicodeDecodeError:
                    content = quopri.decodestring(payload).decode("utf-8", errors="ignore")

                # Find href="..."
                for match in re.findall(r'href=["\'](.*?)["\']', content):
                    url = match

                    # Remove TLDR tracking redirect
                    if "tracking.tldrnewsletter.com/CL0/" in url:
                        url = re.sub(r'^https?://tracking\.tldrnewsletter\.com/CL0/', '', url)
                        url = unquote(url)

                    # Extract root domain
                    parsed = urlparse(url)
                    if parsed.scheme and parsed.netloc:
                        root_url = f"{parsed.scheme}://{parsed.netloc}/"
                        links.add(root_url)

    return from_name, sorted(links)


# ---------- Morning Brew Link Extraction ----------
def extract_morningbrew_links(eml_file):
    """
    Extract all Morning Brew tracking links from a .eml file, fully handling
    quoted-printable encoding and soft line breaks. Returns From name + list of final URLs.
    """
    # Read the raw email content first to handle quoted-printable properly
    with open(eml_file, "r", encoding="utf-8", errors="ignore") as f:
        raw_content = f.read()
    
    # Parse the email for From field
    with open(eml_file, "rb") as f:
        msg = email.message_from_binary_file(f)
    
    from_name = parseaddr(msg.get("From", ""))[0] or parseaddr(msg.get("From", ""))[1]
    links = set()

    # Handle quoted-printable decoding on raw content
    # Remove soft line breaks (= at end of line)
    raw_content = raw_content.replace("=\r\n", "").replace("=\n", "")
    
    # Replace =3D with = to decode quoted-printable URLs
    raw_content = raw_content.replace("=3D", "=")
    
    # Look for all Morning Brew URLs (both link and links domains)
    all_mb_urls = re.findall(r'(https://[^\s\"<>]*morningbrew\.com[^\s\"<>]*)', raw_content)
    
    all_urls = set(all_mb_urls)
    
    for tracking_url in all_urls:
        # Skip image URLs and unsubscribe URLs
        if '/img/' in tracking_url or '/oc/' in tracking_url:
            continue
            
        if ('link.morningbrew.com/c/' in tracking_url or 
            'links.morningbrew.com/c/' in tracking_url):
            # This is a tracking URL, resolve it
            try:
                resp = requests.head(tracking_url, allow_redirects=False, timeout=10)
                final_url = resp.headers.get("Location")
                if final_url and final_url != tracking_url:
                    # Extract root domain from the final URL
                    parsed = urlparse(final_url)
                    if parsed.scheme and parsed.netloc:
                        root_url = f"{parsed.scheme}://{parsed.netloc}/"
                        links.add(root_url)
                else:
                    # If we can't resolve, skip it
                    continue
            except requests.RequestException:
                # If we can't resolve, skip it
                continue
        else:
            # Direct URL - extract root domain
            parsed = urlparse(tracking_url)
            if parsed.scheme and parsed.netloc:
                root_url = f"{parsed.scheme}://{parsed.netloc}/"
                links.add(root_url)

    return from_name, sorted(links)

# ---------- Website Summary ----------
def get_website_summary(url, timeout=5):
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return "Unable to fetch site"
        soup = BeautifulSoup(resp.text, "html.parser")
        og_desc = soup.find("meta", attrs={"property":"og:description"})
        if og_desc and og_desc.get("content"):
            return og_desc["content"].strip()
        meta_desc = soup.find("meta", attrs={"name":"description"})
        if meta_desc and meta_desc.get("content"):
            return meta_desc["content"].strip()
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        return "No description found"
    except Exception as e:
        return f"Error: {str(e)}"


# ---------- RSS Feed Detection ----------
def find_rss_feed(root_url, timeout=5):
    parsed = urlparse(root_url)
    if not parsed.scheme:
        root_url = "https://" + root_url
    common_paths = ["/feed/", "/rss/", "/rss.xml", "/feed.xml"]
    for path in common_paths:
        try:
            feed_url = root_url.rstrip("/") + path
            resp = requests.head(feed_url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and "xml" in resp.headers.get("Content-Type", ""):
                return feed_url
        except:
            continue
    try:
        resp = requests.get(root_url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        link_tag = soup.find("link", attrs={"type":"application/rss+xml"})
        if link_tag and link_tag.get("href"):
            rss_url = link_tag["href"]
            if rss_url.startswith("/"):
                rss_url = root_url.rstrip("/") + rss_url
            return rss_url
    except:
        pass
    return "No RSS feed found"


# ---------- Process EML Folder with Automatic Function Selection ----------
def process_eml_folder(folder_path, output_csv="all_links_with_rss.csv"):
    folder = Path(folder_path)
    all_rows = []

    for eml_file in folder.glob("*.eml"):
        # Read From field
        with open(eml_file, "r", encoding="utf-8", errors="ignore") as f:
            msg = email.message_from_file(f)
            from_name_field = parseaddr(msg.get("From", ""))[0].lower()

        # Decide which function to use
        from_full_field = msg.get("From", "").lower()
        if "tldr" in from_name_field:
            from_name, links = extract_original_links(eml_file)
        elif "morning brew" in from_name_field or "morningbrew" in from_full_field:
            from_name, links = extract_morningbrew_links(eml_file)
        else:
            # Default to TLDR function if unknown
            from_name, links = extract_original_links(eml_file)

        for link in links:
            rss_feed = find_rss_feed(link)
            all_rows.append([from_name, link, rss_feed])
            print(f"Processed {from_name} -> {link} | RSS: {rss_feed}")

    # Save CSV
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["From", "URL", "RSS Feed"])
        writer.writerows(all_rows)

    print(f"CSV saved: {output_csv}")
    print(f"Total links processed: {len(all_rows)}")
    print(f"Total emails processed: {len(list(folder.glob('*.eml')))}")


if __name__ == "__main__":
    eml_folder = "./emails"  # Replace with your folder path
    process_eml_folder(eml_folder)
