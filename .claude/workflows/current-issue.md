# Current Issue: Supabase Schema + Sprint 1 Foundation

## Goal
Create Supabase database schema for Sprint 1 (auth, family, members, tasks, invitations), then build auth screens, family creation, member invitations, and task board.

## Status: IN PROGRESS — writing SQL schema

## Acceptance Criteria
- [ ] Tables: profiles, families, family_members, tasks, invitations
- [ ] Row-level security policies on all tables
- [ ] Auth screens (sign up / sign in)
- [ ] Family creation flow
- [ ] Member invitation by email
- [ ] Task board (create / assign / complete)

## Touched Files
- src/lib/supabase.ts
- src/store/auth.ts
- src/types/index.ts
- App.tsx

## Decisions
- Supabase RLS: families scoped by family_members join, not owner field alone
- Invitations use a random token (uuid); no magic-link dependency for v1

## Next Step
Run SQL schema in Supabase dashboard → then build auth screens
