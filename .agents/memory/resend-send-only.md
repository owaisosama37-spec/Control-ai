---
name: Resend send-only grants
description: Sender verification cannot always be checked through a connected Resend account
---
A connected Resend account may have a send-only API grant. Do not assume the connector can list domains or verify sender configuration.

**Why:** A read of the domains API returned a permission error stating that the key is restricted to sending. This does not prove the sender is unverified, only that the grant cannot inspect domain state.

**How to apply:** Ask for an explicitly approved, verified sender address, keep email disabled until it is configured, and report provider rejection from a deliberate test send without leaking response details. Do not broaden the connector scope just to enumerate domains.