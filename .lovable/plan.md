
User wants a comprehensive professional documentation document for their CRM website that they can paste into Google Docs. They want it in Bengali-English mix, conversational tone (not robotic), with diagrams, tables, and full handover-ready content.

Best format: `.docx` file (Google Docs imports .docx perfectly preserving headings, tables, formatting). User said "Google Docs এ directly paste করে use করা যাবে" — a .docx file uploaded to Drive opens natively in Google Docs.

I have full project context from memory files and codebase exploration done in prior turns. Key facts:
- Project: NH Production House CRM (Lead Management)
- Stack: Vite + React 18 + TypeScript + Tailwind + shadcn/ui + Supabase (Lovable Cloud)
- Auth: Supabase Auth with RBAC (admin/manager/user/viewer)
- Features: Leads CRUD, Bulk actions, Email Verification (MillionVerifier via mv-proxy edge function), Folders/Industries, Client Communications, Workforce tracking, API Dashboard, Google Drive backup, Dark mode
- Edge functions: create-user, mv-proxy, seed-admin
- Branding: NASIR HUSSAIN, minimalist dark mode, framer-motion
- DB: leads, profiles, user_roles, email_verification_cache (RLS disabled intentionally)
- Live: shortcaptionbangla.com & kindred-leads-app.lovable.app

Plan: Generate a professional .docx using docx-js skill. Include all 9 sections user requested but tailored to ACTUAL stack (not the example Next.js/MongoDB stack — replace with Vite/Supabase reality). Mermaid diagrams will be embedded as code blocks (Google Docs shows them as text; user can paste into mermaid.live separately — that's standard practice). Conversational Banglish tone like a senior dev handover note.

## Plan

**Deliverable**: A single `.docx` file at `/mnt/documents/NH_CRM_Documentation_v1.0.docx` ready to upload to Google Drive → opens in Google Docs with formatting intact.

**Content structure** (all 9 sections, Banglish conversational tone):

1. **Introduction** — Project purpose (CRM for lead management), target users (sales/admin team), business goal, history, current status (live URLs), team info
2. **Technology Stack** — Table with ACTUAL stack: Vite, React 18, TypeScript, Tailwind, shadcn/ui, Supabase (Lovable Cloud), Edge Functions (Deno), framer-motion, TanStack Query, React Router, MillionVerifier API, Google Drive OAuth — with "why chosen" + alternatives. Plus deployment flow Mermaid diagram.
3. **Features (in-depth)** — Each major feature: Auth & RBAC, Leads CRUD with sequential 1000-row batching, Bulk Actions (status/folder/verify/delete with portal dropdowns), Email Verification (mv-proxy edge function), Folders & Industries, Client Communications, Workforce tracking, API Dashboard, Google Drive backup, Dark mode. With code paths, user flows, edge cases.
4. **Setup & Local Dev** — Clone, bun install, .env auto-managed by Lovable, Supabase connection details, run instructions, common issues table.
5. **Deployment & Maintenance** — Lovable publish flow, custom domain (shortcaptionbangla.com), Supabase dashboard access via Lovable Cloud, monitoring, backup strategy, monthly checklist.
6. **APIs & DB Schema** — Edge functions table (create-user, mv-proxy, seed-admin) with method/path/purpose. DB tables (leads, profiles, user_roles, email_verification_cache, folders, industries, client_communications) with column definitions. Important note: RLS intentionally disabled.
7. **Sensitive Information** — Bootstrap admin creds, Supabase project ref, env vars (auto-managed), MillionVerifier API key location, Google Drive OAuth credentials, security notes.
8. **Troubleshooting & Support** — Common errors (legacy API keys disabled, edge function errors, 1000-row limit, CORS), debugging via Lovable Cloud, contact info.
9. **Future Improvements** — Re-enable RLS for production hardening, AI lead scoring (Lovable AI Gateway), mobile PWA, advanced analytics, real-time collaboration improvements.

Plus: Update Log table at end (v1.0 — initial release, current date).

**Diagrams** (Mermaid code blocks embedded as monospace text — user copies to mermaid.live or Google Docs Mermaid add-on):
- Deployment flow (Lovable → Supabase → CDN)
- Auth flow (login → Supabase Auth → role fetch → app)
- Lead create flow (UI → Supabase client → DB → realtime broadcast)
- Email verification flow (UI → mv-proxy edge function → MillionVerifier API → cache)

**Tone**: Conversational Banglish like "Bhai, eta kheyal rakhbe je..." — natural senior dev handover style, not corporate AI-generated.

**Tech approach**:
- Use docx-js (Node) following the docx skill
- US Letter, 1" margins, Arial 12pt body, proper heading styles with outline levels
- Tables with DXA widths (sum-matched)
- Bullet lists via `LevelFormat.BULLET` numbering config (no unicode bullets)
- Code blocks as Courier New paragraphs with light gray shading
- Mermaid blocks rendered as Courier New monospace inside bordered cells
- Footer with page numbers
- TOC at start
- Validate with `validate_document.py`, then QA by converting first 3 pages to images

**Steps**:
1. Write `/tmp/gen_docs.js` using docx-js with all 9 sections
2. Run with node, output to `/mnt/documents/NH_CRM_Documentation_v1.0.docx`
3. Validate with skill's validator
4. Convert to PDF + first few pages to images for QA, fix any layout issues
5. Emit `<lov-artifact>` tag

**Length target**: ~15-18 pages (within user's 20-page max)

After approval, switch to default mode and execute.
