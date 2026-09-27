---
name: Gemini API generation verification
description: Why listing Gemini models is not sufficient to verify generation access.
---
Treat `models.list` as a credential and catalog check, not as proof that `generateContent` is available for a project. A one-word generation is only a smoke test, not proof that the application's longer review prompts work. When listing succeeds but generation returns 404, verify generation with a current model before rotating keys repeatedly.

**Why:** On a newly created AI Studio project, model listing returned 200 and included Gemini 2.5 Flash, but generation on that model returned 404. Later, a short “OK” request succeeded while representative architecture review and implementation-validation prompts returned upstream 503, including after a retry and an alternate model.

**How to apply:** For Gemini connection checks, use a current model and a small output budget. When claiming an application feature works, also test one synthetic representative prompt for that feature without project data. Limit retries on upstream overload and report provider unavailability rather than claiming the feature passed.