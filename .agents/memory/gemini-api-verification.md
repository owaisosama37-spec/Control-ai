---
name: Gemini API generation verification
description: Why listing Gemini models is not sufficient to verify generation access.
---
Treat `models.list` as a credential and catalog check, not as proof that `generateContent` is available for a project. When listing succeeds but generation returns 404, verify generation with a current model before rotating keys repeatedly.

**Why:** On a newly created AI Studio project, model listing returned 200 and included Gemini 2.5 Flash, but generation on that model returned 404. A direct generation request to a newer model succeeded.

**How to apply:** For Gemini connection checks, use a current model and a small output budget; test actual generation rather than relying only on model-list access.