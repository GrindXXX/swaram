"""
Shared email de-obfuscation for government sites that hide addresses as
name[at]domain[dot]tld — sometimes with [dot] inside the local part too
(e.g. "mohana[dot]kumari1980[at]ka[dot]gov[dot]in") and sometimes with
multiple domain labels (e.g. "bwssb[dot]gov[dot]in").

A regex that tries to capture "local[at]domain[dot]tld" in one pass breaks
on both of those — it only consumes one [dot] segment after [at], silently
truncating "chairman@bwssb.gov.in" down to "chairman@bwssb.gov". The fix is
to do a blind text substitution first, then extract a normal email pattern
from the result — order matters less than covering every [dot]/[at].
"""

import re

_AT = re.compile(r"\[\s*at\s*\]", re.IGNORECASE)
_DOT = re.compile(r"\[\s*dot\s*\]", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def deobfuscate_email(text: str) -> str:
    cleaned = _DOT.sub(".", _AT.sub("@", text))
    m = _EMAIL.search(cleaned)
    return m.group(0) if m else ""
