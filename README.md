# 🍷 Wijnproeverij

Samen blind wijn proeven met je vrienden: aan het rad draaien voor het thema, een datum en locatie prikken, wijnen scannen of kiezen, de vragenlijst invullen en zien wie het best proeft. Een kopie van de [Bierproeverij](https://unlucky89lj.github.io/Bierproeverij/), maar dan voor wijn.

**Open de app:** https://unlucky89lj.github.io/Wijnproeverij/

## Wat zit erin
- **Home, Proeven, Scannen, Uitslag, Tips, Kaart, Agenda en Wijnen**: zoals in de app op claude.ai.
- **Catalogus** met 865 wijnen uit 28 landen (`catalog.json`), met wijnhuis, streek, druiven, stijl, alcohol, indicatieve prijs en labels.
- **Meerdere proeverijen:** elke groep is een aparte proeverij met een eigen uitslag. Meedoen met een code, de beheerder laat je toe.
- **Op je beginscherm:** open de link in Safari of Chrome en kies *Zet op beginscherm*. Je krijgt het wijnglas-icoon.

## Voorbeeldmodus en database
Zolang `firebase-config.js` leeg is, draait de app in **voorbeeldmodus**: alles blijft op je eigen apparaat. De wijnapp gebruikt eigen verzamelingen (beginnend met `wijn_`), zodat je hetzelfde Firebase-project als de bierapp kunt gebruiken zonder dat bier en wijn elkaar raken. De regels staan in `firestore.rules`.

## Bestanden
| Bestand | Wat |
|---|---|
| `index.html` | de app |
| `firebase-config.js` | instellingen van de database |
| `firestore.rules` | beveiligingsregels voor de database |
| `backend.js` | koppeling met de database (of voorbeeldmodus) en het kiezen van een proeverij |
| `catalog.json` | de wijnlijst |
| `i18n.json` | vertalingen (EN, DE, FR, ES) |
| `manifest.webmanifest`, `sw.js`, `icons/` | app-icoon en werken als app op je telefoon |

## Agenda-abonnement
`agenda.ics` is het agenda-abonnement van de groep (https://unlucky89lj.github.io/Wijnproeverij/agenda.ics).
De app zet de volgende proefavond in het document `meta/agenda`; een geplande taak draait
`python3 tools/update_agenda.py <meta-agenda.json>` en pusht het bijgewerkte bestand.

Gemaakt en bijgehouden met Claude.
