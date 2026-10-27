#!/usr/bin/env python3
"""Werkt agenda.ics (het agenda-abonnement) bij vanuit het document meta/agenda van de Wijnproeverij-app.

Gebruik: python3 tools/update_agenda.py meta-agenda.json
meta-agenda.json bevat {"sig","uid","ics"} zoals de app het schrijft.
- Het evenement met dezelfde uid wordt vervangen (of verwijderd als ics leeg is).
- Eerdere proefavonden blijven in de agenda staan (maximaal 30).
Schrijft agenda.ics en print "gewijzigd" of "ongewijzigd".
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "agenda.ics"
HEAD = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wijnproeverij//NL", "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH", "X-WR-CALNAME:🍷 Wijnproeverij", "X-APPLE-CALENDAR-COLOR:#8E1630", "COLOR:darkred", "X-WR-TIMEZONE:Europe/Amsterdam",
        "REFRESH-INTERVAL;VALUE=DURATION:PT3H", "X-PUBLISHED-TTL:PT3H"]

def events(text):
    return re.findall(r"BEGIN:VEVENT\r?\n.*?END:VEVENT", text or "", re.S)

def uid_of(ev):
    m = re.search(r"^UID:(.*?)\r?$", ev, re.M)
    return m.group(1).strip() if m else ""

def start_of(ev):
    m = re.search(r"^DTSTART:(\S+)", ev, re.M)
    return m.group(1) if m else ""

def main():
    doc = json.load(open(sys.argv[1], encoding="utf-8"))
    doc = doc.get("data", doc)
    uid, new_ics = str(doc.get("uid", "")), str(doc.get("ics", ""))
    old = OUT.read_bytes().decode("utf-8") if OUT.exists() else ""
    keep = [e for e in events(old) if uid_of(e) != uid]
    keep += [e for e in events(new_ics) if uid_of(e) == uid]
    keep = sorted(keep, key=start_of)[-30:]
    body = "\r\n".join(HEAD + [e.replace("\r\n", "\n").replace("\n", "\r\n") for e in keep] + ["END:VCALENDAR"]) + "\r\n"
    strip = lambda t: re.sub(r"^DTSTAMP:.*$", "", t, flags=re.M)
    if strip(body) == strip(old):
        print("ongewijzigd"); return
    OUT.write_text(body, encoding="utf-8", newline="")
    print("gewijzigd")

if __name__ == "__main__":
    main()
