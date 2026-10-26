CCM — Command Center Management
Deliverables package

1) CCM_AI_Implementation_Prompt.md
   Full implementation prompt to paste into the coding agent running inside the intended repository.
   It directs the agent to inspect the repo before changing anything, use the Medicalbay Calm Care design.md, build a production-grade app for Vercel + Supabase initially, keep a Docker/VPS path, research current provider docs, and verify every feature with tests.

2) CCM_Architecture_Presentation.html
   A 14-slide interactive HTML presentation. Keep this HTML file in the same folder as the two PNG files below, then open it in a modern browser. Use arrow keys or Previous/Next to navigate; Print / PDF opens the browser print dialog.

3) CCM_Dashboard_Concept.png
   Dashboard visual direction mockup (illustrative only; not live connected data).

4) CCM_Command_Center_Master_Map.png
   Single-page system map showing major modules, account-launcher architecture, data flow, security guardrails and deployment portability.

Important account-launch requirement:
CCM should open the precise platform/account destination in the user's existing browser profile so a valid provider session can be reused. A website cannot guarantee indefinite third-party login sessions or access other sites' cookies. The prompt specifies an extension/session-bridge design for deterministic same-profile launches, explicit handling for multiple profiles, short-lived signed launch tickets and test cases; it prohibits password/cookie harvesting or bypassing MFA/CAPTCHA.

Working title only: CCM — Command Center Management. Leave final product naming/branding for a later decision.
