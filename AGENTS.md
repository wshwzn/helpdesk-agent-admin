# Repository Guidelines

## Project Scope

This repository is the standalone Vue administration frontend for `helpdesk-agent`. Do not inspect or modify sibling projects unless the user explicitly names them.

## Code Comments

Add a short Chinese JSDoc comment to every newly written method. Explain the business purpose in one or two sentences. Avoid line-by-line comments; add internal comments only for non-obvious authentication, upload, polling, or business rules. Prefer Chinese test names.

## Project Structure

- Keep API calls under `src/api/` and shared request/response types under `src/types/`.
- Put reusable UI in `src/components/` and route-level screens in `src/views/`.
- Use Vue 3 Composition API and TypeScript. Keep admin authorization checks in the auth store and router guard.

## Change Notes

After every implementation change, add or update a Chinese Markdown summary under `notes/`. Prefix new files with the next two-digit sequence number and a short Chinese topic. Include behavior, added and modified files, API impact, verification, and known limitations.

## Verification and Safety

Run `npm run test` and `npm run build` before committing. Never commit API keys, JWTs, `.env.local`, build output, logs, or `node_modules/`.

