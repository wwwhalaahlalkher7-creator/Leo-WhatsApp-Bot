# 🔒 LeoBot Competition — LOCKED SYSTEM

## Scope

This directory contains the complete LeoBot competition system for v1.31.0:

- `config.js` — approved competition economics, stages, timers and assistance costs.
- `question-bank.json` — large question bank and answer/option data.
- `engine.js` — contest state machine, player/group isolation, timers, answers and assistance rules.
- `history.js` — persistence for the competition history.
- `.سجل المسابقات.json` — the competition history store.

## Mandatory protection rule

**DO NOT MODIFY, DELETE, MOVE, RENAME, REFORMAT, REGENERATE, RESTRUCTURE OR REPLACE ANYTHING IN THIS DIRECTORY DURING UNRELATED WORK.**

The competition is intentionally isolated because it is the most complex economic/stateful system in LeoBot.

If another bug appears to require a change inside this directory:

1. Stop before changing it.
2. Explain exactly why the change is necessary.
3. Identify the exact file/function/rule that would be affected.
4. Obtain explicit approval from the project owner.
5. Only then make the approved change.
6. Preserve every previously approved rule and fix, or improve it without weakening or removing it.

No implicit approval is granted by a general request to fix the project.

## Non-negotiable rules

- One active competition per WhatsApp group.
- Only the user who started the active competition may interact with it.
- Other group members may continue using other LeoBot features normally.
- Answers and competition controls are accepted **only as replies to the current question message**.
- The normal question has no visible options.
- Options appear only after the basic options assistance is requested.
- Stage 1: 2 options.
- Stage 2: 4 options.
- Stage 3: 4 more deceptive/closely competing options.
- Stage 4: no options.
- The extra assistance is unavailable until basic options assistance has been used.
- Extra assistance is available only in stages 2 and 3 and removes exactly one wrong option.
- The correct option must never be eligible for removal.
- A question ID may not repeat inside one contest.
- Each question has a two-minute answer deadline.
- Answer timeout is a **loss**, not a voluntary leave, and uses the five-minute cooldown.
- At safe points the player has two minutes to choose whether to continue. No decision means withdrawal with the last guaranteed prize and a five-minute cooldown.
- Voluntary leave during an active question pays the reward reached by the last answered question and uses the fifteen-minute cooldown.
- The approved question costs and cumulative reward table must not be changed without explicit approval.
- The competition economy remains separate from the general LeoBot economy until the owner explicitly approves a later economy redesign.
