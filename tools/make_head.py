"""Generate the SEO <head> block for every page. Run from the project root."""
import pathlib

BASE = "https://onedropndc.github.io"

TEMPLATE = """  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="author" content="Foysal Mahmud — Notre Dame College Batch 27, Group 11">
  <meta name="theme-color" content="#C8102E">
  <meta name="color-scheme" content="light">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{canonical}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Lifeline — Blood Donor Community">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="assets/icons/icon-512.png">
  <meta property="og:url" content="{canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{og_title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="assets/icons/icon-512.png">

  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32.png">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Lifeline">
  <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
  <link rel="stylesheet" href="assets/css/main.css">
"""

PAGES = {
    "donors.html": dict(
        title="Find a Blood Donor — Lifeline",
        desc="Search the Lifeline donor directory by blood group, district and distance. Filter for donors who are available right now and contact them directly.",
        og="Find a Blood Donor — Lifeline",
    ),
    "register.html": dict(
        title="Become a Blood Donor — Lifeline",
        desc="Register as a voluntary blood donor in under a minute. Your phone number stays hidden until a requester taps Show contact.",
        og="Become a Blood Donor — Lifeline",
    ),
    "emergency.html": dict(
        title="Emergency Blood Requests — Lifeline",
        desc="Post an emergency blood request with the patient's blood group, hospital and deadline, or browse live requests and offer to donate.",
        og="Emergency Blood Requests — Lifeline",
    ),
    "about.html": dict(
        title="About Lifeline — NDC Batch 27, Group 11",
        desc="Lifeline was built by students of Notre Dame College Batch 27, Group 11 and developed by Foysal Mahmud. See the mission, the blood compatibility chart and the team.",
        og="About Lifeline — NDC Batch 27, Group 11",
    ),
    "faq.html": dict(
        title="Blood Donation FAQ & Eligibility Guide — Lifeline",
        desc="Who can donate, how often, what to eat beforehand, and what happens at the blood bank. Clear answers for first-time donors in Bangladesh.",
        og="Blood Donation FAQ & Eligibility Guide — Lifeline",
    ),
    "privacy.html": dict(
        title="Privacy Policy, Terms & Contact — Lifeline",
        desc="What Lifeline stores, how donor phone numbers are protected, how to delete your listing, and how to reach the student team.",
        og="Privacy Policy, Terms & Contact — Lifeline",
    ),
    "admin.html": dict(
        title="Moderator Dashboard — Lifeline",
        desc="Restricted area for Lifeline moderators: verify donors, manage emergency requests and publish announcements.",
        og="Moderator Dashboard — Lifeline",
    ),
    "my-donor.html": dict(
        title="My Donor Profile — Lifeline",
        desc="Manage your Lifeline donor listing: update availability, log a donation and share your profile.",
        og="My Donor Profile — Lifeline",
    ),
    "offline.html": dict(
        title="You are offline — Lifeline",
        desc="Lifeline works offline once installed, but live requests need a connection.",
        og="You are offline — Lifeline",
    ),
}

for name, meta in PAGES.items():
    p = pathlib.Path(name)
    if not p.exists():
        print("skip (missing):", name)
        continue
    html = p.read_text(encoding="utf-8")
    start = html.find("  <!--HEAD-->")
    if start == -1:
        print("no placeholder:", name)
        continue
    end = html.find("  <!--/HEAD-->", start)
    if end == -1:
        print("no end marker:", name)
        continue
    head = TEMPLATE.format(
        title=meta["title"],
        desc=meta["desc"],
        og_title=meta["og"],
        canonical=f"{BASE}/{name if name != 'index.html' else ''}",
    )
    p.write_text(html[:start] + head + html[end + len("  <!--/HEAD-->"):], encoding="utf-8")
    print("head injected:", name)
